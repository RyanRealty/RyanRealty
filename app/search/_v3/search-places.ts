import { listingTileHref } from '@/lib/slug'

/** Seed places Command opens onto. MorphingSearch uses live listing addresses. */
export const SEARCH_PLACE_SEEDS = [
  { id: '/homes-for-sale/bend', title: 'Bend', description: 'City' },
  { id: '/homes-for-sale/redmond', title: 'Redmond', description: 'City' },
  { id: '/homes-for-sale/sisters', title: 'Sisters', description: 'City' },
  { id: '/homes-for-sale/sunriver', title: 'Sunriver', description: 'Community' },
  { id: '/communities/tetherow', title: 'Tetherow', description: 'Bend' },
  { id: '/homes-for-sale/prineville', title: 'Prineville', description: 'City' },
  { id: '/homes-for-sale/la-pine', title: 'La Pine', description: 'City' },
  { id: '/homes-for-sale/madras', title: 'Madras', description: 'City' },
] as const

export type SearchPlaceSeed = (typeof SEARCH_PLACE_SEEDS)[number]

export type MorphHomeListing = {
  ListNumber?: string | null
  ListingKey?: string | null
  StreetNumber?: string | null
  StreetName?: string | null
  StreetSuffix?: string | null
  City?: string | null
  PostalCode?: string | null
  SubdivisionName?: string | null
  BoundaryCity?: string | null
  BoundaryNeighborhood?: string | null
}

/** Field-becomes-results seeds: live listing addresses, not a Places city list. */
export function morphHomesFromListings(
  listings: readonly MorphHomeListing[],
  limit = 8,
): Array<{ id: string; title: string; description: string }> {
  const items: Array<{ id: string; title: string; description: string }> = []
  for (const listing of listings) {
    if (items.length >= limit) break
    const title = [listing.StreetNumber, listing.StreetName, listing.StreetSuffix]
      .filter(Boolean)
      .join(' ')
      .trim()
    const key = listing.ListNumber ?? listing.ListingKey
    if (!title || !key) continue
    items.push({
      id: listingTileHref({
        listingKey: String(key),
        listNumber: listing.ListNumber ?? null,
        streetNumber: listing.StreetNumber ?? null,
        streetName: listing.StreetName ?? null,
        city: listing.City ?? null,
        boundaryCity: listing.BoundaryCity ?? null,
        boundaryNeighborhood: listing.BoundaryNeighborhood ?? null,
        subdivisionName: listing.SubdivisionName ?? null,
      }),
      title,
      description: [listing.City, listing.PostalCode].filter(Boolean).join(' '),
    })
  }
  return items
}
