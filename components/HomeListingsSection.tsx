'use client'

import Link from 'next/link'
import ListingTile from './ListingTile'
import { cityEntityKey } from '@/lib/slug'
import type { ListingTileRow } from '@/app/actions/listings'

type Props = {
  city: string
  listings: ListingTileRow[]
  totalInCity: number
  savedKeys: string[]
  priceChangeKeys: Set<string>
  monthlyPayments: (string | undefined)[]
  signedIn: boolean
  userEmail?: string | null
}

export default function HomeListingsSection({
  city,
  listings,
  totalInCity,
  savedKeys,
  priceChangeKeys,
  monthlyPayments,
  signedIn,
  userEmail,
}: Props) {
  const onMapCount = listings.length
  const hasMore = totalInCity > onMapCount

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6" aria-labelledby="home-listings-heading">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="home-listings-heading" className="text-2xl font-bold tracking-tight text-zinc-900">
            Homes in {city}
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            {hasMore ? (
              <>
                Showing <strong>{onMapCount}</strong> on map · <strong>{totalInCity}</strong> total in {city}
              </>
            ) : (
              <>
                <strong>{onMapCount}</strong> {onMapCount === 1 ? 'home' : 'homes'} in {city}
              </>
            )}
          </p>
        </div>
        {hasMore && (
          <Link
            href={`/search/${cityEntityKey(city)}`}
            className="shrink-0 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50"
          >
            View all {totalInCity} in {city} →
          </Link>
        )}
      </div>

      {listings.length === 0 ? (
        <p className="mt-6 text-zinc-500">
          No listings with location data on the map yet.{' '}
          <Link href={`/search/${cityEntityKey(city)}`} className="font-medium text-zinc-700 hover:underline">
            View all {totalInCity} in {city}
          </Link>
        </p>
      ) : (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {listings.map((listing, i) => {
            const key = (listing.ListNumber ?? listing.ListingKey ?? `listing-${i}`).toString().trim()
            return (
              <ListingTile
                key={key}
                listing={listing}
                listingKey={key}
                priority={i < 4}
                hasRecentPriceChange={key ? priceChangeKeys.has(key) : false}
                saved={signedIn ? savedKeys.includes(key) : undefined}
                monthlyPayment={monthlyPayments[i]}
                signedIn={signedIn}
                userEmail={userEmail}
              />
            )
          })}
        </div>
      )}
    </section>
  )
}
