'use client'

import Link from 'next/link'
import { getSubdivisionDisplayName } from '@/lib/slug'
import { homesForSalePath } from '@/lib/slug'
import ListingTile from '@/components/ListingTile'
import type { SimilarListingRow } from '@/app/actions/listings'
import type { ListingTileListing } from '@/components/ListingTile'

type Props = {
  city: string
  subdivisionName: string
  /** 2–3 sentence community description from subdivision_descriptions */
  description?: string | null
  /** Optional amenities text or list (from attractions/about) */
  amenitiesLabel?: string | null
  /** Community/subdivision banner image URL */
  bannerUrl?: string | null
  /** Other listings in this community (shown as tile grid) */
  listings?: SimilarListingRow[]
  signedIn?: boolean
  userEmail?: string | null
  savedKeys?: string[]
  likedKeys?: string[]
}

export default function ListingCommunitySection({
  city,
  subdivisionName,
  description,
  amenitiesLabel,
  bannerUrl,
  listings = [],
  signedIn = false,
  userEmail,
  savedKeys = [],
  likedKeys = [],
}: Props) {
  const searchHref = homesForSalePath(city, subdivisionName)
  return (
    <section className="rounded-lg border border-border bg-card overflow-hidden shadow-sm" aria-labelledby="listing-community-heading">
      <h2 id="listing-community-heading" className="sr-only">
        {getSubdivisionDisplayName(subdivisionName)}
      </h2>
      {bannerUrl && (
        <div className="relative h-32 sm:h-40 w-full">
          <img
            src={bannerUrl}
            alt={`${getSubdivisionDisplayName(subdivisionName)} community in ${city}`}
            className="h-full w-full object-cover"
            width={800}
            height={320}
            decoding="async"
          />
        </div>
      )}
      <div className="p-6">
        <p className="text-xl font-semibold text-foreground">
          Explore homes in {getSubdivisionDisplayName(subdivisionName)}
        </p>
        {description && (
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">{description}</p>
        )}
        {amenitiesLabel && (
          <p className="mt-2 text-sm text-muted-foreground">{amenitiesLabel}</p>
        )}

        {listings.length > 0 && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((row, idx) => {
              const linkKey = (row.ListNumber ?? row.ListingKey ?? '').toString().trim() || `comm-${idx}`
              const listing = row as ListingTileListing
              return (
                <ListingTile
                  key={linkKey}
                  listing={listing}
                  listingKey={linkKey}
                  signedIn={signedIn}
                  userEmail={userEmail ?? undefined}
                  saved={signedIn ? savedKeys.includes(linkKey) : undefined}
                  liked={signedIn ? likedKeys.includes(linkKey) : undefined}
                />
              )
            })}
          </div>
        )}

        <Link
          href={searchHref}
          className="mt-4 inline-block font-medium text-success hover:text-success hover:underline"
        >
          View all homes in {getSubdivisionDisplayName(subdivisionName)} →
        </Link>
      </div>
    </section>
  )
}
