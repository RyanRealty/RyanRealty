import {
  getListingDetailHistory,
  getListingPriceHistory,
  seedListingDetailHistory,
  type ListingHistoryEventRow,
  type ListingHistorySeed,
} from '@/lib/data/listings/getListingDetailBundles'
import { publishListingHistory } from '@/lib/listing/publish-listing-history'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'

const HISTORY_TIMEOUT_MS = 8000
const PRICE_HISTORY_TIMEOUT_MS = 2500

export function listingHistorySeedFrom(listing: {
  listingKey?: string | null
  onMarketDate?: string | null
  listPrice?: number | null
  originalListPrice?: number | null
}): ListingHistorySeed {
  return {
    onMarketDate: listing.onMarketDate ?? null,
    listPrice: listing.listPrice ?? null,
    originalListPrice: listing.originalListPrice ?? null,
  }
}

function asRows(listingKey: string, seed: ListingHistorySeed, extra?: {
  listingHistory?: ListingHistoryEventRow[]
  priceHistory?: Awaited<ReturnType<typeof getListingPriceHistory>>
}): ListingHistoryEventRow[] {
  return publishListingHistory({
    listingHistory: extra?.listingHistory,
    priceHistory: extra?.priceHistory,
    onMarketDate: seed.onMarketDate ?? null,
    listPrice: seed.listPrice ?? null,
    originalListPrice: seed.originalListPrice ?? null,
  }).map((row, i) => ({
    id: `pub-hist-${listingKey}-${i}`,
    listing_key: listingKey,
    event: row.event,
    event_date: row.event_date,
    price: row.price ?? null,
    price_change: row.price_change ?? null,
    description: row.description ?? null,
  }))
}

/** Page/action read: live merge, or Listed from the already-loaded row. */
export async function readListingDetailHistory(
  listingKey: string,
  seed: ListingHistorySeed,
): Promise<ListingHistoryEventRow[]> {
  const [history, priceCuts] = await Promise.all([
    withTimeoutFallback(
      getListingDetailHistory(listingKey, seed),
      seedListingDetailHistory(listingKey, seed),
      HISTORY_TIMEOUT_MS,
      'listing:history',
    ),
    withTimeoutFallback(
      getListingPriceHistory(listingKey),
      [],
      PRICE_HISTORY_TIMEOUT_MS,
      'listing:price-history',
    ),
  ])
  if (priceCuts.length === 0) return history
  return asRows(listingKey, seed, {
    listingHistory: history,
    priceHistory: priceCuts,
  })
}
