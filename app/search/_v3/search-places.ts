import { Building2, Home, MapPin, Trees, type LucideIcon } from 'lucide-react'
import type { MorphingSearchItem } from '@/components/motion/morphing-search'
import { listingTileHref } from '@/lib/slug'

/** Seed places Command opens onto. MorphingSearch empty-open uses these with icons. */
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

function placeIcon(seed: SearchPlaceSeed): LucideIcon {
  if (seed.description === 'Community' || seed.id.includes('tetherow')) return Trees
  if (seed.description === 'City') return Building2
  return MapPin
}

/** Catalog MorphingSearch rows: Lucide icon + title + description (beUI demo shape). */
export function morphCatalogItems(): MorphingSearchItem[] {
  return SEARCH_PLACE_SEEDS.map((seed) => ({
    id: seed.id,
    title: seed.title,
    description: seed.description,
    keywords: [seed.title, seed.description],
    icon: placeIcon(seed),
  }))
}

/** Listing addresses as Home-icon rows. Used only after the shopper types. */
export function morphHomesFromListings(
  listings: readonly MorphHomeListing[],
  limit = 8,
): MorphingSearchItem[] {
  const items: MorphingSearchItem[] = []
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
      icon: Home,
    })
  }
  return items
}
