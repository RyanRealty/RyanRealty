'use server'

import { createClient } from '@supabase/supabase-js'
import type { SparkVideo, SparkVirtualTour } from '@/lib/spark'
import { listingAddressSlug, slugify } from '@/lib/slug'
import {
  getCityListings as getCityListingsDAL,
} from '@/lib/data'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function getSupabase() {
  if (!url?.trim() || !anonKey?.trim()) throw new Error('Supabase not configured')
  return createClient(url, anonKey)
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
