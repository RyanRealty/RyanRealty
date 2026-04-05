'use server'

import { unstable_cache } from 'next/cache'
import { getListingsWithAdvanced, type ListingTileRow } from '@/app/actions/listings'
import {
  getSavedSearchHash,
  normalizeSavedSearchFilters,
  savedFiltersToAdvanced,
  type SavedSearchFilters,
} from '@/lib/search-filters'

export type CachedSearchResult = {
  listings: ListingTileRow[]
  totalCount: number
  cacheKey: string
}

function getCachedSearchRunner(
  cacheKey: string,
  filters: SavedSearchFilters,
  limit: number,
  offset: number
) {
  return unstable_cache(
    async () => {
      const normalized = normalizeSavedSearchFilters(filters)
      const advanced = savedFiltersToAdvanced(normalized)
      return getListingsWithAdvanced({
        ...advanced,
        limit,
        offset,
      })
    },
    ['search-results', cacheKey, String(limit), String(offset)],
    {
      revalidate: 300,
      tags: ['search-results', `search-results:${cacheKey}`],
    }
  )
}

export async function getCachedSearchListings(
  filters: SavedSearchFilters,
  page: number,
  pageSize: number
): Promise<CachedSearchResult> {
  const safePage = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1
  const safePageSize = Number.isFinite(pageSize) ? Math.min(100, Math.max(1, Math.floor(pageSize))) : 24
  const offset = (safePage - 1) * safePageSize
  const cacheKey = getSavedSearchHash(filters)
  const run = getCachedSearchRunner(cacheKey, filters, safePageSize, offset)
  const result = await run()
  return {
    ...result,
    cacheKey,
  }
}

export async function prewarmSearchCache(
  filters: SavedSearchFilters,
  pageSize = 24
): Promise<{ cacheKey: string; totalCount: number; listingKeys: string[] }> {
  const result = await getCachedSearchListings(filters, 1, pageSize)
  const listingKeys = result.listings
    .map((row) => (row.ListNumber ?? row.ListingKey ?? '').toString().trim())
    .filter(Boolean)
  return {
    cacheKey: result.cacheKey,
    totalCount: result.totalCount,
    listingKeys,
  }
}
