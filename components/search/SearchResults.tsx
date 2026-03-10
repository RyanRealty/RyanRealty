'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { ListingTileRow } from '@/app/actions/listings'
import { getSearchListings } from '@/app/actions/search'
import type { SearchFiltersInitial } from '@/components/search/SearchFilters'

const PAGE_SIZE = 24

function formatPrice(n: number | null | undefined): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function formatAddress(listing: ListingTileRow): string {
  const parts = [
    [listing.StreetNumber, listing.StreetName].filter(Boolean).join(' ').trim(),
    listing.City,
    listing.State,
    listing.PostalCode,
  ].filter(Boolean) as string[]
  return parts.join(', ')
}

type Props = {
  initialListings: ListingTileRow[]
  totalCount: number
  initialPage: number
  filters: SearchFiltersInitial
  view: 'split' | 'list' | 'map'
}

export default function SearchResults({
  initialListings,
  totalCount,
  initialPage,
  filters,
  view,
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

  const listingKey = (row: ListingTileRow) => row.ListingKey ?? row.ListNumber ?? ''

  return (
    <div className="p-4 space-y-4">
      <p className="text-[var(--gray-secondary)]">
        {total.toLocaleString()} home{total !== 1 ? 's' : ''} found
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {listings.map((listing) => {
          const key = listingKey(listing)
          const href = `/listings/${encodeURIComponent(key)}`
          const photoUrl = listing.PhotoURL ?? ''
          return (
            <Link key={key} href={href} className="group">
              <article className="bg-white rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.1)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.15)] transition-shadow">
                <div className="relative aspect-[4/3] bg-[var(--gray-border)]">
                  {photoUrl ? (
                    <Image
                      src={photoUrl}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="(max-width:640px) 100vw, (max-width:1280px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-[var(--gray-muted)] text-sm">
                      No photo
                    </div>
                  )}
                  <div className="absolute top-2 left-2 rounded bg-[var(--brand-navy)] text-white text-sm font-semibold px-2 py-0.5">
                    {formatPrice(listing.ListPrice)}
                  </div>
                </div>
                <div className="p-3">
                  <p className="font-medium text-[var(--brand-navy)] truncate">
                    {formatAddress(listing)}
                  </p>
                  <p className="text-sm text-[var(--gray-secondary)] mt-0.5">
                    {listing.BedroomsTotal ?? '—'} Beds · {listing.BathroomsTotal ?? '—'} Baths
                    {listing.SubdivisionName && ` · ${listing.SubdivisionName}`}
                  </p>
                </div>
              </article>
            </Link>
          )
        })}
      </div>
      {listings.length < total && (
        <div ref={sentinelRef} className="flex justify-center py-8">
          {loading && <span className="text-[var(--gray-muted)]">Loading more…</span>}
        </div>
      )}
    </div>
  )
}
