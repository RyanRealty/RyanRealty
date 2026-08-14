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
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { SERVICE_AREA_CITIES_PROPER } from '@/lib/data/listings/service-area'
import { isActiveStatus, isPendingStatus, isClosedStatus } from '@/lib/listing-status'
import { PUBLIC_ACTIVE_OR_PREDICATE } from '@/lib/listing-status-public'

const ACTIVE_OR =
  PUBLIC_ACTIVE_OR_PREDICATE

const PROJECTION = [
  'ListingKey, ListNumber, ListPrice, OriginalListPrice, BedroomsTotal, BathroomsTotal',
  'TotalLivingAreaSqFt, StreetNumber, StreetName, StreetSuffix:details->>StreetSuffix, City, State, PostalCode, SubdivisionName',
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
  StreetSuffix?: string | null
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
  Latitude?: number | null
  Longitude?: number | null
}

/**
 * Exact office-name candidates for an index hit on ListOfficeName.
 * Leading-wildcard ILIKE '%Ryan Realty%' cannot use idx_listings_list_office_name
 * and times out the anon 3s statement window, which the old wrapper cached as [].
 */
export function brokerageOfficeNames(officeName: string): string[] {
  const trimmed = officeName.trim()
  if (!trimmed) return []
  const names = [trimmed]
  if (!/\bllc\b/i.test(trimmed)) names.push(`${trimmed} LLC`)
  return names
}

/** Empty only when both query shapes are empty. One miss is not zero. */
export function chooseBrokerageRows<T>(primary: readonly T[], secondary: readonly T[]): T[] {
  if (primary.length > 0) return [...primary]
  return [...secondary]
}

export function sortBrokerageListings(rows: readonly PriceDropTile[]): PriceDropTile[] {
  const order = (s: string | null | undefined): number => {
    if (isActiveStatus(s)) return 1
    if (isPendingStatus(s)) return 2
    if (isClosedStatus(s)) return 3
    return 4
  }
  return [...rows].sort((a, b) => order(a.StandardStatus) - order(b.StandardStatus))
}

const BROKERAGE_PROJECTION = [
  'ListingKey, ListNumber, ListPrice, OriginalListPrice, BedroomsTotal, BathroomsTotal',
  'TotalLivingAreaSqFt, StreetNumber, StreetName, City, State, PostalCode, SubdivisionName',
  'PhotoURL, StandardStatus, OnMarketDate, CloseDate, ClosePrice',
  'ListAgentName, ListOfficeName',
  'has_virtual_tour, virtual_tour_url',
  'year_built, price_per_sqft, lot_size_acres, garage_spaces, pool_yn',
  'estimated_monthly_piti, price_drop_count, DaysOnMarket, total_price_change_pct',
  'Latitude, Longitude',
].join(', ')

/**
 * Active+Pending+Closed listings for a brokerage by exact ListOfficeName.
 * Excludes Cancelled/Withdrawn rows and rows missing a primary photo.
 * Typed columns only — details->> plus a leading-wildcard ILIKE times out
 * the anon 3s window on this table.
 */
export async function getBrokerageListingTiles(options: {
  officeName: string
  limit?: number
}): Promise<PriceDropTile[]> {
  const sb = supabaseAnon()
  if (!sb || !options.officeName?.trim()) return []
  const names = brokerageOfficeNames(options.officeName)
  if (names.length === 0) return []
  const limit = Math.min(Math.max(options.limit ?? 30, 1), 100)
  const { data, error } = await sb
    .from('listings')
    .select(BROKERAGE_PROJECTION)
    .in('ListOfficeName', names)
    .not('permit_internet_yn', 'is', false) // IDX: seller internet opt-out
    .not('idx_participant', 'is', false) // IDX: listing broker not a participant
    .not('StandardStatus', 'ilike', '%Cancel%')
    .not('StandardStatus', 'ilike', '%Withdraw%')
    .not('PhotoURL', 'is', null)
    .order('ModificationTimestamp', { ascending: false })
    .limit(limit)
  if (error) return []
  return (data ?? []) as unknown as PriceDropTile[]
}

const ON_MARKET_STATUSES = ['Active', 'Pending', 'Active Under Contract'] as const

async function fetchBrokerageOnMarketByExactOffice(
  names: string[],
  limit: number,
): Promise<PriceDropTile[]> {
  const sb = supabaseAnon()
  if (!sb) throw new Error('[getBrokerageListings] supabase anon client missing')
  const { data, error } = await sb
    .from('listings')
    .select(BROKERAGE_PROJECTION)
    .in('ListOfficeName', names)
    .in('StandardStatus', [...ON_MARKET_STATUSES])
    .eq('PropertyType', 'A')
    .not('permit_internet_yn', 'is', false)
    .not('idx_participant', 'is', false)
    .order('ModificationTimestamp', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`[getBrokerageListings] exact office: ${error.message}`)
  return (data ?? []) as unknown as PriceDropTile[]
}

async function fetchBrokerageOnMarketByPrefix(
  prefix: string,
  limit: number,
): Promise<PriceDropTile[]> {
  const sb = supabaseAnon()
  if (!sb) throw new Error('[getBrokerageListings] supabase anon client missing')
  const { data, error } = await sb
    .from('listings')
    .select(BROKERAGE_PROJECTION)
    .ilike('ListOfficeName', `${prefix}%`)
    .in('StandardStatus', ['Active', 'Pending'])
    .eq('PropertyType', 'A')
    .not('permit_internet_yn', 'is', false)
    .not('idx_participant', 'is', false)
    .order('ModificationTimestamp', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`[getBrokerageListings] prefix office: ${error.message}`)
  return (data ?? []) as unknown as PriceDropTile[]
}

/**
 * On-market SFR for one office. Two query shapes before empty: exact
 * ListOfficeName (index) then prefix ILIKE with no leading wildcard.
 * Typed columns only — details->> times out the anon role on this table.
 * Throws on a DB error so makeResilientCached never caches a poison [].
 */
async function _getBrokerageListingsUncached(
  officeName: string = 'Ryan Realty',
): Promise<PriceDropTile[]> {
  const names = brokerageOfficeNames(officeName)
  if (names.length === 0) return []
  const primary = await fetchBrokerageOnMarketByExactOffice(names, 30)
  if (primary.length > 0) return sortBrokerageListings(primary)
  const secondary = await fetchBrokerageOnMarketByPrefix(names[0]!, 30)
  return sortBrokerageListings(chooseBrokerageRows(primary, secondary))
}

export const getBrokerageListings = makeResilientCached(
  _getBrokerageListingsUncached,
  ['brokerage-listings-v2'],
  { revalidate: 300, tags: ['brokerage-listings'] },
  [],
)

/**
 * Active listings with `price_drop_count > 0`, ordered by biggest-percent-drop
 * first. Optional city filter (case-sensitive equality on PascalCase `City`).
 */
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
    .not('permit_internet_yn', 'is', false) // IDX: seller internet opt-out
    .not('idx_participant', 'is', false) // IDX: listing broker not a participant
    .not('ListPrice', 'is', null)
    // Sanity floor (design-audit P1): fractional-share / glitch rows list at
    // $1K-$2K and would headline the biggest-drop sort.
    .gte('ListPrice', 50_000)
    .gt('price_drop_count', 0)
    .order('total_price_change_pct', { ascending: true })
    .limit(limit)
  if (options?.city?.trim()) query = query.eq('City', options.city.trim())
  // Service-area guard (audit P0-3 2026-06-10): the feed is statewide, so the
  // no-city pull scopes to the Central Oregon allowlist.
  else query = query.in('City', SERVICE_AREA_CITIES_PROPER as string[])
  const { data, error } = await query
  if (error) return []
  return (data ?? []) as unknown as PriceDropTile[]
}
