import { getDerivedPopularSearches } from '@/lib/data'
import { loadCitySfrTilesForSearch, loadSearchCityMarketLayer } from '@/lib/market/search-city-sfr-publish'
import { getAllCityHomesLink, getPopularSearchesForCity } from '../../../../lib/popular-searches'
import { withTimeout } from '../fetch-guards'
import { IS_PRODUCTION_BUILD } from '../search-static'

/**
 * The below-map depth of the plain /homes-for-sale/[city] page when the
 * map/split branch serves it (SITE-190 / SITE-192).
 *
 * The split branch returns before the grid branch's reads, so the one winner
 * for "{City} homes for sale" shipped as a map shell: no FAQ, no Dataset, no
 * market band, no related-search doors. This loader is the grid's market
 * layer (loadSearchCityMarketLayer, the same cached market-truth reads the
 * grid and /cities/[city] publish from) plus the related-search cloud, started
 * BESIDE the map's own viewport fetch and awaited after it, so the map never
 * waits on it and the response never stretches past the grace the caller
 * allows (MapSplitView: SPLIT_CITY_DEPTH_GRACE_MS after the viewport settles).
 *
 * Every figure the result carries is built by buildMarketFaq /
 * publishCityInventory / the price ladder from those reads. Nothing here
 * types a number; a null figure is omitted by those helpers (§0).
 *
 * This promise never rejects: every read inside is guarded, and the whole is
 * caught to null so an unexpected throw omits the tail instead of blanking
 * the page.
 */
export type CitySplitDepth = {
  market: Awaited<ReturnType<typeof loadSearchCityMarketLayer>>
  relatedSearches: { href: string; label: string }[]
  relatedAllHomes: ReturnType<typeof getAllCityHomesLink>
}

export function loadCitySplitDepth(args: {
  city: string
  relatedCitySlug: string
  searchPagePath: string
}): Promise<CitySplitDepth | null> {
  const { city, relatedCitySlug, searchPagePath } = args
  const run = async (): Promise<CitySplitDepth> => {
    const [market, derived] = await Promise.all([
      loadSearchCityMarketLayer({
        city,
        relatedCitySlug,
        isPlainCityPage: true,
        isPresetDepthPage: false,
        // The tile census is a promise here on purpose: the loader resolves it
        // inside its own Promise.all, beside the overlay + pace + segment reads.
        citySfrTiles: loadCitySfrTilesForSearch(city),
      }),
      // Live-derived links ranked by actual active-tile counts, same as the
      // grid; the static snapshot is the resilience fallback. Guarded so a
      // slow derivation degrades to the snapshot, never past the grace.
      IS_PRODUCTION_BUILD
        ? Promise.resolve([] as { href: string; label: string }[])
        : withTimeout(getDerivedPopularSearches(relatedCitySlug, 12), [], 1500),
    ])
    const notSelf = (l: { href: string }) => l.href !== searchPagePath
    const relatedDerived = derived.filter(notSelf).slice(0, 8)
    const relatedSearches =
      relatedDerived.length > 0
        ? relatedDerived
        : getPopularSearchesForCity(relatedCitySlug, 12).filter(notSelf).slice(0, 8)
    // "All {City} homes" is this page on the plain city search; a self-link
    // in the related ledger is noise, so it only survives when it leaves.
    const allHomes = getAllCityHomesLink(relatedCitySlug)
    const relatedAllHomes = allHomes && allHomes.href !== searchPagePath ? allHomes : null
    return { market, relatedSearches, relatedAllHomes }
  }
  return run().catch(() => null)
}
