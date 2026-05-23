'use server'

import { createClient } from '@supabase/supabase-js'
import { fetchAllRows } from '@/lib/supabase/paginate'
import {
  classifyInventoryPropertyType,
  isActiveForSaleStatus,
} from '@/lib/inventory-filters'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function supabase() {
  if (!url?.trim() || !anonKey?.trim()) throw new Error('Supabase not configured')
  return createClient(url, anonKey)
}

export type InventoryBreakdown = {
  singleFamily: number
  condoTownhome: number
  manufacturedMobile: number
  landLot: number
}

const EMPTY_BREAKDOWN: InventoryBreakdown = {
  singleFamily: 0,
  condoTownhome: 0,
  manufacturedMobile: 0,
  landLot: 0,
}

function parseRpcBreakdown(data: unknown): InventoryBreakdown | null {
  if (!data || typeof data !== 'object') return null
  const o = data as Record<string, unknown>
  const n = (k: string) => {
    const v = o[k]
    const x = typeof v === 'number' ? v : Number(v)
    return Number.isFinite(x) ? Math.max(0, Math.trunc(x)) : 0
  }
  return {
    singleFamily: n('singleFamily'),
    condoTownhome: n('condoTownhome'),
    manufacturedMobile: n('manufacturedMobile'),
    landLot: n('landLot'),
  }
}

function summarizeBuckets(rows: Array<{ PropertyType?: string | null; StandardStatus?: string | null }>): InventoryBreakdown {
  const result: InventoryBreakdown = { ...EMPTY_BREAKDOWN }
  for (const row of rows) {
    if (!isActiveForSaleStatus(row.StandardStatus)) continue
    const bucket = classifyInventoryPropertyType(row.PropertyType)
    if (bucket === 'single_family') result.singleFamily += 1
    else if (bucket === 'condo_townhome') result.condoTownhome += 1
    else if (bucket === 'manufactured_mobile') result.manufacturedMobile += 1
    else if (bucket === 'land_lot') result.landLot += 1
  }
  return result
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function breakdownFromListingsTableScan(buildQuery: (q: any) => any): Promise<InventoryBreakdown> {
  const rows = await fetchAllRows<{ PropertyType?: string | null; StandardStatus?: string | null }>(
    supabase(),
    'listings',
    'PropertyType, StandardStatus',
    buildQuery
  )
  return summarizeBuckets(rows)
}

export async function getCityInventoryBreakdown(cityName: string): Promise<InventoryBreakdown> {
  const sb = supabase()
  const { data, error } = await sb.rpc('inventory_breakdown_for_city', { p_city: cityName.trim() })
  if (!error) {
    const parsed = parseRpcBreakdown(data)
    if (parsed) return parsed
  } else {
    console.error('[getCityInventoryBreakdown] rpc', error.message)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return breakdownFromListingsTableScan((q: any) =>
    q
      .eq('"City"', cityName)
      .or('StandardStatus.is.null,StandardStatus.ilike.%Active%,StandardStatus.ilike.%For Sale%,StandardStatus.ilike.%Coming Soon%')
  )
}

export async function getCommunityInventoryBreakdown(cityName: string, subdivisionName: string): Promise<InventoryBreakdown> {
  const sb = supabase()
  const { data, error } = await sb.rpc('inventory_breakdown_for_community', {
    p_city: cityName.trim(),
    p_subdivision: subdivisionName.trim(),
  })
  if (!error) {
    const parsed = parseRpcBreakdown(data)
    if (parsed) return parsed
  } else {
    console.error('[getCommunityInventoryBreakdown] rpc', error.message)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return breakdownFromListingsTableScan((q: any) =>
    q
      .eq('"City"', cityName)
      .eq('"SubdivisionName"', subdivisionName)
      .or('StandardStatus.is.null,StandardStatus.ilike.%Active%,StandardStatus.ilike.%For Sale%,StandardStatus.ilike.%Coming Soon%')
  )
}

export async function getNeighborhoodInventoryBreakdown(neighborhoodId: string): Promise<InventoryBreakdown> {
  const sb = supabase()
  const { data, error } = await sb.rpc('inventory_breakdown_for_neighborhood', {
    p_neighborhood_id: neighborhoodId,
  })
  if (!error) {
    const parsed = parseRpcBreakdown(data)
    if (parsed) return parsed
  } else {
    console.error('[getNeighborhoodInventoryBreakdown] rpc', error.message)
  }
  void sb
  void fetchAllRows
  const { getNeighborhoodNameById, getListingTiles } = await import('@/lib/data')
  const neighborhoodName = await getNeighborhoodNameById(neighborhoodId)
  if (!neighborhoodName) return { ...EMPTY_BREAKDOWN }
  const tiles = await getListingTiles({
    neighborhood: neighborhoodName,
    status: 'active',
    limit: 5000,
  })
  const rows = tiles.map((t) => ({
    PropertyType: t.propertyType,
    StandardStatus: t.status,
  }))
  return summarizeBuckets(rows)
}
