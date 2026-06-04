import { Suspense } from 'react'
import Link from 'next/link'
import { getMotivatedListings } from '@/lib/data'
import type { MotivatedListing } from '@/lib/data'
import ListingCard, { type ListingCardData } from '@/components/site/ListingCard'
import { Container } from '@/components/site/primitives'
import { listingTileHref } from '@/lib/slug'

/**
 * MotivatedListings — homes with price cuts or motivation signals in their
 * remarks, rendered with the CANONICAL <ListingCard> (identical to Featured and
 * every other listing display). The motivation reason rides as the card badge.
 *
 * Self-fetching + Suspense. Renders nothing when no motivated listings exist.
 */

type Props = {
  /** City name to scope to (e.g. "Bend"). Omit for region-wide. */
  city?: string
  title?: string
  viewAllHref?: string
  limit?: number
}

function citySlugFor(city: string): string {
  return city.toLowerCase().trim().replace(/\s+/g, '-')
}

function toCardData(l: MotivatedListing): ListingCardData | null {
  const key = (l.listingKey ?? l.listNumber ?? '').toString()
  if (!key) return null
  const addressLine = [l.streetNumber, l.streetName].filter(Boolean).join(' ') || 'Address on request'
  const cityParts: string[] = []
  if (l.city) cityParts.push(`${l.city}, OR`)
  if (l.postalCode) cityParts.push(l.postalCode)
  if (l.subdivisionName) cityParts.push(l.subdivisionName)
  const reason = l.reasons[0]
  return {
    listingKey: key,
    href: listingTileHref({
      listingKey: l.listingKey,
      listNumber: l.listNumber,
      streetNumber: l.streetNumber,
      streetName: l.streetName,
      city: l.city,
      subdivisionName: l.subdivisionName,
    }),
    photoUrl: l.photoUrl ?? null,
    price: l.listPrice ?? null,
    addressLine,
    cityLine: cityParts.join(' · '),
    beds: l.beds ?? null,
    baths: l.baths ?? null,
    sqft: null,
    badge: reason
      ? { kind: l.motivationScore >= 60 ? 'hot' : 'drop', label: reason }
      : undefined,
  }
}

async function MotivatedListingsInner({ city, title, viewAllHref, limit = 8 }: Props) {
  const { listings } = await getMotivatedListings({
    city,
    limit: Math.min(limit * 2 + 4, 50),
  }).catch(() => ({ listings: [] as MotivatedListing[], total: 0 }))

  const cards = listings
    .filter((l) => typeof l.photoUrl === 'string' && l.photoUrl.trim().length > 0)
    .map(toCardData)
    .filter((c): c is ListingCardData => c !== null)
    .slice(0, limit)

  if (cards.length === 0) return null

  const href = viewAllHref ?? (city ? `/motivated-sellers/${citySlugFor(city)}` : '/motivated-sellers')
  const heading = title ?? (city ? `Motivated sellers in ${city}` : 'Motivated sellers in Central Oregon')

  return (
    <section className="border-t border-border bg-card py-10 md:py-14">
      <Container>
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Price cuts and motivated sellers
            </p>
            <h2 className="text-2xl font-bold text-foreground">{heading}</h2>
          </div>
          <Link
            href={href}
            className="shrink-0 text-sm font-semibold text-primary underline-offset-2 hover:underline"
          >
            View all motivated homes
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

export default function MotivatedListings(props: Props) {
  return (
    <Suspense fallback={<div className="min-h-80 border-t border-border" aria-hidden />}>
      <MotivatedListingsInner {...props} />
    </Suspense>
  )
}
