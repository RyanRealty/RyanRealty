/**
 * Performance pull: 48-hour window.
 *
 * Finds every marketing_brain_actions row with status='executed' whose
 * executed_at falls in the [48h-1h, 48h+1h] window relative to now, then
 * fetches per-platform post metrics and upserts them into content_performance.
 *
 * Auth: requires Authorization: Bearer $CRON_SECRET (standard Vercel cron header).
 *
 * Env vars required:
 *   CRON_SECRET                 -- Vercel cron auth secret
 *   NEXT_PUBLIC_SUPABASE_URL    -- Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY   -- service-role key (bypasses RLS)
 *   META_PAGE_ACCESS_TOKEN      -- Meta Graph API token (ig + fb metrics)
 *   X_CLIENT_ID / X_CLIENT_SECRET -- X OAuth app credentials
 *
 * Skipped platforms (OAuth not yet wired as of 2026-05-17):
 *   tt (TikTok), pinterest, threads, nextdoor
 *   These receive a performance_skipped sentinel row instead of an error.
 *
 * Seller-lead attribution stub:
 *   north_star_attributed_seller_leads is written as 0 by default.
 *   A follow-up cron reads FUB lead-source attribution and updates the count.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchMetaPostMetrics } from '@/lib/meta-graph'
import { fetchLinkedInPostMetrics } from '@/lib/linkedin'
import { fetchXPostMetrics } from '@/lib/x'
import { fetchGbpPostMetrics } from '@/lib/google-business-profile'
import { platformFetchCode } from '@/lib/marketing-brain/platform-fetch-code'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const WINDOW_HOURS = 48

type PlatformEntry = { platform: string; post_id: string }

async function fetchByPlatform(platform: string, postId: string): Promise<Record<string, unknown>> {
  // Normalize the published_to vocabulary first: publisher-sweep writes the
  // publish endpoint's long names ('instagram','facebook','google_business_profile')
  // but this switch dispatches on short codes. Without it every IG/FB post — the
  // only token-live platforms — stored {error:'unknown_platform'} instead of metrics.
  switch (platformFetchCode(platform)) {
    case 'ig':
      return (await fetchMetaPostMetrics(postId, 'ig')) as unknown as Record<string, unknown>
    case 'fb':
      return (await fetchMetaPostMetrics(postId, 'fb')) as unknown as Record<string, unknown>
    case 'linkedin':
      return (await fetchLinkedInPostMetrics(postId)) as unknown as Record<string, unknown>
    case 'x':
      return (await fetchXPostMetrics(postId)) as unknown as Record<string, unknown>
    case 'gbp':
      return (await fetchGbpPostMetrics(postId)) as unknown as Record<string, unknown>
    case 'tt':
    case 'youtube':
    case 'pinterest':
    case 'threads':
    case 'nextdoor':
      throw new Error(`platform_skipped:${platform}:oauth_not_wired`)
    default:
      throw new Error(`unknown_platform:${platform}`)
  }
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const windowStart = new Date(Date.now() - (WINDOW_HOURS + 1) * 3600 * 1000).toISOString()
  const windowEnd = new Date(Date.now() - (WINDOW_HOURS - 1) * 3600 * 1000).toISOString()

  const { data: actions, error: fetchError } = await supabase
    .from('marketing_brain_actions')
    .select('id, action_type, executor_response, executed_at, target')
    .eq('status', 'executed')
    .gte('executed_at', windowStart)
    .lte('executed_at', windowEnd)

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  const results: Array<{
    action_id: string
    platform: string
    post_id: string
    metrics?: Record<string, unknown>
    error?: string
    skipped?: boolean
  }> = []

  for (const action of actions ?? []) {
    const platformIds: PlatformEntry[] = action.executor_response?.published_to ?? []
    for (const { platform, post_id } of platformIds) {
      try {
        const metrics = await fetchByPlatform(platform, post_id)
        results.push({ action_id: action.id, platform, post_id, metrics })
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        results.push({ action_id: action.id, platform, post_id, error: msg, skipped: msg.startsWith('platform_skipped:') })
      }
    }
  }

  // The seller-lead-attribution cron stores attributed_lead_ids INSIDE
  // metrics_48h (the only column shared with this pull). If attribution lands
  // before this 48h pull, a naive overwrite would wipe it. Preserve any existing
  // attributed_lead_ids so the metric write is non-destructive to attribution.
  const existingAttributed = new Map<string, number[]>() // `${action_id}:${platform}` -> ids
  const actionIds = [...new Set(results.map((r) => r.action_id))]
  if (actionIds.length > 0) {
    const { data: existingRows } = await supabase
      .from('content_performance')
      .select('action_id, platform, metrics_48h')
      .in('action_id', actionIds)
    for (const row of existingRows ?? []) {
      const ids = (row.metrics_48h as Record<string, unknown> | null)?.attributed_lead_ids
      if (Array.isArray(ids) && ids.length > 0) {
        existingAttributed.set(`${row.action_id}:${row.platform}`, ids as number[])
      }
    }
  }

  for (const r of results) {
    let metricsPayload: Record<string, unknown>
    if (r.skipped) {
      metricsPayload = { performance_skipped: true, reason: 'oauth_not_wired', platform: r.platform }
    } else if (r.error) {
      metricsPayload = { error: r.error }
    } else {
      metricsPayload = r.metrics ?? {}
    }

    // Carry forward attribution written before this pull.
    const priorIds = existingAttributed.get(`${r.action_id}:${r.platform}`)
    if (priorIds) {
      metricsPayload = { ...metricsPayload, attributed_lead_ids: priorIds }
    }

    await supabase
      .from('content_performance')
      .upsert(
        {
          action_id: r.action_id,
          platform: r.platform,
          post_external_id: r.post_id,
          metrics_48h: metricsPayload,
          pulled_at: new Date().toISOString(),
          // north_star_attributed_seller_leads intentionally NOT set — owned by the seller-lead-attribution cron; setting it here clobbered attribution on every pull.
        },
        { onConflict: 'action_id,platform' }
      )
  }

  return NextResponse.json({ ok: true, window: '48h', processed: results.length })
}
