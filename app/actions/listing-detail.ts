'use server'

import { createClient } from '@supabase/supabase-js'
import type { SparkVideo, SparkVirtualTour } from '@/lib/spark'
import { listingAddressSlug, slugify } from '@/lib/slug'
import {
  getCommunityListings as getCommunityListingsDAL,
  getCityListings as getCityListingsDAL,
} from '@/lib/data'
import type { ListingTile } from '@/lib/data'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function getSupabase() {
  if (!url?.trim() || !anonKey?.trim()) throw new Error('Supabase not configured')
  return createClient(url, anonKey)
}

async function withTimeout<T>(promise: Promise<T>, fallback: T, timeoutMs = 2500): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs)),
  ])
}

/* ---------- Sanitise helpers for Spark masked values ("********") ---------- */

function safeNum(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  if (typeof v === 'string') {
    if (v === '' || /^\*+$/.test(v)) return null
    const n = Number(v)
    return Number.isNaN(n) ? null : n
  }
  return null
}

function safeStr(v: unknown): string | null {
  if (v == null) return null
  // Spark stores many fields as objects like {"Frame": true, "Composition": true}
  // Convert to comma-separated string of truthy keys
  if (typeof v === 'object' && !Array.isArray(v)) {
    const keys = Object.entries(v as Record<string, unknown>)
      .filter(([, val]) => val === true)
      .map(([key]) => key)
    if (keys.length > 0) return keys.join(', ')
    // If no truthy keys, try to get string values
    const vals = Object.values(v as Record<string, unknown>).filter(Boolean).map(String)
    if (vals.length > 0) return vals.join(', ')
    return null
  }
  const s = String(v).trim()
  if (!s || /^\*+$/.test(s)) return null
  return s
}

function safeBool(v: unknown): boolean | null {
  if (v === true || v === 'true' || v === 'Y' || v === 'Yes') return true
  if (v === false || v === 'false' || v === 'N' || v === 'No') return false
  return null
}

/* ---------- Price formatting for history events ---------- */

function formatHistoryPrice(price: number | null | undefined): string {
  if (price == null || !Number.isFinite(price)) return 'N/A'
  return `$${Number(price).toLocaleString()}`
}

/* ---------- Exported types (unchanged — page components depend on these) ---------- */

export type ListingDetailListing = {
  id: string
  listing_key: string
  list_number: string | null
  mls_source: string | null
  listing_id: string | null
  property_id: string | null
  standard_status: string | null
  mls_status: string | null
  list_price: number | null
  original_list_price: number | null
  close_price: number | null
  listing_contract_date: string | null
  on_market_date: string | null
  close_date: string | null
  modification_timestamp: string | null
  status_change_timestamp: string | null
  price_change_timestamp: string | null
  beds_total: number | null
  baths_full: number | null
  baths_half: number | null
  baths_total_integer: number | null
  living_area: number | null
  lot_size_acres: number | null
  lot_size_sqft: number | null
  year_built: number | null
  levels: number | null
  garage_spaces: number | null
  property_type: string | null
  property_sub_type: string | null
  subdivision_name: string | null
  public_remarks: string | null
  directions: string | null
  architectural_style: string | null
  construction_materials: string | null
  roof: string | null
  flooring: string | null
  heating: string | null
  cooling: string | null
  fireplace_yn: boolean | null
  fireplace_features: string | null
  interior_features: string | null
  exterior_features: string | null
  kitchen_appliances: string | null
  pool_features: string | null
  view: string | null
  waterfront_yn: boolean | null
  water_source: string | null
  sewer: string | null
  association_yn: boolean | null
  association_fee: number | null
  association_fee_frequency: string | null
  tax_amount: number | null
  tax_year: number | null
  tax_assessed_value: number | null
  elementary_school: string | null
  middle_school: string | null
  high_school: string | null
  photos_count: number | null
  virtual_tour_url: string | null
  vow_avm_display_yn: boolean | null
  new_construction_yn: boolean | null
  senior_community_yn: boolean | null
  days_on_market: number | null
  cumulative_days_on_market: number | null
  created_at: string
  updated_at: string
}

export type ListingDetailProperty = {
  id: string
  unparsed_address: string
  street_number: string | null
  street_name: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  latitude: number | null
  longitude: number | null
  community_id: string | null
}

export type ListingDetailPhoto = {
  id: string
  listing_key: string
  photo_url: string
  cdn_url?: string | null
  sort_order: number
  caption: string | null
  is_hero: boolean
}

export type ListingDetailAgent = {
  id: string
  listing_key: string
  agent_role: string | null
  agent_name: string | null
  agent_mls_id: string | null
  agent_license: string | null
  agent_email: string | null
  agent_phone: string | null
  office_name: string | null
  office_mls_id: string | null
  office_phone: string | null
}

export type ListingDetailPriceHistory = {
  id: string
  listing_key: string
  old_price: number | null
  new_price: number | null
  change_pct: number | null
  changed_at: string
}

export type ListingDetailStatusHistory = {
  id: string
  listing_key: string
  old_status: string | null
  new_status: string | null
  changed_at: string
}

export type ListingDetailEngagement = {
  listing_key: string
  view_count: number
  like_count: number
  save_count: number
  share_count: number
}

export type ListingDetailOpenHouse = {
  id: string
  listing_key: string
  event_date: string
  start_time: string | null
  end_time: string | null
  host_agent_name: string | null
  remarks: string | null
}

export type ListingDetailCommunity = {
  id: string
  name: string
  slug: string
  neighborhood_name?: string | null
  neighborhood_slug?: string | null
  city_slug?: string | null
}

/** A user-facing listing lifecycle event derived from listing_history. */
export type ListingHistoryEvent = {
  id: string
  listing_key: string
  event_date: string
  event_type: 'new_listing' | 'price_change' | 'status_change' | 'back_on_market' | 'closed'
  label: string
  price: number | null
  old_value: string | null
  new_value: string | null
  change_pct: number | null
}

export type ListingDetailData = {
  listing: ListingDetailListing
  property: ListingDetailProperty | null
  photos: ListingDetailPhoto[]
  agents: ListingDetailAgent[]
  priceHistory: ListingDetailPriceHistory[]
  statusHistory: ListingDetailStatusHistory[]
  listingHistory: ListingHistoryEvent[]
  engagement: ListingDetailEngagement | null
  openHouses: ListingDetailOpenHouse[]
  community: ListingDetailCommunity | null
  videos: SparkVideo[]
  virtualTours: SparkVirtualTour[]
}

/* ---------- Listing key resolution ---------- */

/**
 * Resolve URL slug (key, key-zip, mls#, etc.) to a ListingKey.
 * Queries the actual DB columns: ListingKey (PascalCase) and ListNumber.
 */
async function resolveListingKeyFromSlug(supabase: ReturnType<typeof getSupabase>, slug: string): Promise<string | null> {
  const raw = String(slug ?? '').trim()
  if (!raw) return null
  const decoded = decodeURIComponent(raw).trim()
  if (!decoded) return null

  const tryLookup = async (candidate: string): Promise<string | null> => {
    const c = String(candidate ?? '').trim()
    if (!c) return null

    // Try ListNumber first (canonical URL id), then ListingKey — both via DAL.
    try {
      const { getListingTiles } = await import('@/lib/data')
      const byNum = await getListingTiles({
        listNumbers: [c],
        status: 'all',
        sort: 'newest',
        limit: 5,
      })
      const matchByNum = byNum.find((t) => t.listingKey.trim().length > 0)
      if (matchByNum?.listingKey) return matchByNum.listingKey.trim()

      const byKey = await getListingTiles({
        listingKeys: [c],
        status: 'all',
        limit: 1,
      })
      if (byKey[0]?.listingKey) return byKey[0].listingKey.trim()
    } catch { /* ignore */ }

    return null
  }

  // Try the full decoded slug as-is
  const exact = await tryLookup(decoded)
  if (exact) return exact

  // Try splitting by '-' from left to right (handles key-97702 or mls-zip patterns)
  const parts = decoded.split('-')
  for (let i = parts.length - 1; i >= 1; i--) {
    const candidate = parts.slice(0, i).join('-')
    const resolved = await tryLookup(candidate)
    if (resolved) return resolved
  }
  return null
}

/**
 * Resolve listing key from breadcrumb-style path:
 * /homes-for-sale/:citySlug/:optional-area.../:addressSlug
 */
export async function resolveListingKeyFromBreadcrumbPath(input: {
  citySlug: string
  areaSlugs?: string[]
  addressSlug: string
}): Promise<string | null> {
  const supabase = getSupabase()
  const citySlug = slugify(decodeURIComponent(input.citySlug || ''))
  const addressSlug = slugify(decodeURIComponent(input.addressSlug || ''))
  if (!citySlug || !addressSlug) return null
  const areaSlugs = (input.areaSlugs ?? []).map((s) => slugify(decodeURIComponent(s || ''))).filter(Boolean)
  // Title-case the slug-derived city name so it matches the canonical DB value
  // (e.g. "la pine" → "La Pine", "black butte ranch" → "Black Butte Ranch").
  // This enables .eq('"City"', cityLike) instead of .ilike, which uses the
  // expression index idx_listings_city_lower via Postgres's case-folded match.
  const cityLike = decodeURIComponent(input.citySlug || '')
    .replace(/-/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
  if (!cityLike) return null

  // Try to narrow search by extracting street number from address slug
  const streetNumMatch = addressSlug.match(/^(\d+)/)
  // DAL: read tiles from listing_tile_mv. The address-slug match filter
  // happens client-side below (the MV has `address_slug` but the DAL
  // filter schema doesn't expose it today). Same 1000-row cap as before.
  let tiles = await getCityListingsDAL(cityLike, {
    status: 'active-and-pending',
    sort: 'newest',
    limit: 500,
  })
  if (streetNumMatch) {
    tiles = tiles.filter((t) => t.streetNumber === streetNumMatch[1])
  }
  const rows = tiles.map((t) => ({
    ListingKey: t.listingKey,
    ListNumber: t.listNumber,
    StreetNumber: t.streetNumber,
    StreetName: t.streetName,
    City: t.city,
    State: null as string | null,
    PostalCode: t.postalCode,
    SubdivisionName: t.subdivisionName,
    ModificationTimestamp: t.modifiedAt,
  }))

  const matches = rows.filter((row) => {
    if (slugify(row.City ?? '') !== citySlug) return false
    const fullAddressSlug = listingAddressSlug({
      streetNumber: row.StreetNumber ?? null,
      streetName: row.StreetName ?? null,
      city: row.City ?? null,
      state: row.State ?? null,
      postalCode: row.PostalCode ?? null,
    })
    const streetCitySlug = slugify([
      [row.StreetNumber, row.StreetName].filter(Boolean).join('-'),
      row.City ?? '',
    ].filter(Boolean).join('-'))
    const streetOnlySlug = slugify([row.StreetNumber, row.StreetName].filter(Boolean).join('-'))

    const addressCandidates = [fullAddressSlug, streetCitySlug, streetOnlySlug].filter(Boolean)
    const addressMatched = addressCandidates.some((candidate) => (
      candidate === addressSlug ||
      candidate.startsWith(`${addressSlug}-`) ||
      addressSlug.startsWith(`${candidate}-`)
    ))
    if (!addressMatched) return false

    if (areaSlugs.length === 0) return true
    const subdivisionSlug = slugify(row.SubdivisionName ?? '')
    return subdivisionSlug ? areaSlugs.includes(subdivisionSlug) : true
  })

  if (matches.length === 0) return null
  matches.sort((a, b) => {
    const aTime = a.ModificationTimestamp ? new Date(a.ModificationTimestamp).getTime() : 0
    const bTime = b.ModificationTimestamp ? new Date(b.ModificationTimestamp).getTime() : 0
    return bTime - aTime
  })
  const top = matches[0]
  return top.ListingKey ?? top.ListNumber ?? null
}

/**
 * Resolve listing key from canonical MLS/key + ZIP segment with path context:
 * /homes-for-sale/:citySlug/:optional-area.../:keyOrMls-:zip
 */
export async function resolveListingKeyFromCanonicalPath(input: {
  citySlug: string
  areaSlugs?: string[]
  keyOrMls: string
  postalCode?: string | null
}): Promise<string | null> {
  const supabase = getSupabase()
  const citySlug = slugify(decodeURIComponent(input.citySlug || ''))
  const keyOrMls = String(input.keyOrMls ?? '').trim()
  if (!citySlug || !keyOrMls) return null
  if (!/^[a-zA-Z0-9._-]+$/.test(keyOrMls)) return null

  const areaSlugs = (input.areaSlugs ?? []).map((s) => slugify(decodeURIComponent(s || ''))).filter(Boolean)
  const postalCode = String(input.postalCode ?? '').trim().replace(/\D/g, '').slice(0, 5)
  // Title-case the slug-derived city name so it matches the canonical DB value
  // (e.g. "la pine" → "La Pine", "black butte ranch" → "Black Butte Ranch").
  // This enables .eq('"City"', cityLike) instead of .ilike, which uses the
  // expression index idx_listings_city_lower via Postgres's case-folded match.
  const cityLike = decodeURIComponent(input.citySlug || '')
    .replace(/-/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
  if (!cityLike) return null

  // Try direct lookup by key/MLS number first (avoids fetching all city listings)
  const { data: directByKey } = await supabase
    .from('listings')
    .select('ListingKey, ListNumber, City, PostalCode, SubdivisionName, ModificationTimestamp')
    .or(`ListingKey.eq.${keyOrMls},ListNumber.eq.${keyOrMls}`)
    .order('ModificationTimestamp', { ascending: false, nullsFirst: false })
    .limit(5)
  if (directByKey && directByKey.length > 0) {
    const preferred = (directByKey as Array<{ ListingKey?: string | null }>)
      .map((row) => String(row.ListingKey ?? '').trim())
      .find((value) => value.length > 0)
    if (preferred) return preferred
  }

  // Fallback: search within city via DAL (listing_tile_mv). Returns
  // active + pending tiles up to 500; 'all' status would broaden but
  // resolver is for active listings only.
  const tiles = await getCityListingsDAL(cityLike, {
    status: 'active-and-pending',
    sort: 'newest',
    limit: 500,
  })
  const rows = tiles.map((t) => ({
    ListingKey: t.listingKey,
    ListNumber: t.listNumber,
    City: t.city,
    PostalCode: t.postalCode,
    SubdivisionName: t.subdivisionName,
    ModificationTimestamp: t.modifiedAt,
  }))

  const matches = rows.filter((row) => {
    if (slugify(row.City ?? '') !== citySlug) return false

    const keys = [
      row.ListingKey,
      row.ListNumber,
    ].map((v) => String(v ?? '').trim()).filter(Boolean)
    if (!keys.includes(keyOrMls)) return false

    if (postalCode) {
      const rowZip = String(row.PostalCode ?? '').trim().replace(/\D/g, '').slice(0, 5)
      if (rowZip !== postalCode) return false
    }

    if (areaSlugs.length === 0) return true
    const subdivisionSlug = slugify(row.SubdivisionName ?? '')
    return subdivisionSlug ? areaSlugs.includes(subdivisionSlug) : true
  })

  if (matches.length === 0) return null
  matches.sort((a, b) => {
    const aTime = a.ModificationTimestamp ? new Date(a.ModificationTimestamp).getTime() : 0
    const bTime = b.ModificationTimestamp ? new Date(b.ModificationTimestamp).getTime() : 0
    return bTime - aTime
  })
  const top = matches[0]
  const topKey = String(top.ListingKey ?? '').trim()
  if (topKey) return topKey
  return null
}

/* ---------- Main listing detail fetch ---------- */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>

/**
 * Map a PascalCase DB row + its `details` JSONB to the ListingDetailListing shape.
 */
function mapRowToListing(row: AnyRow): ListingDetailListing {
  const d = (row.details ?? {}) as AnyRow
  const now = new Date().toISOString()
  const listingKey = String(row.ListingKey ?? '').trim()

  // Prefer typed columns, then Spark details, then derive for closed (CloseDate − on market) or active (vs now).
  let dom =
    safeNum(row.DaysOnMarket) ??
    safeNum(d.DaysOnMarket)
  let cdom =
    safeNum(row.CumulativeDaysOnMarket) ??
    safeNum(d.CumulativeDaysOnMarket)

  const statusLower = String(row.StandardStatus ?? '').toLowerCase()
  const isClosed = statusLower.includes('closed')
  const onMarketIso = row.OnMarketDate ?? row.ListDate ?? d.OnMarketDate ?? d.ListDate
  const closeIso = row.CloseDate ?? d.CloseDate

  if (dom == null && isClosed && closeIso && onMarketIso) {
    const end = new Date(closeIso)
    const start = new Date(onMarketIso)
    if (!Number.isNaN(end.getTime()) && !Number.isNaN(start.getTime()) && end >= start) {
      dom = Math.max(0, Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)))
    }
  } else if (dom == null && onMarketIso && !isClosed) {
    const onMarket = new Date(onMarketIso)
    if (!Number.isNaN(onMarket.getTime())) {
      dom = Math.max(0, Math.floor((Date.now() - onMarket.getTime()) / (24 * 60 * 60 * 1000)))
    }
  }
  if (cdom == null) cdom = dom

  return {
    id: listingKey,
    listing_key: listingKey,
    list_number: safeStr(row.ListNumber),
    mls_source: safeStr((row as { mls_source?: unknown; MlsSource?: unknown }).mls_source ?? (row as { MlsSource?: unknown }).MlsSource),
    listing_id: safeStr(row.ListingKey),
    property_id: null,
    standard_status: safeStr(row.StandardStatus),
    mls_status: safeStr(d.MlsStatus),
    list_price: safeNum(row.ListPrice),
    original_list_price: safeNum(row.OriginalListPrice ?? d.OriginalListPrice),
    close_price: safeNum(row.ClosePrice ?? d.ClosePrice),
    listing_contract_date: safeStr(d.ListingContractDate),
    on_market_date: safeStr(row.OnMarketDate ?? d.OnMarketDate),
    close_date: safeStr(row.CloseDate ?? d.CloseDate),
    modification_timestamp: safeStr(row.ModificationTimestamp),
    status_change_timestamp: safeStr(d.StatusChangeTimestamp),
    price_change_timestamp: safeStr(d.PriceChangeTimestamp),
    beds_total: safeNum(row.BedroomsTotal ?? d.BedsTotal),
    baths_full: safeNum(d.BathsFull),
    baths_half: safeNum(d.BathsHalf),
    baths_total_integer: safeNum(row.BathroomsTotal ?? d.BathroomsTotalInteger),
    living_area: safeNum(row.TotalLivingAreaSqFt ?? d.LivingArea ?? d.BuildingAreaTotal),
    lot_size_acres: safeNum(d.LotSizeAcres),
    lot_size_sqft: safeNum(d.LotSizeSquareFeet),
    year_built: safeNum(d.YearBuilt),
    levels: safeNum(d.Levels ?? d.StoriesTotal),
    garage_spaces: safeNum(d.GarageSpaces),
    property_type: safeStr(row.PropertyType ?? d.PropertyType),
    property_sub_type: safeStr(d.PropertySubType),
    subdivision_name: safeStr(row.SubdivisionName ?? d.SubdivisionName),
    public_remarks: safeStr(d.PublicRemarks),
    directions: safeStr(d.Directions),
    architectural_style: safeStr(d.ArchitecturalStyle),
    construction_materials: safeStr(d.ConstructionMaterials),
    roof: safeStr(d.Roof),
    flooring: safeStr(d.Flooring),
    heating: safeStr(d.Heating),
    cooling: safeStr(d.Cooling),
    fireplace_yn: safeBool(d.FireplaceYN),
    fireplace_features: safeStr(d.FireplaceFeatures),
    interior_features: safeStr(d.InteriorFeatures),
    exterior_features: safeStr(d.ExteriorFeatures),
    kitchen_appliances: safeStr(d.KitchenAppliances),
    pool_features: safeStr(d.PoolFeatures),
    view: safeStr(d.View),
    waterfront_yn: safeBool(d.WaterFrontYN ?? d.WaterfrontYN),
    water_source: safeStr(d.WaterSource),
    sewer: safeStr(d.Sewer),
    association_yn: safeBool(d.AssociationYN),
    association_fee: safeNum(d.AssociationFee),
    association_fee_frequency: safeStr(d.AssociationFeeFrequency),
    tax_amount: safeNum(d.TaxAmount),
    tax_year: safeNum(d.TaxYear),
    tax_assessed_value: safeNum(d.TaxAssessedValue),
    elementary_school: safeStr(d.ElementarySchool),
    middle_school: safeStr(d.MiddleOrJuniorSchool),
    high_school: safeStr(d.HighSchool),
    photos_count: safeNum(d.PhotosCount),
    virtual_tour_url: safeStr(d.VirtualTourURLUnbranded ?? d.VirtualTourURL),
    vow_avm_display_yn: safeBool(d.VOWAutomatedValuationDisplayYN),
    new_construction_yn: safeBool(d.NewConstructionYN),
    senior_community_yn: safeBool(d.SeniorCommunityYN),
    days_on_market: dom,
    cumulative_days_on_market: cdom,
    created_at: safeStr(row.ListDate) ?? now,
    updated_at: safeStr(row.ModificationTimestamp) ?? now,
  }
}

/**
 * Construct a ListingDetailProperty from inline columns on the listings row.
 */
function mapRowToProperty(row: AnyRow): ListingDetailProperty {
  const unparsed = [row.StreetNumber, row.StreetName, row.City, row.State, row.PostalCode]
    .map((v) => String(v ?? '').trim())
    .filter(Boolean)
    .join(', ')
  return {
    id: String(row.ListingKey ?? ''),
    unparsed_address: unparsed || safeStr((row.details as AnyRow)?.UnparsedAddress) || '',
    street_number: safeStr(row.StreetNumber),
    street_name: safeStr(row.StreetName),
    city: safeStr(row.City),
    state: safeStr(row.State),
    postal_code: safeStr(row.PostalCode),
    latitude: safeNum(row.Latitude),
    longitude: safeNum(row.Longitude),
    community_id: null, // resolved separately
  }
}

/**
 * Extract photos from the details JSONB Photos array + the top-level PhotoURL.
 */
function extractPhotosFromRow(row: AnyRow): ListingDetailPhoto[] {
  const listingKey = String(row.ListingKey ?? '')
  const photos: ListingDetailPhoto[] = []
  const d = (row.details ?? {}) as AnyRow
  const sparkPhotos = Array.isArray(d.Photos) ? d.Photos : []

  if (sparkPhotos.length > 0) {
    for (let i = 0; i < sparkPhotos.length; i++) {
      const p = sparkPhotos[i] as AnyRow
      const photoUrl = safeStr(
        p.Uri1600 ?? p.Uri1280 ?? p.Uri1024 ?? p.Uri800 ?? p.Uri640 ?? p.Uri300 ?? p.Uri ?? p.URL ?? p.Url
      )
      if (!photoUrl) continue
      photos.push({
        id: `spark-photo-${i}`,
        listing_key: listingKey,
        photo_url: photoUrl,
        cdn_url: null,
        sort_order: typeof p.Order === 'number' ? p.Order : i,
        caption: safeStr(p.Caption),
        is_hero: p.Primary === true || i === 0,
      })
    }
  }

  // If no photos from details.Photos, use the top-level PhotoURL
  if (photos.length === 0 && row.PhotoURL) {
    const photoUrl = safeStr(row.PhotoURL)
    if (photoUrl) {
      photos.push({
        id: 'hero-photo',
        listing_key: listingKey,
        photo_url: photoUrl,
        cdn_url: null,
        sort_order: 0,
        caption: null,
        is_hero: true,
      })
    }
  }

  return photos
}

/**
 * Extract agent info from row top-level columns and details JSONB.
 */
function extractAgentsFromRow(row: AnyRow): ListingDetailAgent[] {
  const listingKey = String(row.ListingKey ?? '')
  const d = (row.details ?? {}) as AnyRow
  const agents: ListingDetailAgent[] = []

  // List agent
  const listAgentName = safeStr(row.ListAgentName ?? d.ListAgentName)
  const listOfficeName = safeStr(row.ListOfficeName ?? d.ListOfficeName)
  if (listAgentName || listOfficeName) {
    agents.push({
      id: 'list-agent',
      listing_key: listingKey,
      agent_role: 'list',
      agent_name: listAgentName,
      agent_mls_id: safeStr(d.ListAgentMlsId),
      agent_license: safeStr(d.ListAgentStateLicense),
      agent_email: safeStr(d.ListAgentEmail),
      agent_phone: safeStr(d.ListAgentDirectPhone ?? d.ListAgentCellPhone ?? d.ListAgentOfficePhone),
      office_name: listOfficeName,
      office_mls_id: safeStr(d.ListOfficeMlsId),
      office_phone: safeStr(d.ListOfficePhone),
    })
  }

  // Buyer agent (if present, for closed listings)
  const buyerAgentName = safeStr(d.BuyerAgentName)
  const buyerOfficeName = safeStr(d.BuyerOfficeName)
  if (buyerAgentName || buyerOfficeName) {
    agents.push({
      id: 'buyer-agent',
      listing_key: listingKey,
      agent_role: 'buyer',
      agent_name: buyerAgentName,
      agent_mls_id: safeStr(d.BuyerAgentMlsId),
      agent_license: safeStr(d.BuyerAgentStateLicense),
      agent_email: safeStr(d.BuyerAgentEmail),
      agent_phone: safeStr(d.BuyerAgentDirectPhone ?? d.BuyerAgentCellPhone),
      office_name: buyerOfficeName,
      office_mls_id: safeStr(d.BuyerOfficeMlsId),
      office_phone: safeStr(d.BuyerOfficePhone),
    })
  }

  return agents
}

/**
 * Extract open houses from the top-level OpenHouses JSONB column.
 */
function extractOpenHousesFromRow(row: AnyRow): ListingDetailOpenHouse[] {
  const listingKey = String(row.ListingKey ?? '')
  const ohArr = Array.isArray(row.OpenHouses) ? row.OpenHouses : []
  const today = new Date().toISOString().slice(0, 10)
  const openHouses: ListingDetailOpenHouse[] = []

  for (let i = 0; i < ohArr.length; i++) {
    const oh = ohArr[i] as AnyRow
    const eventDate = safeStr(oh.Date) ?? safeStr(oh.EventDate) ?? ''
    if (!eventDate) continue
    // Only future/today open houses
    if (eventDate.slice(0, 10) < today) continue
    openHouses.push({
      id: `oh-${i}`,
      listing_key: listingKey,
      event_date: eventDate,
      start_time: safeStr(oh.StartTime),
      end_time: safeStr(oh.EndTime),
      host_agent_name: safeStr(oh.HostAgentName ?? oh.AgentName),
      remarks: safeStr(oh.Remarks ?? oh.Description),
    })
  }

  return openHouses
}

/**
 * Extract a playable video URL from Spark's ObjectHtml field.
 * ObjectHtml may be:
 * - An iframe embed: `<iframe ... src="//www.youtube.com/embed/XYZ" ...>`
 * - A direct URL: `https://s3.amazonaws.com/.../out.mp4`
 * - A Vimeo player URL: `https://player.vimeo.com/video/12345...`
 */
function extractVideoUrlFromObjectHtml(html: string | null | undefined): string | null {
  if (!html?.trim()) return null
  const s = html.trim()

  // If it's a direct URL (starts with http, no HTML tags)
  if (/^https?:\/\//.test(s) && !s.includes('<')) return s

  // Extract src from iframe
  const srcMatch = s.match(/src=["']([^"']+)["']/i)
  if (srcMatch?.[1]) {
    let url = srcMatch[1]
    // Fix protocol-relative URLs
    if (url.startsWith('//')) url = `https:${url}`
    return url
  }

  // Extract href from anchor tags
  const hrefMatch = s.match(/href=["']([^"']+)["']/i)
  if (hrefMatch?.[1]) return hrefMatch[1]

  return null
}

/**
 * Extract videos from details JSONB.
 */
function extractVideosFromRow(row: AnyRow): SparkVideo[] {
  const d = (row.details ?? {}) as AnyRow
  const videoArr = Array.isArray(d.Videos) ? d.Videos : []
  const videos: SparkVideo[] = []

  for (const v of videoArr) {
    const item = v as AnyRow
    // Try direct Uri/URL fields first, then parse ObjectHtml
    const uri = safeStr(item.Uri ?? item.URL ?? item.Url) ?? extractVideoUrlFromObjectHtml(safeStr(item.ObjectHtml))
    if (!uri) continue
    videos.push({
      Id: safeStr(item.Id) ?? `video-${videos.length}`,
      Uri: uri,
    })
  }

  return videos
}

/**
 * Extract virtual tours from details JSONB.
 */
function extractVirtualToursFromRow(row: AnyRow): SparkVirtualTour[] {
  const d = (row.details ?? {}) as AnyRow
  const tours: SparkVirtualTour[] = []

  // Check VirtualTours array
  const tourArr = Array.isArray(d.VirtualTours) ? d.VirtualTours : []
  for (const t of tourArr) {
    const item = t as AnyRow
    const uri = safeStr(item.Uri ?? item.URL ?? item.Url)
    if (!uri) continue
    tours.push({
      Id: safeStr(item.Id) ?? `vt-${tours.length}`,
      Uri: uri,
      Name: safeStr(item.Name) ?? 'Virtual tour',
    })
  }

  // Check VirtualTourURLUnbranded as fallback
  if (tours.length === 0) {
    const vtUrl = safeStr(d.VirtualTourURLUnbranded ?? d.VirtualTourURL)
    if (vtUrl) {
      tours.push({ Id: 'vt0', Uri: vtUrl, Name: 'Virtual tour' })
    }
  }

  return tours
}

/** Fetch listing by ListingKey with all related data for the listing detail page. */
export async function getListingDetailData(listingKey: string): Promise<ListingDetailData | null> {
  const supabase = getSupabase()
  const requestedKey = String(listingKey ?? '').trim()
  if (!requestedKey) return null

  // Resolve the key (handles mls#, key-zip, etc.)
  const resolvedKey = (await resolveListingKeyFromSlug(supabase, requestedKey)) ?? requestedKey

  // Query the actual PascalCase listings table — NO properties(*) join
  let listingRow: AnyRow | null = null
  const DETAIL_LISTING_SELECT =
    'ListingKey, ListNumber, ListPrice, OriginalListPrice, ClosePrice, StandardStatus, OnMarketDate, CloseDate, ModificationTimestamp, BedroomsTotal, BathroomsTotal, TotalLivingAreaSqFt, SubdivisionName, PropertyType, StreetNumber, StreetName, City, State, PostalCode, Latitude, Longitude, PhotoURL, OpenHouses, details, year_built, price_per_sqft, close_price_per_sqft, sale_to_list_ratio, sale_to_final_list_ratio, total_price_change_pct, total_price_change_amt, estimated_monthly_piti, lot_size_acres, lot_size_sqft, garage_yn, garage_spaces, pool_yn, fireplace_yn, waterfront_yn, basement_yn, stories_total, property_sub_type, architectural_style, new_construction_yn, county, school_district, elementary_school, middle_school, high_school, tax_annual_amount, tax_assessed_value, tax_rate, hoa_monthly, hoa_annual_cost, property_age, listing_quality_score, photos_count, virtual_tour_url, public_remarks, DaysOnMarket, price_drop_count'

  const { data: byKey } = await supabase
    .from('listings')
    .select(DETAIL_LISTING_SELECT)
    .eq('ListingKey', resolvedKey)
    .maybeSingle()
  listingRow = byKey

  // Fallback: try by ListNumber
  if (!listingRow) {
    const { data: byNum } = await supabase
      .from('listings')
      .select(DETAIL_LISTING_SELECT)
      .eq('ListNumber', resolvedKey)
      .maybeSingle()
    listingRow = byNum
  }

  if (!listingRow) return null

  const canonicalKey = String(listingRow.ListingKey ?? resolvedKey).trim()

  // Map to our typed shapes
  const listing = mapRowToListing(listingRow)
  const property = mapRowToProperty(listingRow)

  // Extract photos from details JSONB + PhotoURL, with listing_photos table as override
  let photos = extractPhotosFromRow(listingRow)
  try {
    const { data: dbPhotos } = await supabase
      .from('listing_photos')
      .select('id, listing_key, photo_url, cdn_url, sort_order, caption, is_hero')
      .eq('listing_key', canonicalKey)
      .order('sort_order', { ascending: true })
    if (dbPhotos && dbPhotos.length > 0) {
      photos = dbPhotos as ListingDetailPhoto[]
    }
  } catch { /* table may not have data — use extracted photos */ }

  // Extract agents from row/details, with listing_agents table as override
  let agents = extractAgentsFromRow(listingRow)
  try {
    const { data: dbAgents } = await supabase
      .from('listing_agents')
      .select('id, listing_key, agent_role, agent_name, agent_mls_id, agent_license, agent_email, agent_phone, office_name, office_mls_id, office_phone')
      .eq('listing_key', canonicalKey)
      .in('agent_role', ['list', 'listing'])
    if (dbAgents && dbAgents.length > 0) {
      agents = dbAgents as ListingDetailAgent[]
    }
  } catch { /* table may not have data */ }

  // Extract open houses from row, with open_houses table as override
  let openHouses = extractOpenHousesFromRow(listingRow)
  try {
    const { data: dbOH } = await supabase
      .from('open_houses')
      .select('id, listing_key, event_date, start_time, end_time, host_agent_name, remarks')
      .eq('listing_key', canonicalKey)
      .gte('event_date', new Date().toISOString().slice(0, 10))
      .order('event_date', { ascending: true })
    if (dbOH && dbOH.length > 0) {
      openHouses = dbOH as ListingDetailOpenHouse[]
    }
  } catch { /* use extracted open houses */ }

  // Extract videos from details, with listing_videos table as override
  let videos = extractVideosFromRow(listingRow)
  try {
    const { data: dbVideos } = await supabase
      .from('listing_videos')
      .select('id, video_url, sort_order')
      .eq('listing_key', canonicalKey)
      .order('sort_order', { ascending: true })
    if (dbVideos && dbVideos.length > 0) {
      videos = dbVideos.map((r: AnyRow) => ({
        Id: r.id,
        Uri: r.video_url,
      }))
    }
  } catch { /* use extracted videos */ }

  const virtualTours = extractVirtualToursFromRow(listingRow)

  // Fetch listing_history (2M+ rows available — this is the real data source)
  // Also fetch engagement metrics
  const [histRowsRaw, engagementRaw] = await Promise.all([
    withTimeout(
      Promise.resolve(
        supabase
          .from('listing_history')
          .select('id, listing_key, event, event_date, price, price_change, description, raw')
          .eq('listing_key', canonicalKey)
          .order('event_date', { ascending: true })
          .limit(100)
      ).then((res) => res.data ?? []),
      [],
      2500
    ),
    withTimeout(
      Promise.resolve(
        supabase
          .from('engagement_metrics')
          .select('listing_key, view_count, like_count, save_count, share_count')
          .eq('listing_key', canonicalKey)
          .maybeSingle()
      ).then((res) => res.data ?? null),
      null,
      1200
    ),
  ])

  const histRows = (histRowsRaw ?? []) as Array<{
    id?: string
    listing_key?: string
    event?: string
    event_date?: string
    price?: number | null
    price_change?: number | null
    description?: string | null
    raw?: AnyRow | null
  }>

  // --- Extract price history from listing_history raw JSONB ---
  // raw.Field = 'ListPrice' has PreviousValue (old price) and NewValue (new price)
  const priceHistory: ListingDetailPriceHistory[] = histRows
    .filter((h) => {
      const field = (h.raw ?? {}).Field
      return field === 'ListPrice'
    })
    .map((h, idx) => {
      const raw = h.raw ?? {}
      const oldPrice = safeNum(raw.PreviousValue)
      const newPrice = safeNum(raw.NewValue)
      const changePct = oldPrice && newPrice ? ((newPrice - oldPrice) / oldPrice) * 100 : (h.price_change != null ? h.price_change * 100 : null)
      return {
        id: h.id ?? `ph-${idx}`,
        listing_key: canonicalKey,
        old_price: oldPrice,
        new_price: newPrice,
        change_pct: changePct,
        changed_at: h.event_date ?? '',
      }
    })
    .filter((p) => p.old_price != null || p.new_price != null)

  // --- Extract status history from listing_history raw JSONB ---
  // raw.Field = 'MlsStatus' has PreviousValue (old status) and NewValue (new status)
  const statusHistory: ListingDetailStatusHistory[] = histRows
    .filter((h) => {
      const field = (h.raw ?? {}).Field
      return field === 'MlsStatus'
    })
    .map((h, idx) => {
      const raw = h.raw ?? {}
      return {
        id: h.id ?? `sh-${idx}`,
        listing_key: canonicalKey,
        old_status: safeStr(raw.PreviousValue),
        new_status: safeStr(raw.NewValue),
        changed_at: h.event_date ?? '',
      }
    })

  // --- Build full listing timeline for user-facing display ---
  // Filter to events a buyer cares about: new listing, price changes, status changes, close, back on market
  const listingHistory: ListingHistoryEvent[] = []
  const seenEvents = new Set<string>()

  for (const h of histRows) {
    const raw = h.raw ?? {}
    const field = String(raw.Field ?? '')
    const eventDate = h.event_date ?? ''
    let evt: ListingHistoryEvent | null = null

    if (h.event === 'NewListing') {
      evt = {
        id: h.id ?? `lh-new-${listingHistory.length}`,
        listing_key: canonicalKey,
        event_date: eventDate,
        event_type: 'new_listing',
        label: `Listed at ${formatHistoryPrice(h.price)}`,
        price: h.price ?? null,
        old_value: null,
        new_value: null,
        change_pct: null,
      }
    } else if (h.event === 'BackOnMarket') {
      evt = {
        id: h.id ?? `lh-bom-${listingHistory.length}`,
        listing_key: canonicalKey,
        event_date: eventDate,
        event_type: 'back_on_market',
        label: `Back on market at ${formatHistoryPrice(h.price)}`,
        price: h.price ?? null,
        old_value: null,
        new_value: null,
        change_pct: null,
      }
    } else if (field === 'ListPrice') {
      const oldP = safeNum(raw.PreviousValue)
      const newP = safeNum(raw.NewValue)
      if (oldP != null && newP != null) {
        const pct = oldP > 0 ? ((newP - oldP) / oldP) * 100 : null
        const direction = newP < oldP ? 'reduced' : 'increased'
        evt = {
          id: h.id ?? `lh-price-${listingHistory.length}`,
          listing_key: canonicalKey,
          event_date: eventDate,
          event_type: 'price_change',
          label: `Price ${direction} to ${formatHistoryPrice(newP)}`,
          price: newP,
          old_value: String(oldP),
          new_value: String(newP),
          change_pct: pct,
        }
      }
    } else if (field === 'MlsStatus') {
      const oldS = safeStr(raw.PreviousValue)
      const newS = safeStr(raw.NewValue)
      if (newS === 'Closed') {
        // For closed events, find the ClosePrice if available
        const closePriceRow = histRows.find((r) => (r.raw ?? {}).Field === 'ClosePrice' && r.event_date === eventDate)
        const closePrice = closePriceRow ? safeNum((closePriceRow.raw ?? {}).NewValue) : h.price
        evt = {
          id: h.id ?? `lh-closed-${listingHistory.length}`,
          listing_key: canonicalKey,
          event_date: eventDate,
          event_type: 'closed',
          label: `Sold for ${formatHistoryPrice(closePrice)}`,
          price: closePrice ?? h.price ?? null,
          old_value: oldS,
          new_value: newS,
          change_pct: h.price_change != null ? h.price_change * 100 : null,
        }
      } else if (oldS && newS) {
        evt = {
          id: h.id ?? `lh-status-${listingHistory.length}`,
          listing_key: canonicalKey,
          event_date: eventDate,
          event_type: 'status_change',
          label: `${oldS} → ${newS}`,
          price: h.price ?? null,
          old_value: oldS,
          new_value: newS,
          change_pct: null,
        }
      }
    }

    if (evt) {
      // Deduplicate by date + type + label
      const key = `${evt.event_date}-${evt.event_type}-${evt.label}`
      if (!seenEvents.has(key)) {
        seenEvents.add(key)
        listingHistory.push(evt)
      }
    }
  }

  const engagement = (engagementRaw ?? null) as ListingDetailEngagement | null

  // Resolve community from SubdivisionName, including neighborhood if assigned
  let community: ListingDetailCommunity | null = null
  const subdivisionName = safeStr(listingRow.SubdivisionName)
  if (subdivisionName) {
    const communitySlug = slugify(subdivisionName)
    try {
      // First try with neighborhood join via neighborhood_id FK
      const { data: comm } = await supabase
        .from('communities')
        .select('id, name, slug, neighborhood_id, city_id')
        .eq('slug', communitySlug)
        .maybeSingle()
      if (comm) {
        let neighborhoodName: string | null = null
        let neighborhoodSlug: string | null = null
        let citySlugResolved: string | null = null

        // Resolve neighborhood if community has one
        if (comm.neighborhood_id) {
          const { data: nh } = await supabase
            .from('neighborhoods')
            .select('name, slug')
            .eq('id', comm.neighborhood_id)
            .maybeSingle()
          if (nh) {
            neighborhoodName = nh.name ?? null
            neighborhoodSlug = nh.slug ?? null
          }
        }

        // Resolve city slug if community has city_id
        if (comm.city_id) {
          const { data: cityRow } = await supabase
            .from('cities')
            .select('slug')
            .eq('id', comm.city_id)
            .maybeSingle()
          if (cityRow) {
            citySlugResolved = cityRow.slug ?? null
          }
        }

        // Fall back to city slug from listing data
        if (!citySlugResolved && listingRow.City) {
          citySlugResolved = slugify(listingRow.City)
        }

        community = {
          id: comm.id,
          name: comm.name,
          slug: comm.slug,
          neighborhood_name: neighborhoodName,
          neighborhood_slug: neighborhoodSlug,
          city_slug: citySlugResolved,
        }
      }
    } catch { /* community lookup failed — continue without it */ }
  }

  return {
    listing,
    property,
    photos,
    agents,
    priceHistory,
    statusHistory,
    listingHistory,
    engagement,
    openHouses,
    community,
    videos,
    virtualTours,
  }
}

/* ---------- Similar listings ---------- */

export type SimilarListingForDetail = {
  listing_key: string
  list_number: string | null
  mls_source: string | null
  list_price: number | null
  beds_total: number | null
  baths_full: number | null
  living_area: number | null
  subdivision_name: string | null
  address: string
  photo_url: string | null
  /** For SEO listing URL slug (city, state, postal_code). */
  city?: string | null
  state?: string | null
  postal_code?: string | null
}

// PascalCase select for similar listings — returns ListingTileRow-compatible data
const SIMILAR_TILE_SELECT =
  'ListingKey, ListNumber, ListPrice, BedroomsTotal, BathroomsTotal, TotalLivingAreaSqFt, SubdivisionName, StreetNumber, StreetName, City, State, PostalCode, PhotoURL, Latitude, Longitude, ModificationTimestamp, PropertyType, StandardStatus, OnMarketDate, ClosePrice, CloseDate'

/** Similar listings: same community or city, ±20% price, ±1 beds, Active, exclude current, limit 6. */
/** Map a DAL ListingTile → SimilarListingForDetail shape callers expect. */
function tileToSimilarDetail(tile: ListingTile): SimilarListingForDetail {
  const address = [
    [tile.streetNumber, tile.streetName].filter(Boolean).join(' '),
    tile.city,
    null, // state — listing_tile_mv doesn't carry it; legacy code put 'OR' here optionally
    tile.postalCode,
  ].filter(Boolean).join(', ')
  return {
    listing_key: tile.listingKey,
    list_number: tile.listNumber,
    mls_source: null,
    list_price: tile.listPrice,
    beds_total: tile.beds,
    baths_full: tile.baths,
    living_area: tile.sqft,
    subdivision_name: tile.subdivisionName,
    address,
    photo_url: tile.photoUrl,
    city: tile.city,
    state: null,
    postal_code: tile.postalCode,
  }
}

export async function getSimilarListingsForDetailPage(
  excludeListingKey: string,
  communityName: string | null,
  city: string | null,
  price: number | null,
  beds: number | null
): Promise<SimilarListingForDetail[]> {
  const key = String(excludeListingKey ?? '').trim()
  if (!key) return []

  const priceMin = price != null ? Math.round(price * 0.8) : undefined
  const priceMax = price != null ? Math.round(price * 1.2) : undefined
  const bedsMin = beds != null ? Math.max(1, beds - 1) : undefined

  // DAL: read from listing_tile_mv. Prefer community-scoped, fall back to
  // city-scoped if too few results, mirroring legacy behavior. Photo filter
  // applied client-side (the MV carries photo_url + the DAL doesn't filter
  // on photo presence today — small post-fetch filter is cheap).
  const trySize = 12
  let tiles: ListingTile[] = []
  if (communityName?.trim()) {
    tiles = await getCommunityListingsDAL(communityName.trim(), {
      status: 'active',
      sort: 'newest',
      limit: trySize,
      minPrice: priceMin,
      maxPrice: priceMax,
      minBeds: bedsMin,
    })
  } else if (city?.trim()) {
    tiles = await getCityListingsDAL(city.trim(), {
      status: 'active',
      sort: 'newest',
      limit: trySize,
      minPrice: priceMin,
      maxPrice: priceMax,
      minBeds: bedsMin,
    })
  }

  // Fallback: community-scoped returned too few, broaden to city.
  if (tiles.length < 4 && communityName?.trim() && city?.trim()) {
    const fallbackTiles = await getCityListingsDAL(city.trim(), {
      status: 'active',
      sort: 'newest',
      limit: trySize,
      minPrice: priceMin,
      maxPrice: priceMax,
    })
    if (fallbackTiles.length > tiles.length) tiles = fallbackTiles
  }

  return tiles
    .filter((t) => t.listingKey !== key && t.photoUrl)
    .slice(0, 6)
    .map(tileToSimilarDetail)
}

/** Get other active listings in the same subdivision (for "Other homes in [Subdivision]" section). */
export async function getSubdivisionListings(
  excludeListingKey: string,
  subdivisionName: string | null,
  city: string | null,
  limit = 8,
): Promise<SimilarListingForDetail[]> {
  if (!subdivisionName?.trim() || !city?.trim()) return []

  // DAL: read from listing_tile_mv via getCommunityListings. Sort by
  // price-desc (legacy behavior was ORDER BY ListPrice DESC).
  const tiles = await getCommunityListingsDAL(subdivisionName.trim(), {
    status: 'active',
    sort: 'price-desc',
    limit: Math.max(limit + 4, 12),
  })

  return tiles
    .filter(
      (t) =>
        t.listingKey !== excludeListingKey &&
        t.photoUrl &&
        t.city?.toLowerCase().trim() === city.toLowerCase().trim(),
    )
    .slice(0, limit)
    .map(tileToSimilarDetail)
}

