import { Suspense } from 'react'
import Link from 'next/link'
import { getListings } from '@/app/actions/listings'
import type { ListingTileRow } from '@/app/actions/listings'
import ListingCard, { type ListingCardData } from '@/components/site/ListingCard'
import { Container } from '@/components/site/primitives'

/**
 * FeaturedListings — premium active inventory for a scope, rendered as the
 * CANONICAL design-system listing display: a responsive grid of <ListingCard>
 * (design_system/ryan-realty/ui_kits/website §featured-listings .listings/.listing).
 *
 * This is the ONE listing presentation the whole site uses. There is no longer a
 * bespoke per-section slider/tile — the canonical-listings gate forbids the old
 * GeoSectionFeaturedListings / TilesSlider / ListingTile path on these surfaces.
 *
 * Self-fetching + Suspense so the page renders instantly and this fills in.
 * Public (no session/cookie) so it stays inside the page ISR cache. Renders
 * nothing when the scope has no active inventory.
 */

type Props = {
  /** City name to scope to (e.g. "Bend"). Omit for region-wide. */
  city?: string
  /** Subdivision/community name to scope to (within a city). */
  subdivision?: string
  title?: string
  viewAllHref?: string
  viewAllLabel?: string
  limit?: number
}

function citySlug(city: string): string {
  return city.toLowerCase().trim().replace(/\s+/g, '-')
}

/** Map the active-listing tile row to the canonical ListingCard shape. */
function toCardData(l: ListingTileRow): ListingCardData | null {
  const key = (l.ListingKey ?? l.ListNumber ?? '').toString()
  if (!key) return null
  const addressLine = [l.StreetNumber, l.StreetName].filter(Boolean).join(' ') || 'Address on request'
  const cityParts: string[] = []
  if (l.City) cityParts.push(`${l.City}, OR`)
  if (l.PostalCode) cityParts.push(l.PostalCode)
  if (l.SubdivisionName) cityParts.push(l.SubdivisionName)
  return {
    listingKey: key,
    href: `/listing/${encodeURIComponent(key)}`,
    photoUrl: l.PhotoURL ?? null,
    price: l.ListPrice ?? null,
    addressLine,
    cityLine: cityParts.join(' · '),
    beds: l.BedroomsTotal ?? null,
    baths: l.BathroomsTotal ?? null,
    sqft: null,
  }
}

async function FeaturedListingsInner({
  city,
  subdivision,
  title,
  viewAllHref,
  viewAllLabel,
  limit = 8,
}: Props) {
  const raw = await getListings({
    ...(city ? { city } : {}),
    ...(subdivision ? { subdivision } : {}),
    propertyType: 'A',
    minBeds: 1,
    sort: 'newest',
    limit: limit * 2 + 6,
  }).catch(() => [])

  const cards = raw
    .filter((l) => typeof l.PhotoURL === 'string' && l.PhotoURL.trim().length > 0)
    .map(toCardData)
    .filter((c): c is ListingCardData => c !== null)
    .slice(0, limit)

  if (cards.length === 0) return null

  const href =
    viewAllHref ??
    (subdivision && city
      ? `/homes-for-sale/${citySlug(city)}/${citySlug(subdivision)}`
      : city
        ? `/homes-for-sale/${citySlug(city)}`
        : '/homes-for-sale')

  const heading =
    title ??
    (subdivision
      ? `Featured homes in ${subdivision}`
      : city
        ? `Featured homes in ${city}`
        : 'Featured Central Oregon homes')

  return (
    <section className="border-t border-border bg-card py-10 md:py-14">
      <Container>
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Featured listings
            </p>
            <h2 className="text-2xl font-bold text-foreground">{heading}</h2>
          </div>
          <Link
            href={href}
            className="shrink-0 text-sm font-semibold text-primary underline-offset-2 hover:underline"
          >
            {viewAllLabel ?? 'View all homes'}
          </Link>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {cards.map((card) => (
            <ListingCard key={card.listingKey} listing={card} />
          ))}
        </div>
      </Container>
    </section>
  )
}

export default function FeaturedListings(props: Props) {
  return (
    <Suspense fallback={<div className="min-h-80 border-t border-border" aria-hidden />}>
      <FeaturedListingsInner {...props} />
    </Suspense>
  )
}
