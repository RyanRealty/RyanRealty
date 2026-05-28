/**
 * getPriceDropTiles — list active listings with a documented price drop.
 *
 * Reads OriginalListPrice + total_price_change_pct from the `listings` table
 * because the materialized view only projects `price_drop_count`, not the
 * dollar/percent savings. Sorted by `total_price_change_pct` ascending (most-
 * negative first = biggest drops first).
 *
 * Lives behind the DAL boundary so the homepage price-drops tile picker
 * doesn't poke `listings` directly.
 */

import { supabaseAnon } from '@/lib/data/client'

const ACTIVE_OR =
  'StandardStatus.is.null,StandardStatus.ilike.%Active%,StandardStatus.ilike.%For Sale%,StandardStatus.ilike.%Coming Soon%'

const PROJECTION = [
  'ListingKey, ListNumber, ListPrice, OriginalListPrice, BedroomsTotal, BathroomsTotal',
  'TotalLivingAreaSqFt, StreetNumber, StreetName, City, State, PostalCode, SubdivisionName',
  'PhotoURL, StandardStatus, OnMarketDate, CloseDate, ClosePrice',
  'ListAgentName, ListOfficeName',
  'has_virtual_tour, virtual_tour_url',
  'year_built, price_per_sqft, lot_size_acres, garage_spaces, pool_yn',
  'estimated_monthly_piti, price_drop_count, DaysOnMarket, total_price_change_pct',
].join(', ')

export type PriceDropTile = {
  ListingKey: string | null
  ListNumber: string | null
  ListPrice: number | null
  OriginalListPrice: number | null
  BedroomsTotal: number | null
  BathroomsTotal: number | null
  TotalLivingAreaSqFt: number | null
  StreetNumber: string | null
  StreetName: string | null
  City: string | null
  State: string | null
  PostalCode: string | null
  SubdivisionName: string | null
  PhotoURL: string | null
  StandardStatus: string | null
  OnMarketDate: string | null
  CloseDate: string | null
  ClosePrice: number | null
  ListAgentName: string | null
  ListOfficeName: string | null
  has_virtual_tour: boolean | null
  virtual_tour_url: string | null
  year_built: number | null
  price_per_sqft: number | null
  lot_size_acres: number | null
  garage_spaces: number | null
  pool_yn: boolean | null
  estimated_monthly_piti: number | null
  price_drop_count: number | null
  DaysOnMarket: number | null
  total_price_change_pct: number | null
}

/**
 * Active listings with `price_drop_count > 0`, ordered by biggest-percent-drop
 * first. Optional city filter (case-sensitive equality on PascalCase `City`).
 */
/**
 * Active+Pending+Closed listings for a brokerage by ListOfficeName ILIKE.
 * Excludes Cancelled/Withdrawn rows and rows missing a primary photo.
 * Reads from `listings` directly inside the DAL boundary because the
 * tile materialized view doesn't project ListOfficeName.
 */
export async function getBrokerageListingTiles(options: {
  officeName: string
  limit?: number
}): Promise<PriceDropTile[]> {
  const sb = supabaseAnon()
  if (!sb || !options.officeName?.trim()) return []
  const limit = Math.min(Math.max(options.limit ?? 30, 1), 100)
  const { data, error } = await sb
    .from('listings')
    .select(PROJECTION)
    .ilike('ListOfficeName', `%${options.officeName.trim()}%`)
    .not('StandardStatus', 'ilike', '%Cancel%')
    .not('StandardStatus', 'ilike', '%Withdraw%')
    .not('PhotoURL', 'is', null)
    .order('ModificationTimestamp', { ascending: false })
    .limit(limit)
  if (error) return []
  return (data ?? []) as unknown as PriceDropTile[]
}

export async function getPriceDropTiles(options?: {
  city?: string | null
  limit?: number
}): Promise<PriceDropTile[]> {
  const sb = supabaseAnon()
  if (!sb) return []
  const limit = Math.min(Math.max(options?.limit ?? 6, 1), 50)
  let query = sb
    .from('listings')
    .select(PROJECTION)
    .or(ACTIVE_OR)
    .not('ListPrice', 'is', null)
    .gt('price_drop_count', 0)
    .order('total_price_change_pct', { ascending: true })
    .limit(limit)
  if (options?.city?.trim()) query = query.eq('City', options.city.trim())
  const { data, error } = await query
  if (error) return []
  return (data ?? []) as unknown as PriceDropTile[]
}
