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
 * DAL boundary (G1): pulse figures through getMarketPulseRowForGeo; leftover
 * through getPublicDetachedPace. No raw `.from()` here.
 *
 * §0 degraded-read contract: this module NEVER fabricates a number.
 *   - FOUND    -> every real column, verdict computed once via marketVerdict()
 *                 (lib/market/classify.ts) — never re-derived here.
 *                 City/region: inventory (active/median) overlays even when
 *                 MOS is below min_n. MOS/verdict overlay only when publishable.
 *                 A full inventory miss withholds activeListings rather than pulse.
 *                 HUD-family overlay: leftover Closed · 30 days, leftover
 *                 90-day days to pending, leftover 12-month sale-to-original,
 *                 leftover median age of actives. New · 30 days is omitted
 *                 until leftover has a true 30-day new-listings cell. A leftover
 *                 miss is null, never 0, never pulse fill. Neighborhood leftover
 *                 and extra types overlay the same way. Pulse MOS at neighborhood
 *                 grain is withheld unless Market Truth headlines assemble.
 *   - NOT_FOUND -> genuine miss (no row for this geo_type/geo_slug). All
 *                 figures null, `note` says so explicitly.
 *   - ERROR    -> getMarketPulseRowForGeo THROWS on a transient DB error
 *                 (readOrThrow contract). Caught here, surfaced as `degraded`
 *                 with all figures null — never a fabricated 0 (see
 *                 scripts/check-count-from-degraded-read.mjs).
 */

import { getMarketPulseRowForGeo } from '@/lib/data/market/getMarketStatsCacheRows'
import {
  cityDetachedSlug,
  getDetachedOverlays,
  type DetachedInventory,
  type SellBendMarket,
} from '@/lib/data/market-truth/getSellBendMarket'
import { marketVerdict, MOS_METHODOLOGY_CLAUSE, MOS_THRESHOLD_CLAUSE, type MarketKind } from '@/lib/market/classify'
import {
  getPublicDetachedPace,
  publicPaceHasRow,
  type PublicPaceRow,
} from '@/lib/data/market-truth/public-pace'
import {
  getPublicPlaceSegments,
  type PublicPlaceSegment,
  type PublicSegmentRow,
} from '@/lib/data/market-truth/public-segments'
import {
  getPublicDetachedMix,
  publicMixHasRow,
  type PublicMixRow,
} from '@/lib/data/market-truth/public-mix'

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

/** Detached leftover. 12-month cells plus pending/age now. Miss is null. */
export type MarketPulseJsonLeftover = PublicPaceRow

const LEFTOVER_NOTE =
  'HUD-family figures are leftover membership. Closed · 30 days and Median to pending are leftover windows. New · 30 days is omitted until leftover has a 30-day new-listings cell. figures.medianSaleToListRatio is leftover saleToOriginal (12-month). A leftover miss omits. Pulse does not fill those fields.'

const EXTRA_SEGMENTS_NOTE =
  'Extra product types are Market Truth mt-v1, sample-gated. Detached stays the HUD. Leftover pace (days to contract, sale to original, YoY, price-cut share) is 12-month, not pulse days-to-pending.'

const MIX_NOTE =
  'Detached mix and feature floors are Market Truth mt-v1, 12-month. Feature flags other than garage are D12 floors labeled at least.'

export type MarketPulseJsonExtraSegment = {
  segment: PublicPlaceSegment
  activeCount: number
  medianList: number | null
  monthsOfSupply: number | null
  verdict: string | null
  pendingCount: number | null
  closedCount: number | null
  daysToContract: number | null
  saleToOriginal: number | null
  yoyMedian: number | null
  priceCutShare: number | null
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
      leftover: MarketPulseJsonLeftover | null
      extraSegments: MarketPulseJsonExtraSegment[] | null
      mix: PublicMixRow | null
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
      leftover: null
      extraSegments: null
      mix: null
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
      leftover: null
      extraSegments: null
      mix: null
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
      leftover: null,
      extraSegments: null,
      mix: null,
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
      leftover: null,
      extraSegments: null,
      mix: null,
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
    leftover: null,
    extraSegments: null,
    mix: null,
    methodology,
    note: null,
  }

  if (geoType === 'city' || geoType === 'region' || geoType === 'neighborhood') {
    const [layers, leftover, extraSegments, mix] = await Promise.all([
      readDetachedOverlay(geoType, geoSlug),
      readJsonFeedLeftover(geoType, geoSlug),
      readJsonFeedExtraSegments(geoType, geoSlug),
      readJsonFeedMix(geoType, geoSlug),
    ])
    applyJsonFeedDetachedOrWithhold(found, layers)
    found.leftover = leftover
    found.figures.medianSaleToListRatio = leftover?.saleToOriginal ?? null
    found.figures.soldLast30Days = leftover?.closedCount30d ?? null
    found.figures.medianDaysToPending = leftover?.daysToPending90d ?? null
    found.figures.newListings30d = null
    found.figures.medianActiveDaysOnMarket = leftover?.medianAgeActive ?? null
    applyJsonFeedLeftoverHudFamily(found, leftover)
    found.extraSegments = extraSegments
    found.mix = mix
    if (leftover) {
      found.note = found.note ? `${found.note} ${LEFTOVER_NOTE}` : LEFTOVER_NOTE
    }
    if (extraSegments.length > 0) {
      found.note = found.note ? `${found.note} ${EXTRA_SEGMENTS_NOTE}` : EXTRA_SEGMENTS_NOTE
    }
    if (mix) {
      found.note = found.note ? `${found.note} ${MIX_NOTE}` : MIX_NOTE
    }
  }

  return found
}

type JsonFeedOverlay = {
  headlines: SellBendMarket | null
  inventory: DetachedInventory | null
}

/** Leftover. Throw and miss both omit — never 0. */
async function readJsonFeedLeftover(
  geoType: 'city' | 'region' | 'neighborhood',
  geoSlug: string,
): Promise<MarketPulseJsonLeftover | null> {
  try {
    const row = await getPublicDetachedPace({ geoType, geoSlug })
    return publicPaceHasRow(row) ? row : null
  } catch {
    return null
  }
}

/** Detached mix/feature floors. Throw and miss omit. */
async function readJsonFeedMix(
  geoType: 'city' | 'region' | 'neighborhood',
  geoSlug: string,
): Promise<PublicMixRow | null> {
  try {
    const row = await getPublicDetachedMix({ geoType, geoSlug })
    return publicMixHasRow(row) ? row : null
  } catch {
    return null
  }
}

/** Extra types. Throw and miss both omit — never 0. */
async function readJsonFeedExtraSegments(
  geoType: 'city' | 'region' | 'neighborhood',
  geoSlug: string,
): Promise<MarketPulseJsonExtraSegment[]> {
  try {
    const rows = await getPublicPlaceSegments({ geoType, geoSlug })
    return jsonExtraSegments(rows)
  } catch {
    return []
  }
}

function jsonExtraSegments(rows: readonly PublicSegmentRow[]): MarketPulseJsonExtraSegment[] {
  const out: MarketPulseJsonExtraSegment[] = []
  for (const row of rows) {
    if (row.activeCount == null || row.activeCount <= 0) continue
    out.push({
      segment: row.segment,
      activeCount: row.activeCount,
      medianList: row.medianList,
      monthsOfSupply: row.monthsOfSupply,
      verdict: row.verdict,
      pendingCount: row.pendingCount,
      closedCount: row.closedCount,
      daysToContract: row.daysToContract,
      saleToOriginal: row.saleToOriginal,
      yoyMedian: row.yoyMedian,
      priceCutShare: row.priceCutShare,
    })
  }
  return out
}

/** Leftover HUD-family overlay. Pulse-only cells without a leftover equivalent omit. */
function applyJsonFeedLeftoverHudFamily(
  found: Extract<MarketPulseJsonFeedResult, { status: 'found' }>,
  leftover: PublicPaceRow | null,
): void {
  found.figures.pendingListings = leftover?.pendingCount ?? null
  found.figures.newListings7d = null
  found.figures.avgListPrice = null
  found.figures.soldLast90Days = null
  found.figures.medianClosePrice90d = null
  found.figures.pctSoldOverAskingPct = null
  found.figures.pctSoldUnderAskingPct = null
  found.figures.pctSoldAtAskingPct = null
  found.figures.priceReductionSharePct =
    leftover?.priceCutShare != null && leftover.priceCutShare > 0
      ? leftover.priceCutShare < 2
        ? leftover.priceCutShare * 100
        : leftover.priceCutShare
      : null
  found.figures.absorptionRatePct = null
  found.figures.pendingToActiveRatio =
    leftover?.pendingCount != null &&
    leftover.pendingCount > 0 &&
    found.figures.activeListings != null &&
    found.figures.activeListings > 0
      ? leftover.pendingCount / found.figures.activeListings
      : null
  found.figures.expiredRate90dPct = null
  found.figures.sellThroughRate90dPct = null
  found.figures.netInventoryChange30d = null
  found.figures.newConstructionSharePct = null
  found.figures.avgPriceDropsActive = null
  found.figures.marketHealthScore = null
}

/** City/region overlay. Throw and miss both withhold — never pulse 488. */
async function readDetachedOverlay(
  geoType: 'city' | 'region' | 'neighborhood',
  geoSlug: string,
): Promise<JsonFeedOverlay> {
  try {
    const map = await getDetachedOverlays([{ geoType, geoSlug }])
    const slug = geoType === 'region' ? geoSlug.trim().toLowerCase() : cityDetachedSlug(geoSlug)
    return map.get(`${geoType}:${slug}`) ?? { headlines: null, inventory: null }
  } catch {
    return { headlines: null, inventory: null }
  }
}

/**
 * Inventory (active/median) overlays even when MOS is below min_n.
 * MOS/verdict overlay only when headlines assemble. Inventory miss nulls
 * activeListings (unknown is not zero) — never pulse 488.
 */
function applyJsonFeedDetachedOrWithhold(
  found: Extract<MarketPulseJsonFeedResult, { status: 'found' }>,
  layers: JsonFeedOverlay,
): void {
  const inv = layers.inventory
  const mt = layers.headlines
  if (inv) {
    found.figures.activeListings = inv.activeCount
    if (inv.medianListPrice != null) found.figures.medianListPrice = inv.medianListPrice
    found.collectedAt = inv.computedAt
    found.methodology.propertyTypeConvention =
      "Detached single-family (PropertyType='A' AND property_sub_type='Single Family Residence'). MLS City text, not the city-limits polygon."
  } else {
    found.figures.activeListings = null
    found.figures.medianListPrice = null
  }

  if (mt) {
    found.figures.monthsOfSupply = mt.monthsOfSupply
    if (mt.medianListPrice != null) found.figures.medianListPrice = mt.medianListPrice
    found.figures.marketHealthLabel = mt.verdictLabel
    found.methodology.verdict = mt.verdictLabel
    found.methodology.verdictKind = mt.verdictKind
    found.methodology.propertyTypeConvention =
      "Detached single-family (PropertyType='A' AND property_sub_type='Single Family Residence'). MLS City text, not the city-limits polygon."
    found.collectedAt = mt.computedAt
    found.note =
      'HUD-family figures are leftover membership. A leftover miss omits. Pulse does not fill.'
    return
  }

  found.figures.monthsOfSupply = null
  found.figures.marketHealthLabel = null
  const withheld = marketVerdict(null)
  found.methodology.verdict = withheld.label
  found.methodology.verdictKind = withheld.kind
  found.note = inv
    ? 'monthsOfSupply and verdict withheld: MOS below min_n. activeListings is Market Truth mt-v1 detached inventory. Remaining figures are the pulse type-A polygon series until their recon line exists.'
    : 'activeListings, monthsOfSupply, and verdict withheld: Market Truth detached cell missing. Remaining figures are the pulse type-A polygon series until their recon line exists.'
}
