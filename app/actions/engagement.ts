'use server'

import { unstable_cache } from 'next/cache'
import {
  getEngagementCountsBatch as _getEngagementCountsBatch,
  incrementListingShareCount as _incrementListingShareCount,
  incrementListingSaveCount as _incrementListingSaveCount,
  decrementListingSaveCount as _decrementListingSaveCount,
  decrementListingLikeCount as _decrementListingLikeCount,
} from '@/lib/data'
import type { EngagementCounts } from '@/app/actions/engagement-types'

const _getEngagementCountsBatchCached = unstable_cache(
  async (listingKeys: string[]) => _getEngagementCountsBatch(listingKeys),
  ['engagement-counts-batch-v1'],
  { revalidate: 120, tags: ['engagement-metrics'] }
)

export async function getEngagementCountsBatchCached(
  listingKeys: string[]
): Promise<Record<string, EngagementCounts>> {
  return _getEngagementCountsBatchCached(listingKeys)
}

/** Increment share_count for a listing (call when user shares). */
export async function incrementListingShareCount(listingKey: string): Promise<void> {
  await _incrementListingShareCount(listingKey)
}

/** Increment save_count (call after user saves listing). */
export async function incrementListingSaveCount(listingKey: string): Promise<void> {
  await _incrementListingSaveCount(listingKey)
}

/** Decrement save_count (call after user unsaves listing). */
export async function decrementListingSaveCount(listingKey: string): Promise<void> {
  await _decrementListingSaveCount(listingKey)
}

/** Decrement like_count (call after user unlikes listing). */
export async function decrementListingLikeCount(listingKey: string): Promise<void> {
  await _decrementListingLikeCount(listingKey)
}
