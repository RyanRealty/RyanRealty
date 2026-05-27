/**
 * getListingDetail — fetch a full ListingDetail row for the detail page.
 *
 * Reads from `public.listing_detail_mv` (Wave 1.5, migration
 * `20260527150000_listing_detail_mv.sql`). The MV pre-projects every
 * column the detail page needs into a single indexed row, replacing the
 * 50-column raw read against `public.listings` that this function did
 * before. Unique index on `listing_key` → sub-5ms point lookup.
 *
 * Per docs/DATA_ACCESS_LAYER.md — every page that needs listing detail
 * data calls this function (never `.from('listings')` directly).
 *
 * The function deliberately does NOT fetch videos, photos, or similar
 * listings; callers should `Promise.all` getListingDetail +
 * getListingVideos + getSimilarListings + getListingPhotos to keep the
 * read path explicit and avoid making one mega-function that's
 * impossible to compose.
 *
 * Freshness: hourly refresh via /api/cron/refresh-mvs at :08
 * (CONCURRENTLY, no read lock). Detail data lags up to one hour after a
 * listings INSERT/UPDATE. The `unstable_cache` window stacks on top
 * (revalidate: 60s default), so the worst-case stale read is roughly
 * one hour. Per-row trigger pattern is deferred — lands in a follow-up
 * if staleness becomes a real complaint.
 */

import { unstable_cache } from 'next/cache'
import { z } from 'zod'
import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import type { ListingDetail, ListingStatus } from '@/lib/data/types/listing'

const InputSchema = z.object({
  listingKey: z.string().min(1).max(100),
})

export type GetListingDetailResult = ListingDetail | null

// MV column list — snake_case, no quoting needed. Order matches the
// migration's SELECT projection so a `select('*')` is fastest, but we
// keep the explicit projection for type-safety + grep-ability.
const DETAIL_MV_SELECT = [
  'listing_key',
  'list_number',
  'standard_status',
  'list_price',
  'original_list_price',
  'close_price',
  'close_date',
  'beds',
  'baths',
  'sqft',
  'street_number',
  'street_name',
  'city',
  'state',
  'postal_code',
  'subdivision_name',
  'lat',
  'lng',
  'photo_url',
  'property_type',
  'property_sub_type',
  'on_market_date',
  'modified_at',
  'dom',
  'list_agent_name',
  'list_agent_email',
  'list_office_name',
  'public_remarks',
  'price_per_sqft',
  'price_drop_count',
  'lot_size_acres',
  'year_built',
  'garage_spaces',
  'pool_yn',
  'has_virtual_tour',
  'fireplace_yn',
  'waterfront_yn',
  'architectural_style',
  'school_district',
  'elementary_school',
  'middle_school',
  'high_school',
  'tax_annual_amount',
  'tax_assessed_value',
  'hoa_monthly',
  'estimated_monthly_piti',
  'listing_quality_score',
  'sale_to_list_ratio',
  'address_slug',
  'boundary_city',
  'boundary_neighborhood',
  'boundary_subdivision',
  'refreshed_at',
].join(',')

type DetailMvRow = {
  listing_key: string
  list_number: string | null
  standard_status: ListingStatus
  list_price: number | null
  original_list_price: number | null
  close_price: number | null
  close_date: string | null
  beds: number | null
  baths: number | null
  sqft: number | null
  street_number: string | null
  street_name: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  subdivision_name: string | null
  lat: number | null
  lng: number | null
  photo_url: string | null
  property_type: string | null
  property_sub_type: string | null
  on_market_date: string | null
  modified_at: string | null
  dom: number | null
  list_agent_name: string | null
  list_agent_email: string | null
  list_office_name: string | null
  public_remarks: string | null
  price_per_sqft: number | null
  price_drop_count: number | null
  lot_size_acres: number | null
  year_built: number | null
  garage_spaces: number | null
  pool_yn: boolean | null
  has_virtual_tour: boolean | null
  fireplace_yn: boolean | null
  waterfront_yn: boolean | null
  architectural_style: string | null
  school_district: string | null
  elementary_school: string | null
  middle_school: string | null
  high_school: string | null
  tax_annual_amount: number | null
  tax_assessed_value: number | null
  hoa_monthly: number | null
  estimated_monthly_piti: number | null
  listing_quality_score: number | null
  sale_to_list_ratio: number | null
  address_slug: string | null
  boundary_city: string | null
  boundary_neighborhood: string | null
  boundary_subdivision: string | null
  refreshed_at: string | null
}

function slug(s: string | null | undefined): string | null {
  if (!s) return null
  return s.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

function rowToDetail(row: DetailMvRow): ListingDetail {
  const propertyAge =
    row.year_built && row.year_built > 1800
      ? new Date().getFullYear() - row.year_built
      : null
  const closePricePerSqft =
    row.close_price != null && row.sqft && row.sqft > 0
      ? Math.round(row.close_price / row.sqft)
      : null

  return {
    listingKey: row.listing_key,
    listNumber: row.list_number,
    status: row.standard_status,
    listPrice: row.list_price,
    closePrice: row.close_price,
    beds: row.beds,
    baths: row.baths,
    sqft: row.sqft,
    streetNumber: row.street_number,
    streetName: row.street_name,
    city: row.city,
    citySlug: slug(row.city),
    postalCode: row.postal_code,
    subdivisionName: row.subdivision_name,
    subdivisionSlug: slug(row.subdivision_name),
    lat: row.lat,
    lng: row.lng,
    photoUrl: row.photo_url,
    propertyType: row.property_type,
    propertySubType: row.property_sub_type,
    onMarketDate: row.on_market_date,
    modifiedAt: row.modified_at,
    pricePerSqft: row.price_per_sqft,
    lotSizeAcres: row.lot_size_acres,
    yearBuilt: row.year_built,
    garageSpaces: row.garage_spaces,
    poolYn: row.pool_yn,
    hasVirtualTour: row.has_virtual_tour,
    dom: row.dom,
    priceDropCount: row.price_drop_count,
    addressSlug: row.address_slug,
    boundaryCity: row.boundary_city,
    boundaryNeighborhood: row.boundary_neighborhood,
    boundarySubdivision: row.boundary_subdivision,

    // Detail-only fields
    originalListPrice: row.original_list_price,
    closeDate: row.close_date,
    totalLivingAreaSqFt: row.sqft,
    fireplaceYn: row.fireplace_yn,
    waterfrontYn: row.waterfront_yn,
    architecturalStyle: row.architectural_style,
    newConstructionYn: null,
    schoolDistrict: row.school_district,
    elementarySchool: row.elementary_school,
    middleSchool: row.middle_school,
    highSchool: row.high_school,
    taxAnnualAmount: row.tax_annual_amount,
    taxAssessedValue: row.tax_assessed_value,
    hoaMonthly: row.hoa_monthly,
    propertyAge,
    listingQualityScore: row.listing_quality_score,
    closePricePerSqft,
    saleToListRatio: row.sale_to_list_ratio,
    estimatedMonthlyPiti: row.estimated_monthly_piti,
    photos: [], // populated separately via getListingPhotos
    videos: [], // populated separately via getListingVideos
    listAgentName: row.list_agent_name,
    listAgentEmail: row.list_agent_email,
    listAgentPhone: null, // not stored in our schema
    listOfficeName: row.list_office_name,
    publicRemarks: row.public_remarks,
    communityId: null, // TODO: resolve via neighborhood_subdivisions when needed
    communityName: row.subdivision_name,
    communitySlug: slug(row.subdivision_name),
    neighborhoodName: row.boundary_neighborhood,
    neighborhoodSlug: slug(row.boundary_neighborhood),
    refreshedAt: row.refreshed_at ?? new Date().toISOString(),
  }
}

async function fetchOne(listingKey: string): Promise<GetListingDetailResult> {
  const supabase = supabaseAnon()
  if (!supabase) return null
  const { data, error } = await supabase
    .from('listing_detail_mv')
    .select(DETAIL_MV_SELECT)
    .eq('listing_key', listingKey)
    .maybeSingle()
  if (error || !data) return null
  return rowToDetail(data as unknown as DetailMvRow)
}

export const getListingDetail = (listingKey: string): Promise<GetListingDetailResult> => {
  InputSchema.parse({ listingKey })
  return unstable_cache(
    () => fetchOne(listingKey),
    ['listing-detail', listingKey],
    {
      revalidate: CACHE_WINDOWS.listingDetail,
      tags: [cacheTag.listings, cacheTag.listing(listingKey)],
    }
  )()
}
