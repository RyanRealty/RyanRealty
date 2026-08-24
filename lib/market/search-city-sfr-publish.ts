import { getCityListings, getDetachedOverlays } from '@/lib/data'
import type { FractionalInterestSubject } from '@/lib/listing/publish-listing-figure'
import { canonicalCityCacheSlug } from '@/lib/market/city-cache-slug'
import { leftoverHudKpis, leftoverHudPublishes, type LeftoverHudKpis } from '@/lib/market/publish-leftover-hud'
import { cityDetachedSlug } from '@/lib/data/market-truth/getSellBendMarket'
import { EMPTY_PUBLIC_PACE, getPublicDetachedPace, type PublicPaceRow } from '@/lib/data/market-truth/public-pace'
import { getPublicPlaceSegments, type PublicSegmentRow } from '@/lib/data/market-truth/public-segments'
import {
  CITY_TILE_FETCH_LIMIT,
  publishCityInventory,
  type CityInventoryPublish,
} from '@/lib/market/publish-city-inventory'
import { medianListPriceOfTiles } from '@/lib/market/tile-medians'
import { buildSearchPriceLadder, type SearchPriceLadder } from '@/lib/search/price-ladder'
import { buildMarketFaq, type MarketFaqInput, type MarketFaqResult } from '@/lib/site/market-faq'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'

export function loadCitySfrTilesForSearch(city: string) {
  return withTimeoutFallback(
    getCityListings(city, {
      status: 'active',
      sort: 'newest',
      propertyType: 'A',
      limit: CITY_TILE_FETCH_LIMIT,
    }),
    [],
    4500,
    'search:citySfrTiles',
  )
}

/** Tile census for the asking-price ladder. Not leftover HUD. Miss omits. */
export function publishSearchCityInventory(
  tiles: ReadonlyArray<FractionalInterestSubject & { listPrice?: number | null }>,
): CityInventoryPublish {
  return publishCityInventory({
    pulseCount: null,
    pulseMedian: null,
    tileCount: tiles.length,
    tileMedian: medianListPriceOfTiles(tiles),
    tileLimit: CITY_TILE_FETCH_LIMIT,
    tileFetchOk: tiles.length > 0,
  })
}

export function buildSearchCityMarketFaq(
  city: string,
  hud: LeftoverHudKpis,
  asOf: string | null,
): MarketFaqResult {
  return buildMarketFaq(city, {
    grain: 'city',
    source: 'market-truth',
    activeCount: hud.active,
    pulseActiveCount: hud.active,
    medianListPrice: hud.medianList,
    monthsOfSupply: hud.monthsSupply,
    medianDaysToPending: hud.daysToPending,
    soldCount12mo: hud.sold12mo ?? null,
    refreshedAt: asOf,
  })
}

export async function loadSearchCityMarketLayer(args: {
  city: string | undefined
  relatedCitySlug: string | null
  isPlainCityPage: boolean
  isPresetDepthPage: boolean
  citySfrTiles: ReadonlyArray<FractionalInterestSubject & { listPrice?: number | null }>
}): Promise<{
  cityFaqInput: MarketFaqInput | null
  publishedCityInventory: CityInventoryPublish | null
  cityMarketFaq: MarketFaqResult | null
  /**
   * The below-fold asking-price ladder, banded from the SAME tiles this search
   * listed. No extra query, nothing above the fold, and null unless the tile
   * fetch was complete and did not hit the row ceiling.
   */
  priceLadder: SearchPriceLadder | null
  publicPace: PublicPaceRow
  publicSegments: PublicSegmentRow[]
}> {
  const cacheSlug = args.relatedCitySlug ? canonicalCityCacheSlug(args.relatedCitySlug) : ''
  const wantHud = Boolean((args.isPlainCityPage || args.isPresetDepthPage) && cacheSlug)
  const wantStrip = Boolean(args.isPlainCityPage && cacheSlug)
  const [overlays, publicPace, publicSegments] = await Promise.all([
    wantHud
      ? getDetachedOverlays([{ geoType: 'city', geoSlug: cacheSlug }]).catch(() => new Map())
      : Promise.resolve(new Map()),
    wantHud
      ? withTimeoutFallback(
          getPublicDetachedPace({ geoType: 'city', geoSlug: cacheSlug }),
          EMPTY_PUBLIC_PACE,
          3000,
          'search:publicPace',
        )
      : Promise.resolve(EMPTY_PUBLIC_PACE),
    wantStrip
      ? withTimeoutFallback(
          getPublicPlaceSegments({ geoType: 'city', geoSlug: cacheSlug }),
          [],
          3000,
          'search:publicSegments',
        )
      : Promise.resolve([] as PublicSegmentRow[]),
  ])
  const layers = cacheSlug ? overlays.get(`city:${cityDetachedSlug(cacheSlug)}`) : undefined
  const hud = leftoverHudKpis({
    grain: 'city',
    headlines: layers?.headlines ?? null,
    inventory: layers?.inventory ?? null,
    pace: publicPace,
  })
  const asOf = layers?.headlines?.computedAt ?? layers?.inventory?.computedAt ?? null
  const leftoverFaq = leftoverHudPublishes(hud)
    ? ({
        grain: 'city' as const,
        source: 'market-truth' as const,
        activeCount: hud.active,
        pulseActiveCount: hud.active,
        medianListPrice: hud.medianList,
        monthsOfSupply: hud.monthsSupply,
        medianDaysToPending: hud.daysToPending,
        soldCount12mo: hud.sold12mo ?? null,
        refreshedAt: asOf,
      } satisfies MarketFaqInput)
    : null
  const publishedCityInventory =
    args.isPlainCityPage && args.city ? publishSearchCityInventory(args.citySfrTiles) : null
  const cityMarketFaq =
    args.isPlainCityPage && args.city && leftoverFaq
      ? buildSearchCityMarketFaq(args.city, hud, asOf)
      : null
  const priceLadder =
    args.isPlainCityPage && args.city
      ? buildSearchPriceLadder({
          city: args.city,
          tiles: args.citySfrTiles,
          published: publishedCityInventory,
        })
      : null
  return {
    cityFaqInput: leftoverFaq,
    publishedCityInventory,
    cityMarketFaq,
    priceLadder,
    publicPace: wantStrip ? publicPace : EMPTY_PUBLIC_PACE,
    publicSegments,
  }
}
