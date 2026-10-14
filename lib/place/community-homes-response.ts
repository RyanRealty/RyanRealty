/**
 * The JSON a community page's map fetches after paint: the same homes list
 * the server built (getCommunityPopulation + placeStockSectionsFromTiles).
 * Server only — the population read is the page's own.
 */
import 'server-only'
import { getCommunityPopulation } from '@/lib/place/community-population'
import { placeStockSectionsFromTiles } from '@/lib/place/place-inventory-stock'
import type { V3ListingRowData } from '@/components/site/v3/V3ListingRow'

export type CommunityHomesResponse = {
  community: string
  homes: V3ListingRowData[]
}

export async function communityHomesResponse(slug: string): Promise<CommunityHomesResponse | null> {
  const population = await getCommunityPopulation(slug)
  if (!population) return null
  const homes = placeStockSectionsFromTiles(population.tiles).flatMap((section) => section.rows)
  return { community: slug, homes }
}
