import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import {
  getListings,
  getListingsForMap,
  getCityMarketStats,
  getCityStatusCounts,
  getSubdivisionsInCity,
  getHotCommunitiesInCity,
  getNearbyCommunities,
  getListingKeysWithRecentPriceChange,
  getCityFromSlug,
  getActiveListingsCount,
  getCityCentroid,
  getCommunityCentroid,
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
import { getHeroVideoUrl, generateHeroVideoForPage } from '../../actions/hero-videos'
import SaveSearchButton from '../../../components/SaveSearchButton'
import { getGeocodedListings } from '../../actions/geocode'
import { getCityContent, getSubdivisionBlurb } from '../../../lib/city-content'
import { cityEntityKey, subdivisionEntityKey } from '../../../lib/slug'
import ListingMap from '../../../components/ListingMap'
import ListingCard from '../../../components/ListingCard'
import ListingFilters from '../../../components/ListingFilters'
import ShareButton from '../../../components/ShareButton'
import Breadcrumb from '../../../components/Breadcrumb'
import BannerActions from '../../../components/BannerActions'
import HeroVideoActions from '../../../components/HeroVideoActions'
import SearchPageJsonLd from './SearchPageJsonLd'
import {
  getSubdivisionDescription,
  getSubdivisionTabContent,
} from '../../actions/subdivision-descriptions'
import SearchListingsToolbar from '../../../components/SearchListingsToolbar'
import { trackPageView } from '../../../lib/followupboss'
import { getSavedListingKeys } from '../../actions/saved-listings'
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

type SearchParams = {
  minPrice?: string
  maxPrice?: string
  beds?: string
  baths?: string
  minSqFt?: string
  propertyType?: string
  sort?: string
  includeClosed?: string
  page?: string
  /** Columns: '1'–'5' (×3 rows) */
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
  const pageSize = columns * ROWS
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
    propertyType: sp.propertyType,
    sort: (sp.sort === 'newest' || sp.sort === 'oldest' || sp.sort === 'price_asc' || sp.sort === 'price_desc' ? sp.sort : 'newest') as 'newest' | 'oldest' | 'price_asc' | 'price_desc',
    includeClosed: sp.includeClosed === '1',
  }

  const [listings, totalCount, marketStats, statusCounts, subdivisions, hotCommunities, priceChangeKeys, session] = await Promise.all([
    city ? getListings({ ...filterOpts, limit: pageSize, offset }) : Promise.resolve([]),
    city ? getActiveListingsCount(filterOpts) : Promise.resolve(0),
    getCityMarketStats({ city: city || undefined, subdivision: decodedSubdivision }),
    city ? getCityStatusCounts({ city, subdivision: decodedSubdivision ?? null }) : Promise.resolve({ active: 0, pending: 0, closed: 0, other: 0 }),
    city && !subdivision ? getSubdivisionsInCity(city) : Promise.resolve([]),
    city && !subdivision ? getHotCommunitiesInCity(city) : Promise.resolve([]),
    getListingKeysWithRecentPriceChange(),
    getSession(),
  ])
  const [listingsWithCoords, mapListingsRaw, nearbyCommunities, mapCenter] = await Promise.all([
    getGeocodedListings(listings),
    city ? getListingsForMap({ city, subdivision: decodedSubdivision, includeClosed: filterOpts.includeClosed }) : Promise.resolve([]),
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
  const [heroVideoUrl, bannerResult] =
    city
      ? await Promise.all([
          subdivision
            ? getHeroVideoUrl('subdivision', entityKey)
            : getHeroVideoUrl('city', entityKey),
          getOrCreatePlaceBanner(entityType, entityKey, bannerSearchQuery),
        ])
      : [null, { url: null, attribution: null }]
  const bannerUrl = bannerResult?.url ?? null
  const bannerAttribution = bannerResult?.attribution ?? null

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || ''
  const searchPagePath = city ? `/search/${cityEntityKey(city)}${subdivision ? `/${encodeURIComponent(decodedSubdivision!)}` : ''}` : '/search'
  const searchPageUrl = `${siteUrl}${searchPagePath}`
  if (session?.user?.email && (city || subdivision)) {
    trackPageView({
      user: session.user,
      pageUrl: searchPageUrl,
      pageTitle: `Homes for Sale in ${displayName}`,
    }).catch(() => {})
  }

  const [savedKeys, prefs] =
    session?.user
      ? await Promise.all([getSavedListingKeys(), getBuyingPreferences()])
      : ([[], null] as [string[], Awaited<ReturnType<typeof getBuyingPreferences>>])

  const searchBreadcrumbItems: { label: string; href?: string }[] = [
    { label: 'Ryan Realty', href: siteUrl },
    { label: 'Homes for Sale', href: `${siteUrl}/listings` },
  ]
  const cityLabel = city ?? (citySlug ? decodeURIComponent(citySlug) : '')
  if (city) searchBreadcrumbItems.push({ label: cityLabel, href: subdivision ? `${siteUrl}/search/${cityEntityKey(city)}` : undefined })
  if (subdivision) searchBreadcrumbItems.push({ label: decodedSubdivision! })

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {searchBreadcrumbItems.length > 2 && (
        <Breadcrumb items={searchBreadcrumbItems} />
      )}
      {/* Hero: video flyover when available, else banner (stored: AI or Unsplash/Pexels) */}
      {city && (
        <section className="-mx-4 mb-8 sm:-mx-6" aria-hidden="false">
          {(heroVideoUrl || bannerUrl) ? (
            <div className="relative h-48 w-full overflow-hidden bg-zinc-900 sm:h-56">
              {heroVideoUrl ? (
                <video
                  src={heroVideoUrl}
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="h-full w-full object-cover"
                  aria-label={`Aerial flyover of ${displayName}, Central Oregon`}
                />
              ) : bannerUrl ? (
                <>
                  <Image
                    src={bannerUrl}
                    alt={`Real estate in ${displayName}, Central Oregon – scenic area`}
                    width={1200}
                    height={336}
                    className="h-full w-full object-cover"
                    sizes="100vw"
                    priority
                  />
                  {bannerAttribution && (
                    <p className="absolute bottom-2 left-2 text-xs text-white/90 drop-shadow-md">
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
            <div className="flex h-48 flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50 sm:h-56">
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
      {city && (
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
      )}

      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold capitalize tracking-tight text-zinc-900 sm:text-3xl">
            Homes in {displayName}
          </h1>
          <p className="mt-1 text-zinc-600">
            {marketStats.count} listing{marketStats.count !== 1 ? 's' : ''}.{' '}
            <Link href="/listings?view=map" className="font-medium text-zinc-900 underline hover:no-underline">
              View on map
            </Link>
          </p>
          {city && (statusCounts.active > 0 || statusCounts.pending > 0 || statusCounts.closed > 0) && (
            <p className="mt-2 text-sm text-zinc-500">
              <span className="font-medium text-zinc-700">{statusCounts.active.toLocaleString()} active</span>
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
          text={subdivisionBlurb ?? cityContent?.metaDescription ?? `Browse ${marketStats.count} listings in ${displayName}, Central Oregon.`}
          url={siteUrl ? `${siteUrl}/search/${cityEntityKey(city)}${subdivision ? `/${encodeURIComponent(decodedSubdivision!)}` : ''}` : undefined}
          variant="default"
        />
      </header>

      {/* Market snapshot — engaging summary for city/community */}
      <section className="mb-10 rounded-xl border border-zinc-200 bg-gradient-to-br from-zinc-50 to-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">
          {subdivision ? `${displayName} at a glance` : `${displayName} market`}
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          {marketStats.count} home{marketStats.count !== 1 ? 's' : ''} for sale
          {marketStats.newListingsLast30Days > 0 &&
            ` · ${marketStats.newListingsLast30Days} new in the last 30 days`}
        </p>
        {city && (statusCounts.active > 0 || statusCounts.pending > 0 || statusCounts.closed > 0) && (
          <p className="mt-2 text-sm text-zinc-500">
            {statusCounts.active.toLocaleString()} active · {statusCounts.pending.toLocaleString()} under contract · {statusCounts.closed.toLocaleString()} closed
            {statusCounts.other > 0 && ` · ${statusCounts.other.toLocaleString()} other`}
          </p>
        )}
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <div className="rounded-lg bg-white/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Homes for sale (active)</p>
            <p className="mt-1 text-2xl font-bold text-zinc-900">{(city ? statusCounts.active : marketStats.count).toLocaleString()}</p>
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

      {/* Hot communities (city page only) — top 5 by activity */}
      {city && !subdivision && hotCommunities.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-2 text-lg font-semibold text-zinc-900">Hot communities</h2>
          <p className="mb-4 text-sm text-zinc-600">
            Where the action is: most listings, pending sales, and new listings in {city}.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {hotCommunities.map((c) => (
              <Link
                key={c.subdivisionName}
                href={`/search/${cityEntityKey(city)}/${encodeURIComponent(c.subdivisionName)}`}
                className="group flex flex-col rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-emerald-200 hover:shadow-md"
              >
                <span className="font-semibold text-zinc-900 group-hover:text-emerald-700">
                  {c.subdivisionName}
                </span>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-zinc-600">
                  <span>{c.forSale} for sale</span>
                  {c.pending > 0 && (
                    <span className="font-medium text-amber-600">{c.pending} pending</span>
                  )}
                  {c.newLast7Days > 0 && (
                    <span className="font-medium text-emerald-600">{c.newLast7Days} new this week</span>
                  )}
                </div>
                {c.medianListPrice != null && (
                  <p className="mt-2 text-sm font-semibold text-zinc-900">
                    ${c.medianListPrice.toLocaleString()} median
                  </p>
                )}
              </Link>
            ))}
          </div>
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
          <ListingFilters
            minPrice={sp.minPrice}
            maxPrice={sp.maxPrice}
            beds={sp.beds}
            baths={sp.baths}
            minSqFt={sp.minSqFt}
            propertyType={sp.propertyType}
            sort={sp.sort}
            includeClosed={sp.includeClosed}
            page={String(page)}
            view={viewParam}
          />
        </Suspense>
        <SaveSearchButton user={!!session?.user} />
      </div>

      <section className="mb-10 overflow-hidden rounded-2xl border border-zinc-200 shadow-sm">
        <div className="h-[320px] sm:h-[420px]">
          <ListingMap
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
            searchParams={{
              minPrice: sp.minPrice,
              maxPrice: sp.maxPrice,
              beds: sp.beds,
              baths: sp.baths,
              minSqFt: sp.minSqFt,
              propertyType: sp.propertyType,
              sort: sp.sort ?? 'newest',
              includeClosed: sp.includeClosed,
              page: String(page),
              view: viewParam,
            }}
          />
          <section
            className={`grid gap-6 ${columns === 1 ? 'grid-cols-1 max-w-md' : columns === 2 ? 'grid-cols-1 sm:grid-cols-2' : columns === 3 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : columns === 4 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'}`}
          >
            {listings.map((listing, i) => {
              const key = listing.ListingKey ?? listing.ListNumber ?? `listing-${i}`
              const price = Number(listing.ListPrice ?? 0)
              const displayPrefs = prefs ?? { downPaymentPercent: DEFAULT_DISPLAY_DOWN_PCT, interestRate: DEFAULT_DISPLAY_RATE, loanTermYears: DEFAULT_DISPLAY_TERM_YEARS }
              const monthly = price > 0 ? estimatedMonthlyPayment(price, displayPrefs.downPaymentPercent, displayPrefs.interestRate, displayPrefs.loanTermYears) : null
              return (
                <ListingCard
                  key={key}
                  listing={listing}
                  hasRecentPriceChange={key ? priceChangeKeys.has(key) : false}
                  saved={session?.user ? savedKeys.includes(key) : undefined}
                  monthlyPayment={monthly != null && monthly > 0 ? formatMonthlyPayment(monthly) : undefined}
                  signedIn={!!session?.user}
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
    </main>
  )
}
