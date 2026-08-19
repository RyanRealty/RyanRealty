/**
 * Storage contract for public.stat_series + public.stat_observations.
 *
 * These tables are ALREADY LIVE (applied 2026-08-17). Everything here was read
 * back off the live database, not assumed:
 *
 *   public.stat_series
 *     id                   text PRIMARY KEY   -- CHECK (id = provider || ':' || provider_series_code)
 *     provider             text               -- CHECK (provider ~ '^[a-z][a-z0-9_]*$')
 *     provider_series_code text               -- CHECK (no ':' inside)
 *     title / units / unit_kind / display_decimals / cadence / geo_* /
 *     seasonal_adjustment / attribution / attribution_url / license / notes
 *     is_public            boolean NOT NULL DEFAULT false
 *     last_checked_at      timestamptz        -- the ingest looked
 *     last_ingested_at     timestamptz        -- the ingest wrote rows
 *
 *   public.stat_observations
 *     series_id        text  REFERENCES stat_series(id)
 *     observation_date date  CHECK (isfinite(observation_date))
 *     realtime_start   date  CHECK (isfinite(realtime_start))
 *     realtime_end     date  NOT NULL DEFAULT 'infinity'
 *     value            numeric NULL
 *     fetched_at       timestamptz NOT NULL DEFAULT now()
 *     PRIMARY KEY (series_id, observation_date, realtime_start)
 *     CHECK (realtime_start <= realtime_end)
 *     UNIQUE INDEX stat_observations_current_uq (series_id, observation_date)
 *            WHERE realtime_end = 'infinity'
 *
 * TWO SENTINELS, AND THEY ARE NOT THE SAME VALUE.
 *
 *   FRED_OPEN_REALTIME_END ('9999-12-31') is what the PUBLISHER puts on the
 *   wire for a still-current vintage.
 *
 *   OPEN_REALTIME_END ('infinity') is what THIS DATABASE stores, and it is the
 *   value the partial unique index keys on. Writing 9999-12-31 into
 *   realtime_end would leave the index predicate unmatched, so the
 *   one-current-value-per-observation guarantee would silently stop applying:
 *   two rows could both claim to be the current figure for the same date and
 *   nothing would complain. Translation happens once, in this module's
 *   `toStorageRealtimeEnd`.
 *
 * WHY THE PRIMARY KEY IS (series_id, observation_date, realtime_start): a
 * revision does not overwrite history. The publisher restates a figure by
 * issuing a new value under a new vintage date, so a revision lands as a NEW
 * row and the superseded figure stays on the record with the interval it was
 * the current answer for. Re-running the ingest re-upserts the same keys, which
 * is what makes the cron idempotent.
 */

/** Table names. */
export const STAT_SERIES_TABLE = 'stat_series'
export const STAT_OBSERVATIONS_TABLE = 'stat_observations'

/** Upsert conflict target — the live primary key, verified on the database. */
export const STAT_OBSERVATIONS_CONFLICT = 'series_id,observation_date,realtime_start'

/** What THIS DATABASE stores for "this value is still the current one". */
export const OPEN_REALTIME_END = 'infinity'

/** What FRED puts on the wire for the same thing. */
export const FRED_OPEN_REALTIME_END = '9999-12-31'

/** The provider slug half of a stat_series id. Satisfies the provider CHECK. */
export const FRED_PROVIDER = 'fred'

/**
 * Build the namespaced series id the live CHECK constraint requires.
 * `fred` + `DGS10` -> `fred:DGS10`.
 */
export function statSeriesId(provider: string, providerSeriesCode: string): string {
  return `${provider}:${providerSeriesCode}`
}

/**
 * Translate a vintage end from the publisher's wire value to the stored one.
 * `null` (the publisher stated no end) and FRED's 9999-12-31 both mean current.
 */
export function toStorageRealtimeEnd(fredRealtimeEnd: string | null): string {
  if (fredRealtimeEnd === null || fredRealtimeEnd === FRED_OPEN_REALTIME_END) return OPEN_REALTIME_END
  return fredRealtimeEnd
}

/** Postgres codes for "the table is not there" (raw + PostgREST schema cache). */
export const TABLE_MISSING_CODES = new Set(['42P01', 'PGRST205'])

/** One row of public.stat_series, as this codebase reads it. */
export type StatSeriesRow = {
  id: string
  provider: string
  provider_series_code: string
  title: string
  units: string
  unit_kind: string
  display_decimals: number
  cadence: string
  geo_level: string
  geo_code: string | null
  geo_label: string
  geo_slug: string | null
  seasonal_adjustment: string
  attribution: string
  attribution_url: string
  license: string | null
  is_public: boolean
  notes: string | null
  last_checked_at: string | null
  last_ingested_at: string | null
}

/** One row of public.stat_observations. */
export type StatObservationRow = {
  series_id: string
  observation_date: string
  realtime_start: string
  realtime_end: string
  /** null when the publisher reported "." for this vintage — a real date with no published figure. */
  value: number | null
  fetched_at: string
}

/**
 * A stored row whose realtime_end must move off 'infinity' because a newer
 * vintage supersedes it. Carried as its own instruction rather than as an
 * upsert so the run never rewrites fetched_at on a row it did not re-fetch.
 */
export type StatObservationClosure = {
  series_id: string
  observation_date: string
  realtime_start: string
  /** The last date this vintage was the current answer (new vintage minus one day). */
  realtime_end: string
}
