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
 *   Sold            -> market_stats_cache.sold_count for rolling_30d / 90d / ytd;
 *                      leftover.closedCount when the chosen period is rolling_365d
 *   Median price    -> market_stats_cache.median_sale_price for 30d / 90d / ytd;
 *                      leftover.medianClose when the chosen period is rolling_365d
 *   Median DOM      -> market_stats_cache.median_dom                     (chosen period)
 *   $/sq ft         -> market_stats_cache.median_price_per_sqft_closed for 30d / 90d / ytd;
 *                      leftover.medianPpsf when the chosen period is rolling_365d
 *   Active listings -> market_pulse_live.active_count                    (live, no period)
 *   Sales (12 mo)   -> leftover.closedCount (Market Truth 12-month). Miss omits;
 *                      never cache rolling_365d. Default range is 30 days — leftover
 *                      does not map onto that Sold column.
 *   Months of supply-> market_pulse_live.months_of_supply                (canonical /6)
 *
 * Leftover days-to-contract is not DOM — Median DOM stays cache on every period.
 * On rolling_365d, leftover.medianPpsf overlays the $/sq ft column; 30d / 90d /
 * ytd keep cache ppsf. UNKNOWN IS NOT ZERO: a leftover miss nulls the 12-month
 * count (and rolling_365d Sold/Median/$/sq ft) rather than printing cache.
 *
 * The median is CLOSE-based and gated at n>=3: a period with fewer than three
 * closings stores NULL rather than a "median" from one sale.
 *
 * CORRECTION (2026-07-24): an earlier version of this comment claimed the cache
 * already enforced that gate. It did not. compute_and_cache_period_stats computed
 * median_sale_price as a bare percentile_cont with no sample gate at all — only its
 * SIBLING statistics (median_dom, ppsf, sale_to_list) were gated, at n>=5. So the
 * replacement carried the same hole the retired RPC was condemned for, and 1,526
 * cached rows across 34 geos held a median computed from one or two closings, 907
 * of them from a SINGLE sale (Terrebonne YTD published $708,500 from n=2 beside a
 * +6.9% YoY; Black Butte Ranch monthly, $88,500 from n=1, -93.5% YoY). Migration
 * 20260724210000 added the gate at all three sites that derive a median from
 * "ClosePrice" — the current period and both prior-period baselines, so a YoY
 * delta can never be derived from a 1-2 sale comparison either — and the stored
 * rows were cleared. The claim is now true because it was made true, not because
 * it was inherited.
 *
 * Short windows are gone for a related reason: the cache holds no
 * rolling_7d/rolling_14d row, and a 7-day median across these cities runs on
 * n = 0-5, so most of them would be NULL under the gate anyway.
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
import { cityDetachedSlug, getDetachedOverlays } from '@/lib/data/market-truth/getSellBendMarket'
import { leftoverHudKpis, type LeftoverHudKpis } from '@/lib/market/publish-leftover-hud'
import { citySlugCandidates, cityUrlSlug } from '@/lib/data/market/getCityReportSnapshot'
import {
  EMPTY_PUBLIC_PACE,
  getPublicDetachedPace,
  type PublicPaceRow,
} from '@/lib/data/market-truth/public-pace'
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

async function readCityLeftover(cityLabel: string): Promise<PublicPaceRow> {
  try {
    return await getPublicDetachedPace({ geoType: 'city', geoSlug: cityUrlSlug(cityLabel) })
  } catch {
    return { ...EMPTY_PUBLIC_PACE }
  }
}

/**
 * Overlay leftover 12-month close onto Sales (12 mo). When the selected period
 * is rolling_365d, Sold, Median, and $/sq ft are that same window — overlay
 * those too. rolling_30d / 90d / ytd Sold, Median, and $/sq ft stay cache.
 * Median DOM stays cache. Miss omits, never cache.
 */
export function overlayRangeLeftover(
  row: CityRangeRow,
  leftover: Pick<PublicPaceRow, 'closedCount' | 'medianClose' | 'medianPpsf'> | null,
  period: RangePeriod,
  hud?: Pick<LeftoverHudKpis, 'active' | 'monthsSupply'> | null,
): CityRangeRow {
  const closed = leftover?.closedCount ?? null
  const medianClose = leftover?.medianClose ?? null
  const medianPpsf = leftover?.medianPpsf ?? null
  return {
    ...row,
    sales12mo: closed,
    soldCount: period === 'rolling_365d' ? closed : row.soldCount,
    medianSalePrice: period === 'rolling_365d' ? medianClose : row.medianSalePrice,
    medianPricePerSqft: period === 'rolling_365d' ? medianPpsf : row.medianPricePerSqft,
    activeCount: hud ? hud.active : row.activeCount,
    monthsOfSupply: hud ? hud.monthsSupply : row.monthsOfSupply,
  }
}

/**
 * One city's range row.
 *
 * EVERY FIGURE IN A ROW COMES FROM ONE SLUG SPELLING. Two spellings of a city are
 * NOT interchangeable sources to be mixed field-by-field. `market_stats_cache`
 * carried a retired hyphen convention ('la-pine') alongside the canonical
 * `lower("City")` space form ('la pine'), and for La Pine the hyphen slug also
 * matched a `boundaries` polygon — so its rows counted only inside the city
 * limits while the space rows counted the whole MLS city. Taking `soldCount`
 * from one spelling and cache `sales12mo` from the other produced a row
 * describing two different geographies: 44 closings "year to date" beside 58 in
 * the last 90 days, a strict sub-window. An impossible row is a worse §0 failure
 * than a missing one, so candidate spellings are tried in order and the FIRST
 * one that answers supplies every cache/pulse field.
 *
 * Sales (12 mo) is leftover, keyed on the URL slug, not a second cache spelling.
 * The underlying cache data was repaired (canonical ytd/quarterly rows written,
 * the 9 retired-convention city rows dropped), so the canonical spelling now
 * carries every period and this loop resolves on its first candidate.
 * `lib/data/market/city-range-slug.test.ts` pins the no-mixing rule.
 */
export async function getCityRangeRow(
  cityLabel: string,
  period: RangePeriod,
): Promise<CityRangeRow | null> {
  const leftoverTask = readCityLeftover(cityLabel)
  let detail: Awaited<ReturnType<typeof getCityMarketDetail>> = null
  let pulse: Awaited<ReturnType<typeof getMarketPulse>> = null

  for (const geoSlug of citySlugCandidates(cityLabel)) {
    const [d, p] = await Promise.all([
      getCityMarketDetail({ geoType: 'city', geoSlug, periodType: period }),
      getMarketPulse({ geoType: 'city', geoSlug }),
    ])
    // This candidate answers — commit to it for EVERY cache/pulse field and stop.
    if (d || p) {
      detail = d
      pulse = p
      break
    }
  }
  const leftover = await leftoverTask
  const leftoverHit = leftover.closedCount != null || leftover.medianClose != null
  const overlays = await getDetachedOverlays([{ geoType: 'city', geoSlug: cityUrlSlug(cityLabel) }]).catch(
    () => new Map(),
  )
  const layers = overlays.get(`city:${cityDetachedSlug(cityUrlSlug(cityLabel))}`)
  const hud = leftoverHudKpis({
    grain: 'city',
    headlines: layers?.headlines ?? null,
    inventory: layers?.inventory ?? null,
    pace: leftover,
  })
  if (!detail && !pulse && !leftoverHit && hud.active == null && hud.monthsSupply == null) return null

  return overlayRangeLeftover(
    {
      city: cityLabel,
      urlSlug: cityUrlSlug(cityLabel),
      soldCount: toNum(detail?.soldCount),
      medianSalePrice: toNum(detail?.medianSalePrice),
      medianDom: toNum(detail?.medianDom),
      medianPricePerSqft: toNum(detail?.medianPricePerSqft),
      activeCount: toNum(pulse?.activeCount),
      sales12mo: null,
      monthsOfSupply: toNum(pulse?.monthsOfSupply),
      periodStart: isoDay(detail?.periodStart),
      periodEnd: isoDay(detail?.periodEnd),
    },
    leftover,
    period,
    hud,
  )
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
