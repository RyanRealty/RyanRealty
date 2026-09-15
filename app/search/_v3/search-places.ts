import { Building2, Home, MapPin, Trees, type LucideIcon } from 'lucide-react'
import type { MorphingSearchItem } from '@/components/motion/morphing-search'
import { listingTileHref } from '@/lib/slug'

/** Seed places Command opens onto. MorphingSearch empty-open prefers live homes. */
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
  ListPrice?: number | string | null
  BedroomsTotal?: number | string | null
}

function placeIcon(seed: SearchPlaceSeed): LucideIcon {
  if (seed.description === 'Community' || seed.id.includes('tetherow')) return Trees
  if (seed.description === 'City') return Building2
  return MapPin
}

function askLabel(price: number | string | null | undefined): string | null {
  const n = typeof price === 'number' ? price : Number(price)
  if (!Number.isFinite(n) || n <= 0) return null
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
}

/** Catalog-shaped fallback rows (icon + title + description). */
export function morphCatalogItems(): MorphingSearchItem[] {
  return SEARCH_PLACE_SEEDS.map((seed) => ({
    id: seed.id,
    title: seed.title,
    description: seed.description,
    keywords: [seed.title, seed.description],
    icon: placeIcon(seed),
  }))
}

/** Field-becomes-results rows: ask first so empty-open is not a street popover. */
export function morphHomesFromListings(
  listings: readonly MorphHomeListing[],
  limit = 8,
): MorphingSearchItem[] {
  const items: MorphingSearchItem[] = []
  for (const listing of listings) {
    if (items.length >= limit) break
    const street = [listing.StreetNumber, listing.StreetName, listing.StreetSuffix]
      .filter(Boolean)
      .join(' ')
      .trim()
    const key = listing.ListNumber ?? listing.ListingKey
    const ask = askLabel(listing.ListPrice)
    if (!ask || !key) continue
    const beds =
      listing.BedroomsTotal != null && String(listing.BedroomsTotal).trim() !== ''
        ? `${listing.BedroomsTotal} bd`
        : null
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
      title: ask,
      description: [beds, listing.City, street || null].filter(Boolean).join(' · '),
      keywords: [ask, street, listing.City ?? ''],
      icon: Home,
    })
  }
  return items
}
