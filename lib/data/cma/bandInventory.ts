/**
 * Live competition in the subject's list-price band.
 * Per docs/DATABASE_FOR_AI_AGENTS.md §4: SFR is PropertyType='A'.
 * Names the houses. Does not dump the city.
 */

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

const BAND_SELECT = [
  'ListingKey',
  'StreetNumber',
  'StreetName',
  'ListPrice',
  'StandardStatus',
  'DaysOnMarket',
  'PhotoURL',
  'Latitude',
  'Longitude',
  'BedroomsTotal',
  'BathroomsTotal',
  'TotalLivingAreaSqFt',
  'SubdivisionName',
  'year_built',
  'lot_size_acres',
  'property_sub_type',
  'association_yn',
  'association_fee',
  'hoa_monthly',
  'water',
  'sewer',
  'levels',
  'new_construction_yn',
].join(', ')

export type CmaBandListingRow = {
  ListingKey: string
  StreetNumber: string | null
  StreetName: string | null
  ListPrice: number | null
  StandardStatus: string | null
  DaysOnMarket: number | null
  PhotoURL: string | null
  Latitude: number | null
  Longitude: number | null
  BedroomsTotal?: number | null
  BathroomsTotal?: number | null
  TotalLivingAreaSqFt?: number | null
  SubdivisionName?: string | null
  year_built?: number | null
  lot_size_acres?: number | null
  property_sub_type?: string | null
  association_yn?: boolean | null
  association_fee?: number | null
  hoa_monthly?: number | null
  water?: unknown
  sewer?: unknown
  levels?: unknown
  new_construction_yn?: boolean | null
}

export type CmaBandInventory = {
  activeAsks: number[]
  activeDaysOnMarket: number[]
  pendingCount: number
  activeRows: CmaBandListingRow[]
  pendingRows: CmaBandListingRow[]
}

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createServiceClient()
}

function asRows(data: unknown): CmaBandListingRow[] {
  return (Array.isArray(data) ? data : []) as CmaBandListingRow[]
}

export async function getCmaBandInventory(
  city: string,
  lo: number,
  hi: number,
  opts?: { sqftMin?: number; sqftMax?: number; limit?: number },
): Promise<CmaBandInventory | null> {
  const sb = client()
  if (!sb) return null
  const limit = Math.min(opts?.limit ?? 200, 400)
  const scoped = (status: 'Active' | 'Pending') => {
    let q = sb
      .from('listings')
      .select(BAND_SELECT, { count: 'exact' })
      .eq('City', city)
      .eq('PropertyType', 'A')
      .eq('StandardStatus', status)
      .gte('ListPrice', lo)
      .lte('ListPrice', hi)
    if (opts?.sqftMin != null) q = q.gte('TotalLivingAreaSqFt', opts.sqftMin)
    if (opts?.sqftMax != null) q = q.lte('TotalLivingAreaSqFt', opts.sqftMax)
    return q.limit(limit)
  }
  const [actives, pendings] = await Promise.all([scoped('Active'), scoped('Pending')])
  if (actives.error || pendings.error) {
    console.error('[getCmaBandInventory]', actives.error?.message ?? pendings.error?.message)
    return null
  }
  const activeRows = asRows(actives.data)
  const pendingRows = asRows(pendings.data)
  return {
    activeAsks: activeRows.map((r) => Number(r.ListPrice)).filter((n) => Number.isFinite(n) && n > 0),
    activeDaysOnMarket: activeRows
      .map((r) => Number(r.DaysOnMarket))
      .filter((n) => Number.isFinite(n) && n >= 0),
    pendingCount: pendings.count ?? pendingRows.length,
    activeRows,
    pendingRows,
  }
}
