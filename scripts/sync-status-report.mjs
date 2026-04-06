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

/**
 * Use .ilike('StandardStatus', pattern) for terminal buckets — not .or('StandardStatus.ilike.%Withdrawn%').
 * PostgREST percent-decodes inside OR filter strings; `%Withdrawn%` breaks when chained with `.eq('history_finalized', true)`.
 */
const STATUS_ILIKE_PATTERNS = {
  closed: '%Closed%',
  expired: '%Expired%',
  withdrawn: '%Withdrawn%',
  canceled: '%Cancel%',
}

function formatError(error) {
  if (!error) return 'unknown error'
  const parts = [error.message, error.code, error.details, error.hint].filter(Boolean)
  return parts.length > 0 ? parts.join(' | ') : 'unknown error'
}

function omitTerminalQueryMeta(row) {
  const { queryErrors: _qe, ...rest } = row
  return rest
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

async function byStatus(pattern) {
  const base = () =>
    supabase.from('listings').select('ListingKey', { count: 'exact', head: true }).ilike('StandardStatus', pattern)
  const [totalRes, finalizedRes, verifiedRes] = await Promise.all([
    countMaybe(() => base(), `count total status ilike ${pattern}`),
    countMaybe(() => base().eq('history_finalized', true), `count finalized ${pattern}`),
    countMaybe(() => base().eq('history_verified_full', true), `count verified ${pattern}`),
  ])
  const t = totalRes.count ?? 0
  const f = finalizedRes.count ?? 0
  const v = verifiedRes.count ?? 0
  const queryErrors = [totalRes.error, finalizedRes.error, verifiedRes.error].filter(Boolean)
  if (v > f && t > 0 && queryErrors.length === 0) {
    queryErrors.push(
      `terminal bucket invariant: verified_full (${v}) > finalized (${f}) for pattern ${pattern} — check listings flags`
    )
  }
  return {
    total: t,
    finalized: f,
    verifiedFull: v,
    remaining: Math.max(0, t - f),
    finalizedUnverified: Math.max(0, f - v),
    queryErrors,
  }
}

async function main() {
  const targetYear = Number(argValue('year', '0') || '0')
  const [
    totalListingsRes,
    totalHistoryRowsRes,
    finalizedAllRes,
    verifiedAllRes,
    cursorRes,
    yearCursorRes,
    yearLogRes,
    stateRes,
    yearStatsRes,
    onMarketYearStatsRes,
    noListDateRes,
  ] = await Promise.all([
    countWithFallback(
      () => supabase.from('listings').select('ListingKey', { count: 'exact', head: true }),
      () => supabase.from('listings').select('ListingKey', { count: 'planned', head: true }),
      'count total listings'
    ),
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
    supabase
      .from('sync_cursor')
      .select(
        'phase, updated_at, run_started_at, run_history_rows, run_listings_upserted, paused, abort_requested, cron_enabled, error'
      )
      .eq('id', 'default')
      .maybeSingle(),
    supabase
      .from('sync_year_cursor')
      .select('current_year, phase, next_history_offset, total_listings, updated_at')
      .eq('id', 'default')
      .maybeSingle(),
    supabase
      .from('year_sync_log')
      .select('year, status, listings_upserted, history_inserted, listings_finalized, completed_at, error')
      .order('completed_at', { ascending: false, nullsFirst: false })
      .limit(6),
    supabase.from('sync_state').select('year_sync_matrix_cache').eq('id', 'default').maybeSingle(),
    supabase
      .from('listing_year_finalization_stats')
      .select('list_year, total_listings, finalized_listings, verified_full_listings')
      .order('list_year', { ascending: false }),
    supabase
      .from('listing_year_on_market_finalization_stats')
      .select('list_year, total_listings, finalized_listings, verified_full_listings')
      .order('list_year', { ascending: false }),
    countMaybe(
      () =>
        supabase
          .from('listings')
          .select('ListingKey', { count: 'exact', head: true })
          .is('ListDate', null)
          .is('OnMarketDate', null),
      'count listings missing list dates'
    ),
  ])

  const [closed, expired, withdrawn, canceled] = await Promise.all([
    byStatus(STATUS_ILIKE_PATTERNS.closed),
    byStatus(STATUS_ILIKE_PATTERNS.expired),
    byStatus(STATUS_ILIKE_PATTERNS.withdrawn),
    byStatus(STATUS_ILIKE_PATTERNS.canceled),
  ])
  const terminalBucketWarnings = [
    ...closed.queryErrors,
    ...expired.queryErrors,
    ...withdrawn.queryErrors,
    ...canceled.queryErrors,
  ].map((e) => (typeof e === 'string' ? e : formatError(e)))

  const totalListings = totalListingsRes.count ?? 0
  const totalHistoryRows = totalHistoryRowsRes.count
  const finalizedAll = finalizedAllRes.count ?? 0
  const verifiedAll = verifiedAllRes.count ?? 0
  const listingYearsBreakdown = []
  if (!yearStatsRes.error) {
    for (const r of yearStatsRes.data ?? []) {
      const total = Number(r.total_listings) || 0
      const finalized = Number(r.finalized_listings) || 0
      const verifiedFull = Number(r.verified_full_listings) || 0
      listingYearsBreakdown.push({
        year: r.list_year,
        total,
        finalized,
        verifiedFull,
        remaining: Math.max(0, total - finalized),
        finalizedUnverified: Math.max(0, finalized - verifiedFull),
        fullyFinalized: total > 0 && finalized === total,
      })
    }
  }

  const listingYearsOnMarketBreakdown = []
  const onMarketByYear = new Map()
  if (!onMarketYearStatsRes.error) {
    for (const r of onMarketYearStatsRes.data ?? []) {
      const yr = Number(r.list_year)
      const total = Number(r.total_listings) || 0
      const finalized = Number(r.finalized_listings) || 0
      const verifiedFull = Number(r.verified_full_listings) || 0
      onMarketByYear.set(yr, { total, finalized, verifiedFull })
      listingYearsOnMarketBreakdown.push({
        year: yr,
        total,
        finalized,
        verifiedFull,
        remaining: Math.max(0, total - finalized),
        finalizedUnverified: Math.max(0, finalized - verifiedFull),
        fullyFinalized: total > 0 && finalized === total,
      })
    }
  }

  const listingYearsWithoutDate = {
    totalListings: noListDateRes.count ?? 0,
    note: 'Rows where both ListDate and OnMarketDate are null',
  }

  const warnings = [
    totalListingsRes.error,
    totalHistoryRowsRes.error,
    finalizedAllRes.error,
    verifiedAllRes.error,
    yearStatsRes.error ? `listing year breakdown: ${formatError(yearStatsRes.error)}` : null,
    onMarketYearStatsRes.error
      ? `on-market year breakdown: ${formatError(onMarketYearStatsRes.error)}`
      : null,
    noListDateRes.error,
    ...terminalBucketWarnings,
  ].filter(Boolean)
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

  const yearsFinalization = yearSummary.map((y) => {
    const om = onMarketByYear.get(y.year)
    const total = om ? om.total : Number(y.supabaseListings ?? y.totalListings ?? 0) || 0
    const finalized = om ? om.finalized : Number(y.finalizedListings ?? 0) || 0
    const verifiedFull = om ? om.verifiedFull : null
    const remaining = Math.max(0, total - finalized)
    const finalizedPct = total > 0 ? Math.round((finalized / total) * 10000) / 100 : null
    return {
      year: y.year,
      totalListings: total,
      finalizedListings: finalized,
      verifiedFullListings: verifiedFull,
      remainingListings: remaining,
      finalizedPct,
      fullyFinalized: total > 0 ? remaining === 0 : false,
      runStatus: y.runStatus,
      runPhase: y.runPhase,
      lastSyncedAt: y.lastSyncedAt,
      processedListings: y.processedListings ?? 0,
      listingsFinalizedThisPass: y.listingsFinalized ?? 0,
      countsSource: om ? 'listing_year_on_market_finalization_stats' : 'matrix_cache_fallback',
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
      startSync: {
        path: '/api/cron/start-sync',
        purpose: 'clear blockers and kick all lanes',
      },
    },
    totals,
    metricQuality: {
      totalListingsCountMode: totalListingsRes.mode,
      historyRowsCountMode: totalHistoryRowsRes.mode,
    },
    statusByTerminal: {
      closed: omitTerminalQueryMeta(closed),
      expired: omitTerminalQueryMeta(expired),
      withdrawn: omitTerminalQueryMeta(withdrawn),
      canceled: omitTerminalQueryMeta(canceled),
    },
    warnings,
    cursors: {
      syncCursor: cursorRes.data ?? null,
      yearCursor: yearCursorRes.data ?? null,
    },
    lastRuns: {
      recentYearSync: yearLogRes.data ?? [],
    },
    yearSummary,
    yearsFinalization,
    yearsFinalizationNote:
      'Counts use listing_year_on_market_finalization_stats when available (OnMarketDate calendar year, same scope as year-by-year sync). processedListings and listingsFinalizedThisPass come from the matrix job state.',
    listingYearsBreakdown,
    listingYearsCohortNote:
      'Cohort year is the calendar year of coalesce(ListDate, OnMarketDate). This can differ from OnMarketDate-only counts when list date and on-market date fall in different years.',
    listingYearsOnMarketBreakdown,
    listingYearsOnMarketCohortNote:
      'OnMarketDate calendar year only. Aligns with Spark filters and sync-year-by-year. Compare to listingYearsBreakdown when diagnosing year mismatches.',
    listingYearsWithoutDate,
    recommendedActions: [
      {
        when: 'Start or restart all sync lanes',
        run: `curl -H "Authorization: Bearer $CRON_SECRET" "${siteUrl}/api/cron/start-sync"`,
      },
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
  console.log('\nYears finalized status (OnMarketDate year, matches year-by-year sync; newest shown):')
  for (const y of yearsFinalization) {
    const pct = y.finalizedPct == null ? 'n/a' : `${y.finalizedPct}%`
    const vf =
      typeof y.verifiedFullListings === 'number' ? `, strict-verified ${y.verifiedFullListings.toLocaleString()}` : ''
    const prog =
      y.runStatus === 'running' && y.totalListings > 0
        ? `, job processed ${y.processedListings.toLocaleString()}/${y.totalListings.toLocaleString()}`
        : ''
    console.log(
      `- ${y.year}: ${y.finalizedListings.toLocaleString()}/${y.totalListings.toLocaleString()} finalized (${pct}), remaining ${y.remainingListings.toLocaleString()}${vf}${prog} [${y.countsSource}]`
    )
  }
  console.log('\nListing year cohorts (calendar year of ListDate or OnMarketDate, newest first):')
  console.log(
    `Rows missing both ListDate and OnMarketDate: ${listingYearsWithoutDate.totalListings.toLocaleString()}`
  )
  for (const y of listingYearsBreakdown) {
    const tag = y.fullyFinalized ? 'fully finalized' : 'open'
    console.log(
      `- ${y.year}: ${y.finalized.toLocaleString()}/${y.total.toLocaleString()} finalized, ${y.verifiedFull.toLocaleString()} strict-verified, ${y.remaining.toLocaleString()} remaining [${tag}]`
    )
  }
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
