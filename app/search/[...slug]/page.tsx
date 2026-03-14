import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import {
  getListingsWithAdvanced,
  getListingsForMap,
  getCityMarketStats,
  getCityStatusCounts,
  getSubdivisionsInCity,
  getHotCommunitiesInCity,
  getNearbyCommunities,
  getListingKeysWithRecentPriceChange,
  getCityFromSlug,
  getSubdivisionNameFromSlug,
  getCityCentroid,
  getCommunityCentroid,
  type AdvancedSort,
} from '../../actions/listings'
import { getSession } from '../../actions/auth'
import { getBannerUrl, getOrCreatePlaceBanner, getBannerSearchQuery } from '../../actions/banners'
import { shareDescription, OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT } from '../../../lib/share-metadata'
import { getBestListingHeroForGeography } from '../../actions/photo-classification'
import { getHeroVideoUrl, refreshHeroMedia } from '../../actions/hero-videos'
import SaveSearchButton from '../../../components/SaveSearchButton'
import { getGeocodedListings } from '../../actions/geocode'
import { getCityContent, getSubdivisionBlurb } from '../../../lib/city-content'
import { cityEntityKey, subdivisionEntityKey, getSubdivisionDisplayName, cityPagePath, homesForSalePath } from '../../../lib/slug'
import { entityKeyToSlug } from '../../../lib/community-slug'
import { getPresetBySlug, isPresetSlug } from '../../../lib/search-presets'
import { communityPagePath } from '../../../lib/community-slug'
import SearchMapClustered from '../../../components/SearchMapClustered'
import ListingTile from '../../../components/ListingTile'
import AdvancedSearchFilters from '../../../components/AdvancedSearchFilters'
import ShareButton from '../../../components/ShareButton'
import BreadcrumbStrip from '../../../components/layout/BreadcrumbStrip'
import HeroRefreshButton from '../../../components/HeroRefreshButton'
import SearchPageJsonLd from './SearchPageJsonLd'
import ResortCommunityJsonLd from './ResortCommunityJsonLd'
import { isResortCommunity } from '../../../lib/resort-communities'
import { getResortEntityKeys } from '../../actions/subdivision-flags'
import {
  getSubdivisionDescription,
  getSubdivisionTabContent,
} from '../../actions/subdivision-descriptions'
import SearchListingsToolbar from '../../../components/SearchListingsToolbar'
import HotCommunitiesSection from '../../../components/search/HotCommunitiesSection'
import MarketSnapshotChart from '../../../components/search/MarketSnapshotChart'
import TrackSearchView from '../../../components/tracking/TrackSearchView'
import { getSavedCommunityKeys } from '../../actions/saved-communities'
import { trackPageViewIfPossible } from '../../../lib/followupboss'
import { getFubPersonIdFromCookie } from '../../actions/fub-identity-bridge'
import { getSavedListingKeys } from '../../actions/saved-listings'
import { getLikedListingKeys } from '../../actions/likes'
import { getBuyingPreferences } from '../../actions/buying-preferences'
import { getCitiesForIndex, getCityBoundary, getCityPriceHistory } from '../../actions/cities'
import { getCommunityBySlug } from '../../actions/communities'
import { estimatedMonthlyPayment, formatMonthlyPayment, DEFAULT_DISPLAY_RATE, DEFAULT_DISPLAY_DOWN_PCT, DEFAULT_DISPLAY_TERM_YEARS } from '../../../lib/mortgage'
import ListingsMapSplitView from '../../listings/ListingsMapSplitView'
import UnifiedMapListingsView from '../../../components/UnifiedMapListingsView'
import SearchFilterBar from '../../../components/SearchFilterBar'

/** Fallback map center when no listing coords (Central Oregon cities). */
const FALLBACK_CITY_CENTERS: Record<string, { latitude: number; longitude: number; zoom: number }> = {
  bend: { latitude: 44.0582, longitude: -121.3153, zoom: 11 },
  'la-pine': { latitude: 43.6704, longitude: -121.5036, zoom: 11 },
  redmond: { latitude: 44.2726, longitude: -121.1739, zoom: 11 },
  sisters: { latitude: 44.2912, longitude: -121.5492, zoom: 11 },
  sunriver: { latitude: 43.8840, longitude: -121.4386, zoom: 12 },
  prineville: { latitude: 44.2990, longitude: -120.8345, zoom: 11 },
  madras: { latitude: 44.6335, longitude: -121.1295, zoom: 11 },
  terrebonne: { latitude: 44.3529, longitude: -121.1778, zoom: 12 },
  culver: { latitude: 44.5254, longitude: -121.2114, zoom: 12 },
}

/** Central Oregon default map center (filter-only search, no city). */
const CENTRAL_OREGON_MAP_CENTER = { latitude: 44.0582, longitude: -121.3153, zoom: 9 }

/** Resolve slug segments to city, subdivision (display name), and preset. */
async function resolveSlug(slug: string[]): Promise<{
  city: string | null
  subdivisionSlug: string | null
  subdivisionDisplayName: string | null
  presetSlug: string | null
  preset: ReturnType<typeof getPresetBySlug>
}> {
  const citySlug = slug[0]
  const resolvedCity = citySlug ? (await getCityFromSlug(citySlug)) ?? decodeURIComponent(citySlug).trim() : null
  const city = resolvedCity ?? citySlug ?? null

  if (slug.length === 0) {
    return { city: null, subdivisionSlug: null, subdivisionDisplayName: null, presetSlug: null, preset: null }
  }
  if (slug.length === 1) {
    return { city, subdivisionSlug: null, subdivisionDisplayName: null, presetSlug: null, preset: null }
  }
  if (slug.length === 2) {
    const second = slug[1]!
    if (isPresetSlug(second)) {
      return { city, subdivisionSlug: null, subdivisionDisplayName: null, presetSlug: second, preset: getPresetBySlug(second) }
    }
    const subdivisionDisplayName = city ? (await getSubdivisionNameFromSlug(city, second)) ?? decodeURIComponent(second) : null
    return { city, subdivisionSlug: second, subdivisionDisplayName, presetSlug: null, preset: null }
  }
  // slug.length >= 3: [city, subdivision, preset]
  const subSlug = slug[1]!
  const subdivisionDisplayName = city ? (await getSubdivisionNameFromSlug(city, subSlug)) ?? decodeURIComponent(subSlug) : null
  const presetSlug = slug[2] ?? null
  const preset = presetSlug ? getPresetBySlug(presetSlug) : null
  return { city, subdivisionSlug: subSlug, subdivisionDisplayName, presetSlug, preset }
}

function buildCanonicalPath(city: string | null, subdivisionDisplayName: string | null, subdivisionSlug: string | null, presetSlug: string | null): string {
  if (!city) return '/homes-for-sale'
  const base = subdivisionDisplayName ?? subdivisionSlug
    ? homesForSalePath(city, subdivisionDisplayName ?? subdivisionSlug ?? null)
    : homesForSalePath(city, null)
  return presetSlug ? `${base}/${presetSlug}` : base
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>
}): Promise<Metadata> {
  const { slug = [] } = await params
  const { city, subdivisionDisplayName, subdivisionSlug, presetSlug, preset } = await resolveSlug(slug)
  const placeName = subdivisionDisplayName ? getSubdivisionDisplayName(subdivisionDisplayName) : (city ?? 'Central Oregon')
  const displayName = preset ? `${placeName} ${preset.shortLabel}` : placeName
  const content = city ? getCityContent(city) : null
  const subdivisionDesc =
    subdivisionDisplayName && city ? await getSubdivisionDescription(city, subdivisionDisplayName) : null
  const rawMetaDesc =
    (subdivisionDisplayName ? (subdivisionDesc ?? getSubdivisionBlurb(subdivisionDisplayName)) : null) ??
    content?.metaDescription ??
    (preset
      ? `Browse ${preset.label.toLowerCase()} in ${placeName}, Central Oregon. View listings and property details.`
      : `Browse homes for sale in ${displayName}, Central Oregon. View listings, map, and property details.`)
  const metaDesc = shareDescription(rawMetaDesc)
  const bannerUrl =
    city &&
    (subdivisionDisplayName
      ? await getBannerUrl('subdivision', subdivisionEntityKey(city, subdivisionDisplayName))
      : await getBannerUrl('city', cityEntityKey(city)))
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
  const canonicalPath = buildCanonicalPath(city, subdivisionDisplayName, subdivisionSlug, presetSlug)
  const title = preset ? `${preset.label} in ${placeName}` : `Homes for Sale in ${placeName}`
  return {
    title,
    description: metaDesc,
    alternates: { canonical: `${siteUrl}${canonicalPath}` },
    openGraph: {
      title,
      description: metaDesc,
      url: `${siteUrl}${canonicalPath}`,
      siteName: 'Ryan Realty',
      type: 'website',
      ...(bannerUrl && {
        images: [{ url: bannerUrl, width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT, alt: `Real estate in ${placeName}, Central Oregon` }],
      }),
    },
    twitter: { card: 'summary_large_image', title, description: metaDesc },
  }
}

const PER_PAGE_OPTIONS = [6, 12, 24, 48] as const
const COLUMN_OPTIONS = [1, 2, 3, 4] as const

type SearchParams = {
  minPrice?: string
  maxPrice?: string
  beds?: string
  baths?: string
  minSqFt?: string
  maxSqFt?: string
  maxBeds?: string
  maxBaths?: string
  yearBuiltMin?: string
  yearBuiltMax?: string
  lotAcresMin?: string
  lotAcresMax?: string
  postalCode?: string
  propertyType?: string
  propertySubType?: string
  statusFilter?: string
  keywords?: string
  hasOpenHouse?: string
  garageMin?: string
  hasPool?: string
  hasView?: string
  hasWaterfront?: string
  newListingsDays?: string
  sort?: string
  includeClosed?: string
  page?: string
  perPage?: string
  view?: string
}

/** Preset breadcrumb label for filter-only searches (e.g. Under $500K, Luxury). */
function getPresetSearchLabel(sp: SearchParams): string | null {
  if (sp.maxPrice === '500000') return 'Under $500K'
  if (sp.minPrice === '1000000') return 'Luxury'
  if (sp.keywords?.toLowerCase().includes('new construction')) return 'New Construction'
  if (sp.hasWaterfront === '1') return 'Waterfront'
  return null
}

function hasFilterOnlySearch(sp: SearchParams): boolean {
  return Boolean(sp.maxPrice || sp.minPrice || (sp.keywords?.trim()) || sp.hasWaterfront === '1')
}

export const revalidate = 60

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string[] }>
  searchParams: Promise<SearchParams>
}) {
  const { slug = [] } = await params
  const sp = await searchParams
  const resolved = await resolveSlug(slug)
  const { city: cityResolved, subdivisionDisplayName: decodedSubdivisionFromSlug, preset } = resolved
  const city = cityResolved ?? undefined
  const subdivision = resolved.subdivisionSlug ?? undefined
  const decodedSubdivision = resolved.subdivisionDisplayName ?? (subdivision ? decodeURIComponent(subdivision) : undefined)
  const hasFilterOnly = !city && hasFilterOnlySearch(sp)
  const presetLabel = !city ? getPresetSearchLabel(sp) : null

  const columns = [1, 2, 3, 4, 5].includes(Number(sp.view)) ? Number(sp.view) : 3
  const viewParam = String(columns) as '1' | '2' | '3' | '4' | '5'
  const ROWS = 3
  const defaultPageSize = columns * ROWS
  const perPageParam = sp.perPage ?? String(defaultPageSize)
  const pageSize = Math.min(100, Math.max(1, parseInt(perPageParam, 10) || defaultPageSize))
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  const offset = (page - 1) * pageSize

  const filterOptsBase = {
    city: city || undefined,
    subdivision: decodedSubdivision,
    minPrice: sp.minPrice ? Number(sp.minPrice) : undefined,
    maxPrice: sp.maxPrice ? Number(sp.maxPrice) : undefined,
    minBeds: sp.beds ? Number(sp.beds) : undefined,
    minBaths: sp.baths ? Number(sp.baths) : undefined,
    minSqFt: sp.minSqFt ? Number(sp.minSqFt) : undefined,
    maxSqFt: sp.maxSqFt ? Number(sp.maxSqFt) : undefined,
    maxBeds: sp.maxBeds ? Number(sp.maxBeds) : undefined,
    maxBaths: sp.maxBaths ? Number(sp.maxBaths) : undefined,
    yearBuiltMin: sp.yearBuiltMin ? Number(sp.yearBuiltMin) : undefined,
    yearBuiltMax: sp.yearBuiltMax ? Number(sp.yearBuiltMax) : undefined,
    lotAcresMin: sp.lotAcresMin != null ? Number(sp.lotAcresMin) : undefined,
    lotAcresMax: sp.lotAcresMax != null ? Number(sp.lotAcresMax) : undefined,
    postalCode: sp.postalCode?.trim() || undefined,
    propertyType: sp.propertyType?.trim() || undefined,
    propertySubType: sp.propertySubType?.trim() || undefined,
    statusFilter: sp.statusFilter?.trim() || undefined,
    keywords: sp.keywords?.trim() || undefined,
    hasOpenHouse: sp.hasOpenHouse === '1',
    garageMin: sp.garageMin != null ? Number(sp.garageMin) : undefined,
    hasPool: sp.hasPool === '1',
    hasView: sp.hasView === '1',
    hasWaterfront: sp.hasWaterfront === '1',
    newListingsDays: sp.newListingsDays ? Number(sp.newListingsDays) : undefined,
    sort:
      sp.sort === 'newest' || sp.sort === 'oldest' || sp.sort === 'price_asc' || sp.sort === 'price_desc' ||
      sp.sort === 'price_per_sqft_asc' || sp.sort === 'price_per_sqft_desc' || sp.sort === 'year_newest' || sp.sort === 'year_oldest'
        ? (sp.sort as AdvancedSort)
        : 'newest',
    includeClosed: sp.includeClosed === '1',
  }
  // Predefined preset: apply preset params (preset wins for its keys so the page shows the right results)
  const filterOpts = preset
    ? {
        ...filterOptsBase,
        ...(preset.params.maxPrice != null && { maxPrice: preset.params.maxPrice }),
        ...(preset.params.minPrice != null && { minPrice: preset.params.minPrice }),
        ...(preset.params.statusFilter != null && { statusFilter: preset.params.statusFilter }),
        ...(preset.params.newListingsDays != null && { newListingsDays: preset.params.newListingsDays }),
        ...(preset.params.hasOpenHouse != null && { hasOpenHouse: preset.params.hasOpenHouse }),
        ...(preset.params.hasPool != null && { hasPool: preset.params.hasPool }),
        ...(preset.params.hasView != null && { hasView: preset.params.hasView }),
        ...(preset.params.hasFireplace != null && { hasFireplace: preset.params.hasFireplace }),
        ...(preset.params.hasGolfCourse != null && { hasGolfCourse: preset.params.hasGolfCourse }),
        ...(preset.params.viewContains != null && preset.params.viewContains !== '' && { viewContains: preset.params.viewContains }),
        ...(preset.params.sort != null && { sort: preset.params.sort as AdvancedSort }),
      }
    : filterOptsBase

  const [listingsResult, marketStats, statusCounts, subdivisions, hotCommunities, priceChangeKeys, session, resortEntityKeys] = await Promise.all([
    getListingsWithAdvanced({ ...filterOpts, limit: pageSize, offset }),
    getCityMarketStats({ city: city || undefined, subdivision: decodedSubdivision }),
    city ? getCityStatusCounts({ city, subdivision: decodedSubdivision ?? null }) : Promise.resolve({ active: 0, pending: 0, closed: 0, other: 0 }),
    city && !subdivision ? getSubdivisionsInCity(city) : Promise.resolve([]),
    city && !subdivision ? getHotCommunitiesInCity(city) : Promise.resolve([]),
    getListingKeysWithRecentPriceChange(),
    getSession(),
    getResortEntityKeys(),
  ])
  const hotCommunitiesSlice = city && !subdivision ? hotCommunities.slice(0, 10) : []
  const [hotCommunityBannerUrls, savedCommunityKeys, cityPriceHistory] = await Promise.all([
    city && !subdivision && hotCommunitiesSlice.length > 0
      ? Promise.all(
          hotCommunitiesSlice.map((c) =>
            getBannerUrl('subdivision', subdivisionEntityKey(city, c.subdivisionName))
          )
        )
      : Promise.resolve([]),
    session?.user ? getSavedCommunityKeys() : Promise.resolve([]),
    city ? getCityPriceHistory(city) : Promise.resolve([]),
  ])
  const { listings, totalCount } = listingsResult
  const effectiveStatusFilter = (filterOpts.statusFilter && ['active', 'active_and_pending', 'pending', 'closed', 'all'].includes(filterOpts.statusFilter))
    ? filterOpts.statusFilter
    : filterOpts.includeClosed
      ? 'all'
      : 'active'
  const [mapListingsRaw, nearbyCommunities, mapCenter] = await Promise.all([
    getListingsForMap({
      city: city ?? undefined,
      subdivision: decodedSubdivision ?? undefined,
      statusFilter: effectiveStatusFilter,
      minPrice: filterOpts.minPrice,
      maxPrice: filterOpts.maxPrice,
      minBeds: filterOpts.minBeds,
      maxBeds: filterOpts.maxBeds,
      minBaths: filterOpts.minBaths,
      maxBaths: filterOpts.maxBaths,
      minSqFt: filterOpts.minSqFt,
      maxSqFt: filterOpts.maxSqFt,
      yearBuiltMin: filterOpts.yearBuiltMin,
      yearBuiltMax: filterOpts.yearBuiltMax,
      lotAcresMin: filterOpts.lotAcresMin,
      lotAcresMax: filterOpts.lotAcresMax,
      postalCode: filterOpts.postalCode,
      propertyType: filterOpts.propertyType,
    }),
    city && subdivision && decodedSubdivision
      ? getNearbyCommunities(city, decodedSubdivision)
      : Promise.resolve([]),
    city
      ? subdivision && decodedSubdivision
        ? getCommunityCentroid(city, decodedSubdivision).then((c) => (c ? { latitude: c.lat, longitude: c.lng, zoom: 12 } as const : null))
        : getCityCentroid(city).then((c) => (c ? { latitude: c.lat, longitude: c.lng, zoom: 11 } as const : null))
      : Promise.resolve(null),
  ])
  const [listingsWithCoords, mapListingsWithCoords] = await Promise.all([
    getGeocodedListings(listings),
    mapListingsRaw.length > 0 ? getGeocodedListings(mapListingsRaw) : Promise.resolve([]),
  ])
  const mapCenterResolved = mapCenter ?? (city ? FALLBACK_CITY_CENTERS[cityEntityKey(city)] ?? null : (mapListingsWithCoords.length > 0 || listingsResult.listings.length > 0 ? CENTRAL_OREGON_MAP_CENTER : null))

  const placeName = subdivision && decodedSubdivision ? getSubdivisionDisplayName(decodedSubdivision) : (city ?? 'Central Oregon')
  const displayName = preset ? `${placeName} ${preset.shortLabel}` : (presetLabel ?? placeName)
  const cityContent = city ? getCityContent(city) : null
  const subdivisionTabContent =
    subdivision && city ? await getSubdivisionTabContent(city, decodedSubdivision!) : null
  const subdivisionBlurb =
    subdivision
      ? (subdivisionTabContent?.about ?? getSubdivisionBlurb(decodedSubdivision!))
      : null

  const entityType = subdivision ? ('subdivision' as const) : ('city' as const)
  const entityKey = subdivision ? subdivisionEntityKey(city!, decodedSubdivision!) : cityEntityKey(city!)
  const resortKeys = city && subdivision ? await getResortEntityKeys() : new Set<string>()
  const isResortSubdivision = subdivision && city && decodedSubdivision ? resortKeys.has(entityKey) : false
  const bannerSearchQuery = city
    ? getBannerSearchQuery(
        subdivision ? 'subdivision' : 'city',
        subdivision ? decodedSubdivision! : city,
        city,
        subdivision ? isResortSubdivision : undefined
      )
    : ''
  const [heroVideoUrl, listingHero, bannerResult] =
    city
      ? await Promise.all([
          subdivision
            ? getHeroVideoUrl('subdivision', entityKey)
            : getHeroVideoUrl('city', entityKey),
          getBestListingHeroForGeography(city, decodedSubdivision ?? null),
          getOrCreatePlaceBanner(entityType, entityKey, bannerSearchQuery),
        ])
      : [null, null, { url: null, attribution: null }]
  const bannerUrl = listingHero?.url ?? bannerResult?.url ?? null
  const bannerAttribution = listingHero?.attribution ?? bannerResult?.attribution ?? null

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || ''
  const searchPagePath = buildCanonicalPath(city ?? null, decodedSubdivision ?? null, subdivision ?? null, resolved.presetSlug)
  const searchPageUrl = `${siteUrl}${searchPagePath}`
  const fubPersonId = session?.user ? null : await getFubPersonIdFromCookie()
  if (city || subdivision) {
    trackPageViewIfPossible({
      sessionUser: session?.user ?? undefined,
      fubPersonId: fubPersonId ?? undefined,
      pageUrl: searchPageUrl,
      pageTitle: `Homes for Sale in ${displayName}`,
    })
  }

  const [savedKeys, likedKeys, prefs] =
    session?.user
      ? await Promise.all([getSavedListingKeys(), getLikedListingKeys(), getBuyingPreferences()])
      : ([[], [] as string[], null] as [string[], string[], Awaited<ReturnType<typeof getBuyingPreferences>>])

  const embeddedMapBoundary =
    city != null
      ? subdivision && decodedSubdivision
        ? (await getCommunityBySlug(entityKeyToSlug(subdivisionEntityKey(city, decodedSubdivision))))?.boundaryGeojson ?? null
        : await getCityBoundary(city)
      : null

  const searchBreadcrumbItems: { label: string; href?: string }[] = [
    { label: 'Home', href: '/' },
    { label: 'Homes for Sale', href: '/homes-for-sale' },
  ]
  const cityLabel = city ?? (slug[0] ? decodeURIComponent(slug[0]) : '')
  if (city) searchBreadcrumbItems.push({ label: cityLabel, href: subdivision || resolved.presetSlug ? `${siteUrl}${homesForSalePath(city)}` : undefined })
  if (subdivision && decodedSubdivision) searchBreadcrumbItems.push({ label: getSubdivisionDisplayName(decodedSubdivision), href: resolved.presetSlug ? `${siteUrl}${homesForSalePath(city!, decodedSubdivision)}` : undefined })
  if (preset) searchBreadcrumbItems.push({ label: preset.shortLabel })
  if (!city && presetLabel) searchBreadcrumbItems.push({ label: presetLabel })

  // Map split view: bounds-driven, Bend default; on city/community pages center on that place and scope search
  if ((sp.view === 'map' || sp.view === 'split') && (city || hasFilterOnly)) {
    const placeQuery = city
      ? decodedSubdivision
        ? `${getSubdivisionDisplayName(decodedSubdivision)} ${city} Oregon`
        : `${city} Oregon`
      : 'Bend Oregon'
    const mapBoundaryGeojson = city
      ? decodedSubdivision
        ? (await getCommunityBySlug(entityKeyToSlug(subdivisionEntityKey(city, decodedSubdivision))))?.boundaryGeojson ?? null
        : await getCityBoundary(city)
      : null
    return (
      <main className="flex flex-col h-[calc(100vh-120px)] min-h-[400px] overflow-hidden">
        {searchBreadcrumbItems.length > 1 && (
          <div className="shrink-0">
            <BreadcrumbStrip items={searchBreadcrumbItems} />
          </div>
        )}
        <UnifiedMapListingsView
          containerClassName="flex-1 min-h-0 overflow-hidden"
          pageTitle={`${displayName} Real Estate & Homes For Sale`}
          basePath={searchPagePath}
          placeQuery={placeQuery}
          boundaryGeojson={mapBoundaryGeojson}
          city={city ?? undefined}
          subdivision={decodedSubdivision ?? undefined}
          savedKeys={savedKeys}
          likedKeys={likedKeys}
          priceChangeKeys={priceChangeKeys}
          signedIn={!!session?.user}
          userEmail={session?.user?.email ?? null}
          prefs={prefs}
          statusFilter={effectiveStatusFilter}
          includeClosed={sp.includeClosed === '1'}
          minPrice={sp.minPrice != null ? Number(sp.minPrice) : undefined}
          maxPrice={sp.maxPrice != null ? Number(sp.maxPrice) : undefined}
          minBeds={sp.beds != null ? Number(sp.beds) : undefined}
          maxBeds={sp.maxBeds != null ? Number(sp.maxBeds) : undefined}
          minBaths={sp.baths != null ? Number(sp.baths) : undefined}
          maxBaths={sp.maxBaths != null ? Number(sp.maxBaths) : undefined}
          minSqFt={sp.minSqFt != null ? Number(sp.minSqFt) : undefined}
          maxSqFt={sp.maxSqFt != null ? Number(sp.maxSqFt) : undefined}
          postalCode={sp.postalCode ?? undefined}
          propertyType={sp.propertyType ?? undefined}
          filterBar={
            <SearchFilterBar
              basePath={searchPagePath}
              locationLabel={displayName}
              locationHref={`${searchPagePath}?${new URLSearchParams({ ...sp, view: 'map' }).toString()}`}
              signedIn={!!session?.user}
              minPrice={sp.minPrice}
              maxPrice={sp.maxPrice}
              beds={sp.beds}
              baths={sp.baths}
              minSqFt={sp.minSqFt}
              maxSqFt={sp.maxSqFt}
              maxBeds={sp.maxBeds}
              maxBaths={sp.maxBaths}
              yearBuiltMin={sp.yearBuiltMin}
              yearBuiltMax={sp.yearBuiltMax}
              lotAcresMin={sp.lotAcresMin}
              lotAcresMax={sp.lotAcresMax}
              postalCode={sp.postalCode}
              propertyType={sp.propertyType}
              statusFilter={sp.statusFilter}
              keywords={sp.keywords}
              hasOpenHouse={sp.hasOpenHouse}
              garageMin={sp.garageMin}
              hasPool={sp.hasPool}
              hasView={sp.hasView}
              hasWaterfront={sp.hasWaterfront}
              newListingsDays={sp.newListingsDays}
              includeClosed={sp.includeClosed}
              sort={sp.sort}
              view="map"
              perPage={perPageParam}
            />
          }
        />
      </main>
    )
  }

  return (
    <main className="min-h-screen">
      {/* Hero first: full-width, then breadcrumb + content in wrapper (Zillow-style) */}
      {city && (
        <section className="w-full" aria-label={`Hero: ${displayName}`}>
          {(heroVideoUrl || bannerUrl) ? (
            <div className="relative h-[40vh] w-full min-h-[240px] overflow-hidden bg-foreground sm:h-[50vh]">
              {heroVideoUrl ? (
                <video
                  src={heroVideoUrl}
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="absolute inset-0 h-full w-full object-cover"
                  aria-label={`Aerial flyover of ${displayName}, Central Oregon`}
                />
              ) : bannerUrl ? (
                <>
                  <div className="absolute inset-0 animate-hero-ken-burns">
                    <Image
                      src={bannerUrl}
                      alt={`Real estate in ${displayName}, Central Oregon – scenic area`}
                      width={1200}
                      height={336}
                      className="h-full w-full object-cover"
                      sizes="100vw"
                      priority
                    />
                  </div>
                  {bannerAttribution && (
                    <p className="absolute bottom-2 left-2 z-10 text-xs text-white/90 drop-shadow-md">
                      {bannerAttribution}
                    </p>
                  )}
                </>
              ) : null}
              <div className="absolute bottom-2 right-2 flex flex-wrap gap-2 justify-end">
                <HeroRefreshButton
                  refreshAction={refreshHeroMedia}
                  entityType={subdivision ? 'subdivision' : 'city'}
                  entityKey={subdivision ? subdivisionEntityKey(city, decodedSubdivision!) : cityEntityKey(city)}
                  searchQuery={bannerSearchQuery}
                />
              </div>
            </div>
          ) : (
            <div className="flex min-h-[240px] h-[40vh] flex-col items-center justify-center gap-4 bg-muted sm:h-[50vh]">
              <p className="text-sm text-muted-foreground">No hero media yet.</p>
              <HeroRefreshButton
                refreshAction={refreshHeroMedia}
                entityType={subdivision ? 'subdivision' : 'city'}
                entityKey={subdivision ? subdivisionEntityKey(city, decodedSubdivision!) : cityEntityKey(city)}
                searchQuery={bannerSearchQuery}
              />
            </div>
          )}
        </section>
      )}

      {searchBreadcrumbItems.length > 1 && (
        <BreadcrumbStrip items={searchBreadcrumbItems} />
      )}

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {city && (
          <TrackSearchView
            city={city}
            subdivision={decodedSubdivision ?? undefined}
            resultsCount={totalCount}
          />
        )}
        {city && (
        <>
          <SearchPageJsonLd
            displayName={displayName}
            city={city}
            subdivision={decodedSubdivision}
            subdivisionBlurb={subdivisionBlurb}
            cityMetaDescription={cityContent?.metaDescription}
            bannerUrl={bannerUrl ?? null}
            siteUrl={siteUrl}
            listings={listings}
          />
          {city && subdivision && decodedSubdivision && isResortCommunity(city, decodedSubdivision, resortEntityKeys) && (
            <ResortCommunityJsonLd
              displayName={displayName}
              city={city}
              subdivision={decodedSubdivision}
              siteUrl={siteUrl}
              description={subdivisionBlurb ?? subdivisionTabContent?.about ?? null}
              bannerUrl={bannerUrl ?? null}
              listingUrls={listings.slice(0, 10).map((l) => {
                const key = l.ListingKey ?? l.ListNumber
                return key ? `${siteUrl}/listing/${encodeURIComponent(String(key))}` : ''
              }).filter(Boolean)}
            />
          )}
        </>
      )}

      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold capitalize tracking-tight text-foreground sm:text-3xl">
            Homes in {displayName}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {totalCount.toLocaleString()} listing{totalCount !== 1 ? 's' : ''}.{' '}
            <Link
              href={`${searchPagePath}?${new URLSearchParams(
                Object.fromEntries(
                  Object.entries({
                    ...sp,
                    view: 'map',
                  }).filter(([, v]) => v !== undefined && v !== '')
                ) as Record<string, string>
              ).toString()}`}
              className="font-medium text-foreground underline hover:no-underline"
            >
              View on map
            </Link>
          </p>
          {city && (totalCount > 0 || statusCounts.pending > 0 || statusCounts.closed > 0) && (
            <p className="mt-2 text-sm text-muted-foreground">
              <span className="font-medium text-muted-foreground">{totalCount.toLocaleString()} active</span>
              {' · '}
              <span className="font-medium text-muted-foreground">{statusCounts.pending.toLocaleString()} under contract</span>
              {' · '}
              <span className="font-medium text-muted-foreground">{statusCounts.closed.toLocaleString()} closed</span>
              {(statusCounts.other > 0) && (
                <> · <span className="font-medium text-muted-foreground">{statusCounts.other.toLocaleString()} other</span></>
              )}
            </p>
          )}
        </div>
        <ShareButton
          title={`Homes for Sale in ${displayName}`}
          text={subdivisionBlurb ?? cityContent?.metaDescription ?? `Browse ${totalCount.toLocaleString()} listings in ${displayName}, Central Oregon.`}
          url={siteUrl ? `${siteUrl}${searchPagePath}` : undefined}
          variant="default"
        />
      </header>

      {/* About this community (subdivision pages with description) */}
      {subdivision && (subdivisionBlurb ?? subdivisionTabContent?.about) && (
        <section className="mb-10 rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">About {displayName}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
            {subdivisionBlurb ?? subdivisionTabContent?.about ?? ''}
          </p>
        </section>
      )}

      {/* Amenities & lifestyle (resort communities — section always shown when flagged; content or placeholder) */}
      {subdivision && city && decodedSubdivision && isResortCommunity(city, decodedSubdivision, resortEntityKeys) && (
        <section className="mb-10 rounded-lg border border-border bg-card p-6 shadow-sm" aria-labelledby="amenities-heading">
          <h2 id="amenities-heading" className="text-lg font-semibold text-foreground">Amenities & lifestyle</h2>
          {subdivisionTabContent?.attractions || subdivisionTabContent?.dining ? (
            <>
              {subdivisionTabContent?.attractions && (
                <div className="mt-3">
                  <h3 className="text-sm font-medium text-muted-foreground">Things to do</h3>
                  <div className="mt-1 text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                    {subdivisionTabContent.attractions}
                  </div>
                </div>
              )}
              {subdivisionTabContent?.dining && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-muted-foreground">Dining</h3>
                  <div className="mt-1 text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                    {subdivisionTabContent.dining}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Resort & master plan community. Amenities and lifestyle details for {displayName} are being updated.
            </p>
          )}
        </section>
      )}

      {/* Market Snapshot — summary + price trend for city/community */}
      <section className="mb-10 rounded-lg border border-border bg-muted p-6 shadow-sm" aria-labelledby="market-snapshot-heading">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <h2 id="market-snapshot-heading" className="text-lg font-semibold text-foreground">
              Market Snapshot
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {marketStats.count.toLocaleString()} home{marketStats.count !== 1 ? 's' : ''} for sale
              {marketStats.newListingsLast30Days > 0 &&
                ` · ${marketStats.newListingsLast30Days} new in the last 30 days`}
              {' · '}
              <Link href="/reports" className="font-medium text-foreground underline hover:no-underline">
                Market reports
              </Link>
            </p>
            {city && (marketStats.count > 0 || statusCounts.pending > 0 || statusCounts.closed > 0) && (
              <p className="mt-2 text-sm text-muted-foreground">
                {marketStats.count.toLocaleString()} active · {statusCounts.pending.toLocaleString()} under contract · {statusCounts.closed.toLocaleString()} closed
                {statusCounts.other > 0 && ` · ${statusCounts.other.toLocaleString()} other`}
              </p>
            )}
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
              <div className="rounded-lg bg-card border border-border p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Homes for sale (active)</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{marketStats.count.toLocaleString()}</p>
              </div>
              {marketStats.avgPrice != null && (
                <div className="rounded-lg bg-card border border-border p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Avg. list price (active)</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">
                    ${marketStats.avgPrice.toLocaleString()}
                  </p>
                </div>
              )}
              {marketStats.medianPrice != null && (
                <div className="rounded-lg bg-card border border-border p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Median list price</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">
                    ${marketStats.medianPrice.toLocaleString()}
                  </p>
                </div>
              )}
              <div className="rounded-lg bg-card border border-border p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">New (last 30 days)</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{marketStats.newListingsLast30Days}</p>
              </div>
              {marketStats.pendingCount > 0 && (
                <div className="rounded-lg bg-card border border-border p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Pending</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">{marketStats.pendingCount}</p>
                </div>
              )}
              {marketStats.closedLast12Months > 0 && (
                <div className="rounded-lg bg-card border border-border p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Closed (12 mo)</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">{marketStats.closedLast12Months}</p>
                </div>
              )}
            </div>
          </div>
          {city && cityPriceHistory.length >= 2 && (
            <div className="shrink-0 lg:pt-0 lg:pl-6">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Median price trend</p>
              <MarketSnapshotChart data={cityPriceHistory} />
            </div>
          )}
        </div>
      </section>

      {/* Hot communities (city page only) — scrollable row with photo background */}
      {city && !subdivision && hotCommunities.length > 0 && (
        <section className="mb-10">
          <HotCommunitiesSection
            city={city}
            communities={hotCommunities}
            bannerUrls={hotCommunityBannerUrls}
            signedIn={!!session?.user}
            savedCommunityKeys={savedCommunityKeys}
          />
        </section>
      )}

      {/* Communities in this city (city page only) */}
      {city && !subdivision && subdivisions.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Communities in {city}</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Explore neighborhoods and communities in {city}. Click a community to see homes for sale.
          </p>
          <div className="flex flex-wrap gap-3">
            {subdivisions.map(({ subdivisionName, count }) => (
              <Link
                key={subdivisionName}
                href={communityPagePath(city, subdivisionName)}
                className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground shadow-sm transition hover:border-primary/20 hover:shadow"
              >
                {getSubdivisionDisplayName(subdivisionName)} <span className="text-muted-foreground">({count})</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Suspense fallback={<div className="h-14 rounded-lg border border-border bg-muted" />}>
          <AdvancedSearchFilters
            basePath={searchPagePath}
            minPrice={sp.minPrice}
            maxPrice={sp.maxPrice}
            beds={sp.beds}
            baths={sp.baths}
            minSqFt={sp.minSqFt}
            maxSqFt={sp.maxSqFt}
            maxBeds={sp.maxBeds}
            maxBaths={sp.maxBaths}
            yearBuiltMin={sp.yearBuiltMin}
            yearBuiltMax={sp.yearBuiltMax}
            lotAcresMin={sp.lotAcresMin}
            lotAcresMax={sp.lotAcresMax}
            postalCode={sp.postalCode}
            propertyType={sp.propertyType}
            propertySubType={sp.propertySubType}
            statusFilter={sp.statusFilter}
            keywords={sp.keywords}
            hasOpenHouse={sp.hasOpenHouse}
            garageMin={sp.garageMin}
            hasPool={sp.hasPool}
            hasView={sp.hasView}
            hasWaterfront={sp.hasWaterfront}
            newListingsDays={sp.newListingsDays}
            sort={sp.sort}
            includeClosed={sp.includeClosed}
            view={viewParam}
            perPage={perPageParam}
          />
        </Suspense>
        <SaveSearchButton user={!!session?.user} />
      </div>

      <section className="mb-10 overflow-hidden rounded-xl border border-border shadow-sm">
        <div className="h-[320px] sm:h-[420px]">
          <SearchMapClustered
            listings={mapListingsWithCoords.length > 0 ? mapListingsWithCoords : listingsWithCoords}
            savedListingKeys={savedKeys}
            likedListingKeys={likedKeys}
            placeQuery={displayName ? `${displayName} Oregon` : undefined}
            boundaryGeojson={embeddedMapBoundary ?? undefined}
          />
        </div>
      </section>

      {!city && !hasFilterOnly ? (
        <p className="text-muted-foreground">Select a city or subdivision to see listings.</p>
      ) : listings.length === 0 ? (
        <p className="text-muted-foreground">No active listings in this area yet.</p>
      ) : (
        <>
          <SearchListingsToolbar
            pathname={searchPagePath}
            totalCount={totalCount}
            page={page}
            pageSize={pageSize}
            viewParam={viewParam}
            perPageParam={perPageParam}
            searchParams={{
              minPrice: sp.minPrice,
              maxPrice: sp.maxPrice,
              beds: sp.beds,
              baths: sp.baths,
              minSqFt: sp.minSqFt,
              propertyType: sp.propertyType,
              sort: sp.sort ?? 'newest',
              statusFilter: sp.statusFilter ?? (sp.includeClosed === '1' ? 'all' : 'active'),
              includeClosed: sp.includeClosed,
              page: String(page),
              view: viewParam,
              perPage: perPageParam,
            }}
          />
          <section
            className={`grid gap-6 ${columns === 1 ? 'grid-cols-1 max-w-md' : columns === 2 ? 'grid-cols-1 sm:grid-cols-2' : columns === 3 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}`}
          >
            {listings.map((listing, i) => {
              const key = (listing.ListNumber ?? listing.ListingKey ?? `listing-${i}`).toString().trim()
              const price = Number(listing.ListPrice ?? 0)
              const displayPrefs = prefs ?? { downPaymentPercent: DEFAULT_DISPLAY_DOWN_PCT, interestRate: DEFAULT_DISPLAY_RATE, loanTermYears: DEFAULT_DISPLAY_TERM_YEARS }
              const monthly = price > 0 ? estimatedMonthlyPayment(price, displayPrefs.downPaymentPercent, displayPrefs.interestRate, displayPrefs.loanTermYears) : null
              return (
                <ListingTile
                  key={key}
                  listing={listing}
                  listingKey={key}
                  hasRecentPriceChange={key ? priceChangeKeys.has(key) : false}
                  saved={session?.user ? savedKeys.includes(key) : undefined}
                  liked={session?.user ? likedKeys.includes(key) : undefined}
                  monthlyPayment={monthly != null && monthly > 0 ? formatMonthlyPayment(monthly) : undefined}
                  signedIn={!!session?.user}
                  userEmail={session?.user?.email ?? null}
                />
              )
            })}
          </section>
          {subdivision && nearbyCommunities.length > 0 && (
            <section className="mt-10">
              <h2 className="mb-4 text-lg font-semibold text-foreground">Nearby communities</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                Explore other communities in {city} near {getSubdivisionDisplayName(decodedSubdivision)}.
              </p>
              <div className="flex flex-wrap gap-3">
                {nearbyCommunities.map((c) => (
                  <Link
                    key={c.subdivisionName}
                    href={communityPagePath(city!, c.subdivisionName)}
                    className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground shadow-sm transition hover:border-primary/20 hover:shadow"
                  >
                    {getSubdivisionDisplayName(c.subdivisionName)} <span className="text-muted-foreground">({c.count})</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}
      </div>
    </main>
  )
}
