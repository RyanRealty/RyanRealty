'use server'

import { getListingsWithAdvanced } from './listings'

const MAX_LIMIT = 500

type QueryBuilderOptions = Parameters<typeof getListingsWithAdvanced>[0]

/**
 * Admin query builder: run advanced search with filters. Returns up to MAX_LIMIT rows.
 * Call from admin only (page is behind admin layout).
 */
export async function runQueryBuilderSearch(filters: {
  city?: string
  subdivision?: string
  minPrice?: number
  maxPrice?: number
  minBeds?: number
  maxBeds?: number
  minBaths?: number
  maxBaths?: number
  hasPool?: boolean
  hasView?: boolean
  hasWaterfront?: boolean
  limit?: number
}): Promise<{ listings: Awaited<ReturnType<typeof getListingsWithAdvanced>>['listings']; totalCount: number }> {
  const limit = Math.min(filters.limit ?? 100, MAX_LIMIT)
  const opts: QueryBuilderOptions = {
    city: filters.city?.trim() || undefined,
    subdivision: filters.subdivision?.trim() || undefined,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    minBeds: filters.minBeds,
    maxBeds: filters.maxBeds,
    minBaths: filters.minBaths,
    maxBaths: filters.maxBaths,
    hasPool: filters.hasPool ?? undefined,
    hasView: filters.hasView ?? undefined,
    hasWaterfront: filters.hasWaterfront ?? undefined,
    limit,
    offset: 0,
    sort: 'newest',
  }
  return getListingsWithAdvanced(opts)
}
