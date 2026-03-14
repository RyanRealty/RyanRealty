'use client'

import Link from 'next/link'
import ListingTile from './ListingTile'
import { cityPagePath } from '@/lib/slug'
import type { ListingTileRow } from '@/app/actions/listings'

type Props = {
  city: string
  listings: ListingTileRow[]
  savedKeys: string[]
  priceChangeKeys: Set<string>
  monthlyPayments: (string | undefined)[]
  signedIn: boolean
}

export default function HomeListingsSlider({
  city,
  listings,
  savedKeys,
  priceChangeKeys,
  monthlyPayments,
  signedIn,
}: Props) {
  if (listings.length === 0) return null

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="flex items-end justify-between gap-4">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Recent & pending in {city}
        </h2>
        <Link
          href={cityPagePath(city)}
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          View all in {city} →
        </Link>
      </div>
      <div className="mt-6 overflow-x-auto pb-4 -mx-4 px-4 sm:-mx-6 sm:px-6">
        <div className="flex gap-6 min-w-max snap-x snap-mandatory" style={{ scrollSnapType: 'x mandatory' }}>
          {listings.map((listing, i) => {
            const key = (listing.ListNumber ?? listing.ListingKey ?? `listing-${i}`).toString().trim()
            return (
              <div
                key={key}
                className="shrink-0 snap-start w-[85vw] min-w-[260px] max-w-[320px] sm:w-[50vw] sm:min-w-[280px] sm:max-w-[360px] lg:w-[33.333vw] lg:min-w-[300px] lg:max-w-[420px]"
                style={{ scrollSnapAlign: 'start' }}
              >
                <ListingTile
                  listing={listing}
                  listingKey={key}
                  priority={i < 3}
                  hasRecentPriceChange={key ? priceChangeKeys.has(key) : false}
                  saved={signedIn ? savedKeys.includes(key) : undefined}
                  monthlyPayment={monthlyPayments[i]}
                  signedIn={signedIn}
                />
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
