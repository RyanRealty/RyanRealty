import { getCityListings, getMarketPulse } from '@/lib/data'
import type { FractionalInterestSubject } from '@/lib/listing/publish-listing-figure'
import { canonicalCityCacheSlug } from '@/lib/market/city-cache-slug'
import {
  CITY_TILE_FETCH_LIMIT,
  publishCityInventory,
  type CityInventoryPublish,
} from '@/lib/market/publish-city-inventory'
import { medianListPriceOfTiles } from '@/lib/market/tile-medians'
import { buildSearchPriceLadder, type SearchPriceLadder } from '@/lib/search/price-ladder'
import { buildMarketFaq, type MarketFaqInput, type MarketFaqResult } from '@/lib/site/market-faq'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'

type PulseLike = Pick<MarketFaqInput, 'activeCount' | 'medianListPrice'> | null

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

export function publishSearchCityInventory(
  pulse: PulseLike,
  tiles: ReadonlyArray<FractionalInterestSubject & { listPrice?: number | null }>,
): CityInventoryPublish {
  return publishCityInventory({
    pulseCount: pulse?.activeCount ?? null,
    pulseMedian: pulse?.medianListPrice ?? null,
    tileCount: tiles.length,
    tileMedian: medianListPriceOfTiles(tiles),
    tileLimit: CITY_TILE_FETCH_LIMIT,
    tileFetchOk: tiles.length > 0,
  })
}

export function buildSearchCityMarketFaq(
  city: string,
  pulse: PulseLike,
  published: CityInventoryPublish | null,
): MarketFaqResult {
  return buildMarketFaq(city, {
    ...(pulse ?? {}),
    // Search city pages are city-grain: refresh_market_pulse attributes actives
    // and closes with one identical predicate on public.listings.
    grain: 'city',
    activeCount: published?.count ?? pulse?.activeCount ?? null,
    pulseActiveCount: pulse?.activeCount ?? null,
    medianListPrice: published?.medianListPrice ?? pulse?.medianListPrice ?? null,
  })
}

export async function loadSearchCityMarketLayer(args: {
  city: string | undefined
  relatedCitySlug: string | null
  isPlainCityPage: boolean
  isPresetDepthPage: boolean
  citySfrTiles: ReadonlyArray<FractionalInterestSubject & { listPrice?: number | null }>
}): Promise<{
  cityPulse: Awaited<ReturnType<typeof getMarketPulse>> | null
  /**
   * The same pulse row carrying the grain it was read at, for builders that take
   * a MarketFaqInput (buildPresetFaq). Declared HERE, beside the
   * `geoType: 'city'` read that justifies it, rather than at each call site
   * where the grain would be a guess.
   */
  cityFaqInput: MarketFaqInput | null
  publishedCityInventory: CityInventoryPublish | null
  cityMarketFaq: MarketFaqResult | null
  /**
   * The below-fold asking-price ladder, banded from the SAME tiles the count
   * and median publish from. No extra query, nothing above the fold, and null
   * unless publishCityInventory released the tile source (i.e. the fetch was
   * complete and did not hit the row ceiling).
   */
  priceLadder: SearchPriceLadder | null
}> {
  const cityPulse =
    (args.isPlainCityPage || args.isPresetDepthPage) && args.relatedCitySlug
      ? await getMarketPulse({
          geoType: 'city',
          geoSlug: canonicalCityCacheSlug(args.relatedCitySlug),
        }).catch(() => null)
      : null
  const publishedCityInventory =
    args.isPlainCityPage && args.city
      ? publishSearchCityInventory(cityPulse, args.citySfrTiles)
      : null
  const cityMarketFaq =
    args.isPlainCityPage && args.city
      ? buildSearchCityMarketFaq(args.city, cityPulse, publishedCityInventory)
      : null
  const cityFaqInput: MarketFaqInput | null = cityPulse ? { ...cityPulse, grain: 'city' } : null
  const priceLadder =
    args.isPlainCityPage && args.city
      ? buildSearchPriceLadder({
          city: args.city,
          tiles: args.citySfrTiles,
          published: publishedCityInventory,
        })
      : null
  return { cityPulse, cityFaqInput, publishedCityInventory, cityMarketFaq, priceLadder }
}
