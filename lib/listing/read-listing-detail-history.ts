import {
  getListingDetailHistory,
  seedListingDetailHistory,
  type ListingHistoryEventRow,
  type ListingHistorySeed,
} from '@/lib/data/listings/getListingDetailBundles'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'

const HISTORY_TIMEOUT_MS = 4500

export function listingHistorySeedFrom(listing: {
  listingKey?: string | null
  onMarketDate?: string | null
  listPrice?: number | null
}): ListingHistorySeed {
  return {
    onMarketDate: listing.onMarketDate ?? null,
    listPrice: listing.listPrice ?? null,
  }
}

/** Page/action read: live merge, or Listed from the already-loaded row. */
export function readListingDetailHistory(
  listingKey: string,
  seed: ListingHistorySeed,
): Promise<ListingHistoryEventRow[]> {
  return withTimeoutFallback(
    getListingDetailHistory(listingKey, seed),
    seedListingDetailHistory(listingKey, seed),
    HISTORY_TIMEOUT_MS,
    'listing:history',
  )
}
