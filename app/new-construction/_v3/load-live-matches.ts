/**
 * Live Active new-construction matches for the exclusive search each
 * community door opens. Count is null when the DAL is missing or the
 * read fails — the page then says See homes, never an invented zero.
 */
import { searchListingsAll, searchListingsAllCount } from '@/lib/data'
import {
  BEND_NEW_CON_SFR_SUBTYPE,
  BEND_NEW_CON_STEVENS_RANCH_TOWNHOMES,
  bendNewConSearchFilter,
  bendNewConSearchHref,
  bendNewConStevensRanchSfHref,
  bendNewConStevensRanchTownhomeHref,
  type NewConInventoryRow,
} from '@/lib/site/bend-new-construction'
import type { ListingTile } from '@/lib/data/types/listing'
import type { SearchListingsAllFilter } from '@/lib/data/listings/searchListingsAll'

export type BendNewConLiveMatch = {
  href: string
  count: number | null
}

function dalReady(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return Boolean(url?.trim() && key?.trim())
}

async function liveCount(filter: SearchListingsAllFilter): Promise<number | null> {
  if (!dalReady()) return null
  try {
    const count = await searchListingsAllCount(filter)
    return Number.isFinite(count) ? count : null
  } catch (err) {
    console.error('[loadBendNewConLiveMatch]', err)
    return null
  }
}

export async function loadBendNewConLiveMatch(
  subdivision: string | null,
  extra?: { propertySubType?: string },
): Promise<BendNewConLiveMatch> {
  return {
    href: bendNewConSearchHref(subdivision, extra),
    count: await liveCount(bendNewConSearchFilter(subdivision, extra)),
  }
}

export function stevensRanchSfExtra(): { propertySubType: string } {
  return { propertySubType: BEND_NEW_CON_SFR_SUBTYPE }
}

export function stevensRanchTownhomeExtra(): { propertySubType: string } {
  return { propertySubType: BEND_NEW_CON_STEVENS_RANCH_TOWNHOMES.propertySubType }
}

export async function loadStevensRanchSfMatch(): Promise<BendNewConLiveMatch> {
  return {
    href: bendNewConStevensRanchSfHref(),
    count: await liveCount(bendNewConSearchFilter('Stevens Ranch', stevensRanchSfExtra())),
  }
}

export async function loadStevensRanchTownhomeMatch(): Promise<BendNewConLiveMatch> {
  return {
    href: bendNewConStevensRanchTownhomeHref(),
    count: await liveCount(bendNewConSearchFilter('Stevens Ranch', stevensRanchTownhomeExtra())),
  }
}

/** Photographed SFR cards for the lead shelf — same NC + place filter as the door, SFR-only for the fold. */
export async function loadLeadShelfTiles(row: NewConInventoryRow): Promise<ListingTile[]> {
  if (!dalReady()) return []
  try {
    const result = await searchListingsAll({
      ...bendNewConSearchFilter(row.name),
      propertySubType: BEND_NEW_CON_SFR_SUBTYPE,
      sort: 'price_asc',
      limit: 12,
    })
    return result.rows
  } catch (err) {
    console.error('[loadLeadShelfTiles]', err)
    return []
  }
}
