'use server'

import { createClient } from '@supabase/supabase-js'
import type { ListingTileRow } from './listings'

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
  void createClient
  void SELECT
  // DAL: admin listings list via listing_tile_mv. Filters: status bucket +
  // free-text searchQuery. Result count derived from result.length given the
  // MV-sized result set is small enough for admin paging.
  const { getListingTiles } = await import('@/lib/data')
  const dalStatus =
    status === 'Active' ? 'active' :
    status === 'Pending' ? 'pending-only' :
    status === 'Closed' ? 'closed' :
    'all'
  const from = page * pageSize
  const tiles = await getListingTiles({
    status: dalStatus,
    searchQuery: search?.trim() ? search.trim() : undefined,
    // scope:'all' — the admin listing browser intentionally covers the full
    // statewide feed (the default service-area guard would hide out-of-area
    // rows admins may need to inspect; audit P0-3).
    scope: 'all',
    sort: 'newest',
    limit: from + pageSize,
  })
  const rows = tiles.slice(from, from + pageSize).map((t) => ({
    ListingKey: t.listingKey,
    ListNumber: t.listNumber,
    ListPrice: t.listPrice,
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
  return { rows, total: tiles.length }
}
