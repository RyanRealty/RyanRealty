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
  const supabase = createClient(url, serviceKey)
  let query = supabase.from('listings').select(SELECT, { count: 'exact' })
  if (status && status !== 'all') {
    if (status === 'Active') query = query.or('StandardStatus.is.null,StandardStatus.ilike.%Active%,StandardStatus.ilike.%For Sale%,StandardStatus.ilike.%Coming Soon%')
    else if (status === 'Pending') query = query.ilike('StandardStatus', '%Pending%')
    else if (status === 'Closed') query = query.ilike('StandardStatus', '%Closed%')
    else query = query.ilike('StandardStatus', `%${status}%`)
  }
  if (search && search.trim()) {
    const term = `%${search.trim()}%`
    query = query.or(`ListingKey.ilike.${term},ListNumber.ilike.${term},StreetNumber.ilike.${term},StreetName.ilike.${term},City.ilike.${term},SubdivisionName.ilike.${term}`)
  }
  const from = page * pageSize
  const { data, count, error } = await query
    .order('ModificationTimestamp', { ascending: false })
    .range(from, from + pageSize - 1)
  if (error) return { rows: [], total: 0 }
  return { rows: (data ?? []) as AdminListingRow[], total: count ?? 0 }
}
