/**
 * Active SFR tiles for a blog related-homes rail.
 *
 * Resort communities use the same city door + alias set as
 * getRegistryResortPublicFigures / /communities/{slug}. City posts use
 * getCityListings. Empty fetch → empty list. Do not invent homes.
 */
import { fetchAllCityActiveSfr } from '@/lib/kb/city-active-sfr'
import { resortTilesForSlug } from '@/lib/kb/resort-active-counts'
import { getCityListings, getCommunityListings } from '@/lib/data/listings/getListingTiles'
import type { ListingTile } from '@/lib/data/types/listing'
import type { BuyablePlace } from '@/lib/blog/publish-blog-related-homes'
import resortRegistry from '@/data/resort-communities.json' assert { type: 'json' }

type RegistryRow = {
  slug: string
  label: string
  city: string
  city_slug: string
  is_resort?: boolean
  mls_cities?: string[]
}

const COMMUNITIES = (resortRegistry as { communities: RegistryRow[] }).communities

function newestFirst(tiles: ListingTile[]): ListingTile[] {
  return [...tiles].sort((a, b) => {
    const aAt = a.onMarketDate ?? a.modifiedAt ?? ''
    const bAt = b.onMarketDate ?? b.modifiedAt ?? ''
    return bAt.localeCompare(aAt)
  })
}

async function resortTiles(row: RegistryRow): Promise<ListingTile[]> {
  const citySet = [row.city, ...(row.mls_cities ?? [])]
  const byKey = new Map<string, ListingTile>()
  await Promise.all(
    citySet.map(async (city) => {
      for (const tile of await fetchAllCityActiveSfr(city)) {
        byKey.set(tile.listingKey, tile)
      }
    }),
  )
  return resortTilesForSlug(row.city_slug, row.slug, [...byKey.values()])
}

export async function getBlogRelatedHomes(
  place: BuyablePlace,
  limit = 8,
): Promise<ListingTile[]> {
  const cap = Math.min(Math.max(limit, 1), 12)
  if (place.kind === 'city') {
    return getCityListings(place.city, {
      propertyType: 'A',
      status: 'active',
      limit: cap,
      sort: 'newest',
    })
  }

  const row = COMMUNITIES.find((c) => c.slug === place.slug)
  if (!row) return []
  if (row.is_resort === true) {
    const tiles = await resortTiles(row)
    if (tiles.length > 0) return newestFirst(tiles).slice(0, cap)
  }
  return getCommunityListings(row.label, {
    propertyType: 'A',
    status: 'active',
    limit: cap,
    sort: 'newest',
  })
}
