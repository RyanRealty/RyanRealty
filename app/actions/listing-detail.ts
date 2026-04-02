'use server'

import { createClient } from '@supabase/supabase-js'
import type { SparkVideo, SparkVirtualTour } from '@/lib/spark'
import { listingAddressSlug, slugify } from '@/lib/slug'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function getSupabase() {
  if (!url?.trim() || !anonKey?.trim()) throw new Error('Supabase not configured')
  return createClient(url, anonKey)
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
  const s = String(v).trim()
  if (!s || /^\*+$/.test(s)) return null
  return s
}

function safeBool(v: unknown): boolean | null {
  if (v === true || v === 'true' || v === 'Y' || v === 'Yes') return true
  if (v === false || v === 'false' || v === 'N' || v === 'No') return false
  return null
}

/* ---------- Exported types (unchanged — page components depend on these) ---------- */

export type ListingDetailListing = {
  id: string
  listing_key: string
  list_number: string | null
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

export type ListingDetailData = {
  listing: ListingDetailListing
  property: ListingDetailProperty | null
  photos: ListingDetailPhoto[]
  agents: ListingDetailAgent[]
  priceHistory: ListingDetailPriceHistory[]
  statusHistory: ListingDetailStatusHistory[]
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

    // Try ListingKey first, then ListNumber
    try {
      const { data } = await supabase.from('listings').select('ListingKey').eq('ListingKey', c).limit(1)
      if (data?.[0]?.ListingKey) return String(data[0].ListingKey).trim()
    } catch { /* ignore */ }

    try {
      const { data } = await supabase.from('listings').select('ListingKey').eq('ListNumber', c).limit(1)
      if (data?.[0]?.ListingKey) return String(data[0].ListingKey).trim()
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
  const cityLike = decodeURIComponent(input.citySlug || '').replace(/-/g, ' ').trim()
  if (!cityLike) return null

  // Try to narrow search by extracting street number from address slug
  const streetNumMatch = addressSlug.match(/^(\d+)/)
  let query = supabase
    .from('listings')
    .select('ListingKey, ListNumber, StreetNumber, StreetName, City, State, PostalCode, SubdivisionName, ModificationTimestamp')
    .ilike('City', cityLike)
  if (streetNumMatch) {
    query = query.eq('StreetNumber', streetNumMatch[1]!)
  }
  const { data } = await query.limit(1000)

  const rows = (data ?? []) as Array<{
    ListingKey?: string | null
    ListNumber?: string | null
    StreetNumber?: string | null
    StreetName?: string | null
    City?: string | null
    State?: string | null
    PostalCode?: string | null
    SubdivisionName?: string | null
    ModificationTimestamp?: string | null
  }>

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

  const areaSlugs = (input.areaSlugs ?? []).map((s) => slugify(decodeURIComponent(s || ''))).filter(Boolean)
  const postalCode = String(input.postalCode ?? '').trim().replace(/\D/g, '').slice(0, 5)
  const cityLike = decodeURIComponent(input.citySlug || '').replace(/-/g, ' ').trim()
  if (!cityLike) return null

  // Try direct lookup by key/MLS number first (avoids fetching all city listings)
  const { data: directByKey } = await supabase
    .from('listings')
    .select('ListingKey, ListNumber, City, PostalCode, SubdivisionName, ModificationTimestamp')
    .or(`ListingKey.eq.${keyOrMls},ListNumber.eq.${keyOrMls}`)
    .limit(5)
  if (directByKey && directByKey.length > 0) {
    return (directByKey[0] as { ListingKey?: string }).ListingKey ?? null
  }

  // Fallback: search within city
  const { data } = await supabase
    .from('listings')
    .select('ListingKey, ListNumber, City, PostalCode, SubdivisionName, ModificationTimestamp')
    .ilike('City', cityLike)
    .limit(1000)

  const rows = (data ?? []) as Array<{
    ListingKey?: string | null
    ListNumber?: string | null
    City?: string | null
    PostalCode?: string | null
    SubdivisionName?: string | null
    ModificationTimestamp?: string | null
  }>

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
  return top.ListingKey ?? top.ListNumber ?? null
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

  // Compute days on market from OnMarketDate if not in details
  let dom = safeNum(d.DaysOnMarket)
  let cdom = safeNum(d.CumulativeDaysOnMarket)
  if (dom == null && row.OnMarketDate) {
    const onMarket = new Date(row.OnMarketDate)
    if (!Number.isNaN(onMarket.getTime())) {
      dom = Math.max(0, Math.floor((Date.now() - onMarket.getTime()) / (24 * 60 * 60 * 1000)))
    }
  }
  if (cdom == null) cdom = dom

  return {
    id: listingKey,
    listing_key: listingKey,
    list_number: safeStr(row.ListNumber),
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

  const { data: byKey } = await supabase
    .from('listings')
    .select('*')
    .eq('ListingKey', resolvedKey)
    .maybeSingle()
  listingRow = byKey

  // Fallback: try by ListNumber
  if (!listingRow) {
    const { data: byNum } = await supabase
      .from('listings')
      .select('*')
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
      .select('*')
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
      .select('*')
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
      .select('*')
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

  // Price/status history: try dedicated tables first, fall back to listing_history
  const [priceRes, statusRes, historyRes, engagementRes] = await Promise.all([
    supabase.from('price_history').select('*').eq('listing_key', canonicalKey).order('changed_at', { ascending: false }),
    supabase.from('status_history').select('*').eq('listing_key', canonicalKey).order('changed_at', { ascending: false }),
    supabase.from('listing_history').select('*').eq('listing_key', canonicalKey).order('event_date', { ascending: false }).limit(50),
    supabase.from('engagement_metrics').select('*').eq('listing_key', canonicalKey).maybeSingle(),
  ])

  // Use dedicated price_history if available; otherwise derive from listing_history
  let priceHistory = (priceRes.data ?? []) as ListingDetailPriceHistory[]
  if (priceHistory.length === 0 && (historyRes.data ?? []).length > 0) {
    const histRows = (historyRes.data ?? []) as Array<{
      event_date?: string | null
      event?: string | null
      description?: string | null
      price?: number | null
      price_change?: number | null
    }>
    // Extract price-related events from listing_history
    priceHistory = histRows
      .filter((h) => h.price != null && h.price > 0)
      .map((h) => ({
        id: '',
        listing_key: canonicalKey,
        changed_at: h.event_date ?? '',
        old_price: null,
        new_price: h.price ?? null,
        change_amount: h.price_change ?? null,
        change_pct: null,
        source: h.event ?? 'MLS',
      }))
      // Deduplicate by date+price
      .filter((item, idx, arr) => arr.findIndex((a) => a.changed_at === item.changed_at && a.new_price === item.new_price) === idx)
  }

  let statusHistory = (statusRes.data ?? []) as ListingDetailStatusHistory[]
  if (statusHistory.length === 0 && (historyRes.data ?? []).length > 0) {
    const histRows = (historyRes.data ?? []) as Array<{
      event_date?: string | null
      event?: string | null
      description?: string | null
    }>
    // Extract status-related events from listing_history
    statusHistory = histRows
      .filter((h) => h.event === 'StatusChange' || h.event === 'FieldChange' || (h.description ?? '').toLowerCase().includes('status'))
      .map((h) => ({
        id: '',
        listing_key: canonicalKey,
        changed_at: h.event_date ?? '',
        old_status: null,
        new_status: h.description ?? h.event ?? '',
        source: 'MLS',
      }))
      .filter((item, idx, arr) => arr.findIndex((a) => a.changed_at === item.changed_at && a.new_status === item.new_status) === idx)
  }

  const engagement = (engagementRes.data ?? null) as ListingDetailEngagement | null

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

/** Similar listings: same community or city, ±20% price, ±1 beds, Active, exclude current, limit 6. */
export async function getSimilarListingsForDetailPage(
  excludeListingKey: string,
  communityName: string | null,
  city: string | null,
  price: number | null,
  beds: number | null
): Promise<SimilarListingForDetail[]> {
  const supabase = getSupabase()
  const key = String(excludeListingKey ?? '').trim()
  if (!key) return []

  const priceMin = price != null ? price * 0.8 : null
  const priceMax = price != null ? price * 1.2 : null
  const bedsMin = beds != null ? Math.max(1, beds - 1) : null
  const bedsMax = beds != null ? beds + 1 : null

  // Query using actual PascalCase columns — only listings with photos
  let query = supabase
    .from('listings')
    .select('ListingKey, ListNumber, ListPrice, BedroomsTotal, BathroomsTotal, TotalLivingAreaSqFt, SubdivisionName, StreetNumber, StreetName, City, State, PostalCode, PhotoURL')
    .neq('ListingKey', key)
    .not('PhotoURL', 'is', null)
    .or('StandardStatus.ilike.%Active%,StandardStatus.is.null')
    .limit(12)

  if (communityName?.trim()) {
    query = query.ilike('SubdivisionName', communityName.trim())
  }
  if (city?.trim()) {
    query = query.ilike('City', city.trim())
  }
  if (priceMin != null) query = query.gte('ListPrice', priceMin)
  if (priceMax != null) query = query.lte('ListPrice', priceMax)
  if (bedsMin != null) query = query.gte('BedroomsTotal', bedsMin)
  if (bedsMax != null) query = query.lte('BedroomsTotal', bedsMax)

  let { data } = await query

  // Fallback: if community-specific query returns too few, try city-wide without community filter
  if ((!data || data.length < 4) && communityName?.trim() && city?.trim()) {
    let fallbackQuery = supabase
      .from('listings')
      .select('ListingKey, ListNumber, ListPrice, BedroomsTotal, BathroomsTotal, TotalLivingAreaSqFt, SubdivisionName, StreetNumber, StreetName, City, State, PostalCode, PhotoURL')
      .neq('ListingKey', key)
      .not('PhotoURL', 'is', null)
      .or('StandardStatus.ilike.%Active%,StandardStatus.is.null')
      .ilike('City', city.trim())
      .limit(12)
    if (priceMin != null) fallbackQuery = fallbackQuery.gte('ListPrice', priceMin)
    if (priceMax != null) fallbackQuery = fallbackQuery.lte('ListPrice', priceMax)
    const { data: fallbackData } = await fallbackQuery
    if (fallbackData && fallbackData.length > (data?.length ?? 0)) {
      data = fallbackData
    }
  }

  const rows = (data ?? []) as Array<{
    ListingKey: string
    ListNumber?: string | null
    ListPrice: number | null
    BedroomsTotal: number | null
    BathroomsTotal: number | null
    TotalLivingAreaSqFt: number | null
    SubdivisionName: string | null
    StreetNumber?: string | null
    StreetName?: string | null
    City?: string | null
    State?: string | null
    PostalCode?: string | null
    PhotoURL?: string | null
  }>

  return rows.slice(0, 6).map((r) => {
    const address = [
      [r.StreetNumber, r.StreetName].filter(Boolean).join(' '),
      r.City,
      r.State,
      r.PostalCode,
    ].filter(Boolean).join(', ')
    return {
      listing_key: r.ListingKey,
      list_price: r.ListPrice,
      beds_total: r.BedroomsTotal,
      baths_full: r.BathroomsTotal,
      living_area: r.TotalLivingAreaSqFt,
      subdivision_name: r.SubdivisionName,
      address,
      photo_url: r.PhotoURL ?? null,
      city: r.City ?? null,
      state: r.State ?? null,
      postal_code: r.PostalCode ?? null,
    }
  })
}

/** Get other active listings in the same subdivision (for "Other homes in [Subdivision]" section). */
export async function getSubdivisionListings(
  excludeListingKey: string,
  subdivisionName: string | null,
  city: string | null,
  limit = 8,
): Promise<SimilarListingForDetail[]> {
  const supabase = getSupabase()
  if (!subdivisionName?.trim() || !city?.trim()) return []

  const { data } = await supabase
    .from('listings')
    .select('ListingKey, ListNumber, ListPrice, BedroomsTotal, BathroomsTotal, TotalLivingAreaSqFt, SubdivisionName, StreetNumber, StreetName, City, State, PostalCode, PhotoURL')
    .neq('ListingKey', excludeListingKey)
    .ilike('SubdivisionName', subdivisionName.trim())
    .ilike('City', city.trim())
    .not('PhotoURL', 'is', null)
    .or('StandardStatus.ilike.%Active%,StandardStatus.is.null')
    .order('ListPrice', { ascending: false })
    .limit(limit)

  const rows = (data ?? []) as Array<{
    ListingKey: string
    ListNumber?: string | null
    ListPrice: number | null
    BedroomsTotal: number | null
    BathroomsTotal: number | null
    TotalLivingAreaSqFt: number | null
    SubdivisionName: string | null
    StreetNumber?: string | null
    StreetName?: string | null
    City?: string | null
    State?: string | null
    PostalCode?: string | null
    PhotoURL?: string | null
  }>

  return rows.map((r) => {
    const address = [
      [r.StreetNumber, r.StreetName].filter(Boolean).join(' '),
      r.City,
      r.State,
      r.PostalCode,
    ].filter(Boolean).join(', ')
    return {
      listing_key: r.ListingKey,
      list_price: r.ListPrice,
      beds_total: r.BedroomsTotal,
      baths_full: r.BathroomsTotal,
      living_area: r.TotalLivingAreaSqFt,
      subdivision_name: r.SubdivisionName,
      address,
      photo_url: r.PhotoURL ?? null,
      city: r.City ?? null,
      state: r.State ?? null,
      postal_code: r.PostalCode ?? null,
    }
  })
}
