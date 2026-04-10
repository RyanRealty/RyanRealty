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

/**
 * PostgREST head+count=exact on listing_history often times out at multi-million rows.
 * Prefer DB RPC with extended statement_timeout; fall back to exact/planned count.
 */
async function countListingHistoryForReport(supabaseClient) {
  const { data, error: rpcError } = await supabaseClient.rpc('report_listing_history_row_count')
  if (!rpcError && data != null) {
    const n = typeof data === 'string' ? Number(data) : Number(data)
    if (Number.isFinite(n) && n >= 0) {
      return { count: n, mode: 'rpc_exact', error: null }
    }
  }
  return countWithFallback(
    () => supabaseClient.from('listing_history').select('listing_key', { count: 'exact', head: true }),
    () => supabaseClient.from('listing_history').select('listing_key', { count: 'planned', head: true }),
    'count listing_history'
  )
}

/**
 * PostgREST double .is(null) on listings can error at scale; use DB COUNT with a raised timeout.
 */
async function countListingsMissingBothDatesForReport(supabaseClient) {
  const { data, error: rpcError } = await supabaseClient.rpc('report_listings_missing_both_dates_count')
  if (!rpcError && data != null) {
    const n = typeof data === 'string' ? Number(data) : Number(data)
    if (Number.isFinite(n) && n >= 0) {
      return { count: n, mode: 'rpc_exact', error: null }
    }
  }
  return countWithFallback(
    () =>
      supabaseClient
        .from('listings')
        .select('ListingKey', { count: 'exact', head: true })
        .is('ListDate', null)
        .is('OnMarketDate', null),
    () =>
      supabaseClient
        .from('listings')
        .select('ListingKey', { count: 'planned', head: true })
        .is('ListDate', null)
        .is('OnMarketDate', null),
    'count listings missing both dates'
  )
}

function summarizeStrictVerifyRuns(runs, terminalStrictBacklog) {
  if (!runs || runs.length === 0) {
    return {
      status: 'unknown',
      summary:
        terminalStrictBacklog > 0
          ? 'No strict verify runs logged yet (apply migration or wait for cron).'
          : 'No strict verify runs logged; backlog clear.',
      minutesSinceLastRun: null,
      successRateLast10: null,
      avgMarkedVerifiedLast5: null,
      avgFetchFailuresLast5: null,
    }
  }
  const last = runs[0]
  const lastTs = new Date(last.completed_at).getTime()
  const minutesSinceLastRun = Number.isFinite(lastTs) ? Math.max(0, (Date.now() - lastTs) / 60000) : null
  const last10 = runs.slice(0, 10)
  const okCount = last10.filter((r) => r.ok && r.query_succeeded).length
  const successRateLast10 = last10.length > 0 ? Math.round((okCount / last10.length) * 1000) / 10 : null
  const last5 = runs.slice(0, 5)
  const avgMarkedVerifiedLast5 =
    last5.length > 0 ? Math.round((last5.reduce((s, r) => s + r.marked_verified, 0) / last5.length) * 10) / 10 : null
  const avgFetchFailuresLast5 =
    last5.length > 0 ? Math.round((last5.reduce((s, r) => s + r.fetch_failures, 0) / last5.length) * 10) / 10 : null

  if (terminalStrictBacklog === 0) {
    return {
      status: 'healthy',
      summary: 'Terminal strict verify backlog is clear.',
      minutesSinceLastRun,
      successRateLast10,
      avgMarkedVerifiedLast5,
      avgFetchFailuresLast5,
    }
  }
  if (minutesSinceLastRun != null && minutesSinceLastRun > 15) {
    return {
      status: 'stalled',
      summary: `No strict verify run in about ${Math.round(minutesSinceLastRun)} minutes with backlog remaining.`,
      minutesSinceLastRun,
      successRateLast10,
      avgMarkedVerifiedLast5,
      avgFetchFailuresLast5,
    }
  }
  if (!last.query_succeeded) {
    return {
      status: 'degraded',
      summary: last.error_message ? `Listing query failed: ${last.error_message}` : 'Listing query failed.',
      minutesSinceLastRun,
      successRateLast10,
      avgMarkedVerifiedLast5,
      avgFetchFailuresLast5,
    }
  }
  if (!last.ok) {
    return {
      status: 'degraded',
      summary: last.error_message ? `Run not ok: ${last.error_message}` : 'Run completed with ok=false.',
      minutesSinceLastRun,
      successRateLast10,
      avgMarkedVerifiedLast5,
      avgFetchFailuresLast5,
    }
  }
  if (last.processed > 5 && last.fetch_failures / last.processed > 0.25) {
    return {
      status: 'degraded',
      summary: `High fetch failure rate last run (${last.fetch_failures}/${last.processed}).`,
      minutesSinceLastRun,
      successRateLast10,
      avgMarkedVerifiedLast5,
      avgFetchFailuresLast5,
    }
  }
  if (successRateLast10 != null && successRateLast10 < 70 && last10.length >= 5) {
    return {
      status: 'degraded',
      summary: `Only ${successRateLast10}% of last ${last10.length} runs succeeded.`,
      minutesSinceLastRun,
      successRateLast10,
      avgMarkedVerifiedLast5,
      avgFetchFailuresLast5,
    }
  }
  return {
    status: 'healthy',
    summary: `Last batch verified ${last.marked_verified} listings (${last.fetch_failures} fetch failures).`,
    minutesSinceLastRun,
    successRateLast10,
    avgMarkedVerifiedLast5,
    avgFetchFailuresLast5,
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
    yearStatsRes,
    onMarketYearStatsRes,
    noListDateRes,
    strictVerifyRunsRes,
    syncStateRes,
    notFinalizedRes,
    activityEventsRes,
  ] = await Promise.all([
    countWithFallback(
      () => supabase.from('listings').select('ListingKey', { count: 'exact', head: true }),
      () => supabase.from('listings').select('ListingKey', { count: 'planned', head: true }),
      'count total listings'
    ),
    countListingHistoryForReport(supabase),
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
      .from('listing_year_finalization_stats')
      .select('list_year, total_listings, finalized_listings, verified_full_listings')
      .order('list_year', { ascending: false }),
    supabase
      .from('listing_year_on_market_finalization_stats')
      .select('list_year, total_listings, finalized_listings, verified_full_listings')
      .order('list_year', { ascending: false }),
    countListingsMissingBothDatesForReport(supabase),
    supabase
      .from('strict_verify_runs')
      .select(
        'completed_at, ok, query_succeeded, processed, marked_verified, fetch_failures, history_rows_inserted, limit_param, concurrency_param, year_filter, duration_ms, error_message'
      )
      .order('completed_at', { ascending: false })
      .limit(20),
    supabase.from('sync_state').select('last_delta_sync_at, updated_at').eq('id', 'default').maybeSingle(),
    countMaybe(
      () =>
        supabase.from('listings').select('ListingKey', { count: 'exact', head: true }).eq('is_finalized', false),
      'count listings is_finalized false'
    ),
    supabase
      .from('activity_events')
      .select('event_type')
      .gte('event_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(12000),
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
    countMode: noListDateRes.mode,
    note: 'Rows where both ListDate and OnMarketDate are null',
  }

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

  const strictRunsRaw = strictVerifyRunsRes.error ? [] : (strictVerifyRunsRes.data ?? [])
  const strictRuns = strictRunsRaw.map((r) => ({
    completed_at: r.completed_at,
    ok: Boolean(r.ok),
    query_succeeded: Boolean(r.query_succeeded),
    processed: Number(r.processed) || 0,
    marked_verified: Number(r.marked_verified) || 0,
    fetch_failures: Number(r.fetch_failures) || 0,
    history_rows_inserted: Number(r.history_rows_inserted) || 0,
    limit_param: r.limit_param ?? null,
    concurrency_param: r.concurrency_param ?? null,
    year_filter: r.year_filter ?? null,
    duration_ms: r.duration_ms ?? null,
    error_message: r.error_message ?? null,
  }))
  const strictVerifyRunHealth = summarizeStrictVerifyRuns(strictRuns, totals.terminal.finalizedUnverified)
  const backlogTerminal = totals.terminal.finalizedUnverified
  const avgMarked = strictVerifyRunHealth.avgMarkedVerifiedLast5
  const strictVerifyEtaMinutes =
    backlogTerminal > 0 && avgMarked != null && avgMarked > 0.05
      ? Math.round(backlogTerminal / avgMarked)
      : null
  const strictVerifyEtaNote =
    'Rough ETA assumes about one successful cron per minute and the average marked_verified from the last five logged runs. Spark failures, timeouts, or overlapping invocations change actual time.'

  const lastDeltaAt = syncStateRes.data?.last_delta_sync_at ?? null
  const lastDeltaTs = lastDeltaAt ? new Date(lastDeltaAt).getTime() : NaN
  const minutesSinceLastDeltaSuccess = Number.isFinite(lastDeltaTs)
    ? Math.max(0, (Date.now() - lastDeltaTs) / 60000)
    : null

  const activityByType = {}
  let activitySampleTotal = 0
  if (!activityEventsRes.error && activityEventsRes.data) {
    for (const row of activityEventsRes.data) {
      const t = row.event_type ?? 'unknown'
      activityByType[t] = (activityByType[t] ?? 0) + 1
      activitySampleTotal += 1
    }
  }

  let deltaHealth = 'unknown'
  if (lastDeltaAt == null) deltaHealth = 'unknown'
  else if (minutesSinceLastDeltaSuccess != null && minutesSinceLastDeltaSuccess <= 25) deltaHealth = 'current'
  else if (minutesSinceLastDeltaSuccess != null && minutesSinceLastDeltaSuccess <= 60) deltaHealth = 'lagging'
  else if (minutesSinceLastDeltaSuccess != null) deltaHealth = 'stale'

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
    strictVerifyRunsRes.error ? `strict_verify_runs: ${formatError(strictVerifyRunsRes.error)}` : null,
    strictVerifyRunHealth.status === 'stalled' ? `Strict verify stalled: ${strictVerifyRunHealth.summary}` : null,
    strictVerifyRunHealth.status === 'degraded' ? `Strict verify degraded: ${strictVerifyRunHealth.summary}` : null,
    syncStateRes.error ? `sync_state: ${formatError(syncStateRes.error)}` : null,
    notFinalizedRes.error ? `delta-eligible listing count: ${formatError(notFinalizedRes.error)}` : null,
    activityEventsRes.error ? `activity_events 24h sample: ${formatError(activityEventsRes.error)}` : null,
    lastDeltaAt == null ? 'last_delta_sync_at is null (delta may not have completed successfully yet)' : null,
    minutesSinceLastDeltaSuccess != null && minutesSinceLastDeltaSuccess > 50
      ? `Delta sync may be stale (last success about ${Math.round(minutesSinceLastDeltaSuccess)} min ago; production cron targets every 15 min)`
      : null,
  ].filter(Boolean)

  const onMarketYearRows = !onMarketYearStatsRes.error ? (onMarketYearStatsRes.data ?? []) : []
  const onMarketYearsSorted = onMarketYearRows
    .map((r) => Number(r.list_year))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => b - a)
  const summaryYearList = targetYear > 0 ? [targetYear] : onMarketYearsSorted.slice(0, 15)
  const yearSummary = summaryYearList.map((year) => ({
    year,
    runStatus: 'retired',
    runPhase: null,
    sparkListings: null,
    supabaseListings: null,
    finalizedListings: null,
    processedListings: 0,
    totalListings: 0,
    historyInserted: 0,
    listingsFinalized: 0,
    lastSyncedAt: null,
    lastError: null,
  }))

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
      countsSource: om ? 'listing_year_on_market_finalization_stats' : 'on_market_stats_missing',
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
      terminalBackfill: {
        path: '/api/cron/sync-history-terminal',
      },
      startSync: {
        path: '/api/cron/start-sync',
        purpose: 'clear blockers and kick full, terminal, and delta lanes',
      },
      strictVerify: {
        path: '/api/cron/sync-verify-full-history',
        cadence: 'see vercel.json production crons (continuous strict verification)',
      },
    },
    totals,
    activeListingFreshness: {
      reportNote:
        'Agents must summarize this block when the user asks about active listings, live inventory freshness, delta sync, price or status changes, or what is updating.',
      cronPath: '/api/cron/sync-delta',
      productionScheduleNote: 'Production schedule is in vercel.json (typically every 15 minutes).',
      lastDeltaSuccessAt: lastDeltaAt,
      minutesSinceLastDeltaSuccess,
      deltaHealth,
      counts: {
        deltaEligibleListings: notFinalizedRes.count ?? null,
        deltaEligibleNote:
          'Rows with is_finalized=false. The delta cron skips is_finalized=true forever. When Spark ModificationTimestamp advances, modified rows are fetched and upserted.',
      },
      activityEventsLast24h: {
        sampleRowsUsed: activitySampleTotal,
        byEventType: activityByType,
        note:
          'From activity_events where event_at is within the last 24 hours (emitted by sync-delta for new listings, price changes, status transitions). Capped at 12000 rows; if sampleRowsUsed equals 12000, distributions are a lower bound.',
      },
      pipeline: {
        keepActiveFresh:
          'sync-delta queries Spark for listings with ModificationTimestamp after last_delta_sync_at, upserts listing fields, records price_history and status_history, inserts activity_events, and may fix photos.',
        whenListingGoesTerminal:
          'Delta queues terminal rows that are not yet finalized, fetches Spark listing history (or price history fallback), runs auxiliary media sync, and when the fetch is fully successful sets history_finalized, history_verified_full, and is_finalized together (bounded per run).',
        terminalHistoryLanes:
          'sync-history-terminal and sync-parity still backfill terminal listing history for rows that need it outside delta.',
        strictVerifyBacklog:
          'Rows that are history_finalized but not history_verified_full (often older terminal inventory) are drained by sync-verify-full-history. See strictVerification.counts.terminalStrictVerifyBacklog.',
      },
    },
    strictVerification: {
      reportNote:
        'Agents must summarize this block whenever the user asks about sync status (including what is up with sync, where we are at with sync, sync health, etc.).',
      cronPath: '/api/cron/sync-verify-full-history',
      productionScheduleNote: 'Schedule and per-run limit are defined in vercel.json for production.',
      adminDashboardForLiveDeltas: `${String(siteUrl).replace(/\/$/, '')}/admin/sync`,
      definitions: {
        history_verified_full:
          'Set only after Spark listing history (or price history fallback) succeeds with full pagination, not partial pages.',
        terminalStrictVerifyBacklog:
          'Terminal status listings (closed, expired, withdrawn, canceled) that are history_finalized but not history_verified_full. This is what the strict verify cron processes first.',
      },
      counts: {
        allListingsHistoryVerifiedFull: totals.historyVerifiedFullAll,
        allListingsFinalizedNotStrictVerified: totals.historyFinalizedUnverifiedAll,
        terminalStrictVerifyBacklog: totals.terminal.finalizedUnverified,
        terminalHistoryVerifiedFull: totals.terminal.verifiedFull,
      },
      perTerminalFinalizedUnverified: {
        closed: closed.finalizedUnverified,
        expired: expired.finalizedUnverified,
        withdrawn: withdrawn.finalizedUnverified,
        canceled: canceled.finalizedUnverified,
      },
      runTelemetry: {
        tableReady: !strictVerifyRunsRes.error,
        tableError: strictVerifyRunsRes.error ? formatError(strictVerifyRunsRes.error) : null,
        health: strictVerifyRunHealth,
        recentRuns: strictRuns.slice(0, 10),
        etaMinutesRough: strictVerifyEtaMinutes,
        etaNote: strictVerifyEtaNote,
      },
    },
    metricQuality: {
      totalListingsCountMode: totalListingsRes.mode,
      historyRowsCountMode: totalHistoryRowsRes.mode,
      listingsMissingBothDatesCountMode: noListDateRes.mode,
      listingYearCohortStats:
        'materialized_views_refreshed_by_cron_/api/cron/refresh-listing-year-stats',
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
    yearSummary,
    yearsFinalization,
    yearsFinalizationNote:
      'OnMarketDate calendar year from listing_year_on_market_finalization_stats (materialized view; cron /api/cron/refresh-listing-year-stats). Year-by-year Spark chunk sync was removed; runStatus in yearSummary is retired. Use strictVerification for strict verify progress.',
    listingYearsBreakdown,
    listingYearsCohortNote:
      'Cohort year is the calendar year of coalesce(ListDate, OnMarketDate). This can differ from OnMarketDate-only counts when list date and on-market date fall in different years. Year tables read materialized views (refreshed about every 30 minutes), not live scans.',
    listingYearsOnMarketBreakdown,
    listingYearsOnMarketCohortNote:
      'OnMarketDate calendar year only. Compare to listingYearsBreakdown when diagnosing year mismatches.',
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
        when: 'Strictly verify finalized-but-unverified listings',
        run: `curl -H "Authorization: Bearer $CRON_SECRET" "${siteUrl}/api/cron/sync-verify-full-history?limit=200"`,
      },
      {
        when: 'Refresh listing year cohort stats (materialized views for reports)',
        run: `curl -H "Authorization: Bearer $CRON_SECRET" "${siteUrl}/api/cron/refresh-listing-year-stats"`,
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
    `History rows: ${typeof totals.totalHistoryRows === 'number' ? totals.totalHistoryRows.toLocaleString() : 'unavailable'} (${totalHistoryRowsRes.mode})`
  )
  console.log(`History finalized: ${totals.historyFinalizedAll.toLocaleString()}`)
  console.log(`History verified full: ${totals.historyVerifiedFullAll.toLocaleString()}`)
  console.log(`Finalized but unverified: ${totals.historyFinalizedUnverifiedAll.toLocaleString()}`)
  console.log(`Terminal remaining: ${totals.terminal.remaining.toLocaleString()}`)
  console.log('\nActive listing freshness (sync-delta, live inventory):')
  console.log(`  last_delta_sync_at: ${lastDeltaAt ?? 'null'}`)
  console.log(
    `  minutes since last delta success: ${minutesSinceLastDeltaSuccess == null ? 'n/a' : Math.round(minutesSinceLastDeltaSuccess)}`
  )
  console.log(`  delta health signal: ${deltaHealth}`)
  console.log(
    `  delta-eligible listings (is_finalized=false): ${notFinalizedRes.count == null ? 'unavailable' : Number(notFinalizedRes.count).toLocaleString()}`
  )
  console.log(`  activity_events last 24h (capped sample): ${activitySampleTotal.toLocaleString()} rows`)
  const topActivityTypes = Object.entries(activityByType).sort((a, b) => b[1] - a[1]).slice(0, 10)
  if (topActivityTypes.length > 0) {
    console.log(`  top event types: ${topActivityTypes.map(([k, v]) => `${k}=${v}`).join(', ')}`)
  }
  console.log('\nStrict verification (Spark full pagination, sync-verify-full-history cron):')
  console.log(`  All listings verified full: ${totals.historyVerifiedFullAll.toLocaleString()}`)
  console.log(`  All listings finalized but not strict verified: ${totals.historyFinalizedUnverifiedAll.toLocaleString()}`)
  console.log(`  Terminal strict verify backlog: ${totals.terminal.finalizedUnverified.toLocaleString()}`)
  console.log(`  Terminal verified full: ${totals.terminal.verifiedFull.toLocaleString()}`)
  console.log(`  Live deltas: ${String(siteUrl).replace(/\/$/, '')}/admin/sync`)
  if (strictVerifyRunsRes.error) {
    console.log(`  strict_verify_runs table: unreadable (${formatError(strictVerifyRunsRes.error)})`)
  } else {
    console.log(`  Cron run health: ${strictVerifyRunHealth.status} — ${strictVerifyRunHealth.summary}`)
    const mins = strictVerifyRunHealth.minutesSinceLastRun
    console.log(
      `  Last logged run: ${mins == null ? 'n/a' : `${Math.round(mins)} min ago`}` +
        (strictVerifyRunHealth.successRateLast10 != null
          ? `; success rate last 10 runs: ${strictVerifyRunHealth.successRateLast10}%`
          : '')
    )
    if (strictRuns[0]) {
      const r = strictRuns[0]
      console.log(
        `  Most recent batch: processed ${r.processed}, marked_verified ${r.marked_verified}, fetch_failures ${r.fetch_failures}, duration_ms ${r.duration_ms ?? 'n/a'}`
      )
    }
    if (strictVerifyEtaMinutes != null) {
      console.log(
        `  Rough ETA to drain terminal strict queue: ~${strictVerifyEtaMinutes} min (${strictVerifyEtaNote})`
      )
    } else if (backlogTerminal > 0) {
      console.log(
        `  Rough ETA: not estimated yet (need a few successful logged runs with marked_verified > 0).`
      )
    }
  }
  console.log('\nYears finalized status (OnMarketDate year from DB stats; newest shown):')
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
