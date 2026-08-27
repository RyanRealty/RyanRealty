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
  // Unit, extracted from the RETS payload. There is no top-level column; a
  // condo building shares one street address across every unit, and without
  // the unit the self-exclusion read the whole building as "the subject's own
  // listing" (363 Bluff: 20 of its own best comps dropped as self).
  'unit_number:details->>UnitNumber',
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
  // Association fields — consumed by lib/cma/development.ts to state whether an
  // HOA exists and what it charges. Never used to characterise unread CC&Rs.
  'association_yn',
  'association_fee',
  'association_fee_frequency',
  'hoa_monthly',
  'hoa_annual_cost',
  // Utility + story raw fields — pricing ladder hard-matches water/sewer and
  // soft-matches story. Typed `water` is usually null; facts refresh reads
  // details.WaterSource. CMA subject still carries sewer + levels here.
  'water',
  'sewer',
  'levels',
  'concessions_amount',
  'new_construction_yn',
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
  // Order by real listing recency (OnMarketDate), NOT ModificationTimestamp: a
  // bulk MLS re-sync bumps last-modified uniformly across a property's
  // relistings, which would otherwise push an ancient listing to the top and
  // truncate the true newest one out of the LIMIT window. resolveCmaSubject
  // still runs its own recency sort; this keeps the newest inside the fetch.
  const { data, error } = await q
    .order('OnMarketDate', { ascending: false, nullsFirst: false })
    .limit(15)
  if (error) {
    console.error('[findCmaSubjectByAddress]', error.message)
    return []
  }
  return (data ?? []) as unknown as CmaListingRow[]
}

/** Photo count on the listing row (expired-audit presentation lens). */
export async function getListingPhotosCount(listingKey: string): Promise<number | null> {
  const sb = client()
  if (!sb) return null
  const { data, error } = await sb
    .from('listings')
    .select('photos_count')
    .eq('ListingKey', listingKey) // @canonical-key — builder callers pass keys read from cmas/expired_listings rows, stored verbatim from listings
    .maybeSingle()
  if (error || !data) return null
  return data.photos_count != null ? Number(data.photos_count) : null
}

/** Closed comp pool for one selection tier. The builder composes tiers. */
export async function selectCmaCompsPool(opts: {
  /**
   * City bound. NULL is deliberate and means "any mailing city": on a rural
   * acreage parcel the MLS City is a postal address, not a market, and the
   * nearest true comparables routinely carry a different one. Only the rural
   * tiers pass null, and only after every city-bounded tier has starved; they
   * always pair it with a `bounds` radius so it never means "anywhere".
   */
  cityIlike: string | null
  subdivisionIlike?: string | null
  postalCode?: string | null
  closeDateGte: string
  /**
   * Living-area band. OMIT BOTH for a land pull: land rows carry a null
   * TotalLivingAreaSqFt, and a null fails every bound, so passing 0..0 returns
   * nothing rather than everything.
   */
  sqftMin?: number | null
  sqftMax?: number | null
  lotMin?: number | null
  lotMax?: number | null
  /**
   * Optional lat/lng box. The tiered selector uses this to push a market-area
   * or radius bound INTO the query, because the row limit below is applied
   * before any in-memory geographic filter — without it a neighborhood tier
   * only sees whichever recent citywide sales happen to land inside it.
   */
  bounds?: { latMin: number; latMax: number; lngMin: number; lngMax: number } | null
  limit?: number
  /**
   * Subject's product type for the SQL eq. Detached callers pass
   * 'Single Family Residence' (D1). Townhouse callers pass 'Townhouse'.
   * Omit rather than defaulting to SFR — a missing type must not force detached.
   */
  propertySubType?: string | null
  /**
   * MLS segment letter. 'A' Residential (the default, and every improved
   * caller), 'D' Land, 'E' Farm — docs/plans/MARKET_TRUTH/REGISTRY.md §1.
   * A land subject pulled against 'A' returns zero rows, silently.
   */
  propertyType?: string | null
}): Promise<CmaListingRow[]> {
  const sb = client()
  if (!sb) return []
  let q = sb
    .from('listings')
    .select(LISTING_CMA_COLUMNS)
    .ilike('StandardStatus', '%Closed%')
    .not('CloseDate', 'is', null)
    .gte('CloseDate', opts.closeDateGte)
    .eq('PropertyType', opts.propertyType?.trim() || 'A')
    .gt('ClosePrice', 0)
  if (opts.sqftMin != null) q = q.gte('TotalLivingAreaSqFt', opts.sqftMin)
  if (opts.sqftMax != null) q = q.lte('TotalLivingAreaSqFt', opts.sqftMax)
  const subType = opts.propertySubType?.trim() || null
  if (subType) q = q.eq('property_sub_type', subType)
  if (opts.cityIlike?.trim()) q = q.ilike('City', opts.cityIlike.trim())
  if (opts.subdivisionIlike?.trim()) q = q.ilike('SubdivisionName', opts.subdivisionIlike.trim())
  if (opts.postalCode?.trim()) q = q.eq('PostalCode', opts.postalCode.trim())
  if (opts.lotMin != null) q = q.gte('lot_size_acres', opts.lotMin)
  if (opts.lotMax != null) q = q.lte('lot_size_acres', opts.lotMax)
  if (opts.bounds) {
    q = q
      .gte('Latitude', opts.bounds.latMin)
      .lte('Latitude', opts.bounds.latMax)
      .gte('Longitude', opts.bounds.lngMin)
      .lte('Longitude', opts.bounds.lngMax)
  }
  const { data, error } = await q
    .order('CloseDate', { ascending: false })
    .limit(Math.min(Math.max(opts.limit ?? 50, 1), opts.bounds ? 500 : 100))
  if (error) {
    console.error('[selectCmaCompsPool]', error.message)
    return []
  }
  return (data ?? []) as unknown as CmaListingRow[]
}

/**
 * Fetch specific closed comps by ListingKey — for a broker-curated comp set.
 * Same column projection as the tiered pool so the builder's rowToComp mapping
 * is identical; the builder handles ordering + downstream vetting.
 */
export async function selectCmaCompsByKeys(keys: string[]): Promise<CmaListingRow[]> {
  const sb = client()
  if (!sb) return []
  const clean = Array.from(new Set(keys.map((k) => k.trim()).filter(Boolean)))
  if (clean.length === 0) return []
  const { data, error } = await sb
    .from('listings')
    .select(LISTING_CMA_COLUMNS)
    .in('ListingKey', clean) // @canonical-key — builder callers pass curated keys read verbatim from listings
    .limit(50)
  if (error) {
    console.error('[selectCmaCompsByKeys]', error.message)
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
 *  both historically. Resort communities use geo_type='neighborhood'
 *  (docs/DATABASE_FOR_AI_AGENTS.md §3a). */
export async function getCmaMarketStatsRow(
  geoSlugs: string[],
  geoType: 'city' | 'neighborhood' = 'city',
): Promise<CmaMarketStatsRow | null> {
  const sb = client()
  if (!sb || geoSlugs.length === 0) return null
  const { data, error } = await sb
    .from('market_stats_cache')
    .select(
      'geo_type, geo_slug, geo_label, period_start, period_end, sold_count, median_sale_price, median_dom, median_ppsf, median_price_per_sqft_closed, avg_sale_to_list_ratio, yoy_median_price_delta_pct, end_of_period_inventory, methodology_version, computed_at',
    )
    .in('geo_slug', geoSlugs)
    .eq('geo_type', geoType)
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

/** Live pulse (active inventory) for the subject geo, SFR only. */
export async function getCmaMarketPulseRow(
  geoSlugs: string[],
  geoType: 'city' | 'neighborhood' = 'city',
): Promise<CmaMarketPulseRow | null> {
  const sb = client()
  if (!sb || geoSlugs.length === 0) return null
  const { data, error } = await sb
    .from('market_pulse_live')
    .select('geo_slug, active_count, pending_count, median_list_price, months_of_supply, updated_at')
    .in('geo_slug', geoSlugs)
    .eq('geo_type', geoType)
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

export type CmaMarketTrendRow = {
  period_start: string
  median_sale_price: number | null
  sold_count: number | null
  end_of_period_inventory: number | null
}

/** Completed monthly cache rows for the CMA market board. Drops the in-progress month. */
export async function getCmaMarketTrendRows(
  geoSlug: string,
  geoType: 'city' | 'neighborhood',
  months = 12,
): Promise<CmaMarketTrendRow[]> {
  const sb = client()
  if (!sb || !geoSlug.trim()) return []
  const { data, error } = await sb
    .from('market_stats_cache')
    .select('period_start, median_sale_price, sold_count, end_of_period_inventory')
    .eq('geo_slug', geoSlug)
    .eq('geo_type', geoType)
    .eq('period_type', 'monthly')
    .order('period_start', { ascending: false })
    .limit(months + 1)
  if (error) {
    console.error('[getCmaMarketTrendRows]', error.message)
    return []
  }
  const now = new Date()
  return ((data ?? []) as CmaMarketTrendRow[]).filter((row) => {
    const d = new Date(row.period_start)
    if (Number.isNaN(d.getTime())) return false
    return d.getUTCFullYear() !== now.getUTCFullYear() || d.getUTCMonth() !== now.getUTCMonth()
  })
}

/** Active broker row for the CMA signature block. */
export async function getCmaBrokerBySlugOrEmail(opts: {
  slug?: string | null
  email?: string | null
}): Promise<Record<string, unknown> | null> {
  const sb = client()
  if (!sb) return null
  // twilio_number is the PUBLISHABLE line. `phone` is NOT safe to render: for
  // Paul and Rebecca it currently holds the same value as forward_to_cell,
  // i.e. their personal cell. A CMA is a client-facing document, so the
  // signature block must render the business line the main number routes to.
  const cols =
    'id, slug, display_name, title, license_number, email, twilio_number, photo_url, is_active'
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
    .select('id, slug, display_name, title, license_number, email, twilio_number, photo_url')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  return (data ?? []) as Array<Record<string, unknown>>
}

// ── Report-extras reads (Matt 2026-08-05: when-to-list, price-band,
//    subdivision pulse, buyer-financing) ────────────────────────────────────

export type CmaClosedSkinnyRow = {
  CloseDate: string
  days_to_pending: number | null
  buyer_financing: string | null
}

/**
 * Skinny city-wide closed pull for seasonality + financing profile: three
 * columns over ~36 months (~6K rows for Bend). market_stats_cache cannot
 * serve this — its periods are rolling 30-day windows, not calendar months,
 * so month-of-year seasonality has to come off the cycles themselves.
 */
export async function getCmaCityClosedSkinny(city: string, sinceIso: string): Promise<CmaClosedSkinnyRow[]> {
  const sb = client()
  if (!sb) return []
  const out: CmaClosedSkinnyRow[] = []
  const SIZE = 1000
  for (let from = 0; from < 20000; from += SIZE) {
    const { data, error } = await sb
      .from('listings')
      .select('CloseDate, days_to_pending, buyer_financing')
      .eq('City', city)
      .eq('PropertyType', 'A')
      .eq('property_sub_type', 'Single Family Residence')
      .eq('StandardStatus', 'Closed')
      .gte('CloseDate', sinceIso)
      .order('CloseDate', { ascending: true })
      .order('ListingKey', { ascending: true })
      .range(from, from + SIZE - 1)
    if (error) {
      console.error('[getCmaCityClosedSkinny]', error.message)
      return out
    }
    out.push(...((data ?? []) as unknown as CmaClosedSkinnyRow[]))
    if (!data || data.length < SIZE) break
  }
  return out
}

export type { CmaBandInventory, CmaBandListingRow } from '@/lib/data/cma/bandInventory'
export { getCmaBandInventory } from '@/lib/data/cma/bandInventory'

export type CmaSubdivisionSaleRow = {
  ClosePrice: number
  CloseDate: string
}

/** Closed sales inside the subject's exact MLS subdivision since sinceIso. */
export async function getCmaSubdivisionClosed(subdivision: string, sinceIso: string): Promise<CmaSubdivisionSaleRow[]> {
  const sb = client()
  if (!sb || !subdivision.trim()) return []
  const { data, error } = await sb
    .from('listings')
    .select('ClosePrice, CloseDate')
    .eq('SubdivisionName', subdivision)
    .eq('PropertyType', 'A')
    .eq('property_sub_type', 'Single Family Residence')
    .eq('StandardStatus', 'Closed')
    .gte('CloseDate', sinceIso)
    .not('ClosePrice', 'is', null)
    .order('CloseDate', { ascending: false })
    .limit(500)
  if (error) {
    console.error('[getCmaSubdivisionClosed]', error.message)
    return []
  }
  return (data ?? []) as unknown as CmaSubdivisionSaleRow[]
}

export type CmaSubdivisionHistoryRow = {
  ListingKey: string
  ListNumber: string | null
  StreetNumber: string | null
  StreetName: string | null
  ClosePrice: number
  CloseDate: string
  ListPrice: number | null
  OriginalListPrice: number | null
  TotalLivingAreaSqFt: number | null
  BedroomsTotal: number | null
  BathroomsTotal: number | null
  year_built: number | null
  CumulativeDaysOnMarket: number | null
  days_to_pending: number | null
  lot_size_acres: number | null
  public_remarks: string | null
  PhotoURL: string | null
}

/**
 * The FULL sales history of one subdivision (Matt 2026-08-05: "review all
 * past sales and photos with those sales, tell a story"). Every closed
 * single-family sale, with remarks + hero photo, newest first. Feeds the
 * subdivision-story engine: deterministic aggregates from these rows, AI
 * narrative grounded on them.
 */
export async function getCmaSubdivisionHistory(subdivision: string, sinceIso: string): Promise<CmaSubdivisionHistoryRow[]> {
  const sb = client()
  if (!sb || !subdivision.trim()) return []
  // Paged to completion: a hard limit silently truncates large subdivisions
  // and drops the OLDEST sales (found live 2026-08-05: Stone Creek holds 450,
  // a 400 cap skewed the 2019 median). Ceiling guards pathological inputs.
  const out: CmaSubdivisionHistoryRow[] = []
  const SIZE = 400
  for (let from = 0; from < 2000; from += SIZE) {
    const { data, error } = await sb
      .from('listings')
      .select(
        'ListingKey, ListNumber, StreetNumber, StreetName, ClosePrice, CloseDate, ListPrice, OriginalListPrice, TotalLivingAreaSqFt, BedroomsTotal, BathroomsTotal, year_built, CumulativeDaysOnMarket, days_to_pending, lot_size_acres, public_remarks, PhotoURL',
      )
      .eq('SubdivisionName', subdivision)
      .eq('PropertyType', 'A')
      .eq('property_sub_type', 'Single Family Residence')
      .eq('StandardStatus', 'Closed')
      .gte('CloseDate', sinceIso)
      .not('ClosePrice', 'is', null)
      .order('CloseDate', { ascending: false })
      .order('ListingKey', { ascending: true })
      .range(from, from + SIZE - 1)
    if (error) {
      console.error('[getCmaSubdivisionHistory]', error.message)
      return out
    }
    out.push(...((data ?? []) as unknown as CmaSubdivisionHistoryRow[]))
    if (!data || data.length < SIZE) break
  }
  return out
}

// ── Prior-sale read (Matt 2026-08-06: CMA equity-position section — "what
//    have you actually made on this house?") ──────────────────────────────

export type CmaPriorSaleRow = {
  ClosePrice: number
  CloseDate: string
  TotalLivingAreaSqFt: number | null
}

/**
 * The subject's own most recent CLOSED sale at its address, newest CloseDate
 * first. Feeds lib/cma/equity.ts's computeEquityPosition, which is the one
 * that decides whether the sale is actually usable (before the current
 * listing cycle, held long enough, priced > 0) — this read just finds it.
 */
export async function getCmaPriorSaleAtAddress(
  streetNumber: string,
  streetName: string,
  city: string,
): Promise<CmaPriorSaleRow | null> {
  const sb = client()
  if (!sb) return null
  const num = streetNumber.trim()
  const name = streetName.trim()
  const cty = city.trim()
  if (!num || !name) return null
  let q = sb
    .from('listings')
    .select('ClosePrice, CloseDate, TotalLivingAreaSqFt')
    .eq('StreetNumber', num)
    .ilike('StreetName', name)
    .eq('StandardStatus', 'Closed')
    .not('ClosePrice', 'is', null)
    .not('CloseDate', 'is', null)
  if (cty) q = q.ilike('City', cty)
  const { data, error } = await q
    .order('CloseDate', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error('[getCmaPriorSaleAtAddress]', error.message)
    return null
  }
  return (data ?? null) as CmaPriorSaleRow | null
}
