import type { ListingCardData } from '@/components/site/ListingCard'
import type { MotivatedListing } from '@/lib/data'

/**
 * Canonical mappers to the ONE listing card shape (ListingCardData → ListingCard).
 * Every listing display on the site uses ListingCard; these adapters feed it from
 * the different DAL row shapes so the cards are identical everywhere.
 */

/** MotivatedListing → ListingCard, with the top motivation reason as the badge. */
export function motivatedToCardData(l: MotivatedListing): ListingCardData | null {
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
