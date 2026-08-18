/**
 * Pure row-building logic for the weekly market history snapshot.
 *
 * Separated from route.ts so the metric extraction and the WoW-safe upsert
 * keys are unit-testable without Supabase or fetch. The route stays a thin
 * shell: auth -> read pulse -> buildPulseSnapshotRows -> upsert.
 */

import type { NationalSeriesPoint } from '@/lib/market-national-series'

/**
 * One upsert row for public.market_history_weekly.
 *
 * `source` names WHERE the number came from and `observation_date` names WHEN
 * the source says it was observed — §0 needs both, and they are not the same
 * as `captured_at` (when this cron wrote the row). Freddie publishes the 30yr
 * rate for a week-ending Thursday; this cron runs the following Monday, so
 * captured_at overstates the number's freshness by days. Null only when the
 * source publishes no date.
 */
export type MarketHistoryRow = {
  week_start: string // YYYY-MM-DD, Monday UTC
  geo_type: string
  geo_slug: string
  metric: string
  value: number
  source: string
  observation_date: string | null // YYYY-MM-DD, as stamped by the source
}

/** The slice of a market_pulse_live row the snapshot reads. */
export type PulseSnapshotSource = {
  geo_type: string
  geo_slug: string
  active_count: number | null
  new_count_7d: number | null
  pending_count: number | null
  price_reduction_share: number | null
  months_of_supply: number | null
  median_list_price: number | null
  /** Pulse refresh timestamp — the pulse row's own vintage. */
  updated_at: string | null
}

/** Columns the route selects from market_pulse_live — keep in sync with PulseSnapshotSource. */
export const PULSE_SELECT_COLUMNS =
  'geo_type, geo_slug, active_count, new_count_7d, pending_count, ' +
  'price_reduction_share, months_of_supply, median_list_price, updated_at'

/** Metric keys captured per geo, mapped from their pulse column. */
export const PULSE_METRICS = [
  'active_count',
  'new_count_7d',
  'pending_count',
  'price_reduction_share',
  'months_of_supply',
  'median_list_price',
] as const

export type PulseMetric = (typeof PULSE_METRICS)[number]

/** National metric keys. */
export const NATIONAL_METRICS = {
  mortgage30: 'mortgage_rate_30yr',
  treasury10: 'treasury_10yr',
  spread: 'mortgage_treasury_spread',
} as const

export const NATIONAL_GEO = { geo_type: 'national', geo_slug: 'us' } as const

/**
 * Monday (UTC) of the ISO week containing `date`, as YYYY-MM-DD.
 *
 * This is THE idempotency key: every run inside the same Mon-Sun window
 * produces the same week_start, so a retried cron (or a manual re-fire later
 * the same week) upserts over its own rows instead of appending.
 */
export function weekStartUtc(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  // getUTCDay(): Sun=0 .. Sat=6. Distance back to Monday.
  const daysSinceMonday = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - daysSinceMonday)
  return d.toISOString().slice(0, 10)
}

function toFiniteNumber(v: unknown): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Date part of a source-supplied timestamp, or null when it is missing or
 * unparseable. Never substitutes today's date — an invented vintage is worse
 * than an absent one (§0).
 */
export function toObservationDate(v: unknown): string | null {
  if (typeof v !== 'string' || v.length === 0) return null
  const parsed = new Date(v)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

/**
 * One row per (geo, metric) from the live pulse rows. Null/non-finite metric
 * values are skipped (value is NOT NULL in the table — a metric the pulse
 * cannot provide this week is simply absent, never zero-filled, per §0).
 *
 * The pulse row's own `updated_at` is the vintage of every metric taken from
 * it — the pulse refreshes every 10-15 minutes, so it is normally same-day as
 * the run, but recording it means a stalled pulse shows up as a stale
 * observation_date instead of hiding behind a fresh captured_at.
 */
export function buildPulseSnapshotRows(weekStart: string, pulseRows: PulseSnapshotSource[]): MarketHistoryRow[] {
  const rows: MarketHistoryRow[] = []
  for (const pulse of pulseRows) {
    if (!pulse.geo_type || !pulse.geo_slug) continue
    const observationDate = toObservationDate(pulse.updated_at)
    for (const metric of PULSE_METRICS) {
      const value = toFiniteNumber(pulse[metric])
      if (value === null) continue
      rows.push({
        week_start: weekStart,
        geo_type: pulse.geo_type,
        geo_slug: pulse.geo_slug,
        metric,
        value,
        source: 'market_pulse_live',
        observation_date: observationDate,
      })
    }
  }
  return rows
}

/**
 * National context rows: 30yr mortgage, 10Y treasury, and the computed
 * spread (mortgage30 - dgs10). Each series degrades independently; the
 * spread only exists when both inputs do.
 *
 * Each row keeps the PROVIDER's observation date, not the run date. FRED
 * reports the date of the observation it returns; Freddie's PMMS row is dated
 * to its week-ending Thursday. week_start is the Monday this cron ran, which
 * is a different (later) day — publishing that as the rate's date would
 * overstate its freshness, so it is never used as the vintage.
 */
export function buildNationalRows(
  weekStart: string,
  mortgage30: NationalSeriesPoint | null,
  treasury10: NationalSeriesPoint | null,
): MarketHistoryRow[] {
  const rows: MarketHistoryRow[] = []
  if (mortgage30 && Number.isFinite(mortgage30.value)) {
    rows.push({
      week_start: weekStart,
      ...NATIONAL_GEO,
      metric: NATIONAL_METRICS.mortgage30,
      value: mortgage30.value,
      source: mortgage30.source,
      observation_date: toObservationDate(mortgage30.observationDate),
    })
  }
  if (treasury10 && Number.isFinite(treasury10.value)) {
    rows.push({
      week_start: weekStart,
      ...NATIONAL_GEO,
      metric: NATIONAL_METRICS.treasury10,
      value: treasury10.value,
      source: treasury10.source,
      observation_date: toObservationDate(treasury10.observationDate),
    })
  }
  if (mortgage30 && treasury10 && Number.isFinite(mortgage30.value) && Number.isFinite(treasury10.value)) {
    const mortgageObserved = toObservationDate(mortgage30.observationDate)
    const treasuryObserved = toObservationDate(treasury10.observationDate)
    rows.push({
      week_start: weekStart,
      ...NATIONAL_GEO,
      metric: NATIONAL_METRICS.spread,
      // Round to 2dp to avoid float dust (6.78 - 4.42 = 2.3599999...).
      value: Math.round((mortgage30.value - treasury10.value) * 100) / 100,
      source: 'computed:mortgage30-dgs10',
      // The weekly mortgage rate and the daily treasury rarely share an
      // observation date. A composite is only as current as its OLDEST input,
      // so the spread is dated to the earlier of the two — dating it to the
      // newer one would claim a freshness the mortgage leg does not have.
      // Null if either leg has no usable date: a half-known vintage is not a
      // vintage.
      observation_date:
        mortgageObserved && treasuryObserved
          ? (mortgageObserved < treasuryObserved ? mortgageObserved : treasuryObserved)
          : null,
    })
  }
  return rows
}

/**
 * The upsert conflict target — must match the table PK exactly so a rerun
 * within the same week updates in place (idempotent) and a new week appends.
 */
export const UPSERT_ON_CONFLICT = 'week_start,geo_type,geo_slug,metric'
