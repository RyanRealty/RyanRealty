import type { Metadata } from 'next'
import { Suspense } from 'react'
import { getListingsWithAdvanced, getListingKeysWithRecentPriceChange } from '../actions/listings'
import { getSession } from '../actions/auth'
import { getSavedListingKeys } from '../actions/saved-listings'
import { getLikedListingKeys } from '../actions/likes'
import { getBuyingPreferences } from '../actions/buying-preferences'
import { estimatedMonthlyPayment, formatMonthlyPayment, DEFAULT_DISPLAY_RATE, DEFAULT_DISPLAY_DOWN_PCT, DEFAULT_DISPLAY_TERM_YEARS } from '../../lib/mortgage'
import SaveSearchButton from '../../components/SaveSearchButton'
import { getGeocodedListings } from '../actions/geocode'
import ListingTile from '../../components/ListingTile'
import ListingMapGoogle from '../../components/ListingMapGoogle'
import AdvancedSearchFilters from '../../components/AdvancedSearchFilters'
import Breadcrumb from '../../components/Breadcrumb'
import MapListingsPage from './MapListingsPage'

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
  perPage?: string
}

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryanrealty.com').replace(/\/$/, '')

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
    perPage,
  } = p
  const isMapView = view === 'map'

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !anonKey?.trim()) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <p className="text-zinc-600">Database not configured.</p>
      </main>
    )
  }

  const filterOpts = {
    limit: 200,
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

  const [{ listings, totalCount }, priceChangeKeys, session] = await Promise.all([
    getListingsWithAdvanced(filterOpts),
    getListingKeysWithRecentPriceChange(),
    getSession(),
  ])
  const [savedKeys, likedKeys, prefs] =
    session?.user
      ? await Promise.all([
          import('../actions/saved-listings').then((m) => m.getSavedListingKeys()),
          import('../actions/likes').then((m) => m.getLikedListingKeys()),
          import('../actions/buying-preferences').then((m) => m.getBuyingPreferences()),
        ])
      : [[], [] as string[], null] as [string[], string[], Awaited<ReturnType<typeof import('../actions/buying-preferences').getBuyingPreferences>>]
  const listingsWithCoords = await getGeocodedListings(listings)

  if (isMapView) {
    return (
      <main className="min-h-[calc(100vh-120px)]">
        <MapListingsPage listings={listingsWithCoords} />
      </main>
    )
  }

  const breadcrumbItems = [
    { label: 'Ryan Realty', href: siteUrl },
    { label: 'All listings' },
  ]

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <Breadcrumb items={breadcrumbItems} />
      <header className="mb-6 mt-4">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
          Advanced search
        </h1>
        <p className="mt-1 text-zinc-600">
          {totalCount.toLocaleString()} home{totalCount !== 1 ? 's' : ''} match your criteria. View on{' '}
          <a href="/listings?view=map" className="font-medium text-zinc-900 underline hover:no-underline">
            map
          </a>
          .
        </p>
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Suspense fallback={<div className="h-14 rounded-xl border border-zinc-200 bg-zinc-50" />}>
          <AdvancedSearchFilters
            basePath="/listings"
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
            propertySubType={propertySubType}
            statusFilter={statusFilter}
            keywords={keywords}
            hasOpenHouse={hasOpenHouse}
            garageMin={garageMin}
            hasPool={hasPool}
            hasView={hasView}
            hasWaterfront={hasWaterfront}
            newListingsDays={newListingsDays}
            sort={sort}
            includeClosed={includeClosed}
            view={view}
            perPage={perPage}
          />
        </Suspense>
        <SaveSearchButton user={!!session?.user} />
      </div>

      {listings.length === 0 ? (
        <p className="text-zinc-500">No listings yet. Sync from Spark to populate.</p>
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
    </main>
  )
}
