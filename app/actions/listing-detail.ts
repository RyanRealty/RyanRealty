'use server'

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function getSupabase() {
  if (!url?.trim() || !anonKey?.trim()) throw new Error('Supabase not configured')
  return createClient(url, anonKey)
}

export type ListingDetailListing = {
  id: string
  listing_key: string
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
}

/** Fetch listing by listing_key with all related data for the listing detail page. */
export async function getListingDetailData(listingKey: string): Promise<ListingDetailData | null> {
  const supabase = getSupabase()
  const key = String(listingKey ?? '').trim()
  if (!key) return null

  // Try snake_case first (migration 002), then PascalCase (legacy)
  const listingResSnake = await supabase
    .from('listings')
    .select('*, properties(*)')
    .eq('listing_key', key)
    .maybeSingle()
  const listingRes =
    listingResSnake.data != null
      ? listingResSnake
      : await supabase.from('listings').select('*, properties(*)').eq('ListingKey', key).maybeSingle()

  const listingRow = listingRes.data as (ListingDetailListing & { properties?: ListingDetailProperty | ListingDetailProperty[] | null }) | null
  if (!listingRow) return null

  const resolvedKey =
    (listingRow as { listing_key?: string }).listing_key ??
    (listingRow as { ListingKey?: string }).ListingKey ??
    key

  const [photosRes, agentsRes, priceRes, statusRes, engagementRes, openHousesRes] = await Promise.all([
    supabase.from('listing_photos').select('*').eq('listing_key', resolvedKey).order('sort_order', { ascending: true }),
    supabase.from('listing_agents').select('*').eq('listing_key', resolvedKey).in('agent_role', ['list', 'listing']),
    supabase.from('price_history').select('*').eq('listing_key', resolvedKey).order('changed_at', { ascending: false }),
    supabase.from('status_history').select('*').eq('listing_key', resolvedKey).order('changed_at', { ascending: false }),
    supabase.from('engagement_metrics').select('*').eq('listing_key', resolvedKey).maybeSingle(),
    supabase
      .from('open_houses')
      .select('*')
      .eq('listing_key', resolvedKey)
      .gte('event_date', new Date().toISOString().slice(0, 10))
      .order('event_date', { ascending: true }),
  ])

  const { properties: propertyRaw, ...rest } = listingRow
  const listing: ListingDetailListing = { ...(rest as Record<string, unknown>), listing_key: resolvedKey } as ListingDetailListing
  const property: ListingDetailProperty | null = Array.isArray(propertyRaw)
    ? (propertyRaw[0] as ListingDetailProperty) ?? null
    : (propertyRaw as ListingDetailProperty) ?? null

  const photos = (photosRes.data ?? []) as ListingDetailPhoto[]
  const agents = (agentsRes.data ?? []) as ListingDetailAgent[]
  const priceHistory = (priceRes.data ?? []) as ListingDetailPriceHistory[]
  const statusHistory = (statusRes.data ?? []) as ListingDetailStatusHistory[]
  const engagement = (engagementRes.data ?? null) as ListingDetailEngagement | null
  const openHouses = (openHousesRes.data ?? []) as ListingDetailOpenHouse[]

  let community: ListingDetailCommunity | null = null
  if (property?.community_id) {
    const { data: comm } = await supabase
      .from('communities')
      .select('id, name, slug')
      .eq('id', property.community_id)
      .maybeSingle()
    community = comm as ListingDetailCommunity | null
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
  }
}

export type SimilarListingForDetail = {
  listing_key: string
  list_price: number | null
  beds_total: number | null
  baths_full: number | null
  living_area: number | null
  subdivision_name: string | null
  address: string
  photo_url: string | null
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

  let query = supabase
    .from('listings')
    .select('listing_key, list_price, beds_total, baths_full, living_area, subdivision_name, properties(unparsed_address, city, state, postal_code)')
    .neq('listing_key', key)
    .or('standard_status.ilike.%Active%,standard_status.is.null')
    .limit(12)

  if (communityName?.trim()) {
    query = query.ilike('subdivision_name', communityName.trim())
  }
  // City filter omitted: listings table may not have city (it lives on properties in migration 002)
  if (priceMin != null) query = query.gte('list_price', priceMin)
  if (priceMax != null) query = query.lte('list_price', priceMax)
  if (bedsMin != null) query = query.gte('beds_total', bedsMin)
  if (bedsMax != null) query = query.lte('beds_total', bedsMax)

  const { data } = await query
  const rows = (data ?? []) as Array<{
    listing_key: string
    list_price: number | null
    beds_total: number | null
    baths_full: number | null
    living_area: number | null
    subdivision_name: string | null
    properties?: { unparsed_address?: string; city?: string; state?: string; postal_code?: string } | null
  }>
  const keys = rows.slice(0, 6).map((r) => r.listing_key)
  if (keys.length === 0) return []

  const { data: photosData } = await supabase
    .from('listing_photos')
    .select('listing_key, photo_url, cdn_url, sort_order')
    .in('listing_key', keys)
    .order('sort_order', { ascending: true })

  const firstPhotoByKey = new Map<string, string>()
  for (const p of photosData ?? []) {
    const k = (p as { listing_key: string }).listing_key
    if (!firstPhotoByKey.has(k)) {
      firstPhotoByKey.set(k, (p as { cdn_url?: string; photo_url: string }).cdn_url ?? (p as { photo_url: string }).photo_url)
    }
  }

  return rows.slice(0, 6).map((r) => {
    const prop = r.properties
    const address = prop?.unparsed_address ?? [prop?.city, prop?.state, prop?.postal_code].filter(Boolean).join(', ') ?? ''
    return {
      listing_key: r.listing_key,
      list_price: r.list_price,
      beds_total: r.beds_total,
      baths_full: r.baths_full,
      living_area: r.living_area,
      subdivision_name: r.subdivision_name,
      address,
      photo_url: firstPhotoByKey.get(r.listing_key) ?? null,
    }
  })
}
