/**
 * Live competition in the subject's list-price band.
 * Per docs/DATABASE_FOR_AI_AGENTS.md §4: PropertyType='A' is the MLS
 * residential bucket, not "detached house." Townhouses and condos sit
 * in A. Same property_sub_type only.
 */

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

const BAND_SELECT =
  'ListingKey, StreetNumber, StreetName, ListPrice, StandardStatus, DaysOnMarket, PhotoURL, Latitude, Longitude, property_sub_type'

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
  property_sub_type?: string | null
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
  subjectSubType?: string | null,
): Promise<CmaBandInventory | null> {
  const sb = client()
  if (!sb) return null
  const subType = subjectSubType?.trim() || null
  const scoped = (status: 'Active' | 'Pending') => {
    let q = sb
      .from('listings')
      .select(BAND_SELECT, { count: 'exact' })
      .eq('City', city)
      .eq('PropertyType', 'A')
      .eq('StandardStatus', status)
      .gte('ListPrice', lo)
      .lte('ListPrice', hi)
    if (subType) q = q.eq('property_sub_type', subType)
    return q.limit(40)
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
