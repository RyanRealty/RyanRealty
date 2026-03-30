import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Cron-triggered optimization loop: analyze site health, data quality,
 * sync freshness, and configuration completeness.
 * Writes structured findings to optimization_runs table.
 *
 * Call with Authorization: Bearer CRON_SECRET.
 *
 * Schedule (Vercel Cron): weekly or daily depending on preference.
 */

interface HealthCheck {
  category: 'data-quality' | 'sync-health' | 'configuration' | 'seo' | 'performance' | 'security'
  severity: 'info' | 'warning' | 'critical'
  finding: string
  suggestion?: string
}

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createClient(url, key)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ServiceSupabase = ReturnType<typeof createClient<any>>

async function checkSyncFreshness(supabase: ServiceSupabase): Promise<HealthCheck[]> {
  const checks: HealthCheck[] = []

  // Check last sync timestamp
  const { data: cursor } = await supabase
    .from('sync_cursor')
    .select('last_completed_at, cron_enabled')
    .limit(1)
    .maybeSingle()

  if (cursor?.last_completed_at) {
    const lastSync = new Date(cursor.last_completed_at)
    const hoursAgo = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60)

    if (hoursAgo > 48) {
      checks.push({
        category: 'sync-health',
        severity: 'critical',
        finding: `Last sync was ${Math.round(hoursAgo)} hours ago (more than 48h stale)`,
        suggestion: 'Check Vercel cron configuration and Spark API connectivity',
      })
    } else if (hoursAgo > 24) {
      checks.push({
        category: 'sync-health',
        severity: 'warning',
        finding: `Last sync was ${Math.round(hoursAgo)} hours ago`,
        suggestion: 'Monitor sync health — approaching staleness threshold',
      })
    } else {
      checks.push({
        category: 'sync-health',
        severity: 'info',
        finding: `Sync is fresh (last completed ${Math.round(hoursAgo)}h ago)`,
      })
    }
  } else {
    checks.push({
      category: 'sync-health',
      severity: 'warning',
      finding: 'No sync cursor found — sync may never have run',
      suggestion: 'Run initial sync via admin or cron',
    })
  }

  if (cursor && !cursor.cron_enabled) {
    checks.push({
      category: 'sync-health',
      severity: 'warning',
      finding: 'Sync cron is disabled',
      suggestion: 'Enable sync cron via admin panel when ready',
    })
  }

  return checks
}

async function checkListingHealth(supabase: ServiceSupabase): Promise<HealthCheck[]> {
  const checks: HealthCheck[] = []

  // Count active listings
  const { count: activeCount } = await supabase
    .from('listings')
    .select('listing_key', { count: 'exact', head: true })
    .or('StandardStatus.is.null,StandardStatus.ilike.%Active%')

  // Count total listings
  const { count: totalCount } = await supabase
    .from('listings')
    .select('listing_key', { count: 'exact', head: true })

  if (activeCount !== null && totalCount !== null) {
    const activeRatio = totalCount > 0 ? (activeCount / totalCount) * 100 : 0

    checks.push({
      category: 'data-quality',
      severity: 'info',
      finding: `${activeCount} active listings out of ${totalCount} total (${activeRatio.toFixed(1)}% active)`,
    })

    if (activeCount === 0) {
      checks.push({
        category: 'data-quality',
        severity: 'critical',
        finding: 'Zero active listings in database',
        suggestion: 'Run a full sync to populate listings',
      })
    }
  }

  // Check for listings with no photos
  const { count: noPhotos } = await supabase
    .from('listings')
    .select('listing_key', { count: 'exact', head: true })
    .or('StandardStatus.is.null,StandardStatus.ilike.%Active%')
    .is('photos', null)

  if (noPhotos !== null && noPhotos > 0 && activeCount !== null && activeCount > 0) {
    const pct = ((noPhotos / activeCount) * 100).toFixed(1)
    if (noPhotos > activeCount * 0.1) {
      checks.push({
        category: 'data-quality',
        severity: 'warning',
        finding: `${noPhotos} active listings (${pct}%) have no photos`,
        suggestion: 'Check sync pipeline photo ingestion',
      })
    }
  }

  return checks
}

async function checkMarketDataFreshness(supabase: ServiceSupabase): Promise<HealthCheck[]> {
  const checks: HealthCheck[] = []

  // Check market_pulse_live freshness
  const { data: pulse } = await supabase
    .from('market_pulse_live')
    .select('updated_at')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (pulse?.updated_at) {
    const hoursAgo = (Date.now() - new Date(pulse.updated_at).getTime()) / (1000 * 60 * 60)
    if (hoursAgo > 48) {
      checks.push({
        category: 'data-quality',
        severity: 'warning',
        finding: `Market pulse data is ${Math.round(hoursAgo)}h old`,
        suggestion: 'Market pulse should refresh after each sync cycle',
      })
    } else {
      checks.push({
        category: 'data-quality',
        severity: 'info',
        finding: `Market pulse data is fresh (${Math.round(hoursAgo)}h old)`,
      })
    }
  }

  return checks
}

function checkConfiguration(): HealthCheck[] {
  const checks: HealthCheck[] = []

  const configChecks: Array<{ key: string; label: string; severity: HealthCheck['severity'] }> = [
    { key: 'GOOGLE_GA4_PROPERTY_ID', label: 'GA4 Data API', severity: 'info' },
    { key: 'GOOGLE_SEARCH_CONSOLE_SITE_URL', label: 'Search Console', severity: 'info' },
    { key: 'NEXT_PUBLIC_ADSENSE_CLIENT_ID', label: 'AdSense', severity: 'info' },
    { key: 'SENTRY_DSN', label: 'Sentry error tracking', severity: 'warning' },
    { key: 'RESEND_API_KEY', label: 'Resend email', severity: 'info' },
    { key: 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY', label: 'Google Maps', severity: 'warning' },
    { key: 'SPARK_API_KEY', label: 'Spark MLS API', severity: 'critical' },
    { key: 'FOLLOWUPBOSS_API_KEY', label: 'Follow Up Boss CRM', severity: 'warning' },
    { key: 'UPSTASH_REDIS_REST_URL', label: 'Rate limiting (Upstash)', severity: 'info' },
  ]

  const configured: string[] = []
  const missing: string[] = []

  for (const check of configChecks) {
    if (process.env[check.key]?.trim()) {
      configured.push(check.label)
    } else {
      missing.push(check.label)
      checks.push({
        category: 'configuration',
        severity: check.severity,
        finding: `${check.label} not configured (${check.key})`,
        suggestion: `Set ${check.key} in environment variables. See .env.example for details.`,
      })
    }
  }

  if (configured.length > 0) {
    checks.push({
      category: 'configuration',
      severity: 'info',
      finding: `${configured.length} integrations configured: ${configured.join(', ')}`,
    })
  }

  return checks
}

async function checkLeadPipelineHealth(supabase: ServiceSupabase): Promise<HealthCheck[]> {
  const checks: HealthCheck[] = []

  // Check recent inquiries
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { count: recentInquiries } = await supabase
    .from('listing_inquiries')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', weekAgo)

  if (recentInquiries !== null) {
    checks.push({
      category: 'data-quality',
      severity: 'info',
      finding: `${recentInquiries} listing inquiries in the last 7 days`,
    })
  }

  // Check saved searches
  const { count: savedSearches } = await supabase
    .from('saved_searches')
    .select('id', { count: 'exact', head: true })

  if (savedSearches !== null) {
    checks.push({
      category: 'data-quality',
      severity: 'info',
      finding: `${savedSearches} total saved searches across all users`,
    })
  }

  return checks
}

export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getServiceSupabase()
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }

  // Run all health checks
  const allChecks: HealthCheck[] = []

  try {
    const [syncChecks, listingChecks, marketChecks, leadChecks] = await Promise.all([
      checkSyncFreshness(supabase),
      checkListingHealth(supabase),
      checkMarketDataFreshness(supabase),
      checkLeadPipelineHealth(supabase),
    ])

    allChecks.push(...syncChecks, ...listingChecks, ...marketChecks, ...leadChecks)
  } catch (e) {
    allChecks.push({
      category: 'data-quality',
      severity: 'warning',
      finding: `Some database checks failed: ${e instanceof Error ? e.message : 'unknown error'}`,
      suggestion: 'Check database connectivity and table existence',
    })
  }

  // Configuration checks (no DB needed)
  allChecks.push(...checkConfiguration())

  // Categorize results
  const findings = allChecks.map(c => `[${c.severity.toUpperCase()}] [${c.category}] ${c.finding}`)
  const suggestedChanges = allChecks
    .filter(c => c.suggestion)
    .map(c => `[${c.severity.toUpperCase()}] ${c.suggestion}`)

  const criticalCount = allChecks.filter(c => c.severity === 'critical').length
  const warningCount = allChecks.filter(c => c.severity === 'warning').length
  const infoCount = allChecks.filter(c => c.severity === 'info').length

  const summary = [
    `Optimization run at ${new Date().toISOString()}.`,
    `${allChecks.length} check(s): ${criticalCount} critical, ${warningCount} warning, ${infoCount} info.`,
    criticalCount > 0 ? 'ACTION REQUIRED: Critical issues detected.' : 'No critical issues.',
  ].join(' ')

  // Store results
  const { error } = await supabase.from('optimization_runs').insert({
    findings: findings.length ? findings : null,
    suggested_changes: suggestedChanges.length ? suggestedChanges : null,
    summary,
    metadata: {
      checks: allChecks,
      counts: { critical: criticalCount, warning: warningCount, info: infoCount },
    },
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    summary,
    counts: { critical: criticalCount, warning: warningCount, info: infoCount },
    findings: findings.length,
    suggested: suggestedChanges.length,
  })
}
