/**
 * getMarketPulseJsonFeed — wide, typed market_pulse_live projection for the
 * public per-geography JSON data endpoint (audit item 12).
 *
 * Why this exists: getMarketPulse() (lib/data/market/getMarketPulse.ts) only
 * selects the handful of columns the on-screen KPI cards need. The JSON feed
 * is a different consumer (a crawler / LLM citing the page's own numbers) and
 * publishes EVERY figure the pulse row carries, so it reads the wide column
 * list through getMarketPulseRowForGeo({ columns }) instead of narrowing.
 *
 * DAL boundary (G1): reads ONLY through getMarketPulseRowForGeo, the existing
 * exported DAL function in getMarketStatsCacheRows.ts. No raw `.from()` here.
 *
 * §0 degraded-read contract: this module NEVER fabricates a number.
 *   - FOUND    -> every real column, verdict computed once via marketVerdict()
 *                 (lib/market/classify.ts) — never re-derived here.
 *                 City/region headlines overlay getDetachedMarket when present.
 *                 A miss withholds activeListings, monthsOfSupply, and
 *                 marketHealthLabel/verdict rather than pulse (matching /sell).
 *                 Neighborhood grain keeps the pulse row — no invented MOS.
 *   - NOT_FOUND -> genuine miss (no row for this geo_type/geo_slug). All
 *                 figures null, `note` says so explicitly.
 *   - ERROR    -> getMarketPulseRowForGeo THROWS on a transient DB error
 *                 (readOrThrow contract). Caught here, surfaced as `degraded`
 *                 with all figures null — never a fabricated 0 (see
 *                 scripts/check-count-from-degraded-read.mjs).
 */

import { getMarketPulseRowForGeo } from '@/lib/data/market/getMarketStatsCacheRows'
import { getDetachedMarket } from '@/lib/data/market-truth/getSellBendMarket'
import { marketVerdict, MOS_METHODOLOGY_CLAUSE, MOS_THRESHOLD_CLAUSE, type MarketKind } from '@/lib/market/classify'

/** geo_type values market_pulse_live actually carries (verified live 2026-08-03: city, neighborhood, region). */
export type PulseGeoType = 'city' | 'neighborhood' | 'region'

const WIDE_COLUMNS = [
  'geo_type', 'geo_slug', 'geo_label',
  'active_count', 'pending_count', 'new_count_7d', 'new_count_30d',
  'median_list_price', 'avg_list_price',
  'market_health_score', 'market_health_label',
  'updated_at',
  'months_of_supply', 'absorption_rate_pct', 'pending_to_active_ratio',
  'median_sale_to_list', 'pct_sold_over_asking', 'pct_sold_under_asking', 'pct_sold_at_asking',
  'median_days_to_pending', 'avg_price_drops_active', 'price_reduction_share',
  'expired_rate_90d', 'sell_through_rate_90d', 'net_inventory_change_30d',
  'median_active_dom', 'new_construction_share',
  'sold_count_30d', 'sold_count_90d', 'median_close_price_90d',
  'property_type', 'methodology_version',
].join(', ')

function toNum(v: unknown): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function toStr(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s.length > 0 ? s : null
}

/** Every published market_pulse_live figure, camelCased, null when the row lacks it. */
export type MarketPulseJsonFigures = {
  activeListings: number | null
  pendingListings: number | null
  newListings7d: number | null
  newListings30d: number | null
  medianListPrice: number | null
  avgListPrice: number | null
  monthsOfSupply: number | null
  medianDaysToPending: number | null
  medianActiveDaysOnMarket: number | null
  soldLast30Days: number | null
  soldLast90Days: number | null
  medianClosePrice90d: number | null
  medianSaleToListRatio: number | null
  pctSoldOverAskingPct: number | null
  pctSoldUnderAskingPct: number | null
  pctSoldAtAskingPct: number | null
  priceReductionSharePct: number | null
  absorptionRatePct: number | null
  pendingToActiveRatio: number | null
  expiredRate90dPct: number | null
  sellThroughRate90dPct: number | null
  netInventoryChange30d: number | null
  newConstructionSharePct: number | null
  avgPriceDropsActive: number | null
  marketHealthScore: number | null
  marketHealthLabel: string | null
}

export type MarketPulseJsonMethodology = {
  monthsOfSupplyFormula: string
  monthsOfSupplyThresholds: string
  verdict: string
  verdictKind: MarketKind
  propertyTypeConvention: string
  cacheMethodologyVersion: string | null
}

export type MarketPulseJsonFeedResult =
  | {
      status: 'found'
      geoType: PulseGeoType
      geoSlug: string
      geoLabel: string | null
      collectedAt: string | null
      figures: MarketPulseJsonFigures
      methodology: MarketPulseJsonMethodology
      note: string | null
    }
  | {
      status: 'not_found'
      geoType: PulseGeoType
      geoSlug: string
      geoLabel: null
      collectedAt: null
      figures: null
      methodology: null
      note: string
    }
  | {
      status: 'degraded'
      geoType: PulseGeoType
      geoSlug: string
      geoLabel: null
      collectedAt: null
      figures: null
      methodology: null
      note: string
    }

/**
 * Fetch + shape one geography's full pulse row for the public JSON feed.
 * Never throws — every failure mode resolves to a typed `status`.
 */
export async function getMarketPulseJsonFeed(input: {
  geoType: PulseGeoType
  geoSlug: string
}): Promise<MarketPulseJsonFeedResult> {
  const { geoType, geoSlug } = input

  let row: Record<string, unknown> | null
  try {
    row = await getMarketPulseRowForGeo({ geoType, geoSlug, propertyType: 'A', columns: WIDE_COLUMNS })
  } catch (err) {
    // Transient DB error (readOrThrow-style contract upstream). §0: unknown is
    // not zero — never fall through to a fabricated figure.
    return {
      status: 'degraded',
      geoType,
      geoSlug,
      geoLabel: null,
      collectedAt: null,
      figures: null,
      methodology: null,
      note:
        `market_pulse_live read failed for ${geoType}/${geoSlug}: ` +
        `${err instanceof Error ? err.message : String(err)}. Figures withheld rather than shown as zero. Retry shortly.`,
    }
  }

  if (!row) {
    return {
      status: 'not_found',
      geoType,
      geoSlug,
      geoLabel: null,
      collectedAt: null,
      figures: null,
      methodology: null,
      note: `No market_pulse_live row for geo_type='${geoType}', geo_slug='${geoSlug}', property_type='A'. This geography is not published.`,
    }
  }

  const mos = toNum(row.months_of_supply)
  const verdict = marketVerdict(mos)

  const figures: MarketPulseJsonFigures = {
    activeListings: toNum(row.active_count),
    pendingListings: toNum(row.pending_count),
    newListings7d: toNum(row.new_count_7d),
    newListings30d: toNum(row.new_count_30d),
    medianListPrice: toNum(row.median_list_price),
    avgListPrice: toNum(row.avg_list_price),
    monthsOfSupply: mos,
    medianDaysToPending: toNum(row.median_days_to_pending),
    medianActiveDaysOnMarket: toNum(row.median_active_dom),
    soldLast30Days: toNum(row.sold_count_30d),
    soldLast90Days: toNum(row.sold_count_90d),
    medianClosePrice90d: toNum(row.median_close_price_90d),
    medianSaleToListRatio: toNum(row.median_sale_to_list),
    pctSoldOverAskingPct: toNum(row.pct_sold_over_asking),
    pctSoldUnderAskingPct: toNum(row.pct_sold_under_asking),
    pctSoldAtAskingPct: toNum(row.pct_sold_at_asking),
    priceReductionSharePct: toNum(row.price_reduction_share),
    absorptionRatePct: toNum(row.absorption_rate_pct),
    pendingToActiveRatio: toNum(row.pending_to_active_ratio),
    expiredRate90dPct: toNum(row.expired_rate_90d),
    sellThroughRate90dPct: toNum(row.sell_through_rate_90d),
    netInventoryChange30d: toNum(row.net_inventory_change_30d),
    newConstructionSharePct: toNum(row.new_construction_share),
    avgPriceDropsActive: toNum(row.avg_price_drops_active),
    marketHealthScore: toNum(row.market_health_score),
    marketHealthLabel: toStr(row.market_health_label),
  }

  const methodology: MarketPulseJsonMethodology = {
    monthsOfSupplyFormula: MOS_METHODOLOGY_CLAUSE,
    monthsOfSupplyThresholds: MOS_THRESHOLD_CLAUSE,
    verdict: verdict.label,
    verdictKind: verdict.kind,
    propertyTypeConvention: "Single-family residential only (MLS PropertyType = 'A').",
    cacheMethodologyVersion: toStr(row.methodology_version),
  }

  const found: Extract<MarketPulseJsonFeedResult, { status: 'found' }> = {
    status: 'found',
    geoType,
    geoSlug: toStr(row.geo_slug) ?? geoSlug,
    geoLabel: toStr(row.geo_label),
    collectedAt: toStr(row.updated_at),
    figures,
    methodology,
    note: null,
  }

  if (geoType === 'city' || geoType === 'region') {
    applyJsonFeedDetachedOrWithhold(found, await readDetachedMarket(geoType, geoSlug))
  }

  return found
}

/** City/region overlay. A miss withholds the three headlines — never pulse. */
async function readDetachedMarket(
  geoType: 'city' | 'region',
  geoSlug: string,
): Promise<Awaited<ReturnType<typeof getDetachedMarket>>> {
  try {
    return await getDetachedMarket(geoType, geoSlug)
  } catch {
    // Same as a cell miss: withhold headlines. Do not throw (this feed never
    // throws) and do not keep pulse 488 / 3.54 / seller as if it were detached.
    return null
  }
}

/**
 * Overlay Market Truth when the cell is present. On miss, withhold
 * activeListings, monthsOfSupply, and marketHealthLabel/verdict — matching
 * /sell, which prints none of those three rather than pulse.
 */
function applyJsonFeedDetachedOrWithhold(
  found: Extract<MarketPulseJsonFeedResult, { status: 'found' }>,
  mt: Awaited<ReturnType<typeof getDetachedMarket>>,
): void {
  if (mt) {
    found.figures.activeListings = mt.activeCount
    found.figures.monthsOfSupply = mt.monthsOfSupply
    found.figures.medianListPrice = mt.medianListPrice
    found.figures.marketHealthLabel = mt.verdictLabel
    found.methodology.verdict = mt.verdictLabel
    found.methodology.verdictKind = mt.verdictKind
    found.methodology.propertyTypeConvention =
      "Detached single-family (PropertyType='A' AND property_sub_type='Single Family Residence'). MLS City text, not the city-limits polygon."
    found.note =
      'activeListings, monthsOfSupply, medianListPrice, and verdict are Market Truth mt-v1 detached. Remaining figures are the pulse type-A polygon series until their recon line exists.'
    found.collectedAt = mt.computedAt
    return
  }

  found.figures.activeListings = null
  found.figures.monthsOfSupply = null
  found.figures.marketHealthLabel = null
  const withheld = marketVerdict(null)
  found.methodology.verdict = withheld.label
  found.methodology.verdictKind = withheld.kind
  found.note =
    'activeListings, monthsOfSupply, and verdict withheld: Market Truth detached cell missing. Remaining figures are the pulse type-A polygon series until their recon line exists.'
}
