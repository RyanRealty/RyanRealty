/**
 * Closed-sale tiles for the community sold table. Neighborhood membership
 * first (the leftover grain), then a short alias list so a plat whose
 * boundary_neighborhood is blank still lands. DAL only. A miss is [].
 */

import { getListingTiles } from '@/lib/data'
import type { ListingTile } from '@/lib/data/types/listing'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import { communitySoldAliasList } from './community-sold'

const SOLD_TILE_LIMIT = 80
const SOLD_READ_MS = 4000

export async function loadCommunitySoldTiles(input: {
  neighborhoodSlug: string
  aliases: readonly string[]
  windowStart: string
  windowEnd: string
}): Promise<ListingTile[]> {
  const start = input.windowStart.trim()
  const end = input.windowEnd.trim()
  if (!start || !end) return []

  const aliases = communitySoldAliasList(input.aliases)
  const neighborhood = input.neighborhoodSlug.trim()
  const reads: Array<Promise<ListingTile[]>> = []

  if (neighborhood) {
    reads.push(
      withTimeoutFallback(
        getListingTiles({
          neighborhood,
          status: 'closed',
          closedFromDate: start,
          closedToDate: end,
          sort: 'close-newest',
          limit: SOLD_TILE_LIMIT,
        }),
        [],
        SOLD_READ_MS,
        `comm:sold-nbhd:${neighborhood}`,
      ),
    )
  }

  for (const subdivision of aliases) {
    reads.push(
      withTimeoutFallback(
        getListingTiles({
          subdivision,
          status: 'closed',
          closedFromDate: start,
          closedToDate: end,
          sort: 'close-newest',
          limit: SOLD_TILE_LIMIT,
        }),
        [],
        SOLD_READ_MS,
        `comm:sold-sub:${subdivision}`,
      ),
    )
  }

  if (reads.length === 0) return []
  return (await Promise.all(reads)).flat()
}
