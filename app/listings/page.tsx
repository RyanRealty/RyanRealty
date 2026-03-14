import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { getListingsWithAdvanced, getListingsForMap, getListingKeysWithRecentPriceChange } from '../actions/listings'
import { getSession } from '../actions/auth'
import { getSavedListingKeys } from '../actions/saved-listings'
import { getLikedListingKeys } from '../actions/likes'
import { getBuyingPreferences } from '../actions/buying-preferences'
import { getCitiesForIndex } from '../actions/cities'
import { estimatedMonthlyPayment, formatMonthlyPayment, DEFAULT_DISPLAY_RATE, DEFAULT_DISPLAY_DOWN_PCT, DEFAULT_DISPLAY_TERM_YEARS } from '../../lib/mortgage'
import SaveSearchButton from '../../components/SaveSearchButton'
import { getGeocodedListings } from '../actions/geocode'
import ListingTile from '../../components/ListingTile'
import SearchFilterBar from '../../components/SearchFilterBar'
import BreadcrumbStrip from '../../components/layout/BreadcrumbStrip'
import ContentPageHero from '../../components/layout/ContentPageHero'
import { CONTENT_HERO_IMAGES } from '../../lib/content-page-hero-images'
import ListingsMapSplitView from './ListingsMapSplitView'
import UnifiedMapListingsView from '../../components/UnifiedMapListingsView'
import ListingsPagination from '../../components/ListingsPagination'
import ListingsPageFooter from './ListingsPageFooter'

type SearchParams = {
  view?: string
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
}

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export const metadata: Metadata = {
  title: 'All Listings',
  description: 'Browse all Central Oregon homes for sale. View listings and map.',
  alternates: { canonical: `${siteUrl}/listings` },
  openGraph: {
    title: 'All Listings | Ryan Realty',
    description: 'Browse all Central Oregon homes for sale. View listings and map.',
    url: `${siteUrl}/listings`,
    type: 'website',
    siteName: 'Ryan Realty',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'All Listings | Ryan Realty',
    description: 'Browse all Central Oregon homes for sale. View listings and map.',
  },
}

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const p = await searchParams
  const {
    view,
    minPrice,
    maxPrice,
    beds,
    baths,
    minSqFt,
    maxSqFt,
    maxBeds,
    maxBaths,
    yearBuiltMin,
    yearBuiltMax,
    lotAcresMin,
    lotAcresMax,
    postalCode,
    propertyType,
    propertySubType,
    statusFilter,
    keywords,
    hasOpenHouse,
    garageMin,
    hasPool,
    hasView,
    hasWaterfront,
    newListingsDays,
    sort,
    includeClosed,
    page: pageParam,
    perPage: perPageParam,
  } = p
  const page = Math.max(1, parseInt(String(pageParam ?? '1'), 10) || 1)
  const perPage = Math.min(50, Math.max(10, parseInt(String(perPageParam ?? '20'), 10) || 20))
  const isMapView = view === 'map'

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !anonKey?.trim()) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <p className="text-muted-foreground">Database not configured.</p>
      </main>
    )
  }

  const filterOpts = {
    limit: perPage,
    offset: (page - 1) * perPage,
    minPrice: minPrice ? Number(minPrice) : undefined,
    maxPrice: maxPrice ? Number(maxPrice) : undefined,
    minBeds: beds ? Number(beds) : undefined,
    minBaths: baths ? Number(baths) : undefined,
    minSqFt: minSqFt ? Number(minSqFt) : undefined,
    maxSqFt: maxSqFt ? Number(maxSqFt) : undefined,
    maxBeds: maxBeds ? Number(maxBeds) : undefined,
    maxBaths: maxBaths ? Number(maxBaths) : undefined,
    yearBuiltMin: yearBuiltMin ? Number(yearBuiltMin) : undefined,
    yearBuiltMax: yearBuiltMax ? Number(yearBuiltMax) : undefined,
    lotAcresMin: lotAcresMin != null ? Number(lotAcresMin) : undefined,
    lotAcresMax: lotAcresMax != null ? Number(lotAcresMax) : undefined,
    postalCode: postalCode?.trim() || undefined,
    propertyType: propertyType?.trim() || undefined,
    propertySubType: propertySubType?.trim() || undefined,
    statusFilter: statusFilter?.trim() || undefined,
    keywords: keywords?.trim() || undefined,
    hasOpenHouse: hasOpenHouse === '1',
    garageMin: garageMin != null ? Number(garageMin) : undefined,
    hasPool: hasPool === '1',
    hasView: hasView === '1',
    hasWaterfront: hasWaterfront === '1',
    newListingsDays: newListingsDays ? Number(newListingsDays) : undefined,
    includeClosed: includeClosed === '1',
    sort:
      sort === 'newest' || sort === 'oldest' || sort === 'price_asc' || sort === 'price_desc' ||
      sort === 'price_per_sqft_asc' || sort === 'price_per_sqft_desc' || sort === 'year_newest' || sort === 'year_oldest'
        ? (sort as 'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'price_per_sqft_asc' | 'price_per_sqft_desc' | 'year_newest' | 'year_oldest')
        : undefined,
  }

  const effectiveStatusFilter =
    statusFilter && ['active', 'active_and_pending', 'pending', 'closed', 'all'].includes(statusFilter)
      ? statusFilter
      : includeClosed
        ? 'all'
        : 'active'

  const [listingsPromise, mapListingsPromise, priceChangeKeysPromise, sessionPromise, citiesPromise] = [
    isMapView ? Promise.resolve({ listings: [], totalCount: 0 }) : getListingsWithAdvanced(filterOpts),
    isMapView ? Promise.resolve([]) : getListingsForMap({
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
    getListingKeysWithRecentPriceChange(),
    getSession(),
    getCitiesForIndex(),
  ]
  const [{ listings, totalCount }, mapListingsRaw, priceChangeKeys, session, cities] = await Promise.all([
    listingsPromise,
    mapListingsPromise,
    priceChangeKeysPromise,
    sessionPromise,
    citiesPromise,
  ])
  const [savedKeys, likedKeys, prefs] =
    session?.user
      ? await Promise.all([
          import('../actions/saved-listings').then((m) => m.getSavedListingKeys()),
          import('../actions/likes').then((m) => m.getLikedListingKeys()),
          import('../actions/buying-preferences').then((m) => m.getBuyingPreferences()),
        ])
      : [[], [] as string[], null] as [string[], string[], Awaited<ReturnType<typeof import('../actions/buying-preferences').getBuyingPreferences>>]
  const [listingsWithCoords, mapListingsWithCoords] = isMapView
    ? [listings, []]
    : await Promise.all([
        getGeocodedListings(listings),
        mapListingsRaw.length > 0 ? getGeocodedListings(mapListingsRaw) : Promise.resolve([]),
      ])

  if (isMapView) {
    const searchParamsForBar = {
      view: 'map',
      minPrice: p.minPrice,
      maxPrice: p.maxPrice,
      beds: p.beds,
      baths: p.baths,
      minSqFt: p.minSqFt,
      maxSqFt: p.maxSqFt,
      maxBeds: p.maxBeds,
      maxBaths: p.maxBaths,
      yearBuiltMin: p.yearBuiltMin,
      yearBuiltMax: p.yearBuiltMax,
      lotAcresMin: p.lotAcresMin,
      lotAcresMax: p.lotAcresMax,
      postalCode: p.postalCode,
      propertyType: p.propertyType,
      propertySubType: p.propertySubType,
      statusFilter: p.statusFilter,
      keywords: p.keywords,
      hasOpenHouse: p.hasOpenHouse,
      garageMin: p.garageMin,
      hasPool: p.hasPool,
      hasView: p.hasView,
      hasWaterfront: p.hasWaterfront,
      newListingsDays: p.newListingsDays,
      sort: p.sort,
      includeClosed: p.includeClosed,
      page: String(page),
      perPage: p.perPage ?? String(perPage),
    }
    const mapQuery = new URLSearchParams()
    for (const [k, v] of Object.entries(searchParamsForBar)) {
      if (v !== undefined && v !== '') mapQuery.set(k, v)
    }
    const bendMapHref = `/homes-for-sale/bend?${mapQuery.toString()}`
    const mapBreadcrumbItems = [
      { label: 'Home', href: '/' },
      { label: 'Homes for Sale', href: '/listings' },
      { label: 'Bend OR', href: bendMapHref },
    ]
    return (
      <main className="flex flex-col h-[calc(100vh-120px)] min-h-[400px] overflow-hidden">
        <div className="shrink-0">
          <BreadcrumbStrip items={mapBreadcrumbItems} />
        </div>
        <UnifiedMapListingsView
          containerClassName="flex-1 min-h-0 overflow-hidden"
          pageTitle="Bend OR Real Estate & Homes For Sale"
          basePath="/listings"
          placeQuery="Bend Oregon"
          savedKeys={savedKeys}
          likedKeys={likedKeys}
          priceChangeKeys={priceChangeKeys}
          signedIn={!!session?.user}
          userEmail={session?.user?.email ?? null}
          prefs={prefs}
          statusFilter={effectiveStatusFilter}
          includeClosed={includeClosed === '1'}
          minPrice={minPrice ? Number(minPrice) : undefined}
          maxPrice={maxPrice ? Number(maxPrice) : undefined}
          minBeds={beds ? Number(beds) : undefined}
          maxBeds={maxBeds ? Number(maxBeds) : undefined}
          minBaths={baths ? Number(baths) : undefined}
          maxBaths={maxBaths ? Number(maxBaths) : undefined}
          minSqFt={minSqFt ? Number(minSqFt) : undefined}
          maxSqFt={maxSqFt ? Number(maxSqFt) : undefined}
          postalCode={postalCode ?? undefined}
          propertyType={propertyType ?? undefined}
          filterBar={
            <SearchFilterBar
              basePath="/listings"
              locationLabel="Bend OR"
              locationHref={bendMapHref}
              signedIn={!!session?.user}
              minPrice={minPrice}
              maxPrice={maxPrice}
              beds={beds}
              baths={baths}
              minSqFt={minSqFt}
              maxSqFt={maxSqFt}
              maxBeds={maxBeds}
              maxBaths={maxBaths}
              yearBuiltMin={yearBuiltMin}
              yearBuiltMax={yearBuiltMax}
              lotAcresMin={lotAcresMin}
              lotAcresMax={lotAcresMax}
              postalCode={postalCode}
              propertyType={propertyType}
              statusFilter={p.statusFilter}
              keywords={keywords}
              hasOpenHouse={hasOpenHouse}
              garageMin={garageMin}
              hasPool={hasPool}
              hasView={hasView}
              hasWaterfront={hasWaterfront}
              newListingsDays={newListingsDays}
              includeClosed={includeClosed}
              sort={p.sort}
              view="map"
              perPage={p.perPage ?? String(perPage)}
            />
          }
        />
      </main>
    )
  }

  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    { label: 'All listings' },
  ]

  return (
    <main className="min-h-screen bg-background">
      <ContentPageHero
        title="Homes for Sale in Central Oregon"
        subtitle="Browse and filter by price, beds, baths, and more. Or explore every listing on the map."
        imageUrl={CONTENT_HERO_IMAGES.listings}
        ctas={[
          { label: 'Search Listings', href: '#filters', primary: true },
          { label: 'View Map', href: '/listings?view=map', primary: false },
        ]}
      />
      <BreadcrumbStrip items={breadcrumbItems} />
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-primary sm:text-4xl mb-6">
        Homes for Sale in Central Oregon
      </h1>
      <header id="filters" className="mb-4">
        <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Advanced search
        </h2>
        <p className="mt-1 text-muted-foreground">
          {totalCount.toLocaleString()} home{totalCount !== 1 ? 's' : ''} match your criteria. View on{' '}
          <Link href="/listings?view=map" className="font-medium text-foreground underline hover:no-underline">
            map
          </Link>
          .
        </p>
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-4 py-3">
        <Suspense fallback={<div className="h-10 w-48 rounded-lg bg-muted" />}>
          <SearchFilterBar
            basePath="/listings"
            signedIn={!!session?.user}
            minPrice={minPrice}
            maxPrice={maxPrice}
            beds={beds}
            baths={baths}
            minSqFt={minSqFt}
            maxSqFt={maxSqFt}
            maxBeds={maxBeds}
            maxBaths={maxBaths}
            yearBuiltMin={yearBuiltMin}
            yearBuiltMax={yearBuiltMax}
            lotAcresMin={lotAcresMin}
            lotAcresMax={lotAcresMax}
            postalCode={postalCode}
            propertyType={propertyType}
            statusFilter={statusFilter}
            keywords={keywords}
            hasOpenHouse={hasOpenHouse}
            garageMin={garageMin}
            hasPool={hasPool}
            hasView={hasView}
            hasWaterfront={hasWaterfront}
            newListingsDays={newListingsDays}
            includeClosed={includeClosed}
            sort={sort}
            view={view}
            perPage={p.perPage ?? String(perPage)}
          />
        </Suspense>
      </div>

      {listings.length === 0 && totalCount === 0 ? (
        <p className="text-muted-foreground">No listings yet. Sync from Spark to populate.</p>
      ) : (
        <>
          {listings.length === 0 ? (
            <p className="text-muted-foreground">No listings on this page. Try another page.</p>
          ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                  hasRecentPriceChange={priceChangeKeys.has(key)}
                  saved={session?.user ? savedKeys.includes(key) : undefined}
                  liked={session?.user ? likedKeys.includes(key) : undefined}
                  monthlyPayment={monthly != null && monthly > 0 ? formatMonthlyPayment(monthly) : undefined}
                  signedIn={!!session?.user}
                  userEmail={session?.user?.email ?? null}
                />
              )
            })}
          </div>
          )}
          {totalCount > 0 && (
          <>
          <ListingsPagination
            pathname="/listings"
            searchParams={{
              view: p.view,
              minPrice: p.minPrice,
              maxPrice: p.maxPrice,
              beds: p.beds,
              baths: p.baths,
              minSqFt: p.minSqFt,
              maxSqFt: p.maxSqFt,
              maxBeds: p.maxBeds,
              maxBaths: p.maxBaths,
              yearBuiltMin: p.yearBuiltMin,
              yearBuiltMax: p.yearBuiltMax,
              lotAcresMin: p.lotAcresMin,
              lotAcresMax: p.lotAcresMax,
              postalCode: p.postalCode,
              propertyType: p.propertyType,
              propertySubType: p.propertySubType,
              statusFilter: p.statusFilter,
              keywords: p.keywords,
              hasOpenHouse: p.hasOpenHouse,
              garageMin: p.garageMin,
              hasPool: p.hasPool,
              hasView: p.hasView,
              hasWaterfront: p.hasWaterfront,
              newListingsDays: p.newListingsDays,
              sort: p.sort,
              includeClosed: p.includeClosed,
              page: p.page,
              perPage: p.perPage,
            }}
            page={page}
            perPage={perPage}
            totalCount={totalCount}
          />
          <ListingsPageFooter cities={cities} signedIn={!!session?.user} basePath="/listings" />
          </>
          )}
        </>
      )}
      </div>
    </main>
  )
}
