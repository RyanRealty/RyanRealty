import { getCityListings, getMarketPulse } from '@/lib/data'
import { canonicalCityCacheSlug } from '@/lib/market/city-cache-slug'
import {
  CITY_TILE_FETCH_LIMIT,
  publishCityInventory,
  type CityInventoryPublish,
} from '@/lib/market/publish-city-inventory'
import { medianListPriceOfTiles } from '@/lib/market/tile-medians'
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
  tiles: ReadonlyArray<{ listPrice?: number | null }>,
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
  citySfrTiles: ReadonlyArray<{ listPrice?: number | null }>
}): Promise<{
  cityPulse: Awaited<ReturnType<typeof getMarketPulse>> | null
  publishedCityInventory: CityInventoryPublish | null
  cityMarketFaq: MarketFaqResult | null
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
  return { cityPulse, publishedCityInventory, cityMarketFaq }
}
