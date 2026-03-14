'use client'

import Link from 'next/link'
import ListingTile from './ListingTile'
import { cityPagePath } from '@/lib/slug'
import type { ListingTileRow } from '@/app/actions/listings'
import { TILE_MIN_HEIGHT_PX } from '@/lib/tile-constants'
import TilesSlider, { TilesSliderItem } from '@/components/TilesSlider'

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

  if (listings.length === 0) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6" aria-labelledby="home-listings-heading">
        <h2 id="home-listings-heading" className="text-2xl font-bold tracking-tight text-primary">
          Homes in {city}
        </h2>
        <p className="mt-6 text-muted-foreground">
          No listings with location data on the map yet.{' '}
          <Link href={cityPagePath(city)} className="font-medium text-accent-foreground hover:underline">
            View all {totalInCity} in {city}
          </Link>
        </p>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6" aria-labelledby="home-listings-heading">
      <TilesSlider
        title={`Homes in ${city}`}
        titleId="home-listings-heading"
        subtitle={
          hasMore
            ? `Showing ${onMapCount} on map · ${totalInCity} total in ${city}`
            : `${onMapCount} ${onMapCount === 1 ? 'home' : 'homes'} in ${city}`
        }
        headerRight={
          hasMore ? (
            <Link
              href={cityPagePath(city)}
              className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground shadow-sm transition hover:bg-muted hover:text-foreground"
            >
              View all {totalInCity} in {city} →
            </Link>
          ) : undefined
        }
      >
        {listings.map((listing, i) => {
          const key = (listing.ListNumber ?? listing.ListingKey ?? `listing-${i}`).toString().trim()
          return (
            <TilesSliderItem key={key} style={{ minHeight: TILE_MIN_HEIGHT_PX }}>
              <ListingTile
                listing={listing}
                listingKey={key}
                priority={i < 4}
                hasRecentPriceChange={key ? priceChangeKeys.has(key) : false}
                saved={signedIn ? savedKeys.includes(key) : undefined}
                monthlyPayment={monthlyPayments[i]}
                signedIn={signedIn}
                userEmail={userEmail}
              />
            </TilesSliderItem>
          )
        })}
      </TilesSlider>
    </section>
  )
}
