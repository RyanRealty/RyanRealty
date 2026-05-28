/**
 * getListingDetail — fetch a full ListingDetail row for the detail page.
 *
 * Reads from `public.listings` directly today. A future `listing_detail_mv`
 * migration will pre-join + project the relevant fields and this function
 * will switch to it without changing the public contract.
 *
 * Per docs/DATA_ACCESS_LAYER.md — every page that needs listing detail
 * data calls this function (never `.from('listings')` directly).
 *
 * The function deliberately does NOT fetch videos or similar listings;
 * callers should `Promise.all` getListingDetail + getListingVideos +
 * getSimilarListings to keep the read path explicit and avoid making one
 * mega-function that's impossible to compose.
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

// Mixed-case columns in `listings` are sent bare to PostgREST — the
// supabase-js client URL-encodes them correctly. Literal double-quotes
// here would be sent as part of the column name and cause every row to
// be missing from the response. See lib/data/listings/getListingRawRow.ts
// for the working pattern.
const DETAIL_SELECT = [
  'ListingKey',
  'ListNumber',
  'StandardStatus',
  'ListPrice',
  'OriginalListPrice',
  'ClosePrice',
  'CloseDate',
  'BedroomsTotal',
  'BathroomsTotal',
  'TotalLivingAreaSqFt',
  'StreetNumber',
  'StreetName',
  'City',
  'State',
  'PostalCode',
  'SubdivisionName',
  'Latitude',
  'Longitude',
  'PhotoURL',
  'PropertyType',
  'property_sub_type',
  'OnMarketDate',
  'ModificationTimestamp',
  'DaysOnMarket',
  'ListAgentName',
  'list_agent_email',
  'ListOfficeName',
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
  'boundary_city',
  'boundary_neighborhood',
  'boundary_subdivision',
].join(',')

type ListingRow = {
  ListingKey: string
  ListNumber: string | null
  StandardStatus: ListingStatus
  ListPrice: number | null
  OriginalListPrice: number | null
  ClosePrice: number | null
  CloseDate: string | null
  BedroomsTotal: number | null
  BathroomsTotal: number | null
  TotalLivingAreaSqFt: number | null
  StreetNumber: string | null
  StreetName: string | null
  City: string | null
  State: string | null
  PostalCode: string | null
  SubdivisionName: string | null
  Latitude: number | null
  Longitude: number | null
  PhotoURL: string | null
  PropertyType: string | null
  property_sub_type: string | null
  OnMarketDate: string | null
  ModificationTimestamp: string | null
  DaysOnMarket: number | null
  ListAgentName: string | null
  list_agent_email: string | null
  ListOfficeName: string | null
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
  boundary_city: string | null
  boundary_neighborhood: string | null
  boundary_subdivision: string | null
}

function slug(s: string | null | undefined): string | null {
  if (!s) return null
  return s.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

function rowToDetail(row: ListingRow): ListingDetail {
  const propertyAge =
    row.year_built && row.year_built > 1800
      ? new Date().getFullYear() - row.year_built
      : null
  const closePricePerSqft =
    row.ClosePrice != null && row.TotalLivingAreaSqFt && row.TotalLivingAreaSqFt > 0
      ? Math.round(row.ClosePrice / row.TotalLivingAreaSqFt)
      : null

  return {
    // ListingTile subset
    listingKey: row.ListingKey,
    listNumber: row.ListNumber,
    status: row.StandardStatus,
    listPrice: row.ListPrice,
    closePrice: row.ClosePrice,
    beds: row.BedroomsTotal,
    baths: row.BathroomsTotal,
    sqft: row.TotalLivingAreaSqFt,
    streetNumber: row.StreetNumber,
    streetName: row.StreetName,
    city: row.City,
    citySlug: slug(row.City),
    postalCode: row.PostalCode,
    subdivisionName: row.SubdivisionName,
    subdivisionSlug: slug(row.SubdivisionName),
    lat: row.Latitude,
    lng: row.Longitude,
    photoUrl: row.PhotoURL,
    propertyType: row.PropertyType,
    propertySubType: row.property_sub_type,
    onMarketDate: row.OnMarketDate,
    modifiedAt: row.ModificationTimestamp,
    pricePerSqft: row.price_per_sqft,
    lotSizeAcres: row.lot_size_acres,
    yearBuilt: row.year_built,
    garageSpaces: row.garage_spaces,
    poolYn: row.pool_yn,
    hasVirtualTour: row.has_virtual_tour,
    dom: row.DaysOnMarket,
    priceDropCount: row.price_drop_count,
    addressSlug:
      row.StreetNumber && row.StreetName
        ? slug(`${row.StreetNumber}-${row.StreetName}`)
        : null,
    boundaryCity: row.boundary_city,
    boundaryNeighborhood: row.boundary_neighborhood,
    boundarySubdivision: row.boundary_subdivision,

    // Detail-only fields
    originalListPrice: row.OriginalListPrice,
    closeDate: row.CloseDate,
    totalLivingAreaSqFt: row.TotalLivingAreaSqFt,
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
    photos: [], // populated separately via getListingPhotos (TODO Wave 1.6)
    videos: [], // populated separately via getListingVideos
    listAgentName: row.ListAgentName,
    listAgentEmail: row.list_agent_email,
    listAgentPhone: null, // not stored in our schema
    listOfficeName: row.ListOfficeName,
    publicRemarks: row.public_remarks,
    communityId: null, // TODO Wave 1.6: resolve via neighborhood_subdivisions
    communityName: row.SubdivisionName,
    communitySlug: slug(row.SubdivisionName),
    neighborhoodName: row.boundary_neighborhood,
    neighborhoodSlug: slug(row.boundary_neighborhood),
    refreshedAt: new Date().toISOString(),
  }
}

async function fetchOne(listingKey: string): Promise<GetListingDetailResult> {
  const supabase = supabaseAnon()
  if (!supabase) return null
  const { data, error } = await supabase
    .from('listings')
    .select(DETAIL_SELECT)
    .eq('ListingKey', listingKey)
    .maybeSingle()
  if (error || !data) return null
  return rowToDetail(data as unknown as ListingRow)
}

export const getListingDetail = (listingKey: string): Promise<GetListingDetailResult> => {
  InputSchema.parse({ listingKey })
  return unstable_cache(
    () => fetchOne(listingKey),
    // v2 cache-key bump 2026-05-28 — invalidates the null results
    // that were cached during the column-quoting bug (commit 2ded4d5
    // through f136a40). Without this, listings queried during the
    // broken window stay 404 until natural revalidation.
    ['listing-detail-v2', listingKey],
    {
      revalidate: CACHE_WINDOWS.listingDetail,
      tags: [cacheTag.listings, cacheTag.listing(listingKey)],
    }
  )()
}
