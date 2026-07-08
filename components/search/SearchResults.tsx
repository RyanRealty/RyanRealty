'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { ListingTileRow } from '@/app/actions/listings'
import { getSearchListings } from '@/app/actions/search'
import { listingDetailPath } from '@/lib/slug'
import ListingCard from '@/components/site/ListingCard'
import type { SearchFiltersInitial } from '@/components/search/SearchFilters'

type Props = {
  initialListings: ListingTileRow[]
  totalCount: number
  initialPage: number
  filters: SearchFiltersInitial
  view: 'split' | 'list' | 'map'
  /** When true and totalCount is 0, show a helpful empty state with clear-filters CTA. */
  hasActiveFilters?: boolean
}

export default function SearchResults({
  initialListings,
  totalCount,
  initialPage,
  filters,
  hasActiveFilters = false,
}: Props) {
  const [listings, setListings] = useState(initialListings)
  const [page, setPage] = useState(initialPage)
  const [total, setTotal] = useState(totalCount)
  const [loading, setLoading] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const filtersSnapshot = JSON.stringify(filters)

  useEffect(() => {
    setListings(initialListings)
    setPage(initialPage)
    setTotal(totalCount)
  }, [initialListings, initialPage, totalCount, filtersSnapshot])

  const loadMore = useCallback(async () => {
    if (loading || listings.length >= total) return
    setLoading(true)
    try {
      const nextPage = page + 1
      const filtersForApi = {
        city: filters.city || undefined,
        subdivision: filters.subdivision || undefined,
        minPrice: filters.minPrice ? Number(filters.minPrice) : undefined,
        maxPrice: filters.maxPrice ? Number(filters.maxPrice) : undefined,
        beds: filters.beds ? Number(filters.beds) : undefined,
        baths: filters.baths ? Number(filters.baths) : undefined,
        status: filters.status || 'Active',
        sort: filters.sort || 'newest',
        minSqFt: filters.minSqFt ? Number(filters.minSqFt) : undefined,
        maxSqFt: filters.maxSqFt ? Number(filters.maxSqFt) : undefined,
        lotAcresMin: filters.lotAcresMin != null ? Number(filters.lotAcresMin) : undefined,
        lotAcresMax: filters.lotAcresMax != null ? Number(filters.lotAcresMax) : undefined,
        yearBuiltMin: filters.yearBuiltMin ? Number(filters.yearBuiltMin) : undefined,
        yearBuiltMax: filters.yearBuiltMax ? Number(filters.yearBuiltMax) : undefined,
        propertyType: filters.propertyType || undefined,
        hasPool: filters.hasPool === '1',
        hasView: filters.hasView === '1',
        hasWaterfront: filters.hasWaterfront === '1',
        garageMin: filters.garageMin != null ? Number(filters.garageMin) : undefined,
        daysOnMarket: filters.daysOnMarket || undefined,
        keywords: filters.keywords || undefined,
      }
      const { listings: nextListings, totalCount: nextTotal } = await getSearchListings(filtersForApi, nextPage)
      setListings((prev) => [...prev, ...nextListings])
      setTotal(nextTotal)
      setPage(nextPage)
    } finally {
      setLoading(false)
    }
  }, [loading, listings.length, total, page, filters])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore()
      },
      { rootMargin: '200px', threshold: 0 }
    )
    io.observe(sentinel)
    return () => io.disconnect()
  }, [loadMore])

  const listingKey = (row: ListingTileRow) => row.ListNumber ?? row.ListingKey ?? ''
  const showEmptyState = total === 0 && hasActiveFilters

  return (
    <div className="w-full p-4 space-y-4">
      {showEmptyState ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-lg font-medium text-foreground">
            No homes match your current filters.
          </p>
          <p className="mt-2 text-muted-foreground">
            Try lowering the minimum price, changing beds/baths, or clear filters to see all Central Oregon listings.
          </p>
          <Link
            href="/homes-for-sale"
            className="mt-6 inline-block bg-accent px-6 py-3 font-semibold text-primary hover:bg-accent/90"
          >
            View all listings
          </Link>
        </div>
      ) : (
        <>
          <p className="text-muted-foreground">
            {total.toLocaleString()} home{total !== 1 ? 's' : ''} found
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {listings.map((listing) => {
          const key = String(listingKey(listing)).trim()
          const href = listingDetailPath(key, {
            streetNumber: listing.StreetNumber,
            streetName: listing.StreetName,
            city: listing.City,
            state: listing.State,
            postalCode: listing.PostalCode,
          }, undefined, { mlsNumber: listing.ListNumber ?? null })
          const cityParts = [listing.City, listing.State].filter(Boolean).join(', ')
          const cityZip = [cityParts, listing.PostalCode].filter(Boolean).join(' ').trim()
          const cityLine = listing.SubdivisionName ? `${cityZip} · ${listing.SubdivisionName}` : cityZip
          const addressLine =
            [listing.StreetNumber, listing.StreetName, listing.StreetSuffix].filter(Boolean).join(' ').trim() || cityParts || 'Listing'
          // Wrapper carries data-listing-key for the map<->list hover sync
          // (consumed by SearchSplitView / MapSearchView). ListingCard is the
          // canonical site card — one look across the whole site.
          return (
            <div key={key} data-listing-key={key}>
              <ListingCard
                listing={{
                  listingKey: key,
                  href,
                  photoUrl: listing.PhotoURL,
                  price: listing.ListPrice,
                  addressLine,
                  cityLine,
                  beds: listing.BedroomsTotal,
                  baths: listing.BathroomsTotal,
                  sqft: listing.TotalLivingAreaSqFt ?? null,
                }}
              />
            </div>
          )
        })}
      </div>
      {listings.length < total && (
        <div ref={sentinelRef} className="flex justify-center py-8">
          {loading && <span className="text-muted-foreground">Loading more…</span>}
        </div>
      )}
        </>
      )}
    </div>
  )
}
