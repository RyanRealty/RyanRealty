/**
 * getAtlasTiles — the Atlas population, read lean and read whole.
 *
 * The living map needs every public on-market listing with a coordinate plus
 * the month's closes, for a scope (the whole service area, one city, or the
 * MLS cities a resort spans). Reading that through getListingTiles cost six
 * offset-paged, 40-column, newest-sorted requests per render and timed out
 * at the statement limit on the closed window (`sort: close-newest` over a
 * `close_date >=` filter) — and the resilient wrapper turned each timeout
 * into an EMPTY page, so a short population printed as the market with no
 * error (evaluator pass two, N10; dev logs 2026-09-01).
 *
 * This read is shaped for the job:
 *   - fourteen columns, not forty; no photo, no address slug, no sqft
 *   - keyset pagination on listing_key (the MV's primary order), never
 *     OFFSET, so page five costs what page one costs
 *   - two reads instead of one OR: the on-market statuses from the tile MV
 *     (its city+status indexes cover them), and the closed window from the
 *     listings table, whose partial index idx_listings_closed_close_date
 *     ("CloseDate" WHERE Closed AND ClosePrice >= 1000) is the only index on
 *     this database that serves "closes since a date" — the tile MV has no
 *     close_date index and 550K closed rows
 *   - THROWS on any Supabase error. A caller that wants a fallback wraps it;
 *     an empty array from here means the scope is empty, never that the
 *     read failed. unstable_cache never stores a thrown read.
 *
 * Public statuses only (Coming Soon excluded by policy, lib/listing-status-
 * public.ts). Cached per scope for the listingsByGeo window.
 */
import { supabaseAnon } from '@/lib/data/client'
import { SERVICE_AREA_CITIES_LOWER, SERVICE_AREA_CITIES_PROPER } from '@/lib/data/listings/service-area'
import { PUBLIC_ON_MARKET_STATUSES } from '@/lib/listing-status-public'
import type { ListingStatus } from '@/lib/data/types/listing'

/** The lean tile the Atlas is built from. Field names mirror ListingTile. */
export type AtlasTile = {
  listingKey: string
  listNumber: string | null
  status: ListingStatus
  listPrice: number | null
  closePrice: number | null
  closeDate: string | null
  onMarketDate: string | null
  modifiedAt: string | null
  lat: number
  lng: number
  city: string | null
  subdivisionName: string | null
  propertyType: string | null
  propertySubType: string | null
  streetNumber: string | null
  streetName: string | null
}

export type AtlasTilesInput = {
  /** MLS City values. Empty = the whole service area. */
  cities: readonly string[]
  /** ISO date (YYYY-MM-DD): closes on or after this day are included. */
  closedFromDate: string
}

type Row = {
  listing_key: string
  list_number: string | null
  standard_status: string
  list_price: number | string | null
  close_price: number | string | null
  close_date: string | null
  on_market_date: string | null
  modified_at: string | null
  lat: number | string | null
  lng: number | string | null
  city: string | null
  subdivision_name: string | null
  property_type: string | null
  property_sub_type: string | null
  street_number: string | null
  street_name: string | null
}

const COLUMNS =
  'listing_key,list_number,standard_status,list_price,close_price,close_date,on_market_date,modified_at,lat,lng,city,subdivision_name,property_type,property_sub_type,street_number,street_name'
const PAGE = 1000
/** 8 pages = 8,000 rows: the whole service area on market is ~4–5K. */
const MAX_PAGES = 8

function num(v: number | string | null): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

type Scope = { citiesLower: string[]; citiesProper: string[] }

/** One keyset walk over the tile MV for the on-market statuses. */
async function walkOnMarket(scope: Scope): Promise<Row[]> {
  const supabase = supabaseAnon()
  if (!supabase) throw new Error('[getAtlasTiles] no Supabase client')
  const out: Row[] = []
  let after: string | null = null
  for (let page = 0; page < MAX_PAGES; page += 1) {
    let query = supabase
      .from('listing_tile_mv')
      .select(COLUMNS)
      .in('standard_status', PUBLIC_ON_MARKET_STATUSES)
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .order('listing_key', { ascending: true })
      .limit(PAGE)
    if (scope.citiesLower.length === 1) query = query.eq('city_lower', scope.citiesLower[0]!)
    else if (scope.citiesLower.length > 1) query = query.in('city_lower', scope.citiesLower)
    else query = query.in('city_lower', SERVICE_AREA_CITIES_LOWER)
    if (after) query = query.gt('listing_key', after)
    const { data, error } = await query
    if (error) throw new Error(`[getAtlasTiles] supabase error: ${error.message}`)
    const rows = (data ?? []) as unknown as Row[]
    out.push(...rows)
    if (rows.length < PAGE) break
    after = rows[rows.length - 1]!.listing_key
  }
  return out
}

/** The closed-window row as the listings table names it. */
type ClosedRow = {
  ListingKey: string
  ListNumber: string | null
  StandardStatus: string
  ListPrice: number | string | null
  ClosePrice: number | string | null
  CloseDate: string | null
  OnMarketDate: string | null
  ModificationTimestamp: string | null
  Latitude: number | string | null
  Longitude: number | string | null
  City: string | null
  SubdivisionName: string | null
  PropertyType: string | null
  property_sub_type: string | null
  StreetNumber: string | null
  StreetName: string | null
}

const CLOSED_COLUMNS =
  'ListingKey,ListNumber,StandardStatus,ListPrice,ClosePrice,CloseDate,OnMarketDate,ModificationTimestamp,Latitude,Longitude,City,SubdivisionName,PropertyType,property_sub_type,StreetNumber,StreetName'
/** A month of closes across the service area is a few hundred rows. */
const CLOSED_MAX_PAGES = 3

/**
 * One keyset walk over listings for the closed window. The predicate is
 * spelled the way the partial index is (ILIKE '%Closed%', ClosePrice >= 1000)
 * so the planner can prove it and use the index.
 */
async function walkClosed(scope: Scope, closedFromDate: string): Promise<ClosedRow[]> {
  const supabase = supabaseAnon()
  if (!supabase) throw new Error('[getAtlasTiles] no Supabase client')
  const out: ClosedRow[] = []
  let after: string | null = null
  for (let page = 0; page < CLOSED_MAX_PAGES; page += 1) {
    let query = supabase
      .from('listings')
      .select(CLOSED_COLUMNS)
      .ilike('StandardStatus', '%Closed%')
      .gte('CloseDate', closedFromDate)
      .gte('ClosePrice', 1000)
      .not('Latitude', 'is', null)
      .not('Longitude', 'is', null)
      .order('ListingKey', { ascending: true })
      .limit(PAGE)
    if (scope.citiesProper.length === 1) query = query.eq('City', scope.citiesProper[0]!)
    else if (scope.citiesProper.length > 1) query = query.in('City', scope.citiesProper)
    else query = query.in('City', SERVICE_AREA_CITIES_PROPER)
    if (after) query = query.gt('ListingKey', after)
    const { data, error } = await query
    if (error) throw new Error(`[getAtlasTiles] supabase error: ${error.message}`)
    const rows = (data ?? []) as unknown as ClosedRow[]
    out.push(...rows)
    if (rows.length < PAGE) break
    after = rows[rows.length - 1]!.ListingKey
  }
  return out
}

function fromClosed(r: ClosedRow): Row {
  return {
    listing_key: r.ListingKey,
    list_number: r.ListNumber,
    standard_status: 'Closed',
    list_price: r.ListPrice,
    close_price: r.ClosePrice,
    close_date: r.CloseDate,
    on_market_date: r.OnMarketDate,
    modified_at: r.ModificationTimestamp,
    lat: r.Latitude,
    lng: r.Longitude,
    city: r.City,
    subdivision_name: r.SubdivisionName,
    property_type: r.PropertyType,
    property_sub_type: r.property_sub_type,
    street_number: r.StreetNumber,
    street_name: r.StreetName,
  }
}

async function fetchAtlasTiles(input: AtlasTilesInput): Promise<AtlasTile[]> {
  const citiesProper = input.cities.map((c) => c.trim()).filter(Boolean)
  const scope: Scope = { citiesLower: citiesProper.map((c) => c.toLowerCase()), citiesProper }
  const [onMarket, closedRows] = await Promise.all([walkOnMarket(scope), walkClosed(scope, input.closedFromDate)])
  const closed = closedRows.map(fromClosed)
  const out: AtlasTile[] = []
  const seen = new Set<string>()
  for (const r of [...onMarket, ...closed]) {
    if (seen.has(r.listing_key)) continue
    seen.add(r.listing_key)
    const lat = num(r.lat)
    const lng = num(r.lng)
    if (lat == null || lng == null) continue
    out.push({
      listingKey: r.listing_key,
      listNumber: r.list_number,
      status: r.standard_status as ListingStatus,
      listPrice: num(r.list_price),
      closePrice: num(r.close_price),
      closeDate: r.close_date,
      onMarketDate: r.on_market_date,
      modifiedAt: r.modified_at,
      lat,
      lng,
      city: r.city,
      subdivisionName: r.subdivision_name,
      propertyType: r.property_type,
      propertySubType: r.property_sub_type,
      streetNumber: r.street_number,
      streetName: r.street_name,
    })
  }
  return out
}

/**
 * The Atlas population for a scope, cached per scope. Throws on a failed
 * read — wrap it where a fallback is honest, and say so when you fall back.
 */
export function getAtlasTiles(input: AtlasTilesInput): Promise<AtlasTile[]> {
  // Not cached here: the raw rows for the service area are ~2.2MB, over
  // Next's per-entry ceiling. lib/atlas/build-place-atlas.ts caches the
  // compact population it derives from them.
  return fetchAtlasTiles(input)
}
