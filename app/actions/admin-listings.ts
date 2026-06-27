'use server'

import type { ListingTileRow } from './listings'
import type { GetListingTilesFilter } from '@/lib/data/listings/getListingTiles'

const SELECT =
  'ListingKey, ListNumber, ListPrice, BedroomsTotal, BathroomsTotal, StreetNumber, StreetName, City, State, PostalCode, SubdivisionName, PhotoURL, StandardStatus, ModificationTimestamp, OnMarketDate'

export type AdminListingRow = ListingTileRow & { OnMarketDate?: string | null }

export async function getAdminListingsPage(
  page = 0,
  pageSize = 50,
  search?: string,
  status?: string
): Promise<{ rows: AdminListingRow[]; total: number }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !serviceKey?.trim()) {
    return { rows: [], total: 0 }
  }
  void SELECT
  // DAL: admin listings list via listing_tile_mv. Filters: status bucket +
  // free-text searchQuery.
  // P2-1 fix: use getListingTilesCount() for the true total instead of
  // tiles.length (which was always ≤ pageSize, permanently stuck on page 1).
  const { getListingTiles, getListingTilesCount } = await import('@/lib/data')
  const dalStatus = (
    status === 'Active' ? 'active' :
    status === 'Pending' ? 'pending-only' :
    status === 'Closed' ? 'closed' :
    'all'
  ) as 'active' | 'pending-only' | 'closed' | 'all'
  const from = page * pageSize
  const filter: GetListingTilesFilter = {
    status: dalStatus,
    searchQuery: search?.trim() ? search.trim() : undefined,
    // scope:'all' — the admin listing browser intentionally covers the full
    // statewide feed (the default service-area guard would hide out-of-area
    // rows admins may need to inspect; audit P0-3).
    scope: 'all',
    sort: 'newest',
    limit: pageSize,
    offset: from,
  }
  const [tiles, total] = await Promise.all([
    getListingTiles(filter),
    getListingTilesCount(filter),
  ])
  const rows = tiles.map((t) => ({
    ListingKey: t.listingKey,
    ListNumber: t.listNumber,
    ListPrice: t.listPrice,
    // P2-2 fix: include beds/baths in the row mapping (were missing, causing
    // BedroomsTotal and BathroomsTotal to always show — on every listing).
    BedroomsTotal: t.beds,
    BathroomsTotal: t.baths,
    StreetNumber: t.streetNumber,
    StreetName: t.streetName,
    City: t.city,
    State: 'OR',
    PostalCode: t.postalCode,
    SubdivisionName: t.subdivisionName,
    StandardStatus: t.status,
    ModificationTimestamp: t.modifiedAt,
    OnMarketDate: t.onMarketDate,
    CloseDate: t.closeDate,
    PhotoURL: t.photoUrl,
  })) as unknown as AdminListingRow[]
  return { rows, total }
}
