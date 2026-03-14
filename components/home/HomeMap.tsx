'use client'

import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import type { MapListingRow } from '@/app/actions/listings'
import type { ListingMapListing } from '@/components/ListingMapGoogle'

const ListingMapGoogle = dynamic(
  () => import('@/components/ListingMapGoogle').then((m) => m.default),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex w-full items-center justify-center bg-muted text-muted-foreground"
        style={{ minHeight: '560px' }}
      >
        Loading map…
      </div>
    ),
  }
)

const MAP_MIN_HEIGHT = 560
const SIDEBAR_WIDTH = 300
const MAX_LISTINGS_IN_VIEW = 50
const THUMB_SIZE = 72

function formatListPrice(price: number | null | undefined): string {
  if (price == null || !Number.isFinite(price) || price <= 0) return '—'
  return `$${Number(price).toLocaleString()}`
}

function formatAddress(l: ListingMapListing): string {
  const parts = [l.StreetNumber, l.StreetName].filter(Boolean)
  if (parts.length === 0) return [l.City, l.State].filter(Boolean).join(', ') || '—'
  const rest = [l.City, l.State, l.PostalCode].filter(Boolean).join(' ')
  return rest ? `${parts.join(' ')}, ${rest}` : parts.join(' ')
}

type Props = {
  listings: MapListingRow[]
}

/**
 * Home page map: left sidebar with thumbnails + list, map focused on selected city (Bend by default).
 */
export default function HomeMap({ listings }: Props) {
  const [listingsInView, setListingsInView] = useState<ListingMapListing[]>(listings)

  const onBoundsChanged = useCallback((inView: ListingMapListing[]) => {
    setListingsInView(inView.slice(0, MAX_LISTINGS_IN_VIEW))
  }, [])

  const validListings = listings.filter(
    (l) =>
      l.Latitude != null &&
      l.Longitude != null &&
      Number.isFinite(Number(l.Latitude)) &&
      Number.isFinite(Number(l.Longitude))
  )

  return (
    <div className="flex w-full overflow-hidden border-0 border-b border-border bg-card">
      <aside
        className="flex flex-col border-r border-border bg-muted"
        style={{ width: SIDEBAR_WIDTH, minHeight: MAP_MIN_HEIGHT }}
        aria-label="Listings in map area"
      >
        <div className="border-b border-border bg-card px-3 py-2">
          <h3 className="text-sm font-semibold text-foreground">
            Homes in view
          </h3>
          <p className="text-xs text-muted-foreground">
            {listingsInView.length === 0 && validListings.length === 0
              ? 'No listings with location'
              : `${listingsInView.length}${listingsInView.length >= MAX_LISTINGS_IN_VIEW ? '+' : ''} in this area`}
          </p>
        </div>
        <ul className="flex-1 overflow-y-auto p-2" style={{ maxHeight: MAP_MIN_HEIGHT - 56 }}>
          {listingsInView.length === 0 && validListings.length > 0 ? (
            <li className="px-2 py-2 text-sm text-muted-foreground">
              Move the map to see listings.
            </li>
          ) : (
            listingsInView.map((l, i) => {
              const id = (l.ListingKey ?? l.ListNumber ?? `item-${i}`).toString()
              const price = Number(l.ListPrice ?? 0)
              const photoUrl = (l as { PhotoURL?: string | null }).PhotoURL
              return (
                <li key={id}>
                  <Link
                    href={`/listing/${id}`}
                    className="mb-2 flex gap-3 border border-border bg-card p-2 text-left shadow-sm transition hover:border-accent hover:shadow"
                  >
                    {photoUrl?.trim() ? (
                      <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden bg-muted">
                        <Image
                          src={photoUrl}
                          alt={`Property at ${formatAddress(l)}`}
                          fill
                          sizes={`${THUMB_SIZE}px`}
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div
                        className="h-[72px] w-[72px] shrink-0 bg-muted"
                        aria-hidden
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <span className="block font-semibold text-foreground">
                        {formatListPrice(price)}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground line-clamp-2">
                        {formatAddress(l)}
                      </span>
                      {(l.BedroomsTotal != null || l.BathroomsTotal != null) && (
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {[l.BedroomsTotal != null ? `${l.BedroomsTotal} bed` : null, l.BathroomsTotal != null ? `${l.BathroomsTotal} bath` : null].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              )
            })
          )}
        </ul>
      </aside>
      <div
        className="flex-1 min-w-0"
        style={{ minHeight: MAP_MIN_HEIGHT }}
      >
        <ListingMapGoogle
          listings={listings}
          centerOnBend={validListings.length === 0}
          fitBounds={validListings.length > 0}
          onBoundsChanged={onBoundsChanged}
          className="h-full w-full min-h-0"
        />
      </div>
    </div>
  )
}
