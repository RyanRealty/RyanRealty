import { NextResponse, type NextRequest } from 'next/server'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { sendMarketStatAlertEmail } from '@/lib/market-stat-alert'
import {
  closeSupersededVintages,
  countRegisteredStatSeries,
  readAllCurrentVintages,
  readCurrentVintages,
  readRegisteredStatSeries,
  readSeriesCursors,
  stampSeriesIngest,
  upsertStatObservations,
} from '@/lib/data/stats/statsAccess'
import { getStatIngestHealth } from '@/lib/data/stats/statsReads'
import { FRED_PROVIDER, type StatSeriesRow } from '@/lib/stats/contract'
import {
  fetchFredObservations,
  fetchFredSeriesStatus,
  fetchFredVintageDates,
  isNoVintagesFailure,
  isVintageCapFailure,
  planVintageWindows,
  type FredFailure,
  type FredObservation,
} from '@/lib/stats/fred'
import {
  EMPTY_CURSOR,
  groupClosuresByEnd,
  isoDay,
  planSeriesIngest,
  reconcileVintages,
  type CurrentVintage,
  type IngestPlan,
  type SeriesCursor,
} from '@/lib/stats/vintage'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * fred-ingest — daily 22:47 UTC (registered in vercel.json).
 *
 * Captures the national rate, price-index, inflation, and supply series that
 * local MLS data cannot supply, into public.stat_series + public.stat_observations.
 * WHICH series is not written here: the ingest reads whatever is registered in
 * public.stat_series with provider 'fred', so adding one is an INSERT and no
 * deploy. Titles, units, attribution, and is_public are curated in that table
 * and this route never writes them.
 *
 * WHY DAILY. Three of the five registered series are monthly, but DGS10 is a
 * business-day series and MORTGAGE30US is weekly, so a monthly cron would leave
 * both rate series up to a month stale. On a day a monthly series has nothing
 * new the publisher answers "no vintage dates exist in that period" and the
 * series is a no-op costing one request.
 *
 * WHY 22:47 UTC. The daily treasury figure posts after the US close, so an
 * evening slot catches the same day's print in both DST halves (22:47 UTC is
 * 18:47 ET in summer, 17:47 ET in winter; the H.15 release is mid-afternoon
 * ET). Minute 47 is odd and divides by neither 5, 10, 15, nor 30, so it shares
 * a minute with no sub-hourly cron in vercel.json.
 *
 * IDEMPOTENT. Observations are keyed (series_id, observation_date,
 * realtime_start). A re-fire re-upserts the same vintages. A revision arrives
 * as a NEW vintage and closes the one it supersedes, so the earlier figure
 * stays on the record with the interval it was the current answer for, and the
 * partial unique index stat_observations_current_uq keeps exactly one current
 * figure per period.
 *
 * FIRST RUN backfills a series that has no rows, capped at
 * MAX_BACKFILLS_PER_RUN so the first days spread the load instead of one run
 * pulling every series at once. Deferred series are reported as deferred, not
 * as failures.
 *
 * FAILURE IS LOUD. Every series outcome is in the response body. A failed
 * series logs, is listed in the ops alert email, and takes the response to 500
 * so cron monitoring sees red. A series that ingests clean while sitting behind
 * its publisher grades `behind_publisher` and joins the same alert. The one
 * soft case is the tables not existing, which is reported with the reason and
 * without paging anyone.
 */

/** Series backfilled per run. Keeps the first runs well inside maxDuration. */
const MAX_BACKFILLS_PER_RUN = 2

type SeriesOutcome = {
  seriesId: string
  ok: boolean
  mode: IngestPlan['mode'] | 'deferred_backfill'
  requests: number
  observationsFetched: number
  rowsWritten: number
  vintagesClosed: number
  /** Vintages the publisher reported as "." — a real period with no figure. */
  missingValueCount: number
  /** Clamped continuations dropped: the same figure, not a revision. */
  collapsedCount: number
  error?: string
}

function failureLine(seriesId: string, failure: FredFailure): string {
  const status = failure.status ? ` (HTTP ${failure.status})` : ''
  return `${seriesId}: ${failure.kind}${status} — ${failure.message}`
}

type BatchWriteTotals = { rowsWritten: number; vintagesClosed: number; missingValueCount: number; collapsedCount: number }

/**
 * Reconcile one batch against what the database already holds and write it.
 *
 * `currentByDate` is carried BY REFERENCE across the batches of one series: a
 * backfill walks several real-time windows and each window's writes are what
 * the next window reconciles against, so the map has to reflect the rows just
 * written rather than a snapshot from before them.
 */
async function writeBatch(
  seriesId: string,
  observations: readonly FredObservation[],
  currentByDate: Map<string, CurrentVintage>,
  fetchedAt: string,
  seedFromDatabase: boolean,
): Promise<{ ok: true; totals: BatchWriteTotals } | { ok: false; detail: string }> {
  if (observations.length === 0) {
    return { ok: true, totals: { rowsWritten: 0, vintagesClosed: 0, missingValueCount: 0, collapsedCount: 0 } }
  }

  if (seedFromDatabase) {
    const unseen = [...new Set(observations.map((o) => o.observationDate))].filter((d) => !currentByDate.has(d))
    if (unseen.length > 0) {
      const stored = await readCurrentVintages(seriesId, unseen)
      if (!stored.ok) return { ok: false, detail: `current-vintage read failed (${stored.reason}): ${stored.detail}` }
      for (const [date, vintage] of stored.data) currentByDate.set(date, vintage)
    }
  }

  const plan = reconcileVintages({ seriesId, observations, currentByDate, fetchedAt })

  // Closures first: the partial unique index allows one 'infinity' row per
  // period, so the superseded vintage has to step aside before the new one
  // lands. See lib/data/stats/statsAccess.ts on why a half-finished run
  // self-heals rather than leaving a hole.
  const closed = await closeSupersededVintages(seriesId, groupClosuresByEnd(plan.closures))
  if (!closed.ok) return { ok: false, detail: `closing superseded vintages failed (${closed.reason}): ${closed.detail}` }

  const written = await upsertStatObservations(plan.rows)
  if (!written.ok) return { ok: false, detail: `observation write failed (${written.reason}): ${written.detail}` }

  for (const [date, vintage] of plan.nextCurrentByDate) currentByDate.set(date, vintage)

  return {
    ok: true,
    totals: {
      rowsWritten: written.rowsWritten,
      vintagesClosed: closed.rowsWritten,
      missingValueCount: plan.missingValueCount,
      collapsedCount: plan.collapsedCount,
    },
  }
}

/** Ingest one registered series end to end. */
async function ingestSeries(
  series: StatSeriesRow,
  cursor: SeriesCursor,
  today: string,
  fetchedAt: string,
  plan: IngestPlan,
): Promise<SeriesOutcome> {
  const seriesId = series.id
  const code = series.provider_series_code
  const outcome: SeriesOutcome = {
    seriesId,
    ok: true,
    mode: plan.mode,
    requests: 0,
    observationsFetched: 0,
    rowsWritten: 0,
    vintagesClosed: 0,
    missingValueCount: 0,
    collapsedCount: 0,
  }

  // A re-walk of a populated series reconciles against thousands of dates, so
  // the standing figures are read once up front instead of per window. A first
  // backfill has nothing to read.
  const currentByDate = new Map<string, CurrentVintage>()
  const seedFromDatabase = plan.mode === 'incremental'
  if (plan.mode === 'backfill' && cursor.rowCount > 0) {
    const seed = await readAllCurrentVintages(seriesId)
    if (!seed.ok) {
      return { ...outcome, ok: false, error: `${seriesId}: standing-figure read failed (${seed.reason}): ${seed.detail}` }
    }
    for (const [date, vintage] of seed.data) currentByDate.set(date, vintage)
  }

  const applyBatch = async (observations: FredObservation[]): Promise<string | null> => {
    outcome.observationsFetched += observations.length
    const result = await writeBatch(seriesId, observations, currentByDate, fetchedAt, seedFromDatabase)
    if (!result.ok) return `${seriesId}: ${result.detail}`
    outcome.rowsWritten += result.totals.rowsWritten
    outcome.vintagesClosed += result.totals.vintagesClosed
    outcome.missingValueCount += result.totals.missingValueCount
    outcome.collapsedCount += result.totals.collapsedCount
    return null
  }

  outcome.requests += 1
  const first = await fetchFredObservations({
    seriesId: code,
    outputType: plan.outputType,
    realtimeStart: plan.realtimeStart,
    realtimeEnd: plan.realtimeEnd,
  })

  if (first.ok) {
    const error = await applyBatch(first.data)
    return error ? { ...outcome, ok: false, error } : outcome
  }

  // A window with no vintages is the publisher saying "nothing changed", which
  // is the ordinary answer for a monthly series polled daily.
  if (isNoVintagesFailure(first.error)) return outcome

  if (!isVintageCapFailure(first.error)) {
    return { ...outcome, ok: false, error: failureLine(seriesId, first.error) }
  }

  // More vintages than one request may carry. The publisher's own vintage list
  // gives the exact boundaries to cut real-time windows on, so the walk stays
  // inside the ceiling without guessing at day counts.
  console.warn(
    `[fred-ingest] ${seriesId} exceeded the publisher's vintage-per-request ceiling; walking its vintage list in windows. ` +
      `Detail: ${first.error.message}`,
  )
  outcome.requests += 1
  const vintageDates = await fetchFredVintageDates(code)
  if (!vintageDates.ok) return { ...outcome, ok: false, error: failureLine(seriesId, vintageDates.error) }

  const windows = planVintageWindows(vintageDates.data)
  for (const window of windows) {
    outcome.requests += 1
    const page = await fetchFredObservations({
      seriesId: code,
      outputType: 1,
      realtimeStart: window.realtimeStart,
      realtimeEnd: window.realtimeEnd,
    })
    if (!page.ok) {
      if (isNoVintagesFailure(page.error)) continue
      return { ...outcome, ok: false, error: failureLine(seriesId, page.error) }
    }
    const error = await applyBatch(page.data)
    if (error) return { ...outcome, ok: false, error }
  }
  return outcome
}

export async function GET(request: NextRequest) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const now = new Date()
  const today = isoDay(now)
  const fetchedAt = now.toISOString()

  const registry = await readRegisteredStatSeries(FRED_PROVIDER)
  if (!registry.ok) {
    if (registry.reason === 'table_missing') {
      console.error(
        '[fred-ingest] public.stat_series does not exist — apply the stat-series schema, then this cron starts capturing. No rows written.',
      )
      return NextResponse.json({ ok: false, reason: 'table_missing', today })
    }
    console.error(`[fred-ingest] registry read failed (${registry.reason}): ${registry.detail}`)
    return NextResponse.json({ ok: false, reason: registry.reason, detail: registry.detail, today }, { status: 500 })
  }

  if (registry.data.length === 0) {
    // A zero-row result is a fact about the filter before it is a fact about
    // the world (§0), so the counter-query goes in the same response: how many
    // series exist at all, under any provider.
    const everySeries = await countRegisteredStatSeries()
    const totalRegistered = everySeries.ok ? everySeries.data : null
    console.error(
      `[fred-ingest] no series registered with provider '${FRED_PROVIDER}'. ` +
        `Series registered under any provider: ${totalRegistered ?? 'unreadable'}. Nothing to ingest.`,
    )
    return NextResponse.json({ ok: false, reason: 'no_series_registered', provider: FRED_PROVIDER, totalRegistered, today })
  }

  const cursors = await readSeriesCursors(registry.data.map((s) => s.id))
  if (!cursors.ok) {
    if (cursors.reason === 'table_missing') {
      console.error('[fred-ingest] public.stat_observations does not exist — apply the stat-series schema. No rows written.')
      return NextResponse.json({ ok: false, reason: 'table_missing', today })
    }
    console.error(`[fred-ingest] cursor read failed (${cursors.reason}): ${cursors.detail}`)
    return NextResponse.json({ ok: false, reason: cursors.reason, detail: cursors.detail, today }, { status: 500 })
  }

  const outcomes: SeriesOutcome[] = []
  const failures: string[] = []
  const publisherEnds = new Map<string, string | null>()
  let backfillsRun = 0

  for (const series of registry.data) {
    const cursor = cursors.data.get(series.id) ?? EMPTY_CURSOR
    const plan = planSeriesIngest(cursor, today)

    if (plan.mode === 'backfill' && backfillsRun >= MAX_BACKFILLS_PER_RUN) {
      outcomes.push({
        seriesId: series.id,
        ok: true,
        mode: 'deferred_backfill',
        requests: 0,
        observationsFetched: 0,
        rowsWritten: 0,
        vintagesClosed: 0,
        missingValueCount: 0,
        collapsedCount: 0,
      })
      continue
    }
    if (plan.mode === 'backfill') backfillsRun += 1

    // The publisher's own coverage stamp. It is what the freshness grade
    // compares against, so no release-schedule threshold has to be invented.
    const status = await fetchFredSeriesStatus(series.provider_series_code)
    if (status.ok) publisherEnds.set(series.id, status.data.observationEnd)
    else {
      const line = `${series.id}: publisher status unavailable — ${failureLine(series.id, status.error)}`
      console.warn(`[fred-ingest] ${line}`)
      publisherEnds.set(series.id, null)
    }

    const outcome = await ingestSeries(series, cursor, today, fetchedAt, plan)
    outcomes.push(outcome)
    if (!outcome.ok && outcome.error) {
      console.error(`[fred-ingest] ${outcome.error}`)
      failures.push(outcome.error)
      continue
    }

    const stamp = await stampSeriesIngest(series.id, {
      checkedAt: fetchedAt,
      ingestedAt: outcome.rowsWritten > 0 ? fetchedAt : undefined,
    })
    if (!stamp.ok) {
      const line = `${series.id}: registry stamp failed (${stamp.reason}): ${stamp.detail}`
      console.error(`[fred-ingest] ${line}`)
      failures.push(line)
    }
  }

  // A series can ingest cleanly and still be behind its publisher, or stalled
  // because this cron stopped firing. Neither throws anywhere, so both are
  // graded here and folded into the same alert.
  const health = await getStatIngestHealth(FRED_PROVIDER, publisherEnds, now)
  const deferred = new Set(outcomes.filter((o) => o.mode === 'deferred_backfill').map((o) => o.seriesId))
  const healthProblems = health
    .filter((h) => h.status !== 'current' && !deferred.has(h.seriesId))
    .map((h) => h.note)
  for (const note of healthProblems) console.error(`[fred-ingest] ${note}`)

  const problems = [...failures, ...healthProblems]
  if (problems.length > 0) {
    await sendMarketStatAlertEmail({
      failures: problems,
      subject: `[Data] National stat ingest reported ${problems.length} issue${problems.length === 1 ? '' : 's'}`,
      heading: 'The national stat ingest did not complete clean',
      intro:
        'The daily FRED ingest either failed on a series or found one this database is behind on. Any surface rendering that series is serving an older figure than it claims.',
      context:
        'Route: /api/cron/fred-ingest. Client: lib/stats/fred.ts. Vintage rules: lib/stats/vintage.ts. Storage: public.stat_series + public.stat_observations, keyed (series_id, observation_date, realtime_start), current row marked realtime_end = infinity.',
    })
  }

  // `ok` tracks what this run controls. A series sitting behind its publisher is
  // reported and mailed, but it is not this route failing, and a standing 500
  // on a retired series would drown the real signal.
  return NextResponse.json(
    {
      ok: failures.length === 0,
      today,
      provider: FRED_PROVIDER,
      seriesRegistered: registry.data.length,
      backfillsRun,
      rowsWritten: outcomes.reduce((sum, o) => sum + o.rowsWritten, 0),
      vintagesClosed: outcomes.reduce((sum, o) => sum + o.vintagesClosed, 0),
      outcomes,
      health,
    },
    { status: failures.length === 0 ? 200 : 500 },
  )
}
