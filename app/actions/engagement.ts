'use server'

import { unstable_cache } from 'next/cache'
import {
  getEngagementCountsBatch as _getEngagementCountsBatch,
  getEngagementForListing as _getEngagementForListing,
  incrementListingShareCount as _incrementListingShareCount,
  incrementListingSaveCount as _incrementListingSaveCount,
  decrementListingSaveCount as _decrementListingSaveCount,
  incrementListingLikeCount as _incrementListingLikeCount,
  decrementListingLikeCount as _decrementListingLikeCount,
} from '@/lib/data'
import type { EngagementCounts, ListingDetailEngagement } from '@/app/actions/engagement-types'

/**
 * Batch-fetch engagement counts for a set of listing keys.
 * Delegates to the DAL `engagement_metrics` reader.
 */
export async function getEngagementCountsBatch(
  listingKeys: string[]
): Promise<Record<string, EngagementCounts>> {
  return _getEngagementCountsBatch(listingKeys)
}

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

/**
 * Fetch engagement counts for a single listing detail page.
 */
export async function getEngagementForListingDetail(
  listingKey: string
): Promise<ListingDetailEngagement> {
  return _getEngagementForListing(listingKey)
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

/** Increment like_count (call after user likes listing). */
export async function incrementListingLikeCount(listingKey: string): Promise<void> {
  await _incrementListingLikeCount(listingKey)
}

/** Decrement like_count (call after user unlikes listing). */
export async function decrementListingLikeCount(listingKey: string): Promise<void> {
  await _decrementListingLikeCount(listingKey)
}
