/**
 * CMA builder reads — the deterministic CMA engine's only door to the database.
 *
 * lib/cma/** (the builder) is NOT a write-path prefix for the DAL boundary, so
 * every listings / market_stats_cache / market_pulse_live read it needs lives
 * here. Service-role client: the builder runs from crons and admin actions,
 * never from a consumer page.
 */

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createServiceClient()
}

/** Wide listings projection the CMA builder consumes for subject + comps.
 *  Mixed-case RETS columns are selected by exact name (PostgREST style). */
const LISTING_CMA_COLUMNS = [
  'ListingKey',
  'ListNumber',
  'StreetNumber',
  'StreetName',
  'City',
  'State',
  'PostalCode',
  'SubdivisionName',
  'Latitude',
  'Longitude',
  'PropertyType',
  'property_sub_type',
  'StandardStatus',
  'ListPrice',
  'OriginalListPrice',
  'ClosePrice',
  'CloseDate',
  'OnMarketDate',
  'ListDate',
  'ModificationTimestamp',
  'PhotoURL',
  'BedroomsTotal',
  'BathroomsTotal',
  'TotalLivingAreaSqFt',
  'year_built',
  'lot_size_acres',
  'garage_spaces',
  'public_remarks',
  'view_description',
  'tax_annual_amount',
  'DaysOnMarket',
  'CumulativeDaysOnMarket',
  'days_to_pending',
  'pending_timestamp',
  'status_change_timestamp',
  'ListAgentName',
  'list_agent_email',
  'photos_count',
].join(', ')

export type CmaListingRow = Record<string, unknown>

/** Resolve candidate subject rows by MLS number / ListingKey. */
export async function findCmaSubjectByMls(mls: string): Promise<CmaListingRow[]> {
  const sb = client()
  if (!sb) return []
  const key = mls.trim()
  if (!key) return []
  const { data, error } = await sb
    .from('listings')
    .select(LISTING_CMA_COLUMNS)
    .or(`ListNumber.eq.${key},ListingKey.eq.${key}`)
    .order('ModificationTimestamp', { ascending: false })
    .limit(5)
  if (error) {
    console.error('[findCmaSubjectByMls]', error.message)
    return []
  }
  return (data ?? []) as unknown as CmaListingRow[]
}

/** Resolve candidate subject rows by street number + street-name prefix + city. */
export async function findCmaSubjectByAddress(opts: {
  streetNumber: string
  streetNameIlike: string
  cityIlike?: string | null
  postalCode?: string | null
}): Promise<CmaListingRow[]> {
  const sb = client()
  if (!sb) return []
  let q = sb
    .from('listings')
    .select(LISTING_CMA_COLUMNS)
    .eq('StreetNumber', opts.streetNumber)
    .ilike('StreetName', opts.streetNameIlike)
  if (opts.cityIlike?.trim()) q = q.ilike('City', opts.cityIlike.trim())
  if (opts.postalCode?.trim()) q = q.eq('PostalCode', opts.postalCode.trim())
  const { data, error } = await q
    .order('ModificationTimestamp', { ascending: false })
    .limit(10)
  if (error) {
    console.error('[findCmaSubjectByAddress]', error.message)
    return []
  }
  return (data ?? []) as unknown as CmaListingRow[]
}

/** Closed SFR comp pool for one selection tier. The builder composes tiers. */
export async function selectCmaCompsPool(opts: {
  cityIlike: string
  subdivisionIlike?: string | null
  postalCode?: string | null
  closeDateGte: string
  sqftMin: number
  sqftMax: number
  lotMin?: number | null
  lotMax?: number | null
  limit?: number
}): Promise<CmaListingRow[]> {
  const sb = client()
  if (!sb) return []
  let q = sb
    .from('listings')
    .select(LISTING_CMA_COLUMNS)
    .ilike('StandardStatus', '%Closed%')
    .not('CloseDate', 'is', null)
    .gte('CloseDate', opts.closeDateGte)
    .eq('PropertyType', 'A')
    .gt('ClosePrice', 0)
    .gte('TotalLivingAreaSqFt', opts.sqftMin)
    .lte('TotalLivingAreaSqFt', opts.sqftMax)
    .ilike('City', opts.cityIlike)
  if (opts.subdivisionIlike?.trim()) q = q.ilike('SubdivisionName', opts.subdivisionIlike.trim())
  if (opts.postalCode?.trim()) q = q.eq('PostalCode', opts.postalCode.trim())
  if (opts.lotMin != null) q = q.gte('lot_size_acres', opts.lotMin)
  if (opts.lotMax != null) q = q.lte('lot_size_acres', opts.lotMax)
  const { data, error } = await q
    .order('CloseDate', { ascending: false })
    .limit(Math.min(Math.max(opts.limit ?? 50, 1), 100))
  if (error) {
    console.error('[selectCmaCompsPool]', error.message)
    return []
  }
  return (data ?? []) as unknown as CmaListingRow[]
}

export type CmaMarketStatsRow = {
  geo_type: string
  geo_slug: string
  geo_label: string | null
  period_start: string
  period_end: string
  sold_count: number
  median_sale_price: number | null
  median_dom: number | null
  median_ppsf: number | null
  median_price_per_sqft_closed: number | null
  avg_sale_to_list_ratio: number | null
  yoy_median_price_delta_pct: number | null
  end_of_period_inventory: number | null
  methodology_version: string | null
  computed_at: string
}

/** Latest rolling_365d market_stats_cache row for the first matching geo slug.
 *  Callers pass both slug spellings ('la-pine' + 'la pine') — the cache carries
 *  both historically. */
export async function getCmaMarketStatsRow(geoSlugs: string[]): Promise<CmaMarketStatsRow | null> {
  const sb = client()
  if (!sb || geoSlugs.length === 0) return null
  const { data, error } = await sb
    .from('market_stats_cache')
    .select(
      'geo_type, geo_slug, geo_label, period_start, period_end, sold_count, median_sale_price, median_dom, median_ppsf, median_price_per_sqft_closed, avg_sale_to_list_ratio, yoy_median_price_delta_pct, end_of_period_inventory, methodology_version, computed_at',
    )
    .in('geo_slug', geoSlugs)
    .eq('geo_type', 'city')
    .eq('period_type', 'rolling_365d')
    .order('period_end', { ascending: false })
    .order('computed_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error('[getCmaMarketStatsRow]', error.message)
    return null
  }
  return (data ?? null) as CmaMarketStatsRow | null
}

export type CmaMarketPulseRow = {
  geo_slug: string
  active_count: number | null
  pending_count: number | null
  median_list_price: number | null
  /** Canonical published MoS (active / (closed_6mo / 6)) — same figure the site shows. */
  months_of_supply: number | null
  updated_at: string | null
}

/** Live pulse (active inventory) for the subject city, SFR only. */
export async function getCmaMarketPulseRow(geoSlugs: string[]): Promise<CmaMarketPulseRow | null> {
  const sb = client()
  if (!sb || geoSlugs.length === 0) return null
  const { data, error } = await sb
    .from('market_pulse_live')
    .select('geo_slug, active_count, pending_count, median_list_price, months_of_supply, updated_at')
    .in('geo_slug', geoSlugs)
    .eq('geo_type', 'city')
    .eq('property_type', 'A')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error('[getCmaMarketPulseRow]', error.message)
    return null
  }
  return (data ?? null) as CmaMarketPulseRow | null
}

/** Active broker row for the CMA signature block. */
export async function getCmaBrokerBySlugOrEmail(opts: {
  slug?: string | null
  email?: string | null
}): Promise<Record<string, unknown> | null> {
  const sb = client()
  if (!sb) return null
  const cols = 'id, slug, display_name, title, license_number, email, phone, photo_url, is_active'
  if (opts.slug?.trim()) {
    const { data } = await sb.from('brokers').select(cols).eq('slug', opts.slug.trim()).eq('is_active', true).maybeSingle()
    if (data) return data as Record<string, unknown>
  }
  if (opts.email?.trim()) {
    const { data } = await sb.from('brokers').select(cols).ilike('email', opts.email.trim()).eq('is_active', true).maybeSingle()
    if (data) return data as Record<string, unknown>
  }
  return null
}

/** All active brokers (admin build form select). */
export async function listActiveBrokersForCma(): Promise<Array<Record<string, unknown>>> {
  const sb = client()
  if (!sb) return []
  const { data } = await sb
    .from('brokers')
    .select('id, slug, display_name, title, license_number, email, phone, photo_url')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  return (data ?? []) as Array<Record<string, unknown>>
}
