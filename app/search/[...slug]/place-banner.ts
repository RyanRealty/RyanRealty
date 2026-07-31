import { getBannerUrl, getOrCreatePlaceBanner, getBannerSearchQuery } from '../../actions/banners'
import { getBestListingHeroForGeography } from '../../actions/photo-classification'
import { getResortEntityKeys } from '../../actions/subdivision-flags'
import { cityEntityKey, subdivisionEntityKey } from '../../../lib/slug'
import { IS_PRODUCTION_BUILD } from './search-static'
import { withTimeout } from './fetch-guards'

/** Resolve the place hero/banner URL the search page's structured data references. */
export async function resolvePlaceBannerUrl({
  city,
  subdivision,
  decodedSubdivision,
}: {
  city: string | undefined
  subdivision: string | undefined
  decodedSubdivision: string | undefined
}): Promise<string | null> {
  const entityType = subdivision ? ('subdivision' as const) : ('city' as const)
  // All-cities preset routes (/homes-for-sale/manufactured) carry no city —
  // there is no geographic entity to key banners or curation on.
  const entityKey = subdivision
    ? subdivisionEntityKey(city!, decodedSubdivision!)
    : city
      ? cityEntityKey(city)
      : null
  const resortKeys = city && subdivision ? await withTimeout(getResortEntityKeys(), new Set<string>(), 1200) : new Set<string>()
  const isResortSubdivision =
    subdivision && city && decodedSubdivision && entityKey ? resortKeys.has(entityKey) : false
  const bannerSearchQuery = city
    ? getBannerSearchQuery(
        subdivision ? 'subdivision' : 'city',
        subdivision ? decodedSubdivision! : city,
        city,
        subdivision ? isResortSubdivision : undefined
      )
    : ''
  // Banner URL is still resolved because the SearchPageJsonLd / ResortCommunityJsonLd
  // structured data references the place's hero image. The clean results page does
  // not render a photo hero band, so only the URL is needed (no attribution chrome).
  const [listingHero, bannerResult] =
    city && entityKey
      ? await Promise.all([
          withTimeout(getBestListingHeroForGeography(city, decodedSubdivision ?? null), null, 1500),
          IS_PRODUCTION_BUILD
            ? withTimeout(getBannerUrl(entityType, entityKey), null, 800).then((url) => ({
                url,
                attribution: null,
              }))
            : withTimeout(
                getOrCreatePlaceBanner(entityType, entityKey, bannerSearchQuery),
                { url: null, attribution: null },
                1500,
              ),
        ])
      : [null, { url: null, attribution: null }]
  // Prefer curated Central Oregon lifestyle image over generic Unsplash/AI banner
  const { CITY_HERO_IMAGES } = await import('@/lib/central-oregon-images')
  const curatedCityImage = city ? (CITY_HERO_IMAGES[city.toLowerCase().replace(/\s+/g, '-')] ?? null) : null
  return curatedCityImage ?? listingHero?.url ?? bannerResult?.url ?? null
}
