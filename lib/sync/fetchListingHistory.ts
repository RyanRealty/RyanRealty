/**
 * Shared Spark → listing_history fetch used by delta finalize and the
 * expired-listing CRM note. One helper so the note never invents a price path
 * the finalize lane would have written differently.
 */
import { sparkHistoryItemToRow } from '@/lib/listing-mapper'
import {
  fetchSparkListingHistory,
  fetchSparkPriceHistory,
  priceHistoryMayStandIn,
  type SparkListingHistoryItem,
} from '@/lib/spark'
import { replaceListingHistoryForKey } from '@/lib/data/sync/syncWrites'

export async function fetchAndInsertHistoryCore(
  accessToken: string,
  listingKey: string,
): Promise<{ inserted: number; ok: boolean; items: SparkListingHistoryItem[]; status?: number }> {
  let response = await fetchSparkListingHistory(accessToken, listingKey)
  // The price history stands in only on a standing answer (priceHistoryMayStandIn):
  // it carries no status changes, so a rate limit or an outage must not swap it
  // in for the whole history the replace below would then delete.
  if (priceHistoryMayStandIn(response)) {
    const fallback = await fetchSparkPriceHistory(accessToken, listingKey)
    if (fallback.items.length > 0) response = fallback
  }
  const hadSuccessfulFetch = response.ok && response.partial !== true
  // A partial history (a later page failed) never replaces the stored one: the
  // replace deletes every event it does not carry.
  if (response.items.length > 0 && hadSuccessfulFetch) {
    const rows = response.items.map((item) => sparkHistoryItemToRow(listingKey, item))
    const result = await replaceListingHistoryForKey(listingKey, rows)
    if (!result.ok) {
      // Not saved: callers must not freeze the listing as if it were.
      console.error(`[fetchListingHistory] listing_history replace error for ${listingKey}.`, result.error)
      return { inserted: 0, ok: false, items: response.items, status: response.status }
    }
    return { inserted: result.inserted, ok: hadSuccessfulFetch, items: response.items, status: response.status }
  }
  return { inserted: 0, ok: hadSuccessfulFetch, items: response.items, status: response.status }
}
