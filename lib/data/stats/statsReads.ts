/**
 * Read side of the stat domain: the series a surface renders, and the graded
 * answer to "is this ingest actually working".
 *
 * The write side and the registry live in the sibling statsAccess.ts. Both are
 * inside lib/data/, so the G1 boundary holds either way; the split is about the
 * two concerns being read by different callers, not about the boundary.
 *
 * IMPORT BY SUB-PATH: `@/lib/data/stats/statsReads`. The lib/data barrel is
 * frozen at its current export count by the p2.2 file-size ratchet, so a new
 * domain does not go through it.
 */

import 'server-only'
import { supabaseAnon } from '@/lib/data/client'
import { OPEN_REALTIME_END, STAT_OBSERVATIONS_TABLE, TABLE_MISSING_CODES } from '@/lib/stats/contract'
import { daysBetween, isoDay } from '@/lib/stats/vintage'
import { readRegisteredStatSeries, readSeriesCursors, type StatReadOutcome } from '@/lib/data/stats/statsAccess'

/** PostgREST caps a single response at 1,000 rows regardless of a larger limit. */
const PAGE_SIZE = 1000

function isTableMissing(error: { code?: string } | null): boolean {
  return Boolean(error?.code && TABLE_MISSING_CODES.has(error.code))
}

/* ------------------------------------------------------------------ */
/* Public read                                                         */
/* ------------------------------------------------------------------ */

/** One published point: the figure standing today for one period. */
export type StatPoint = {
  observationDate: string
  value: number
  /** The date this figure became the current answer — its vintage. */
  realtimeStart: string
}

/**
 * The current vintage of one public series, ascending by period.
 *
 * Reads through the anon client, so RLS decides what comes back: a series
 * registered is_public false returns zero rows here even though the ingest has
 * captured it. That is the intended gate, and it is why a caller must treat an
 * empty result as "not published", never as "no data exists".
 *
 * Only rows where realtime_end = 'infinity' are returned — the superseded
 * vintages stay in the table for the audit trail and never reach a surface —
 * and rows the publisher reported as "." are excluded, because a period with no
 * published figure is not a figure.
 */
export async function readPublicStatSeries(
  seriesId: string,
  options: { from?: string; to?: string; maxPoints?: number } = {},
): Promise<StatReadOutcome<StatPoint[]>> {
  const supabase = supabaseAnon()
  if (!supabase) return { ok: false, reason: 'not_configured', detail: 'Supabase anon environment is not set.' }

  const maxPoints = Math.max(1, options.maxPoints ?? 5000)
  const out: StatPoint[] = []

  for (let offset = 0; offset < maxPoints; offset += PAGE_SIZE) {
    let query = supabase
      .from(STAT_OBSERVATIONS_TABLE)
      .select('observation_date, realtime_start, value')
      .eq('series_id', seriesId)
      .eq('realtime_end', OPEN_REALTIME_END)
      .not('value', 'is', null)
    if (options.from) query = query.gte('observation_date', options.from)
    if (options.to) query = query.lte('observation_date', options.to)

    const { data, error } = await query
      // A stable order is what makes range paging correct rather than
      // arbitrary — the observation date is unique per current row here.
      .order('observation_date', { ascending: true })
      .range(offset, Math.min(offset + PAGE_SIZE, maxPoints) - 1)
    if (error) {
      if (isTableMissing(error)) return { ok: false, reason: 'table_missing', detail: error.message }
      return { ok: false, reason: 'read_failed', detail: `${seriesId}: ${error.message}` }
    }

    const rows = (data ?? []) as { observation_date: string; realtime_start: string; value: number | string }[]
    for (const row of rows) {
      out.push({ observationDate: row.observation_date, value: Number(row.value), realtimeStart: row.realtime_start })
    }
    if (rows.length < PAGE_SIZE) break
  }

  return { ok: true, data: out }
}

/* ------------------------------------------------------------------ */
/* Health                                                              */
/* ------------------------------------------------------------------ */

export type StatSeriesHealthStatus =
  | 'current'
  | 'never_ingested'
  | 'ingest_stalled'
  | 'behind_publisher'
  | 'unreadable'

export type StatSeriesHealth = {
  seriesId: string
  status: StatSeriesHealthStatus
  /** Newest period this database covers, a published "." included. */
  latestObservationDate: string | null
  /** Newest period this database holds an actual figure for. */
  latestPublishedObservationDate: string | null
  /** Newest period the PUBLISHER holds, when this run asked it. */
  publisherObservationEnd: string | null
  lastCheckedAt: string | null
  lastIngestedAt: string | null
  note: string
}

/**
 * How many days without a successful check before the ingest itself is the
 * problem. This is not a claim about any publisher's release schedule — it is
 * read off THIS repo's own cron registration in vercel.json, which fires
 * fred-ingest once a day, plus one day of slack for a single missed firing.
 */
export const INGEST_CHECK_BUDGET_DAYS = 2

/**
 * Grade one series without inventing a freshness threshold for it.
 *
 * There is no budget here for "how old may a figure be" — that is the
 * publisher's release schedule, and guessing at it is how a healthy Case-Shiller
 * series three months in arrears gets reported as broken. The only two things
 * graded are facts this system owns: whether OUR cron has run, and whether OUR
 * newest period matches the newest period the publisher says it has.
 */
export function gradeStatSeries(input: {
  seriesId: string
  latestObservationDate: string | null
  latestPublishedObservationDate: string | null
  publisherObservationEnd: string | null
  lastCheckedAt: string | null
  lastIngestedAt: string | null
  today: string
}): StatSeriesHealth {
  const base = {
    seriesId: input.seriesId,
    latestObservationDate: input.latestObservationDate,
    latestPublishedObservationDate: input.latestPublishedObservationDate,
    publisherObservationEnd: input.publisherObservationEnd,
    lastCheckedAt: input.lastCheckedAt,
    lastIngestedAt: input.lastIngestedAt,
  }

  if (!input.latestObservationDate) {
    return { ...base, status: 'never_ingested', note: `${input.seriesId} holds no observation. The ingest has not completed for it.` }
  }

  const checkedAgeDays = input.lastCheckedAt ? daysBetween(input.lastCheckedAt.slice(0, 10), input.today) : null
  if (checkedAgeDays === null || !Number.isFinite(checkedAgeDays) || checkedAgeDays > INGEST_CHECK_BUDGET_DAYS) {
    const age = checkedAgeDays === null ? 'never' : `${checkedAgeDays}d ago`
    return { ...base, status: 'ingest_stalled', note: `${input.seriesId} was last checked ${age}, against a daily cron. The ingest is not running.` }
  }

  // Coverage is graded against the period the publisher says it holds, so a
  // series whose newest period is a market holiday reads as caught up rather
  // than as behind. What a surface would actually render is reported beside it.
  if (input.publisherObservationEnd && input.publisherObservationEnd > input.latestObservationDate) {
    return {
      ...base,
      status: 'behind_publisher',
      note: `${input.seriesId} covers through ${input.latestObservationDate} but the publisher reports ${input.publisherObservationEnd}. This database is behind the source.`,
    }
  }

  const rendered = input.latestPublishedObservationDate ?? 'no period yet'
  return { ...base, status: 'current', note: `${input.seriesId} covers through ${input.latestObservationDate}; newest figure ${rendered}.` }
}

/**
 * Graded health for every registered series of one provider.
 *
 * `publisherObservationEnd` is optional because it costs a network call the
 * caller may not want to spend; the cron passes what it already fetched. When
 * the registry cannot be read at all the answer is one unreadable row with the
 * reason attached, never an empty list — an empty list reads as "nothing wrong",
 * which is the swallowed failure this function exists to make visible.
 */
export async function getStatIngestHealth(
  provider: string,
  publisherEnds: ReadonlyMap<string, string | null> = new Map(),
  now: Date = new Date(),
): Promise<StatSeriesHealth[]> {
  const today = isoDay(now)
  const registry = await readRegisteredStatSeries(provider)
  if (!registry.ok) {
    return [
      {
        seriesId: `${provider}:*`,
        status: 'unreadable',
        latestObservationDate: null,
        latestPublishedObservationDate: null,
        publisherObservationEnd: null,
        lastCheckedAt: null,
        lastIngestedAt: null,
        note: `The ${provider} stat registry did not read (${registry.reason}): ${registry.detail}`,
      },
    ]
  }

  const cursors = await readSeriesCursors(registry.data.map((s) => s.id))
  return registry.data.map((series) => {
    if (!cursors.ok) {
      return {
        seriesId: series.id,
        status: 'unreadable' as const,
        latestObservationDate: null,
        latestPublishedObservationDate: null,
        publisherObservationEnd: publisherEnds.get(series.id) ?? null,
        lastCheckedAt: series.last_checked_at,
        lastIngestedAt: series.last_ingested_at,
        note: `${series.id} could not be graded (${cursors.reason}): ${cursors.detail}`,
      }
    }
    return gradeStatSeries({
      seriesId: series.id,
      latestObservationDate: cursors.data.get(series.id)?.latestObservationDate ?? null,
      latestPublishedObservationDate: cursors.data.get(series.id)?.latestPublishedObservationDate ?? null,
      publisherObservationEnd: publisherEnds.get(series.id) ?? null,
      lastCheckedAt: series.last_checked_at,
      lastIngestedAt: series.last_ingested_at,
      today,
    })
  })
}
