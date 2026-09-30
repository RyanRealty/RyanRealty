import { getDetachedOverlays } from '@/lib/data'
import { EMPTY_PUBLIC_PACE, getPublicDetachedPace } from '@/lib/data/market-truth/public-pace'
import { leftoverHudKpis, leftoverHudPublishes, type LeftoverHudKpis } from '@/lib/market/publish-leftover-hud'
import { buildMarketFaq, type MarketFaqResult } from '@/lib/site/market-faq'
import { placeInventoryHref } from '@/lib/communities/self-city-community'
import { CITY_POPULAR_SEARCHES } from '@/lib/popular-searches'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import { REGIONAL_FRAME_LABEL } from '@/lib/search/search-opening'
import { formatPriceExact } from '@/lib/format/money'
import { formatMonthsOfSupply, monthsOfSupplyVerdict } from '@/lib/format/months-of-supply'

/**
 * The below-map depth of the bare /homes-for-sale (SITE-201).
 *
 * The bare URL is the one winner for "Central Oregon homes for sale", and it
 * shipped as a map shell: an sr-only h1, no h2, no FAQ, no Dataset, no doors
 * to the city searches. Meanwhile /cities, /cities/bend and a Bend area
 * search carried the depth and split the query between them. This is the
 * region's counterpart of city-split-depth.ts (SITE-190 / SITE-192): the same
 * Market Truth reads /cities publishes the region from (market_metric
 * detached, region central-oregon, through getDetachedOverlays +
 * getPublicDetachedPace), folded by the same helpers (leftoverHudKpis,
 * buildMarketFaq), so the band, the FAQ, the FAQPage node and the Dataset
 * node carry one set of figures and cannot disagree with each other or with
 * /cities.
 *
 * It STARTS in page.tsx beside the map's own viewport read and is awaited
 * after that read settles, with a grace (REGION_DEPTH_GRACE_MS), so the map
 * never waits on it. Every read is guarded and the whole is caught to null:
 * a slow or failed read omits the tail, it never blanks the page. Nothing
 * here types a number (CLAUDE.md section 0); a null figure is omitted by the
 * helpers that publish it.
 */

/** How long the bare hub may wait for its depth AFTER the viewport read settled. */
export const REGION_DEPTH_GRACE_MS = 1500

export const REGION_GEO = { geoType: 'region' as const, geoSlug: 'central-oregon' }

export type RegionSplitDepth = {
  /** The region's single-family figures, the band's source. Null when none publishes. */
  hud: LeftoverHudKpis | null
  /** computed_at of the Market Truth row the figures came from. */
  asOf: string | null
  regionMarketFaq: MarketFaqResult | null
  /** Plain "{City} homes for sale" doors, each to that city's one winner. */
  cityDoors: { href: string; label: string }[]
}

/** The city doors: the city search, or the community page for a self-city. */
export function regionCityDoors(): { href: string; label: string }[] {
  const seen = new Set<string>()
  const doors: { href: string; label: string }[] = []
  for (const entry of CITY_POPULAR_SEARCHES) {
    const href = placeInventoryHref(entry.city)
    if (!href || seen.has(href)) continue
    seen.add(href)
    doors.push({ href, label: `${entry.city} homes for sale` })
  }
  return doors
}

export function loadRegionSplitDepth(): Promise<RegionSplitDepth | null> {
  const run = async (): Promise<RegionSplitDepth> => {
    const [overlays, pace] = await Promise.all([
      withTimeoutFallback(getDetachedOverlays([REGION_GEO]), new Map(), 3500, 'search:regionOverlays'),
      withTimeoutFallback(getPublicDetachedPace(REGION_GEO), EMPTY_PUBLIC_PACE, 3000, 'search:regionPace'),
    ])
    const layers = overlays.get(`${REGION_GEO.geoType}:${REGION_GEO.geoSlug}`)
    const kpis = leftoverHudKpis({
      grain: 'region',
      headlines: layers?.headlines ?? null,
      inventory: layers?.inventory ?? null,
      pace,
    })
    const hud = leftoverHudPublishes(kpis) ? kpis : null
    const asOf = layers?.headlines?.computedAt ?? layers?.inventory?.computedAt ?? null
    const regionMarketFaq = hud
      ? buildMarketFaq(REGIONAL_FRAME_LABEL, {
          grain: 'region',
          source: 'market-truth',
          activeCount: hud.active,
          pulseActiveCount: hud.active,
          medianListPrice: hud.medianList,
          monthsOfSupply: hud.monthsSupply,
          medianDaysToPending: hud.daysToPending,
          soldCount12mo: hud.sold12mo ?? null,
          refreshedAt: asOf,
        })
      : null
    return { hud, asOf, regionMarketFaq, cityDoors: regionCityDoors() }
  }
  return run().catch(() => null)
}

/**
 * The region's market band, drawn ONLY from the Dataset variables
 * buildMarketFaq published. The band, the FAQ answers, the FAQPage node and
 * the Dataset node are therefore one set of figures: a figure the FAQ's
 * publish gates withheld is not on the band either, and each value is
 * formatted by the function the FAQ sentence uses. The verdict is classified
 * from the same one-decimal months of supply the reader sees.
 */
export type RegionMarketBand = {
  headline: string
  figures: { key: string; value: string; label: string; sentence: string; href?: string }[]
  source: string
  asOfIso: string | null
}

export function buildRegionMarketBand(faq: MarketFaqResult | null): RegionMarketBand | null {
  if (!faq) return null
  const byName = new Map(faq.datasetVariables.map((v) => [v.name, v.value]))
  const num = (name: string): number | null => {
    const value = byName.get(name)
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
  }
  const figures: RegionMarketBand['figures'] = []
  const active = num('Active Listings')
  if (active != null) {
    figures.push({
      key: 'active',
      value: active.toLocaleString('en-US'),
      label: 'single-family homes for sale',
      sentence: 'Listed in the regional MLS and not under contract yet.',
    })
  }
  const medianList = num('Median List Price')
  if (medianList != null) {
    figures.push({
      key: 'median-list',
      value: formatPriceExact(medianList),
      label: 'median list price',
      sentence: 'Half of the homes for sale ask more than this, half ask less.',
    })
  }
  const mos = num('Months of Supply')
  const verdict = monthsOfSupplyVerdict(mos)
  if (mos != null && verdict) {
    figures.push({
      key: 'supply',
      value: formatMonthsOfSupply(mos),
      label: `months of supply, ${verdict.label.toLowerCase()}`,
      sentence: 'How long the homes for sale would last at the recent pace of sales.',
      href: '/housing-market/central-oregon',
    })
  }
  const days = num('Median Days to Pending')
  if (days != null) {
    figures.push({
      key: 'days',
      value: String(days),
      // hud.daysToPending is the pace row's 90-day median (leftoverHudKpis).
      label: 'median days to go under contract, last 90 days',
      sentence: 'Half the homes that went under contract took less time than this.',
    })
  }
  const sold = num('Homes Sold (12 months)')
  if (sold != null) {
    figures.push({
      key: 'sold',
      value: sold.toLocaleString('en-US'),
      label: 'single-family homes sold, last 12 months',
      sentence: 'Closed sales across the region over the past year.',
    })
  }
  if (figures.length === 0) return null
  return {
    headline: verdict
      ? `Central Oregon is a ${verdict.label.toLowerCase()} right now`
      : 'The Central Oregon housing market right now',
    figures,
    source: 'Single-family homes across Central Oregon in the regional MLS, counted by Ryan Realty',
    asOfIso: faq.asOfIso,
  }
}
