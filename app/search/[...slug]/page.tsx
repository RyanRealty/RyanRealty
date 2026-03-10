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
  getCityCentroid,
  getCommunityCentroid,
  type AdvancedSort,
} from '../../actions/listings'
import { getSession } from '../../actions/auth'
import {
  getBannerUrl,
  getOrCreatePlaceBanner,
  getPlaceBannerOptions,
  setPlaceBannerFromPhoto,
  refreshPlaceBanner,
  generateBannerForPage,
} from '../../actions/banners'
import { getBestListingHeroForGeography } from '../../actions/photo-classification'
import { getHeroVideoUrl, generateHeroVideoForPage } from '../../actions/hero-videos'
import SaveSearchButton from '../../../components/SaveSearchButton'
import { getGeocodedListings } from '../../actions/geocode'
import { getCityContent, getSubdivisionBlurb } from '../../../lib/city-content'
import { cityEntityKey, subdivisionEntityKey } from '../../../lib/slug'
import ListingMapGoogle from '../../../components/ListingMapGoogle'
import ListingTile from '../../../components/ListingTile'
import AdvancedSearchFilters from '../../../components/AdvancedSearchFilters'
import ShareButton from '../../../components/ShareButton'
import Breadcrumb from '../../../components/Breadcrumb'
import BannerActions from '../../../components/BannerActions'
import HeroVideoActions from '../../../components/HeroVideoActions'
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
import TrackSearchView from '../../../components/tracking/TrackSearchView'
import { getSavedCommunityKeys } from '../../actions/saved-communities'
import { trackPageView } from '../../../lib/followupboss'
import { getFubPersonIdFromCookie } from '../../actions/fub-identity-bridge'
import { getSavedListingKeys } from '../../actions/saved-listings'
import { getLikedListingKeys } from '../../actions/likes'
import { getBuyingPreferences } from '../../actions/buying-preferences'
import { estimatedMonthlyPayment, formatMonthlyPayment, DEFAULT_DISPLAY_RATE, DEFAULT_DISPLAY_DOWN_PCT, DEFAULT_DISPLAY_TERM_YEARS } from '../../../lib/mortgage'

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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>
}): Promise<Metadata> {
  const { slug = [] } = await params
  const citySlug = slug[0]
  const subdivision = slug[1]
  const resolvedCity = citySlug ? (await getCityFromSlug(citySlug)) ?? decodeURIComponent(citySlug).trim() : null
  const city = resolvedCity ?? citySlug ?? null
  const displayName = subdivision ? decodeURIComponent(subdivision) : (city ?? 'Central Oregon')
  const content = city ? getCityContent(city) : null
  const subdivisionDesc =
    subdivision && city ? await getSubdivisionDescription(city, decodeURIComponent(subdivision)) : null
  const metaDesc =
    (subdivision ? (subdivisionDesc ?? getSubdivisionBlurb(decodeURIComponent(subdivision))) : null) ??
    content?.metaDescription ??
    `Browse homes for sale in ${displayName}, Central Oregon. View listings, map, and property details.`
  const bannerUrl =
    city &&
    (subdivision
      ? await getBannerUrl('subdivision', subdivisionEntityKey(city, decodeURIComponent(subdivision)))
      : await getBannerUrl('city', cityEntityKey(city)))
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryanrealty.com').replace(/\/$/, '')
  const canonicalPath = city ? `/search/${cityEntityKey(city)}${subdivision ? `/${encodeURIComponent(decodeURIComponent(subdivision))}` : ''}` : '/'
  return {
    title: `Homes for Sale in ${displayName}`,
    description: metaDesc,
    alternates: { canonical: `${siteUrl}${canonicalPath}` },
    openGraph: {
      title: `Homes for Sale in ${displayName}`,
      description: metaDesc,
      url: `${siteUrl}${canonicalPath}`,
      ...(bannerUrl && {
        images: [{ url: bannerUrl, width: 1200, height: 336, alt: `Real estate in ${displayName}, Central Oregon` }],
      }),
    },
    twitter: { card: 'summary_large_image', title: `Homes for Sale in ${displayName}`, description: metaDesc },
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

export const dynamic = 'force-dynamic'

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string[] }>
  searchParams: Promise<SearchParams>
}) {
  const { slug = [] } = await params
  const sp = await searchParams
  const citySlug = slug[0]
  const subdivision = slug[1]
  const decodedSubdivision = subdivision ? decodeURIComponent(subdivision) : undefined

  const resolvedCity = citySlug ? (await getCityFromSlug(citySlug)) ?? (decodeURIComponent(citySlug).trim() || undefined) : undefined
  const city = resolvedCity ?? citySlug ?? undefined

  const columns = [1, 2, 3, 4, 5].includes(Number(sp.view)) ? Number(sp.view) : 3
  const viewParam = String(columns) as '1' | '2' | '3' | '4' | '5'
  const ROWS = 3
  const defaultPageSize = columns * ROWS
  const perPageParam = sp.perPage ?? String(defaultPageSize)
  const pageSize = Math.min(100, Math.max(1, parseInt(perPageParam, 10) || defaultPageSize))
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  const offset = (page - 1) * pageSize

  const filterOpts = {
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

  const [listingsResult, marketStats, statusCounts, subdivisions, hotCommunities, priceChangeKeys, session, resortEntityKeys] = await Promise.all([
    city ? getListingsWithAdvanced({ ...filterOpts, limit: pageSize, offset }) : Promise.resolve({ listings: [], totalCount: 0 }),
    getCityMarketStats({ city: city || undefined, subdivision: decodedSubdivision }),
    city ? getCityStatusCounts({ city, subdivision: decodedSubdivision ?? null }) : Promise.resolve({ active: 0, pending: 0, closed: 0, other: 0 }),
    city && !subdivision ? getSubdivisionsInCity(city) : Promise.resolve([]),
    city && !subdivision ? getHotCommunitiesInCity(city) : Promise.resolve([]),
    getListingKeysWithRecentPriceChange(),
    getSession(),
    getResortEntityKeys(),
  ])
  const hotCommunitiesSlice = city && !subdivision ? hotCommunities.slice(0, 10) : []
  const [hotCommunityBannerUrls, savedCommunityKeys] = await Promise.all([
    city && !subdivision && hotCommunitiesSlice.length > 0
      ? Promise.all(
          hotCommunitiesSlice.map((c) =>
            getBannerUrl('subdivision', subdivisionEntityKey(city, c.subdivisionName))
          )
        )
      : Promise.resolve([]),
    session?.user ? getSavedCommunityKeys() : Promise.resolve([]),
  ])
  const { listings, totalCount } = listingsResult
  const effectiveStatusFilter = (filterOpts.statusFilter && ['active', 'active_and_pending', 'pending', 'closed', 'all'].includes(filterOpts.statusFilter))
    ? filterOpts.statusFilter
    : filterOpts.includeClosed
      ? 'all'
      : 'active'
  const [listingsWithCoords, mapListingsRaw, nearbyCommunities, mapCenter] = await Promise.all([
    getGeocodedListings(listings),
    city
      ? getListingsForMap({
          city,
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
        })
      : Promise.resolve([]),
    city && subdivision && decodedSubdivision
      ? getNearbyCommunities(city, decodedSubdivision)
      : Promise.resolve([]),
    city
      ? subdivision && decodedSubdivision
        ? getCommunityCentroid(city, decodedSubdivision).then((c) => (c ? { latitude: c.lat, longitude: c.lng, zoom: 12 } as const : null))
        : getCityCentroid(city).then((c) => (c ? { latitude: c.lat, longitude: c.lng, zoom: 11 } as const : null))
      : Promise.resolve(null),
  ])
  const mapListingsWithCoords = city && mapListingsRaw.length > 0 ? await getGeocodedListings(mapListingsRaw) : []
  const mapCenterResolved = mapCenter ?? (city ? FALLBACK_CITY_CENTERS[cityEntityKey(city)] ?? null : null)

  const displayName = subdivision ? decodedSubdivision! : city || 'Central Oregon'
  const cityContent = city ? getCityContent(city) : null
  const subdivisionTabContent =
    subdivision && city ? await getSubdivisionTabContent(city, decodedSubdivision!) : null
  const subdivisionBlurb =
    subdivision
      ? (subdivisionTabContent?.about ?? getSubdivisionBlurb(decodedSubdivision!))
      : null

  const entityType = subdivision ? ('subdivision' as const) : ('city' as const)
  const entityKey = subdivision ? subdivisionEntityKey(city!, decodedSubdivision!) : cityEntityKey(city!)
  const bannerSearchQuery = city
    ? subdivision && decodedSubdivision
      ? `${decodedSubdivision} ${city} Oregon`
      : `${city} Oregon`
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
  const searchPagePath = city ? `/search/${cityEntityKey(city)}${subdivision ? `/${encodeURIComponent(decodedSubdivision!)}` : ''}` : '/search'
  const searchPageUrl = `${siteUrl}${searchPagePath}`
  const fubPersonId = session?.user ? null : await getFubPersonIdFromCookie()
  if (city || subdivision) {
    if (session?.user?.email || fubPersonId) {
      trackPageView({
        user: session?.user ?? undefined,
        fubPersonId: fubPersonId ?? undefined,
        pageUrl: searchPageUrl,
        pageTitle: `Homes for Sale in ${displayName}`,
      }).catch(() => {})
    }
  }

  const [savedKeys, likedKeys, prefs] =
    session?.user
      ? await Promise.all([getSavedListingKeys(), getLikedListingKeys(), getBuyingPreferences()])
      : ([[], [] as string[], null] as [string[], string[], Awaited<ReturnType<typeof getBuyingPreferences>>])

  const searchBreadcrumbItems: { label: string; href?: string }[] = [
    { label: 'Ryan Realty', href: siteUrl },
    { label: 'Homes for Sale', href: `${siteUrl}/listings` },
  ]
  const cityLabel = city ?? (citySlug ? decodeURIComponent(citySlug) : '')
  if (city) searchBreadcrumbItems.push({ label: cityLabel, href: subdivision ? `${siteUrl}/search/${cityEntityKey(city)}` : undefined })
  if (subdivision) searchBreadcrumbItems.push({ label: decodedSubdivision! })

  return (
    <main className="min-h-screen">
      {/* Hero first: full-width, then breadcrumb + content in wrapper (Zillow-style) */}
      {city && (
        <section className="w-full" aria-label={`Hero: ${displayName}`}>
          {(heroVideoUrl || bannerUrl) ? (
            <div className="relative h-[40vh] w-full min-h-[240px] overflow-hidden bg-zinc-900 sm:h-[50vh]">
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
                <HeroVideoActions
                  generateAction={generateHeroVideoForPage}
                  entityType={subdivision ? 'subdivision' : 'city'}
                  entityKey={subdivision ? subdivisionEntityKey(city, decodedSubdivision!) : cityEntityKey(city)}
                  displayName={displayName}
                  city={subdivision ? city : undefined}
                  hasVideo={!!heroVideoUrl}
                />
                <BannerActions
                  generateAction={generateBannerForPage}
                  getOptionsAction={getPlaceBannerOptions}
                  setBannerFromPhotoAction={setPlaceBannerFromPhoto}
                  refreshBannerAction={refreshPlaceBanner}
                  searchQuery={bannerSearchQuery}
                  entityType={subdivision ? 'subdivision' : 'city'}
                  entityKey={subdivision ? subdivisionEntityKey(city, decodedSubdivision!) : cityEntityKey(city)}
                  displayName={displayName}
                  city={subdivision ? city : undefined}
                  hasBanner={!!bannerUrl}
                />
              </div>
            </div>
          ) : (
            <div className="flex min-h-[240px] h-[40vh] flex-col items-center justify-center gap-4 bg-zinc-100 sm:h-[50vh]">
              <p className="text-sm text-zinc-600">No hero media yet.</p>
              <div className="flex flex-wrap gap-2 justify-center">
                <HeroVideoActions
                  generateAction={generateHeroVideoForPage}
                  entityType={subdivision ? 'subdivision' : 'city'}
                  entityKey={subdivision ? subdivisionEntityKey(city, decodedSubdivision!) : cityEntityKey(city)}
                  displayName={displayName}
                  city={subdivision ? city : undefined}
                  hasVideo={false}
                />
                <BannerActions
                  generateAction={generateBannerForPage}
                  getOptionsAction={getPlaceBannerOptions}
                  setBannerFromPhotoAction={setPlaceBannerFromPhoto}
                  refreshBannerAction={refreshPlaceBanner}
                  searchQuery={bannerSearchQuery}
                  entityType={subdivision ? 'subdivision' : 'city'}
                  entityKey={subdivision ? subdivisionEntityKey(city, decodedSubdivision!) : cityEntityKey(city)}
                  displayName={displayName}
                  city={subdivision ? city : undefined}
                  hasBanner={false}
                />
              </div>
            </div>
          )}
        </section>
      )}

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {city && (
          <TrackSearchView
            city={city}
            subdivision={decodedSubdivision ?? undefined}
            resultsCount={totalCount}
          />
        )}
        {searchBreadcrumbItems.length > 2 && (
          <Breadcrumb items={searchBreadcrumbItems} />
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
          <h1 className="text-2xl font-bold capitalize tracking-tight text-zinc-900 sm:text-3xl">
            Homes in {displayName}
          </h1>
          <p className="mt-1 text-zinc-600">
            {totalCount.toLocaleString()} listing{totalCount !== 1 ? 's' : ''}.{' '}
            <Link href="/listings?view=map" className="font-medium text-zinc-900 underline hover:no-underline">
              View on map
            </Link>
          </p>
          {city && (totalCount > 0 || statusCounts.pending > 0 || statusCounts.closed > 0) && (
            <p className="mt-2 text-sm text-zinc-500">
              <span className="font-medium text-zinc-700">{totalCount.toLocaleString()} active</span>
              {' · '}
              <span className="font-medium text-zinc-700">{statusCounts.pending.toLocaleString()} under contract</span>
              {' · '}
              <span className="font-medium text-zinc-700">{statusCounts.closed.toLocaleString()} closed</span>
              {(statusCounts.other > 0) && (
                <> · <span className="font-medium text-zinc-700">{statusCounts.other.toLocaleString()} other</span></>
              )}
            </p>
          )}
        </div>
        <ShareButton
          title={`Homes for Sale in ${displayName}`}
          text={subdivisionBlurb ?? cityContent?.metaDescription ?? `Browse ${totalCount.toLocaleString()} listings in ${displayName}, Central Oregon.`}
          url={siteUrl ? `${siteUrl}/search/${cityEntityKey(city)}${subdivision ? `/${encodeURIComponent(decodedSubdivision!)}` : ''}` : undefined}
          variant="default"
        />
      </header>

      {/* About this community (subdivision pages with description) */}
      {subdivision && (subdivisionBlurb ?? subdivisionTabContent?.about) && (
        <section className="mb-10 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">About {displayName}</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600 whitespace-pre-line">
            {subdivisionBlurb ?? subdivisionTabContent?.about ?? ''}
          </p>
        </section>
      )}

      {/* Amenities & lifestyle (resort communities with attractions/dining content) */}
      {subdivision && city && decodedSubdivision && isResortCommunity(city, decodedSubdivision, resortEntityKeys) && (subdivisionTabContent?.attractions ?? subdivisionTabContent?.dining) && (
        <section className="mb-10 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Amenities & lifestyle</h2>
          {subdivisionTabContent?.attractions && (
            <div className="mt-3">
              <h3 className="text-sm font-medium text-zinc-700">Things to do</h3>
              <div className="mt-1 text-sm leading-relaxed text-zinc-600 whitespace-pre-line">
                {subdivisionTabContent.attractions}
              </div>
            </div>
          )}
          {subdivisionTabContent?.dining && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-zinc-700">Dining</h3>
              <div className="mt-1 text-sm leading-relaxed text-zinc-600 whitespace-pre-line">
                {subdivisionTabContent.dining}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Market snapshot — engaging summary for city/community */}
      <section className="mb-10 rounded-xl border border-zinc-200 bg-gradient-to-br from-zinc-50 to-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">
          {subdivision ? `${displayName} at a glance` : `${displayName} market`}
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          {totalCount.toLocaleString()} home{totalCount !== 1 ? 's' : ''} for sale
          {marketStats.newListingsLast30Days > 0 &&
            ` · ${marketStats.newListingsLast30Days} new in the last 30 days`}
          {' · '}
          <Link href="/reports" className="font-medium text-zinc-900 underline hover:no-underline">
            Market reports
          </Link>
        </p>
        {city && (totalCount > 0 || statusCounts.pending > 0 || statusCounts.closed > 0) && (
          <p className="mt-2 text-sm text-zinc-500">
            {totalCount.toLocaleString()} active · {statusCounts.pending.toLocaleString()} under contract · {statusCounts.closed.toLocaleString()} closed
            {statusCounts.other > 0 && ` · ${statusCounts.other.toLocaleString()} other`}
          </p>
        )}
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <div className="rounded-lg bg-white/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Homes for sale (active)</p>
            <p className="mt-1 text-2xl font-bold text-zinc-900">{totalCount.toLocaleString()}</p>
          </div>
          {marketStats.avgPrice != null && (
            <div className="rounded-lg bg-white/80 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Avg. list price (active)</p>
              <p className="mt-1 text-2xl font-bold text-emerald-700">
                ${marketStats.avgPrice.toLocaleString()}
              </p>
            </div>
          )}
          {marketStats.medianPrice != null && (
            <div className="rounded-lg bg-white/80 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Median list price</p>
              <p className="mt-1 text-2xl font-bold text-zinc-900">
                ${marketStats.medianPrice.toLocaleString()}
              </p>
            </div>
          )}
          <div className="rounded-lg bg-white/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">New (last 30 days)</p>
            <p className="mt-1 text-2xl font-bold text-amber-600">{marketStats.newListingsLast30Days}</p>
          </div>
          {marketStats.pendingCount > 0 && (
            <div className="rounded-lg bg-white/80 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Pending</p>
              <p className="mt-1 text-2xl font-bold text-amber-600">{marketStats.pendingCount}</p>
            </div>
          )}
          {marketStats.closedLast12Months > 0 && (
            <div className="rounded-lg bg-white/80 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Closed (12 mo)</p>
              <p className="mt-1 text-2xl font-bold text-zinc-600">{marketStats.closedLast12Months}</p>
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
            sectionBackgroundUrl={bannerUrl}
            bannerUrls={hotCommunityBannerUrls}
            signedIn={!!session?.user}
            savedCommunityKeys={savedCommunityKeys}
          />
        </section>
      )}

      {/* Communities in this city (city page only) */}
      {city && !subdivision && subdivisions.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900">Communities in {city}</h2>
          <p className="mb-4 text-sm text-zinc-600">
            Explore neighborhoods and communities in {city}. Click a community to see homes for sale.
          </p>
          <div className="flex flex-wrap gap-3">
            {subdivisions.map(({ subdivisionName, count }) => (
              <Link
                key={subdivisionName}
                href={`/search/${cityEntityKey(city)}/${encodeURIComponent(subdivisionName)}`}
                className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:shadow"
              >
                {subdivisionName} <span className="text-zinc-400">({count})</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Suspense fallback={<div className="h-14 rounded-xl border border-zinc-200 bg-zinc-50" />}>
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

      <section className="mb-10 overflow-hidden rounded-2xl border border-zinc-200 shadow-sm">
        <div className="h-[320px] sm:h-[420px]">
          <ListingMapGoogle
            listings={mapListingsWithCoords.length > 0 ? mapListingsWithCoords : listingsWithCoords}
            initialCenter={mapCenterResolved}
          />
        </div>
      </section>

      {!city ? (
        <p className="text-zinc-500">Select a city or subdivision to see listings.</p>
      ) : listings.length === 0 ? (
        <p className="text-zinc-500">No active listings in this area yet.</p>
      ) : (
        <>
          <SearchListingsToolbar
            pathname={subdivision ? `/search/${cityEntityKey(city)}/${encodeURIComponent(decodedSubdivision!)}` : `/search/${cityEntityKey(city)}`}
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
              <h2 className="mb-4 text-lg font-semibold text-zinc-900">Nearby communities</h2>
              <p className="mb-4 text-sm text-zinc-600">
                Explore other communities in {city} near {decodedSubdivision}.
              </p>
              <div className="flex flex-wrap gap-3">
                {nearbyCommunities.map((c) => (
                  <Link
                    key={c.subdivisionName}
                    href={`/search/${cityEntityKey(city!)}/${encodeURIComponent(c.subdivisionName)}`}
                    className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:shadow"
                  >
                    {c.subdivisionName} <span className="text-zinc-400">({c.count})</span>
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
