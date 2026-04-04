#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

function argValue(name, fallback = null) {
  const i = process.argv.findIndex((a) => a === `--${name}`)
  if (i === -1) return fallback
  return process.argv[i + 1] ?? fallback
}

const asJson = process.argv.includes('--json')
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://ryan-realty.com'
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl?.trim() || !serviceRole?.trim()) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRole)

const STATUS_FILTERS = {
  closed: 'StandardStatus.ilike.%Closed%',
  expired: 'StandardStatus.ilike.%Expired%',
  withdrawn: 'StandardStatus.ilike.%Withdrawn%',
  canceled: 'StandardStatus.ilike.%Cancel%',
}

function formatError(error) {
  if (!error) return 'unknown error'
  const parts = [error.message, error.code, error.details, error.hint].filter(Boolean)
  return parts.length > 0 ? parts.join(' | ') : 'unknown error'
}

async function countWithRetry(run, label, attempts = 5) {
  let lastErr = null
  for (let i = 0; i < attempts; i++) {
    const { count, error } = await run()
    if (!error) return count ?? 0
    lastErr = error
    await new Promise((r) => setTimeout(r, 200 * (i + 1)))
  }
  throw new Error(`${label}: ${formatError(lastErr)}`)
}

async function countExact(run, label) {
  return countWithRetry(run, label, 5)
}

async function countWithFallback(runExact, runFallback, label) {
  try {
    const count = await countWithRetry(runExact, `${label} exact`, 3)
    return { count, mode: 'exact', error: null }
  } catch (exactError) {
    try {
      const count = await countWithRetry(runFallback, `${label} fallback`, 2)
      return {
        count,
        mode: 'fallback',
        error: `${label}: exact failed (${exactError?.message ?? 'unknown'}), using fallback count`,
      }
    } catch (fallbackError) {
      return {
        count: null,
        mode: 'unavailable',
        error: `${label}: exact and fallback failed (${exactError?.message ?? 'unknown'} | ${fallbackError?.message ?? 'unknown'})`,
      }
    }
  }
}

async function countMaybe(run, label) {
  try {
    return { count: await countExact(run, label), error: null }
  } catch (error) {
    return { count: null, error: `${label}: ${error?.message ?? 'unknown error'}` }
  }
}

async function byStatus(orExpr) {
  const [totalRes, finalizedRes, verifiedRes] = await Promise.all([
    countMaybe(
      () => supabase.from('listings').select('ListingKey', { count: 'exact', head: true }).or(orExpr),
      `count total ${orExpr}`
    ),
    countMaybe(
      () => supabase.from('listings').select('ListingKey', { count: 'exact', head: true }).or(orExpr).eq('history_finalized', true),
      `count finalized ${orExpr}`
    ),
    countMaybe(
      () =>
        supabase
          .from('listings')
          .select('ListingKey', { count: 'exact', head: true })
          .or(orExpr)
          .eq('history_verified_full', true),
      `count verified ${orExpr}`
    ),
  ])
  const t = totalRes.count ?? 0
  const f = finalizedRes.count ?? 0
  const v = verifiedRes.count ?? 0
  return {
    total: t,
    finalized: f,
    verifiedFull: v,
    remaining: Math.max(0, t - f),
    finalizedUnverified: Math.max(0, f - v),
  }
}

async function main() {
  const targetYear = Number(argValue('year', '0') || '0')
  const [totalListings, totalHistoryRowsRes, finalizedAllRes, verifiedAllRes, cursorRes, yearCursorRes, stateRes] = await Promise.all([
    countExact(() => supabase.from('listings').select('ListingKey', { count: 'exact', head: true }), 'count total listings'),
    countWithFallback(
      () => supabase.from('listing_history').select('listing_key', { count: 'exact', head: true }),
      () => supabase.from('listing_history').select('listing_key', { count: 'planned', head: true }),
      'count listing_history'
    ),
    countMaybe(
      () => supabase.from('listings').select('ListingKey', { count: 'exact', head: true }).eq('history_finalized', true),
      'count history_finalized'
    ),
    countMaybe(
      () => supabase.from('listings').select('ListingKey', { count: 'exact', head: true }).eq('history_verified_full', true),
      'count history_verified_full'
    ),
    supabase.from('sync_cursor').select('phase, updated_at, run_started_at, error').eq('id', 'default').maybeSingle(),
    supabase
      .from('sync_year_cursor')
      .select('current_year, phase, next_history_offset, total_listings, updated_at')
      .eq('id', 'default')
      .maybeSingle(),
    supabase.from('sync_state').select('year_sync_matrix_cache').eq('id', 'default').maybeSingle(),
  ])

  const [closed, expired, withdrawn, canceled] = await Promise.all([
    byStatus(STATUS_FILTERS.closed),
    byStatus(STATUS_FILTERS.expired),
    byStatus(STATUS_FILTERS.withdrawn),
    byStatus(STATUS_FILTERS.canceled),
  ])

  const totalHistoryRows = totalHistoryRowsRes.count
  const finalizedAll = finalizedAllRes.count ?? 0
  const verifiedAll = verifiedAllRes.count ?? 0
  const warnings = [totalHistoryRowsRes.error, finalizedAllRes.error, verifiedAllRes.error].filter(Boolean)
  const totals = {
    totalListings,
    totalHistoryRows,
    historyFinalizedAll: finalizedAll,
    historyVerifiedFullAll: verifiedAll,
    historyFinalizedUnverifiedAll: Math.max(0, finalizedAll - verifiedAll),
    terminal: {
      total: closed.total + expired.total + withdrawn.total + canceled.total,
      finalized: closed.finalized + expired.finalized + withdrawn.finalized + canceled.finalized,
      verifiedFull: closed.verifiedFull + expired.verifiedFull + withdrawn.verifiedFull + canceled.verifiedFull,
      remaining:
        closed.remaining + expired.remaining + withdrawn.remaining + canceled.remaining,
      finalizedUnverified:
        closed.finalizedUnverified +
        expired.finalizedUnverified +
        withdrawn.finalizedUnverified +
        canceled.finalizedUnverified,
    },
  }

  const yearCache =
    stateRes.data?.year_sync_matrix_cache && typeof stateRes.data.year_sync_matrix_cache === 'object'
      ? stateRes.data.year_sync_matrix_cache
      : null
  const cacheRows = yearCache?.rows && typeof yearCache.rows === 'object' ? yearCache.rows : {}
  const yearKeys = Object.keys(cacheRows)
    .map((k) => Number(k))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => b - a)

  const yearSummary = (targetYear > 0 ? [targetYear] : yearKeys.slice(0, 10)).map((year) => {
    const r = cacheRows[String(year)] || {}
    return {
      year,
      runStatus: r.runStatus ?? 'idle',
      runPhase: r.runPhase ?? null,
      sparkListings: r.sparkListings ?? null,
      supabaseListings: r.supabaseListings ?? null,
      finalizedListings: r.finalizedListings ?? null,
      processedListings: r.processedListings ?? 0,
      totalListings: r.totalListings ?? 0,
      historyInserted: r.historyInserted ?? 0,
      listingsFinalized: r.listingsFinalized ?? 0,
      lastSyncedAt: r.lastSyncedAt ?? null,
      lastError: r.lastError ?? null,
    }
  })

  const payload = {
    generatedAt: new Date().toISOString(),
    lanes: {
      freshness: {
        path: '/api/cron/sync-delta',
        cadence: 'every 15 minutes',
      },
      parityChunk: {
        path: '/api/cron/sync-parity',
        cadence: 'manual or frequent cron',
      },
      yearBackfill: {
        path: '/api/cron/sync-year-by-year',
        strategy: 'newest year to oldest year',
      },
      terminalBackfill: {
        path: '/api/cron/sync-history-terminal',
      },
    },
    totals,
    metricQuality: {
      historyRowsCountMode: totalHistoryRowsRes.mode,
    },
    statusByTerminal: { closed, expired, withdrawn, canceled },
    warnings,
    cursors: {
      syncCursor: cursorRes.data ?? null,
      yearCursor: yearCursorRes.data ?? null,
    },
    yearSummary,
    recommendedActions: [
      {
        when: 'Keep data fresh',
        run: `curl -H "Authorization: Bearer $CRON_SECRET" "${siteUrl}/api/cron/sync-delta"`,
      },
      {
        when: 'Run one parity chunk (all lanes)',
        run: `curl -H "Authorization: Bearer $CRON_SECRET" "${siteUrl}/api/cron/sync-parity"`,
      },
      {
        when: 'Force one specific year chunk',
        run: `curl -H "Authorization: Bearer $CRON_SECRET" "${siteUrl}/api/cron/sync-year-by-year?year=2025"`,
      },
      {
        when: 'Strictly verify finalized-but-unverified listings',
        run: `curl -H "Authorization: Bearer $CRON_SECRET" "${siteUrl}/api/cron/sync-verify-full-history?limit=200"`,
      },
      {
        when: 'Open visual dashboard',
        run: `${siteUrl}/admin/sync`,
      },
    ],
  }

  if (asJson) {
    console.log(JSON.stringify(payload, null, 2))
    return
  }

  console.log('\nSync Status Snapshot')
  console.log('--------------------')
  console.log(`Generated: ${payload.generatedAt}`)
  console.log(`Total listings: ${totals.totalListings.toLocaleString()}`)
  console.log(
    `History rows: ${typeof totals.totalHistoryRows === 'number' ? totals.totalHistoryRows.toLocaleString() : 'unavailable'}`
  )
  console.log(`History finalized: ${totals.historyFinalizedAll.toLocaleString()}`)
  console.log(`History verified full: ${totals.historyVerifiedFullAll.toLocaleString()}`)
  console.log(`Finalized but unverified: ${totals.historyFinalizedUnverifiedAll.toLocaleString()}`)
  console.log(`Terminal remaining: ${totals.terminal.remaining.toLocaleString()}`)
  console.log('\nCurrent cursors:')
  console.log(`- sync_cursor: ${JSON.stringify(payload.cursors.syncCursor)}`)
  console.log(`- sync_year_cursor: ${JSON.stringify(payload.cursors.yearCursor)}`)
  console.log('\nRecommended commands:')
  for (const action of payload.recommendedActions) {
    console.log(`- ${action.when}:`)
    console.log(`  ${action.run}`)
  }
  if (warnings.length > 0) {
    console.log('\nWarnings:')
    for (const warning of warnings) console.log(`- ${warning}`)
  }
}

main().catch((err) => {
  console.error(err?.stack || String(err))
  process.exit(1)
})
