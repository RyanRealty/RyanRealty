'use client'

import Image from 'next/image'
import Link from 'next/link'
import type { MotivatedListing } from '@/lib/data'
import { listingDetailPath } from '@/lib/slug'
import { cn } from '@/lib/utils'

type Props = {
  listing: MotivatedListing
}

function formatPrice(price: number | null): string {
  if (price == null) return 'Price unavailable'
  return `$${(Math.round(price / 1000) * 1000).toLocaleString()}`
}

function formatAddress(listing: MotivatedListing): string {
  const parts = [
    listing.streetNumber,
    listing.streetName,
    listing.city ? `${listing.city}, OR` : null,
  ].filter(Boolean)
  return parts.join(' ')
}

function buildDetailPath(listing: MotivatedListing): string {
  return listingDetailPath(
    listing.listingKey,
    {
      streetNumber: listing.streetNumber,
      streetName: listing.streetName,
      city: listing.city,
      state: 'OR',
      postalCode: listing.postalCode,
    },
    {
      city: listing.citySlug,
      neighborhood: null,
      subdivision: listing.subdivisionName,
    },
    { mlsNumber: listing.listNumber }
  )
}

/**
 * Card for motivated-seller grid pages.
 *
 * Renders: hero photo, motivation badge (top-left), price, beds/baths/sqft,
 * address, and a reason tag strip.
 *
 * Design system compliant: tokens only, no arbitrary hex, no arbitrary text
 * sizes, shadcn/ui border + bg tokens throughout.
 */
export default function MotivatedListingCard({ listing }: Props) {
  const href = buildDetailPath(listing)
  const address = formatAddress(listing)
  const price = formatPrice(listing.listPrice)

  const topReason = listing.reasons[0] ?? null
  const scoreHigh = listing.motivationScore >= 60

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-shadow">
      {/* Photo */}
      <Link href={href} className="relative block aspect-[4/3] overflow-hidden bg-muted">
        {listing.photoUrl ? (
          <Image
            src={listing.photoUrl}
            alt={address || 'Listing photo'}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <span className="text-muted-foreground text-sm">No photo</span>
          </div>
        )}

        {/* Motivation badge — top-left overlay */}
        {topReason ? (
          <div className="absolute top-2 left-2 z-10">
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold leading-none',
                scoreHigh
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground'
              )}
            >
              {topReason}
            </span>
          </div>
        ) : null}

        {/* Status badge — top-right */}
        <div className="absolute top-2 right-2 z-10">
          <span className="inline-flex items-center rounded-full bg-success text-success-foreground px-2.5 py-1 text-xs font-semibold leading-none">
            Active
          </span>
        </div>
      </Link>

      {/* Card body */}
      <div className="flex flex-col gap-2 p-4 flex-1">
        {/* Price */}
        <p className="font-display text-xl font-semibold tabular-nums text-foreground">
          {price}
        </p>

        {/* Beds / baths / sqft */}
        <p className="text-sm text-muted-foreground">
          {[
            listing.beds != null ? `${listing.beds} bd` : null,
            listing.baths != null ? `${listing.baths} ba` : null,
            listing.sqft != null ? `${Math.round(listing.sqft).toLocaleString()} sqft` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>

        {/* Address */}
        <Link
          href={href}
          className="text-sm font-medium text-foreground hover:underline underline-offset-4 line-clamp-2"
        >
          {address}
        </Link>

        {/* All reason tags */}
        {listing.reasons.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 mt-auto pt-2">
            {listing.reasons.slice(0, 3).map((reason) => (
              <span
                key={reason}
                className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground"
              >
                {reason}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  )
}
