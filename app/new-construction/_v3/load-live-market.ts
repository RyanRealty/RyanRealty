/**
 * One live Active Bend new-construction pull. The named community SET, the
 * map dots, and the photographed homes all read this result so the page cannot
 * show three subdivisions while the map counts a different market.
 */
import { searchListingsAll } from '@/lib/data'
import type { ListingTile } from '@/lib/data/types/listing'
import { formatDateTime } from '@/lib/format/date'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import {
  BEND_NEW_CON_LIVE_SOURCE,
  bendNewConIsSunriverCaldera,
  groupBendNewConLiveTiles,
  type BendNewConLiveGroup,
} from '@/lib/site/bend-new-construction'

export type BendNewConLiveMarket = BendNewConLiveGroup & {
  tiles: ListingTile[]
  bendTiles: ListingTile[]
  source: string
  stamp: string
  incomplete: boolean
  listingsOk: boolean
  rawTotal: number | null
}

function dalReady(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return Boolean(url?.trim() && key?.trim())
}

function emptyMarket(incomplete: boolean): BendNewConLiveMarket {
  return {
    tiles: [],
    bendTiles: [],
    named: [],
    unspecifiedCount: 0,
    excluded: [],
    homeCount: 0,
    namedCount: 0,
    priceMin: null,
    priceMax: null,
    median: null,
    source: BEND_NEW_CON_LIVE_SOURCE,
    stamp: formatDateTime(new Date()),
    incomplete,
    listingsOk: false,
    rawTotal: null,
  }
}

export async function loadBendNewConLiveMarket(): Promise<BendNewConLiveMarket> {
  if (!dalReady()) return emptyMarket(true)

  try {
    const listings = await withTimeoutFallback(
      searchListingsAll({
        city: 'Bend',
        newConstruction: true,
        status: 'active',
        limit: 400,
      }),
      { rows: [] as ListingTile[], totalCount: 0, capped: false, countIsExact: true },
      8000,
      'newcon:live-market',
    )

    const grouped = groupBendNewConLiveTiles(listings.rows)
    const bendTiles = listings.rows.filter(
      (tile) => !bendNewConIsSunriverCaldera(tile.subdivisionName),
    )
    const listingsOk = listings.rows.length > 0 || listings.countIsExact

    return {
      ...grouped,
      tiles: listings.rows,
      bendTiles,
      source: BEND_NEW_CON_LIVE_SOURCE,
      stamp: formatDateTime(new Date()),
      incomplete: !listingsOk || listings.capped,
      listingsOk,
      rawTotal: listingsOk ? listings.totalCount : null,
    }
  } catch (err) {
    console.error('[loadBendNewConLiveMarket]', err)
    return emptyMarket(true)
  }
}
