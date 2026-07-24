/**
 * getCityRangeReport — the §0 canonical per-city ROW for the /reports range table.
 *
 * WHY THIS EXISTS (W8.1, the raw-listings-RPC retirement):
 * the /reports page rendered cache-based headline cards directly ABOVE an
 * RPC-based range table, and the two disagreed on the same city, on one screen:
 *
 *     Bend card:  507 active · MoS 3.9 · "seller's market"   (market_pulse_live)
 *     Bend table: 984 active · MoS 5.3 · "balanced market"   (get_city_period_metrics)
 *
 * Two causes compounded. (1) PROPERTY UNIVERSE — the RPC admitted condo/townhome
 * and more, while market_pulse_live / market_stats_cache are SFR-only
 * (PropertyType='A'); Bend's active count and 12-month sales both ran ~1.43x hot.
 * (2) MoS BASIS — the RPC's inventory_months used a /12 absorption divisor, so the
 * verdict pill sat next to a number computed differently than the threshold it was
 * compared against (CLAUDE.md §0.4 fixes MoS at active / (closed_6mo / 6)).
 *
 * This DAL reads the SAME cache the headline cards read, so the table and the cards
 * can no longer disagree — they agree BY CONSTRUCTION, not by a monitor catching
 * drift after the fact.
 *
 * §0 trace, per column of the rendered table:
 *   Sold            -> market_stats_cache.sold_count                     (chosen period)
 *   Median price    -> market_stats_cache.median_sale_price             (chosen period, CLOSE price)
 *   Median DOM      -> market_stats_cache.median_dom                     (chosen period)
 *   $/sq ft         -> market_stats_cache.median_price_per_sqft_closed   (chosen period)
 *   Active listings -> market_pulse_live.active_count                    (live, no period)
 *   Sales (12 mo)   -> market_stats_cache.sold_count                     (rolling_365d)
 *   Months of supply-> market_pulse_live.months_of_supply                (canonical /6)
 *
 * The median is CLOSE-based and inherits the cache's n>=3 gate (the ODS rule in
 * compute_and_cache_period_stats): a period with fewer than three closings stores
 * NULL rather than a "median" from one sale. The retired RPC had no such gate and
 * was publishing, e.g., a $885,000 Sunriver "median" computed from a single sale
 * in the 7-day window. Short windows are gone for the same reason: the cache holds
 * no rolling_7d/rolling_14d row, and a 7-day median across these cities runs on
 * n = 0-5.
 *
 * NEVER aggregates raw `listings`. NEVER fabricates a figure — a missing cache row
 * yields null fields and the renderer shows an em-dash.
 *
 * DAL boundary (G1): reads ONLY through other DAL functions. No raw `.from()`.
 * Slug resolution reuses citySlugCandidates (space-separated first) so 'La Pine'
 * finds the 'la pine' cache row.
 */

import { getCityMarketDetail } from '@/lib/data/market/getCityMarketDetail'
import { getMarketPulse } from '@/lib/data/market/getMarketPulse'
import { citySlugCandidates, cityUrlSlug } from '@/lib/data/market/getCityReportSnapshot'
import {
  RANGE_PERIOD_LABELS,
  hasRangeSignal,
  envelopePeriod,
  type RangePeriod,
  type CityRangeRow,
  type CityRangeReport,
} from '@/lib/market/range-periods'

export {
  RANGE_PERIODS,
  RANGE_PERIOD_LABELS,
  DEFAULT_RANGE_PERIOD,
  parseRangePeriod,
  hasRangeSignal,
  envelopePeriod,
  type RangePeriod,
  type CityRangeRow,
  type CityRangeReport,
} from '@/lib/market/range-periods'

function toNum(v: unknown): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function isoDay(v: unknown): string | null {
  return v ? String(v).slice(0, 10) : null
}

/**
 * One city's range row.
 *
 * SLUG RESOLUTION IS PER-SOURCE, NOT PER-CITY. A multi-word city does not keep
 * all of its rows under one spelling: market_pulse_live carries 'la pine' while
 * the market_stats_cache `ytd` row lives under 'la-pine'. Resolving the city to
 * ONE slug (first candidate that answers anything) therefore silently drops the
 * other source — La Pine's year-to-date rendered as em-dashes while the cache
 * held 44 sales at a $369,950 median. Publishing "no data" for a place that has
 * data is a §0 failure, so each source is resolved independently: take the first
 * candidate spelling that actually returns a row for THAT read.
 *
 * Single-word cities produce one candidate (spaced === hyphenated), so this
 * costs nothing for them; multi-word cities issue one extra cached read.
 */
export async function getCityRangeRow(
  cityLabel: string,
  period: RangePeriod,
): Promise<CityRangeRow | null> {
  const candidates = citySlugCandidates(cityLabel)

  const perCandidate = await Promise.all(
    candidates.map(async (geoSlug) => {
      const [detail, trailing, pulse] = await Promise.all([
        getCityMarketDetail({ geoType: 'city', geoSlug, periodType: period }),
        period === 'rolling_365d'
          ? Promise.resolve(null)
          : getCityMarketDetail({ geoType: 'city', geoSlug, periodType: 'rolling_365d' }),
        getMarketPulse({ geoType: 'city', geoSlug }),
      ])
      return { detail, trailing, pulse }
    }),
  )

  const detail = perCandidate.find((c) => c.detail)?.detail ?? null
  const pulse = perCandidate.find((c) => c.pulse)?.pulse ?? null
  const trailing = perCandidate.find((c) => c.trailing)?.trailing ?? null
  if (!detail && !pulse) return null

  // When the chosen period IS rolling_365d, its own row supplies sales-12mo —
  // never a second read, and never a different number for the same window.
  const twelve = period === 'rolling_365d' ? detail : trailing
  return {
    city: cityLabel,
    urlSlug: cityUrlSlug(cityLabel),
    soldCount: toNum(detail?.soldCount),
    medianSalePrice: toNum(detail?.medianSalePrice),
    medianDom: toNum(detail?.medianDom),
    medianPricePerSqft: toNum(detail?.medianPricePerSqft),
    activeCount: toNum(pulse?.activeCount),
    sales12mo: toNum(twelve?.soldCount),
    monthsOfSupply: toNum(pulse?.monthsOfSupply),
    periodStart: isoDay(detail?.periodStart),
    periodEnd: isoDay(detail?.periodEnd),
  }
}

/**
 * The /reports range table. Input order preserved, duplicates dropped, no-signal
 * cities omitted. Underlying reads are already resiliently cached (getMarketPulse
 * 10-15 min, getCityMarketDetail 6h) — no extra cache layer here.
 */
export async function getCityRangeReport(
  cityLabels: string[],
  period: RangePeriod,
): Promise<CityRangeReport> {
  const seen = new Set<string>()
  const labels: string[] = []
  for (const raw of cityLabels) {
    const label = typeof raw === 'string' ? raw.trim() : ''
    const key = label.toLowerCase()
    if (!label || seen.has(key)) continue
    seen.add(key)
    labels.push(label)
  }

  const settled = await Promise.all(
    labels.map((label) => getCityRangeRow(label, period).catch(() => null)),
  )
  const rows = settled.filter((r): r is CityRangeRow => r !== null).filter(hasRangeSignal)

  return {
    period,
    periodLabel: RANGE_PERIOD_LABELS[period],
    rows,
    ...envelopePeriod(rows),
  }
}
