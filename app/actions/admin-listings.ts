'use server'

import type { ListingTileRow } from './listings'
import type { GetListingTilesFilter } from '@/lib/data/listings/getListingTiles'
import type { ListingTile } from '@/lib/data/types/listing'

const SELECT =
  'ListingKey, ListNumber, ListPrice, BedroomsTotal, BathroomsTotal, StreetNumber, StreetName, City, State, PostalCode, SubdivisionName, PhotoURL, StandardStatus, ModificationTimestamp, OnMarketDate'

export type AdminListingRow = ListingTileRow & { OnMarketDate?: string | null }

export async function getAdminListingsPage(
  page = 0,
  pageSize = 50,
  search?: string,
  status?: string
): Promise<{ rows: AdminListingRow[]; total: number; error: string | null }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !serviceKey?.trim()) {
    return { rows: [], total: 0, error: 'Database is not configured.' }
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
  let tiles: ListingTile[] = []
  let total = 0
  try {
    ;[tiles, total] = await Promise.all([
      getListingTiles(filter),
      getListingTilesCount(filter),
    ])
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Listings read failed'
    console.error('[getAdminListingsPage]', message)
    return { rows: [], total: 0, error: 'The listings database did not answer in time.' }
  }
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
  return { rows, total, error: null }
}


/**
 * Admin-only remarks search: keyword match across PublicRemarks AND
 * PrivateRemarks (on-market listings). private_remarks is readable only by the
 * service role (column-level grant, migration 20260711190000), and this action
 * refuses without a verified admin session — the public surfaces never gain a
 * path to it.
 */
export async function searchAdminRemarksPage(
  query: string,
  page = 0,
  pageSize = 50
): Promise<{ rows: AdminListingRow[]; total: number; privateOnlyKeys: string[]; error: string | null }> {
  const { getAdminContext } = await import('@/lib/auth/guards')
  const ctx = await getAdminContext()
  if (!ctx) return { rows: [], total: 0, privateOnlyKeys: [], error: 'Not signed in.' }

  const { searchAdminListingsRemarks } = await import('@/lib/data')
  let rows
  let totalCount: number
  try {
    ;({ rows, totalCount } = await searchAdminListingsRemarks(query, {
      limit: pageSize,
      offset: page * pageSize,
    }))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Remarks search failed'
    console.error('[searchAdminRemarksPage]', message)
    return { rows: [], total: 0, privateOnlyKeys: [], error: 'The listings database did not answer in time.' }
  }
  const mapped = rows.map((r) => ({
    ListingKey: r.listingKey,
    ListNumber: r.listNumber,
    ListPrice: r.listPrice,
    BedroomsTotal: r.beds,
    BathroomsTotal: r.baths,
    StreetNumber: r.streetNumber,
    StreetName: r.streetName,
    City: r.city,
    State: 'OR',
    PostalCode: r.postalCode,
    SubdivisionName: r.subdivisionName,
    StandardStatus: r.status,
    ModificationTimestamp: r.modifiedAt,
    OnMarketDate: r.onMarketDate,
    PhotoURL: r.photoUrl,
  })) as unknown as AdminListingRow[]
  return {
    rows: mapped,
    total: totalCount,
    privateOnlyKeys: rows
      .filter((r) => r.matchedIn.length === 1 && r.matchedIn[0] === 'private')
      .map((r) => r.listingKey),
    error: null,
  }
}
