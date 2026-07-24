/**
 * range-periods — the /reports range-table period vocabulary. PURE.
 *
 * Deliberately free of any DAL/server import so the client `ReportsByCityView`
 * can render the selector without dragging `next/headers` (via the supabase
 * server client) into the browser bundle. The server DAL
 * (lib/data/market/getCityRangeReport.ts) imports these same constants, so the
 * selector's options and the fetcher's period vocabulary can never drift apart.
 */

/**
 * The period windows the range table offers. Every one is a period_type that
 * market_stats_cache actually populates for city rows (verified live 2026-07-24:
 * rolling_30d 4,930 rows · rolling_90d 6,918 · rolling_365d 10,649 · ytd 11 —
 * all refreshed the same day). Offering a window with no cache row would render
 * a table of em-dashes, so this list is the contract.
 *
 * The retired 7-day and 14-day windows are absent on purpose: the cache holds no
 * rolling_7d/rolling_14d row, and a 7-day median across these cities ran on
 * n = 0-5 (a single Sunriver sale was publishing an $885,000 "median").
 */
export const RANGE_PERIODS = ['rolling_30d', 'rolling_90d', 'ytd', 'rolling_365d'] as const
export type RangePeriod = (typeof RANGE_PERIODS)[number]

export const RANGE_PERIOD_LABELS: Record<RangePeriod, string> = {
  rolling_30d: 'Last 30 days',
  rolling_90d: 'Last 90 days',
  ytd: 'Year to date',
  rolling_365d: 'Last 12 months',
}

export const DEFAULT_RANGE_PERIOD: RangePeriod = 'rolling_30d'

/** Narrow an untrusted ?range= value to a supported period. Pure — unit-tested. */
export function parseRangePeriod(raw: unknown): RangePeriod {
  const s =
    typeof raw === 'string'
      ? raw.trim()
      : Array.isArray(raw)
        ? String(raw[0] ?? '').trim()
        : ''
  return (RANGE_PERIODS as readonly string[]).includes(s) ? (s as RangePeriod) : DEFAULT_RANGE_PERIOD
}

export type CityRangeRow = {
  /** Display name, e.g. 'La Pine'. */
  city: string
  /** Hyphenated URL slug for /housing-market/<slug> links. */
  urlSlug: string
  soldCount: number | null
  medianSalePrice: number | null
  medianDom: number | null
  medianPricePerSqft: number | null
  activeCount: number | null
  /** Trailing-12-month closings — rolling_365d, independent of the chosen period. */
  sales12mo: number | null
  /** Canonical months of supply from the pulse (active / (closed_6mo / 6)). */
  monthsOfSupply: number | null
  /** The chosen period row's OWN bounds — the §0 label for this row. */
  periodStart: string | null
  periodEnd: string | null
}

export type CityRangeReport = {
  period: RangePeriod
  periodLabel: string
  rows: CityRangeRow[]
  /** Envelope of the rendered rows' own cache bounds (never a computed guess). */
  periodStart: string | null
  periodEnd: string | null
}

/**
 * True when the row carries at least one real market signal. Mirrors
 * hasReportSignal in getCityReportSnapshot — a city with no median, no active
 * inventory, and no sales has nothing to report, so the renderer drops it rather
 * than showing a wall of dashes. Pure — exported for unit tests.
 */
export function hasRangeSignal(r: CityRangeRow): boolean {
  return (
    r.medianSalePrice != null ||
    (r.activeCount ?? 0) > 0 ||
    (r.soldCount ?? 0) > 0 ||
    (r.sales12mo ?? 0) > 0
  )
}

/**
 * Envelope the rendered rows' own period bounds. Rows for one period_type share
 * bounds in practice (one cron computes them together); if any row differs, the
 * min/max span is an honest envelope of what is actually on screen rather than a
 * recomputed window. Pure — exported for unit tests.
 */
export function envelopePeriod(rows: CityRangeRow[]): {
  periodStart: string | null
  periodEnd: string | null
} {
  const starts = rows.map((r) => r.periodStart).filter((v): v is string => !!v).sort()
  const ends = rows.map((r) => r.periodEnd).filter((v): v is string => !!v).sort()
  return { periodStart: starts[0] ?? null, periodEnd: ends[ends.length - 1] ?? null }
}
