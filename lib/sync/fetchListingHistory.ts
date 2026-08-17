/**
 * Shared Spark → listing_history fetch used by delta finalize and the
 * expired-listing CRM note. One helper so the note never invents a price path
 * the finalize lane would have written differently.
 */
import { sparkHistoryItemToRow } from '@/lib/listing-mapper'
import {
  fetchSparkListingHistory,
  fetchSparkPriceHistory,
  type SparkListingHistoryItem,
} from '@/lib/spark'
import { replaceListingHistoryForKey } from '@/lib/data/sync/syncWrites'

export async function fetchAndInsertHistoryCore(
  accessToken: string,
  listingKey: string,
): Promise<{ inserted: number; ok: boolean; items: SparkListingHistoryItem[] }> {
  let response = await fetchSparkListingHistory(accessToken, listingKey)
  if (response.items.length === 0) {
    const fallback = await fetchSparkPriceHistory(accessToken, listingKey)
    if (fallback.items.length > 0) response = fallback
  }
  const hadSuccessfulFetch = response.ok && response.partial !== true
  if (response.items.length > 0) {
    const rows = response.items.map((item) => sparkHistoryItemToRow(listingKey, item))
    const result = await replaceListingHistoryForKey(listingKey, rows)
    if (!result.ok) {
      console.error(`[fetchListingHistory] listing_history replace error for ${listingKey}.`, result.error)
      return { inserted: 0, ok: hadSuccessfulFetch, items: response.items }
    }
    return { inserted: result.inserted, ok: hadSuccessfulFetch, items: response.items }
  }
  return { inserted: 0, ok: hadSuccessfulFetch, items: response.items }
}
