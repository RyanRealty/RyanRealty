import type { ListingTile } from '@/lib/data'
import { listingTileToRow } from '@/components/site/listing-detail/listing-similar'
import type { V3ListingRowData } from '@/components/site/v3'

export const BUYER_ANSWER_LISTING_CAP = 12

export function buyerAnswerListingRows(tiles: readonly ListingTile[]): V3ListingRowData[] {
  return tiles.slice(0, BUYER_ANSWER_LISTING_CAP).map(listingTileToRow)
}
