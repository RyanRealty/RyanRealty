'use client'

import React, { useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import ListingTile from '@/components/ListingTile'
import SearchMapClustered from '@/components/SearchMapClustered'
import SearchFilterBar from '@/components/SearchFilterBar'
import ListingsPagination from '@/components/ListingsPagination'
import ListingsPageFooter from '@/app/listings/ListingsPageFooter'
import type { ListingTileListing } from '@/components/ListingTile'
import { estimatedMonthlyPayment, formatMonthlyPayment, DEFAULT_DISPLAY_DOWN_PCT, DEFAULT_DISPLAY_RATE, DEFAULT_DISPLAY_TERM_YEARS } from '@/lib/mortgage'
import type { ListingForMap } from '@/components/SearchMapClustered'
import type { CityForIndex } from '@/lib/cities'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
] as const

type Props = {
  listings: ListingTileListing[]
  mapListings: ListingForMap[]
  totalCount: number
  savedKeys: string[]
  likedKeys: string[]
  priceChangeKeys: Set<string>
  signedIn: boolean
  userEmail: string | null
  prefs: { downPaymentPercent?: number; interestRate?: number; loanTermYears?: number } | null
  searchParams: Record<string, string | undefined>
  cities: CityForIndex[]
  /** Base path for filter/pagination links (e.g. /listings or /homes-for-sale/bend). Default: /listings */
  basePath?: string
  /** Title shown above the list (e.g. "Central Oregon Real Estate & Homes For Sale"). Default: Central Oregon. */
  pageTitle?: string
  /** Optional place query for map (e.g. "Bend Oregon") so map fits to Google Places boundary when available. */
  placeQuery?: string | null
}

function buildQuery(params: Record<string, string | undefined>, overrides: Record<string, string>) {
  const p = { ...params, ...overrides }
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(p)) {
    if (v !== undefined && v !== '') q.set(k, v)
  }
  const s = q.toString()
  return s ? `?${s}` : ''
}

const DEFAULT_BASE_PATH = '/listings'
const DEFAULT_PAGE_TITLE = 'Central Oregon Real Estate & Homes For Sale'

export default function ListingsMapSplitView({
  listings,
  mapListings,
  totalCount,
  savedKeys,
  likedKeys,
  priceChangeKeys,
  signedIn,
  userEmail,
  prefs,
  searchParams,
  cities,
  basePath = DEFAULT_BASE_PATH,
  pageTitle = DEFAULT_PAGE_TITLE,
  placeQuery,
}: Props) {
  const page = Math.max(1, parseInt(String(searchParams.page ?? '1'), 10) || 1)
  const perPage = Math.min(50, Math.max(10, parseInt(String(searchParams.perPage ?? '20'), 10) || 20))
  const router = useRouter()
  const listRef = useRef<HTMLDivElement>(null)
  const openMarkerKeyRef = useRef<string | null>(null)

  const onMarkerClick = useCallback((listingKey: string) => {
    openMarkerKeyRef.current = listingKey
    const el = listRef.current?.querySelector(`[data-listing-key="${listingKey}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [])

  const displayPrefs = {
    downPaymentPercent: prefs?.downPaymentPercent ?? DEFAULT_DISPLAY_DOWN_PCT,
    interestRate: prefs?.interestRate ?? DEFAULT_DISPLAY_RATE,
    loanTermYears: prefs?.loanTermYears ?? DEFAULT_DISPLAY_TERM_YEARS,
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] min-h-[400px] flex-col overflow-hidden">
      {/* Top: filter bar (dropdowns with Apply — baseline from reference) */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-3">
        <SearchFilterBar
          basePath={basePath}
          signedIn={signedIn}
          minPrice={searchParams.minPrice}
          maxPrice={searchParams.maxPrice}
          beds={searchParams.beds}
          baths={searchParams.baths}
          minSqFt={searchParams.minSqFt}
          maxSqFt={searchParams.maxSqFt}
          maxBeds={searchParams.maxBeds}
          maxBaths={searchParams.maxBaths}
          yearBuiltMin={searchParams.yearBuiltMin}
          yearBuiltMax={searchParams.yearBuiltMax}
          lotAcresMin={searchParams.lotAcresMin}
          lotAcresMax={searchParams.lotAcresMax}
          postalCode={searchParams.postalCode}
          propertyType={searchParams.propertyType}
          statusFilter={searchParams.statusFilter}
          keywords={searchParams.keywords}
          hasOpenHouse={searchParams.hasOpenHouse}
          garageMin={searchParams.garageMin}
          hasPool={searchParams.hasPool}
          hasView={searchParams.hasView}
          hasWaterfront={searchParams.hasWaterfront}
          newListingsDays={searchParams.newListingsDays}
          includeClosed={searchParams.includeClosed}
          sort={searchParams.sort}
          view="map"
          perPage={searchParams.perPage}
        />
      </div>

      {/* Split: list left (scrollable), map right (fills rest) */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left: fixed-width scrollable list — only this column scrolls */}
        <div className="flex w-full flex-col min-h-0 shrink-0 border-r border-border bg-card md:w-[420px] lg:w-[480px]">
          <div className="shrink-0 border-b border-border bg-card px-4 py-3">
            <h2 className="text-lg font-semibold text-primary">
              {pageTitle}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {totalCount.toLocaleString()} result{totalCount !== 1 ? 's' : ''}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Sort:</span>
              <Select
                value={searchParams.sort ?? 'newest'}
                onValueChange={(value) => {
                  router.push(`${basePath}${buildQuery(searchParams, { sort: value, page: '1' })}`)
                }}
              >
                <SelectTrigger className="w-32 rounded-lg px-2 py-1.5 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto p-4">
            {listings.length === 0 && totalCount === 0 ? (
              <p className="text-muted-foreground">No listings match your criteria.</p>
            ) : (
              <>
                {listings.length === 0 ? (
                  <p className="text-muted-foreground">No listings on this page. Try another page.</p>
                ) : (
                  <ul className="space-y-4">
                    {listings.map((listing, i) => {
                      const key = (listing.ListNumber ?? listing.ListingKey ?? `listing-${i}`).toString().trim()
                      const price = Number(listing.ListPrice ?? 0)
                      const monthly = price > 0 ? estimatedMonthlyPayment(price, displayPrefs.downPaymentPercent, displayPrefs.interestRate, displayPrefs.loanTermYears) : null
                      return (
                        <li key={key} data-listing-key={key}>
                          <ListingTile
                            listing={listing}
                            listingKey={key}
                            hasRecentPriceChange={priceChangeKeys.has(key)}
                            saved={signedIn ? savedKeys.includes(key) : undefined}
                            liked={signedIn ? likedKeys.includes(key) : undefined}
                            monthlyPayment={monthly != null && monthly > 0 ? formatMonthlyPayment(monthly) : undefined}
                            signedIn={signedIn}
                            userEmail={userEmail}
                          />
                        </li>
                      )
                    })}
                  </ul>
                )}
                {totalCount > 0 && (
                  <>
                    <ListingsPagination
                      pathname={basePath}
                      searchParams={searchParams}
                      page={page}
                      perPage={perPage}
                      totalCount={totalCount}
                    />
                    <ListingsPageFooter cities={cities} signedIn={signedIn} basePath={basePath} />
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right: map (desktop) */}
        <div className="hidden flex-1 min-h-0 md:block">
          <SearchMapClustered
            listings={mapListings}
            savedListingKeys={savedKeys}
            likedListingKeys={likedKeys}
            onMarkerClick={onMarkerClick}
            placeQuery={placeQuery}
            className="h-full"
          />
        </div>
      </div>

      {/* Mobile: map below list (fixed height so user can scroll to it) */}
      <div className="h-[320px] shrink-0 border-t border-border md:hidden">
        <SearchMapClustered
          listings={mapListings}
          savedListingKeys={savedKeys}
          likedListingKeys={likedKeys}
          onMarkerClick={onMarkerClick}
          placeQuery={placeQuery}
          className="h-full"
        />
      </div>
    </div>
  )
}
