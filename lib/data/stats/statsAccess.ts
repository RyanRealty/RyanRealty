/**
 * Registry + write side of public.stat_series and public.stat_observations.
 * Nothing outside lib/data/ touches those tables (G1), so
 * app/api/cron/fred-ingest/ carries no query of its own. The public read and
 * the health grade live in the sibling statsReads.ts.
 *
 * IMPORT BY SUB-PATH: `@/lib/data/stats/statsAccess`. The lib/data barrel is
 * frozen at its current export count by the p2.2 file-size ratchet, so a new
 * domain does not go through it.
 *
 * Nothing throws. Every function returns a discriminated outcome, so a caller
 * cannot read a failure as "nothing to do" — the swallowed-error class §0
 * exists to prevent.
 *
 * SERVICE ROLE ON PURPOSE. All five series are registered is_public false and
 * the anon policy shows only public ones, so the ingest and the health grade
 * read the registry through the service role. The public reader in statsReads.ts
 * uses the anon client and therefore returns rows only for series a human has
 * already flipped to public — the intended gate, not a bug to route around.
 *
 * WRITE ORDER IS PART OF THE CORRECTNESS ARGUMENT, not an implementation
 * detail. `closeSupersededVintages` runs BEFORE `upsertStatObservations`,
 * because stat_observations_current_uq allows exactly one 'infinity' row per
 * (series, observation date) and a new vintage cannot land until the one it
 * supersedes is closed.
 *
 * That order has one visible failure window: closures land, upserts fail, and
 * the affected dates briefly have no current row. It self-heals on the next run
 * with nobody intervening, because the ingest cursor is MAX(realtime_start)
 * over stored rows: a vintage that failed to write did not move the cursor, so
 * the next window still starts at it and asks for the same revision again.
 * Rows are written ascending by realtime_start (lib/stats/vintage.ts sorts
 * them), so a half-finished chunk run leaves the cursor below every unwritten
 * vintage rather than past it.
 */

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import {
  STAT_OBSERVATIONS_CONFLICT,
  STAT_OBSERVATIONS_TABLE,
  STAT_SERIES_TABLE,
  OPEN_REALTIME_END,
  TABLE_MISSING_CODES,
  type StatObservationRow,
  type StatSeriesRow,
} from '@/lib/stats/contract'
import { chunkRows, type CurrentVintage, type SeriesCursor } from '@/lib/stats/vintage'

/** PostgREST handles this many rows per write without strain. */
const WRITE_CHUNK_SIZE = 1000
/** Observation dates per `.in()` filter. Keeps the URL and the response bounded. */
const DATE_FILTER_CHUNK = 400
/** PostgREST caps a single response at 1,000 rows regardless of a larger limit. */
const PAGE_SIZE = 1000

const SERIES_COLUMNS =
  'id, provider, provider_series_code, title, units, unit_kind, display_decimals, cadence, ' +
  'geo_level, geo_code, geo_label, geo_slug, seasonal_adjustment, attribution, attribution_url, ' +
  'license, is_public, notes, last_checked_at, last_ingested_at'

export type StatWriteOutcome =
  | { ok: true; rowsWritten: number }
  | { ok: false; reason: 'table_missing' | 'not_configured' | 'write_failed'; detail: string }

export type StatReadOutcome<T> =
  | { ok: true; data: T }
  | { ok: false; reason: 'table_missing' | 'not_configured' | 'read_failed'; detail: string }

type SupabaseErrorish = { code?: string; message?: string } | null

function isTableMissing(error: SupabaseErrorish): boolean {
  return Boolean(error?.code && TABLE_MISSING_CODES.has(error.code))
}

function serviceClient(): { ok: true; sb: ReturnType<typeof createServiceClient> } | { ok: false; detail: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    return { ok: false, detail: 'NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not both set.' }
  }
  try {
    return { ok: true, sb: createServiceClient() }
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) }
  }
}

/* ------------------------------------------------------------------ */
/* Registry                                                            */
/* ------------------------------------------------------------------ */

/**
 * Every registered series for one provider, private ones included.
 *
 * The registry is curated, not derived: title, units, attribution, and
 * is_public are editorial decisions already recorded in the table. The ingest
 * reads them and never overwrites them, which is why adding a series is one
 * INSERT and no code change.
 */
export async function readRegisteredStatSeries(provider: string): Promise<StatReadOutcome<StatSeriesRow[]>> {
  const client = serviceClient()
  if (!client.ok) return { ok: false, reason: 'not_configured', detail: client.detail }

  const { data, error } = await client.sb
    .from(STAT_SERIES_TABLE)
    .select(SERIES_COLUMNS)
    .eq('provider', provider)
    .order('id', { ascending: true })
    .limit(PAGE_SIZE)
  if (error) {
    if (isTableMissing(error)) return { ok: false, reason: 'table_missing', detail: error.message }
    return { ok: false, reason: 'read_failed', detail: error.message }
  }
  return { ok: true, data: (data ?? []) as unknown as StatSeriesRow[] }
}

/**
 * How many series are registered under ANY provider.
 *
 * The counter-query for the provider-filtered read above. "No fred series are
 * registered" is first a fact about the filter and only then a fact about the
 * table (§0), and this is the cheap broad check that tells the two apart before
 * anyone is told to go register something.
 */
export async function countRegisteredStatSeries(): Promise<StatReadOutcome<number>> {
  const client = serviceClient()
  if (!client.ok) return { ok: false, reason: 'not_configured', detail: client.detail }

  const { count, error } = await client.sb.from(STAT_SERIES_TABLE).select('id', { count: 'exact', head: true })
  if (error) {
    if (isTableMissing(error)) return { ok: false, reason: 'table_missing', detail: error.message }
    return { ok: false, reason: 'read_failed', detail: error.message }
  }
  return { ok: true, data: count ?? 0 }
}

/* ------------------------------------------------------------------ */
/* Reads the writer needs to stay idempotent                           */
/* ------------------------------------------------------------------ */

/**
 * Newest stored vintage, newest covered period, newest period carrying an
 * actual figure, and the row count — for each series. Four indexed reads per
 * series rather than one aggregate, so this needs no RPC and no schema
 * function.
 */
export async function readSeriesCursors(
  seriesIds: readonly string[],
): Promise<StatReadOutcome<Map<string, SeriesCursor>>> {
  const client = serviceClient()
  if (!client.ok) return { ok: false, reason: 'not_configured', detail: client.detail }
  const { sb } = client

  const cursors = new Map<string, SeriesCursor>()
  for (const seriesId of seriesIds) {
    const { count, error: countError } = await sb
      .from(STAT_OBSERVATIONS_TABLE)
      .select('series_id', { count: 'exact', head: true })
      .eq('series_id', seriesId)
    if (countError) {
      if (isTableMissing(countError)) return { ok: false, reason: 'table_missing', detail: countError.message }
      return { ok: false, reason: 'read_failed', detail: `${seriesId}: ${countError.message}` }
    }
    if (!count) {
      cursors.set(seriesId, {
        latestRealtimeStart: null,
        latestObservationDate: null,
        latestPublishedObservationDate: null,
        rowCount: 0,
      })
      continue
    }

    const { data: vintageRow, error: vintageError } = await sb
      .from(STAT_OBSERVATIONS_TABLE)
      .select('realtime_start')
      .eq('series_id', seriesId)
      .order('realtime_start', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (vintageError) return { ok: false, reason: 'read_failed', detail: `${seriesId}: ${vintageError.message}` }

    const { data: coveredRow, error: coveredError } = await sb
      .from(STAT_OBSERVATIONS_TABLE)
      .select('observation_date')
      .eq('series_id', seriesId)
      .eq('realtime_end', OPEN_REALTIME_END)
      .order('observation_date', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (coveredError) return { ok: false, reason: 'read_failed', detail: `${seriesId}: ${coveredError.message}` }

    const { data: publishedRow, error: publishedError } = await sb
      .from(STAT_OBSERVATIONS_TABLE)
      .select('observation_date')
      .eq('series_id', seriesId)
      .eq('realtime_end', OPEN_REALTIME_END)
      .not('value', 'is', null)
      .order('observation_date', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (publishedError) return { ok: false, reason: 'read_failed', detail: `${seriesId}: ${publishedError.message}` }

    cursors.set(seriesId, {
      latestRealtimeStart: (vintageRow as { realtime_start?: string } | null)?.realtime_start ?? null,
      latestObservationDate: (coveredRow as { observation_date?: string } | null)?.observation_date ?? null,
      latestPublishedObservationDate: (publishedRow as { observation_date?: string } | null)?.observation_date ?? null,
      rowCount: count,
    })
  }
  return { ok: true, data: cursors }
}

/**
 * What the database holds as the standing figure for each of these observation
 * dates. stat_observations_current_uq guarantees at most one row per date
 * matches, so this is a lookup, not a ranking.
 */
export async function readCurrentVintages(
  seriesId: string,
  observationDates: readonly string[],
): Promise<StatReadOutcome<Map<string, CurrentVintage>>> {
  const out = new Map<string, CurrentVintage>()
  if (observationDates.length === 0) return { ok: true, data: out }

  const client = serviceClient()
  if (!client.ok) return { ok: false, reason: 'not_configured', detail: client.detail }

  for (const chunk of chunkRows(observationDates, DATE_FILTER_CHUNK)) {
    const { data, error } = await client.sb
      .from(STAT_OBSERVATIONS_TABLE)
      .select('observation_date, realtime_start, value')
      .eq('series_id', seriesId)
      .eq('realtime_end', OPEN_REALTIME_END)
      .in('observation_date', chunk)
      .order('observation_date', { ascending: true })
      .limit(PAGE_SIZE)
    if (error) {
      if (isTableMissing(error)) return { ok: false, reason: 'table_missing', detail: error.message }
      return { ok: false, reason: 'read_failed', detail: `${seriesId}: ${error.message}` }
    }
    for (const row of (data ?? []) as { observation_date: string; realtime_start: string; value: number | string | null }[]) {
      out.set(row.observation_date, {
        realtimeStart: row.realtime_start,
        // numeric arrives as a string over PostgREST; the collapse rule
        // compares figures, so it has to compare numbers.
        value: row.value === null ? null : Number(row.value),
      })
    }
  }
  return { ok: true, data: out }
}

/**
 * Every standing figure for one series, keyed by observation date.
 *
 * A re-walk of an already-populated series touches thousands of dates at once,
 * and asking for them by name would be dozens of `.in()` filters. Paging the
 * whole current set is one bounded pass instead — 'infinity' rows are one per
 * observation date, so this is the series length, not the vintage history.
 */
export async function readAllCurrentVintages(seriesId: string): Promise<StatReadOutcome<Map<string, CurrentVintage>>> {
  const out = new Map<string, CurrentVintage>()
  const client = serviceClient()
  if (!client.ok) return { ok: false, reason: 'not_configured', detail: client.detail }

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await client.sb
      .from(STAT_OBSERVATIONS_TABLE)
      .select('observation_date, realtime_start, value')
      .eq('series_id', seriesId)
      .eq('realtime_end', OPEN_REALTIME_END)
      // Range paging without a stable order returns arbitrary slices.
      .order('observation_date', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)
    if (error) {
      if (isTableMissing(error)) return { ok: false, reason: 'table_missing', detail: error.message }
      return { ok: false, reason: 'read_failed', detail: `${seriesId}: ${error.message}` }
    }
    const rows = (data ?? []) as { observation_date: string; realtime_start: string; value: number | string | null }[]
    for (const row of rows) {
      out.set(row.observation_date, {
        realtimeStart: row.realtime_start,
        value: row.value === null ? null : Number(row.value),
      })
    }
    if (rows.length < PAGE_SIZE) break
  }
  return { ok: true, data: out }
}

/* ------------------------------------------------------------------ */
/* Writes                                                              */
/* ------------------------------------------------------------------ */

/**
 * Move superseded rows off 'infinity'. One UPDATE per distinct end date, which
 * is one statement for the ordinary case where a single new vintage supersedes
 * many observation dates at once.
 *
 * The filter names no realtime_start on purpose: stat_observations_current_uq
 * makes the 'infinity' row unique per (series, observation date), so "the
 * current row for this date" already identifies exactly one row.
 */
export async function closeSupersededVintages(
  seriesId: string,
  groups: readonly { realtimeEnd: string; observationDates: string[] }[],
): Promise<StatWriteOutcome> {
  if (groups.length === 0) return { ok: true, rowsWritten: 0 }

  const client = serviceClient()
  if (!client.ok) return { ok: false, reason: 'not_configured', detail: client.detail }

  let closed = 0
  for (const group of groups) {
    for (const chunk of chunkRows(group.observationDates, DATE_FILTER_CHUNK)) {
      const { data, error } = await client.sb
        .from(STAT_OBSERVATIONS_TABLE)
        .update({ realtime_end: group.realtimeEnd })
        .eq('series_id', seriesId)
        .eq('realtime_end', OPEN_REALTIME_END)
        .in('observation_date', chunk)
        .select('observation_date')
      if (error) {
        if (isTableMissing(error)) return { ok: false, reason: 'table_missing', detail: error.message }
        return { ok: false, reason: 'write_failed', detail: `${seriesId}: after ${closed} closures: ${error.message}` }
      }
      closed += (data ?? []).length
    }
  }
  return { ok: true, rowsWritten: closed }
}

/**
 * Upsert observation rows in chunks, keyed on the live primary key
 * (series_id, observation_date, realtime_start). A re-fire re-upserts the same
 * vintages; a revision arrives as a new vintage rather than as an overwrite, so
 * the superseded figure stays on the record.
 */
export async function upsertStatObservations(rows: readonly StatObservationRow[]): Promise<StatWriteOutcome> {
  if (rows.length === 0) return { ok: true, rowsWritten: 0 }

  const client = serviceClient()
  if (!client.ok) return { ok: false, reason: 'not_configured', detail: client.detail }

  let written = 0
  for (const chunk of chunkRows(rows, WRITE_CHUNK_SIZE)) {
    const { error } = await client.sb
      .from(STAT_OBSERVATIONS_TABLE)
      .upsert(chunk as StatObservationRow[], { onConflict: STAT_OBSERVATIONS_CONFLICT })
    if (error) {
      if (isTableMissing(error)) return { ok: false, reason: 'table_missing', detail: error.message }
      return { ok: false, reason: 'write_failed', detail: `after ${written} rows: ${error.message}` }
    }
    written += chunk.length
  }
  return { ok: true, rowsWritten: written }
}

/**
 * Stamp the registry row. `last_checked_at` says the ingest looked;
 * `last_ingested_at` says it found something and wrote it. They are separate
 * facts: a monthly series is checked daily and ingested monthly, and reading
 * the first as the second would grade a healthy series as stalled.
 *
 * Never touches is_public, title, units, or attribution — those are curated in
 * the registry and are not the publisher's to overwrite.
 */
export async function stampSeriesIngest(
  seriesId: string,
  stamps: { checkedAt: string; ingestedAt?: string },
): Promise<StatWriteOutcome> {
  const client = serviceClient()
  if (!client.ok) return { ok: false, reason: 'not_configured', detail: client.detail }

  const patch: Record<string, string> = { last_checked_at: stamps.checkedAt }
  if (stamps.ingestedAt) patch.last_ingested_at = stamps.ingestedAt

  const { error } = await client.sb.from(STAT_SERIES_TABLE).update(patch).eq('id', seriesId)
  if (error) {
    if (isTableMissing(error)) return { ok: false, reason: 'table_missing', detail: error.message }
    return { ok: false, reason: 'write_failed', detail: `${seriesId}: ${error.message}` }
  }
  return { ok: true, rowsWritten: 1 }
}

