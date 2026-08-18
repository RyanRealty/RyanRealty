/**
 * getBendNeighborhoodLedger — live per-neighborhood active count + median
 * list price for `/neighborhoods`, `/cities/bend` district tiles, and peers.
 *
 * SoR is `getBendNeighborhoodPublicInventory` (listing_boundary_xref_mv,
 * SFR + PUBLIC_ACTIVE, `public.boundaries` polygon). That is the same
 * population the place-page hero, FAQ, and Field list. Do not reintroduce
 * `listing_tile_mv.boundary_neighborhood` or `market_pulse_live.active_count`
 * as a second public "Active" figure — those were the 52 / 62 / 63 split
 * on Awbrey Butte (2026-08-16 fleet finding).
 */

import {
  getBendNeighborhoodPublicInventory,
  type NeighborhoodPublicInventory,
} from '@/lib/data/geo/neighborhood-public-inventory'

export {
  BEND_NEIGHBORHOOD_DISTRICTS,
  bendNeighborhoodCanonicalHref,
} from '@/lib/data/geo/neighborhood-public-inventory'

export type NeighborhoodLedgerRow = {
  label: string
  activeCount: number
  medianListPrice: number | null
  href: string
}

function toLedgerRow(row: NeighborhoodPublicInventory): NeighborhoodLedgerRow {
  return {
    label: row.label,
    activeCount: row.activeCount,
    medianListPrice: row.medianListPrice,
    href: row.href,
  }
}

/**
 * Districts with measured inventory only. A degraded batch (`[]`) stays empty
 * so callers cannot `?? 0` a timeout into thirteen fake zeros (city-places
 * invariant 4). A district that rolled up to 0 is a measured empty and is
 * omitted from the index the same way.
 */
export async function getBendNeighborhoodLedger(): Promise<NeighborhoodLedgerRow[]> {
  const rows = await getBendNeighborhoodPublicInventory()
  return rows.filter((r) => r.activeCount > 0).map(toLedgerRow)
}
