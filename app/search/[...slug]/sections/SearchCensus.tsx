import { getCityContent, getSubdivisionBlurb } from '@/lib/city-content'
import { cityEntityKey, listingDetailPath } from '@/lib/slug'
import { getPopularSearchesForCity, getAllCityHomesLink } from '@/lib/popular-searches'
import {
  buildPresetFaq,
  getAdjacentPriceBandLinks,
  getParentCityPresetLink,
  getSamePresetCityLinks,
  isSortOnlyPreset,
} from '@/lib/site/preset-faq'
import { getDerivedPopularSearches } from '@/lib/data'
import { shouldNoIndexSearchVariant } from '@/lib/seo-routing'
import { isResortCommunity } from '@/lib/resort-communities'
import { loadCitySfrTilesForSearch, loadSearchCityMarketLayer } from '@/lib/market/search-city-sfr-publish'
import SearchPageJsonLd from '../SearchPageJsonLd'
import ResortCommunityJsonLd from '../ResortCommunityJsonLd'
import { getResortEntityKeys } from '../../../actions/subdivision-flags'
import { getSubdivisionTabContent } from '../../../actions/subdivision-descriptions'
import { IS_PRODUCTION_BUILD } from '../search-static'
import { withTimeout } from '../fetch-guards'
import { resolvePlaceBannerUrl } from '../place-banner'
import { SearchSeoTail } from './SeoTail'
import type { SearchPreset } from '../resolve-slug'
import type { SearchParams } from '../page-filters'

type CensusListing = {
  ListingKey?: string | null
  ListNumber?: string | null
  StreetNumber?: string | null
  StreetName?: string | null
  City?: string | null
  State?: string | null
  PostalCode?: string | null
  SubdivisionName?: string | null
}

/**
 * Below-fold census for the Field search face: live listing URLs in JSON-LD,
 * the asking-price ladder, FAQ, and related searches. No leftover HUD.
 */
export async function SearchCensus({
  city,
  subdivision,
  decodedSubdivision,
  displayName,
  searchPagePath,
  listings,
  totalCount,
  preset,
  placeName,
  searchParams,
}: {
  city: string | undefined
  subdivision: string | undefined
  decodedSubdivision: string | undefined
  displayName: string
  searchPagePath: string
  listings: CensusListing[]
  totalCount: number
  preset: SearchPreset
  placeName: string
  searchParams?: SearchParams
}) {
  const isPlainCityPage = Boolean(city && !subdivision && !preset)
  const isPresetDepthPage = Boolean(
    city &&
      preset &&
      !isSortOnlyPreset(preset) &&
      !shouldNoIndexSearchVariant(searchParams ?? {}),
  )
  const relatedCitySlug = city ? cityEntityKey(city) : null
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

  const [citySfrTiles, bannerUrl, resortEntityKeys, subdivisionTabContent] = await Promise.all([
    isPlainCityPage && city ? loadCitySfrTilesForSearch(city) : Promise.resolve([]),
    resolvePlaceBannerUrl({ city, subdivision, decodedSubdivision }),
    withTimeout(getResortEntityKeys(), new Set<string>()),
    subdivision && city
      ? withTimeout(getSubdivisionTabContent(city, decodedSubdivision!), null, 1200)
      : Promise.resolve(null),
  ])

  const cityContent = city ? getCityContent(city) : null
  const subdivisionBlurb = subdivision
    ? (subdivisionTabContent?.about ?? getSubdivisionBlurb(decodedSubdivision!))
    : null

  const {
    cityFaqInput,
    publishedCityInventory,
    cityMarketFaq,
    priceLadder,
    publicPace,
    publicSegments,
  } = await loadSearchCityMarketLayer({
    city,
    relatedCitySlug,
    isPlainCityPage,
    isPresetDepthPage,
    citySfrTiles,
  })

  const relatedAllHomes = relatedCitySlug ? getAllCityHomesLink(relatedCitySlug) : null
  const relatedDerived =
    relatedCitySlug && !IS_PRODUCTION_BUILD
      ? (await getDerivedPopularSearches(relatedCitySlug, 12))
          .filter((link) => link.href !== searchPagePath)
          .slice(0, 8)
      : []
  const relatedSearches =
    relatedDerived.length > 0
      ? relatedDerived
      : relatedCitySlug
        ? getPopularSearchesForCity(relatedCitySlug, 12)
            .filter((link) => link.href !== searchPagePath)
            .slice(0, 8)
        : []

  const presetAreaLabel = subdivision ? placeName : null
  const presetDepth =
    isPresetDepthPage && city && preset
      ? buildPresetFaq(city, preset, totalCount, cityFaqInput, presetAreaLabel)
      : null
  const presetBandLinks =
    isPresetDepthPage && city && preset
      ? getAdjacentPriceBandLinks(
          city,
          preset.slug,
          subdivision ? { slug: subdivision, label: placeName } : null,
        )
      : []
  const presetCityLinks =
    isPresetDepthPage && preset && relatedCitySlug
      ? subdivision && city
        ? [getParentCityPresetLink(city, preset)]
        : getSamePresetCityLinks(preset, relatedCitySlug)
      : []

  return (
    <>
      <SearchPageJsonLd
        displayName={displayName}
        city={city}
        subdivision={decodedSubdivision}
        subdivisionBlurb={subdivisionBlurb}
        cityMetaDescription={cityContent?.metaDescription}
        bannerUrl={bannerUrl ?? null}
        siteUrl={siteUrl}
        presetLabel={preset?.shortLabel ?? null}
        canonicalPath={searchPagePath}
        listings={listings}
        totalCount={totalCount}
        suppressPlace={Boolean(
          city && subdivision && decodedSubdivision && isResortCommunity(city, decodedSubdivision, resortEntityKeys),
        )}
        datasetSchema={
          cityMarketFaq && cityMarketFaq.datasetVariables.length > 0
            ? {
                type: 'dataset',
                name: `${city}, Oregon real estate market statistics${cityMarketFaq.asOfLabel ? `, ${cityMarketFaq.asOfLabel}` : ''}`,
                description: `Live single-family home market data for ${city}, Oregon. Includes median list price, active inventory, months of supply, and median days to pending. Sourced from the regional MLS via Ryan Realty.`,
                url: searchPagePath,
                dateModified: cityMarketFaq.asOfIso ?? undefined,
                spatialCoverageName: `${city}, OR`,
                variableMeasured: cityMarketFaq.datasetVariables,
              }
            : undefined
        }
      />
      {city && subdivision && decodedSubdivision && isResortCommunity(city, decodedSubdivision, resortEntityKeys) ? (
        <ResortCommunityJsonLd
          displayName={displayName}
          city={city}
          subdivision={decodedSubdivision}
          siteUrl={siteUrl}
          description={subdivisionBlurb ?? subdivisionTabContent?.about ?? null}
          bannerUrl={bannerUrl ?? null}
          listingUrls={listings
            .slice(0, 10)
            .map((listing) => {
              const key = listing.ListNumber ?? listing.ListingKey
              if (!key) return ''
              return `${siteUrl}${listingDetailPath(
                String(key),
                {
                  streetNumber: listing.StreetNumber ?? null,
                  streetName: listing.StreetName ?? null,
                  city: listing.City ?? city ?? null,
                  state: listing.State ?? null,
                  postalCode: listing.PostalCode ?? null,
                },
                {
                  city: listing.City ?? city ?? null,
                  subdivision: listing.SubdivisionName ?? decodedSubdivision ?? null,
                },
                {
                  mlsNumber: listing.ListNumber ?? null,
                },
              )}`
            })
            .filter(Boolean)}
        />
      ) : null}
      <SearchSeoTail
        isPlainCityPage={isPlainCityPage}
        relatedCitySlug={relatedCitySlug}
        city={city}
        published={publishedCityInventory}
        priceLadder={priceLadder}
        publicPace={publicPace}
        publicSegments={publicSegments}
        cityMarketFaq={cityMarketFaq}
        presetDepth={presetDepth}
        presetBandLinks={presetBandLinks}
        presetCityLinks={presetCityLinks}
        relatedAllHomes={relatedAllHomes}
        relatedSearches={relatedSearches}
        placeName={placeName}
        subdivision={subdivision}
        preset={preset}
      />
    </>
  )
}
