import type { ListingBadge, ListingCardData } from '@/components/site/ListingCard'
import type { ListingTile, MotivatedListing } from '@/lib/data'
import { listingTileHref, displaySubdivision } from '@/lib/slug'

/**
 * Canonical mappers to the ONE listing card shape (ListingCardData → ListingCard).
 * Every listing display on the site uses ListingCard; these adapters feed it from
 * the different DAL row shapes so the cards are identical everywhere.
 */

/** MotivatedListing → ListingCard, with the top motivation reason as the badge. */
export function motivatedToCardData(l: MotivatedListing): ListingCardData | null {
  const key = (l.listingKey ?? l.listNumber ?? '').toString()
  if (!key) return null
  const addressLine =
    [l.streetNumber, l.streetName, l.streetSuffix].filter(Boolean).join(' ') || 'Address on request'
  const cityParts: string[] = []
  if (l.city) cityParts.push(`${l.city}, OR`)
  if (l.postalCode) cityParts.push(l.postalCode)
  const lSubdivision = displaySubdivision(l.subdivisionName)
  if (lSubdivision) cityParts.push(lSubdivision)
  const reason = l.reasons[0]
  return {
    listingKey: key,
    href: `/listing/${encodeURIComponent(key)}`,
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

/** ListingTile (the canonical DAL tile) → ListingCard, with an optional badge. */
export function tileToCardData(
  t: ListingTile,
  badge?: { kind: ListingBadge; label: string },
): ListingCardData | null {
  const key = (t.listingKey ?? t.listNumber ?? '').toString()
  if (!key) return null
  const addressLine =
    [t.streetNumber, t.streetName, t.streetSuffix].filter(Boolean).join(' ') || 'Address on request'
  const cityParts: string[] = []
  if (t.city) cityParts.push(`${t.city}, OR`)
  if (t.postalCode) cityParts.push(t.postalCode)
  const tSubdivision = displaySubdivision(t.subdivisionName)
  if (tSubdivision) cityParts.push(tSubdivision)
  return {
    listingKey: key,
    href: listingTileHref({
      listingKey: t.listingKey,
      listNumber: t.listNumber,
      streetNumber: t.streetNumber,
      streetName: t.streetName,
      city: t.city,
      boundaryCity: t.boundaryCity,
      boundaryNeighborhood: t.boundaryNeighborhood,
      subdivisionName: t.subdivisionName,
    }),
    photoUrl: t.photoUrl ?? null,
    price: t.listPrice ?? null,
    addressLine,
    cityLine: cityParts.join(' · '),
    beds: t.beds ?? null,
    baths: t.baths ?? null,
    sqft: t.sqft ?? null,
    badge,
    tourUrl: t.tourUrl ?? null,
  }
}
