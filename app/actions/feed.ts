'use server'

import { getListings } from './listings'
import type { ListingTileRow } from './listings'

const DEFAULT_PAGE_SIZE = 24
const MAX_PAGE_SIZE = 48

export type FeedResult = {
  listings: ListingTileRow[]
  nextOffset: number | null
}

/**
 * Infinite feed: returns a page of listing tiles (newest first). Use nextOffset as cursor for next page.
 * Optionally pass city for "For You" / geo-scoped feed; userId reserved for future personalization (pgvector).
 */
export async function getFeedListings(options: {
  offset?: number
  limit?: number
  city?: string | null
  userId?: string | null
}): Promise<FeedResult> {
  const limit = Math.min(options.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)
  const offset = Math.max(0, options.offset ?? 0)

  const listings = await getListings({
    city: options.city?.trim() || undefined,
    limit,
    offset,
    sort: 'newest',
    includePending: true,
  })

  const nextOffset = listings.length < limit ? null : offset + listings.length
  return { listings, nextOffset }
}
