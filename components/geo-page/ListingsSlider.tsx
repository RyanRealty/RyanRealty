'use client'

import type { ListingTileRow } from '@/app/actions/listings'
import GeoSlider from '@/components/geo-page/GeoSlider'
import ListingBarCard from '@/components/geo-page/ListingBarCard'

type Props = {
  title: string
  listings: (ListingTileRow & { details?: unknown })[]
  savedKeys?: string[]
  likedKeys?: string[]
  signedIn: boolean
  userEmail?: string | null
  /** e.g. community or neighborhood name for context (subtitle). */
  placeName?: string
}

/** Compact bar of listing cards under hero (e.g. homes in this community/neighborhood). Matches listing detail strip; hover arrows, infinite wrap. */
export default function ListingsSlider({
  title,
  listings,
  placeName,
  savedKeys = [],
  likedKeys = [],
  signedIn = false,
  userEmail,
}: Props) {
  if (listings.length === 0) return null

  return (
    <GeoSlider
      title={title}
      subtitle={placeName ? `Homes for sale in ${placeName}` : undefined}
      titleId="listings-slider-heading"
      className="bg-muted border-b border-border px-4 py-3 sm:px-6 sm:py-4 lg:px-8"
      hoverArrows
    >
      {listings.map((listing) => {
        const key = (listing.ListingKey ?? listing.ListNumber ?? '').toString()
        if (!key) return null
        return (
          <ListingBarCard
            key={key}
            listing={listing}
            listingKey={key}
            signedIn={signedIn}
            saved={savedKeys.includes(key)}
            liked={likedKeys.includes(key)}
            userEmail={userEmail}
          />
        )
      })}
    </GeoSlider>
  )
}
