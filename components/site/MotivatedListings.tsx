import { Suspense } from 'react'
import Link from 'next/link'
import { getMotivatedListings } from '@/lib/data'
import type { MotivatedListing } from '@/lib/data'
import type { ListingTileRow } from '@/app/actions/listings'
import TilesSlider, { TilesSliderItem } from '@/components/TilesSlider'
import ListingTile from '@/components/ListingTile'
import { TILE_MIN_HEIGHT_PX } from '@/lib/tile-constants'
import { cn } from '@/lib/utils'

type Props = {
  /**
   * City name to scope to (e.g. "Bend"). Omit for region-wide.
   * Passed through to getMotivatedListings as a case-insensitive city filter.
   */
  city?: string
  /** Heading override. Defaults to "Motivated sellers in {City}" or "Motivated sellers in Central Oregon". */
  title?: string
  /** "View all" link override. Defaults to /motivated-sellers/<citySlug> or /motivated-sellers. */
  viewAllHref?: string
  /** Number of cards to display in the slider. Default 8. */
  limit?: number
}

/**
 * Convert a MotivatedListing (camelCase DAL type) to ListingTileRow
 * (PascalCase legacy type) so the existing ListingTile component can
 * render it without modification.
 */
function toTileRow(listing: MotivatedListing): ListingTileRow {
  return {
    ListingKey: listing.listingKey,
    ListNumber: listing.listNumber,
    mls_source: null,
    ListPrice: listing.listPrice,
    BedroomsTotal: listing.beds,
    BathroomsTotal: listing.baths,
    StreetNumber: listing.streetNumber,
    StreetName: listing.streetName,
    City: listing.city,
    State: 'OR',
    PostalCode: listing.postalCode,
    SubdivisionName: listing.subdivisionName,
    PhotoURL: listing.photoUrl,
    Latitude: listing.lat,
    Longitude: listing.lng,
    ModificationTimestamp: listing.modifiedAt,
    PropertyType: listing.propertyType,
    StandardStatus: listing.status,
    OnMarketDate: listing.onMarketDate,
    ClosePrice: null,
    CloseDate: null,
  }
}

function citySlugFor(city: string): string {
  return city.toLowerCase().trim().replace(/\s+/g, '-')
}

async function MotivatedListingsInner({
  city,
  title,
  viewAllHref,
  limit = 8,
}: Props) {
  const { listings } = await getMotivatedListings({
    city,
    limit: Math.min(limit * 2 + 4, 50),
  }).catch(() => ({ listings: [], total: 0 }))

  // Require a photo — the score already filters but guard again here
  const filtered = listings
    .filter((l) => typeof l.photoUrl === 'string' && l.photoUrl.trim().length > 0)
    .slice(0, limit)

  if (filtered.length === 0) return null

  const href =
    viewAllHref ??
    (city ? `/motivated-sellers/${citySlugFor(city)}` : '/motivated-sellers')

  const heading =
    title ??
    (city ? `Motivated sellers in ${city}` : 'Motivated sellers in Central Oregon')

  return (
    <TilesSlider
      title={heading}
      titleId="motivated-listings-heading"
      headerRight={
        <Link
          href={href}
          className="text-sm font-semibold text-accent-foreground hover:text-accent-foreground"
        >
          View all motivated homes
        </Link>
      }
      className="bg-card px-4 py-10 sm:px-6 sm:py-12"
    >
      {filtered.map((listing) => {
        const key = (listing.listingKey ?? listing.listNumber ?? '').toString()
        if (!key) return null
        const row = toTileRow(listing)
        return (
          <TilesSliderItem key={key} style={{ minHeight: TILE_MIN_HEIGHT_PX }}>
            <div className="relative h-full">
              <ListingTile
                listing={row}
                listingKey={key}
                saved={false}
                liked={false}
                signedIn={false}
                userEmail={null}
                viewCount={0}
                likeCount={0}
                saveCount={0}
                shareCount={0}
              />
              {listing.reasons.length > 0 ? (
                <MotivationBadge reasons={listing.reasons} score={listing.motivationScore} />
              ) : null}
            </div>
          </TilesSliderItem>
        )
      })}
    </TilesSlider>
  )
}

/**
 * Motivation badge overlaid on the listing card image area.
 * Shows the top 1-2 reason strings from the scoring pass.
 * Uses design-system tokens only — no arbitrary hex or arbitrary text sizes.
 */
function MotivationBadge({
  reasons,
  score,
}: {
  reasons: string[]
  score: number
}) {
  const topReason = reasons[0] ?? null
  if (!topReason) return null

  // Intensity class: high motivation (score 60+) gets the primary badge,
  // lower gets a muted variant — both within design system tokens.
  const intensity = score >= 60 ? 'high' : 'medium'

  return (
    <div className="absolute top-2 left-2 z-10 pointer-events-none">
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium leading-tight',
          intensity === 'high'
            ? 'bg-primary text-primary-foreground'
            : 'bg-secondary text-secondary-foreground'
        )}
      >
        {topReason}
      </span>
    </div>
  )
}

/**
 * Self-fetching motivated-sellers slider server component.
 *
 * Pattern mirrors FeaturedListings.tsx — Suspense wrapper means the
 * surrounding page renders immediately while this section awaits data.
 * Returns nothing when no motivated listings are found.
 */
export default function MotivatedListings(props: Props) {
  return (
    <Suspense fallback={<div className="min-h-80 border-t border-border" aria-hidden />}>
      <MotivatedListingsInner {...props} />
    </Suspense>
  )
}
