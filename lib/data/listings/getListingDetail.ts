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
import { cleanText, formatMlsMultiSelect } from './mls-multiselect'
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
  'media_suppressed',
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
  // Wider detail fields surfaced on the listing page (previously fetched but
  // unrendered, or not fetched at all). Mixed-case ("ListDate",
  // "CumulativeDaysOnMarket") go bare to PostgREST like the other RETS columns.
  'county',
  'tax_year',
  'lot_size_sqft',
  'stories_total',
  'levels',
  'roof',
  'construction_materials',
  'foundation_details',
  'basement_yn',
  'view_description',
  'parking_total',
  'carport_spaces',
  'garage_yn',
  'heating_yn',
  'cooling_yn',
  'sewer',
  'water',
  'fireplaces_total',
  'new_construction_yn',
  'property_attached_yn',
  'ListDate',
  'CumulativeDaysOnMarket',
  'parcel_number',
  'walk_score',
  'association_fee',
  'association_fee_frequency',
  'rooms_total',
  'building_area_total',
  'spa_yn',
  'lot_features',
  'fencing',
  'direction_faces',
  // IDX compliance: seller internet opt-out + IDX participation. A listing the
  // seller withheld from internet display (ODS Rule B/G) must 404, not render.
  'permit_internet_yn',
  'idx_participant',
].join(',')

type ListingRow = {
  ListingKey: string
  ListNumber: string | null
  // IDX compliance — seller internet opt-out / IDX participation flags.
  permit_internet_yn: boolean | null
  idx_participant: boolean | null
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
  media_suppressed: boolean | null
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
  county: string | null
  tax_year: number | null
  lot_size_sqft: number | null
  stories_total: number | null
  levels: string | null
  roof: string | null
  construction_materials: string | null
  foundation_details: string | null
  basement_yn: boolean | null
  view_description: string | null
  parking_total: number | null
  carport_spaces: number | null
  garage_yn: boolean | null
  heating_yn: boolean | null
  cooling_yn: boolean | null
  sewer: string | null
  water: string | null
  fireplaces_total: number | null
  new_construction_yn: boolean | null
  property_attached_yn: boolean | null
  ListDate: string | null
  CumulativeDaysOnMarket: number | null
  parcel_number: string | null
  walk_score: number | null
  association_fee: number | null
  association_fee_frequency: string | null
  rooms_total: number | null
  building_area_total: number | null
  spa_yn: boolean | null
  lot_features: string | null
  fencing: string | null
  direction_faces: string | null
}

function slug(s: string | null | undefined): string | null {
  if (!s) return null
  return s.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

// cleanText + formatMlsMultiSelect now live in ./mls-multiselect (pure + tested).

/**
 * Guard a numeric field against the MLS `'********'` sentinel. Our schema
 * types these columns as numeric/smallint so PostgREST returns a number when
 * the value is real; a masked value comes back as the asterisk string. Only a
 * finite number survives — anything else (the sentinel, NaN, a stray string)
 * becomes null so we never cast or render a sentinel.
 */
function cleanNumber(n: number | string | null | undefined): number | null {
  if (typeof n === 'number') return Number.isFinite(n) ? n : null
  if (typeof n === 'string') {
    const t = n.trim()
    if (t.length === 0 || t.startsWith('*') || !/^-?\d/.test(t)) return null
    const parsed = Number(t)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
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
    // Owner media-removal request: a media_suppressed listing exposes no hero
    // poster / OG image (mirrors getListingPhotos + getListingVideos). The flag is
    // the durable, sync-proof gate — see migration 20260618121500_add_media_suppressed.sql.
    photoUrl: row.media_suppressed ? null : row.PhotoURL,
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
    // The detail page resolves its full video/tour set via getListingVideos
    // (the rich 3-tier DAL), so the tile-level scalar tourUrl isn't needed here.
    tourUrl: null,
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
    architecturalStyle: formatMlsMultiSelect(row.architectural_style),
    newConstructionYn: row.new_construction_yn,
    schoolDistrict: cleanText(row.school_district),
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
    // Structure / interior
    storiesTotal: cleanNumber(row.stories_total),
    levels: formatMlsMultiSelect(row.levels),
    roomsTotal: cleanNumber(row.rooms_total),
    basementYn: row.basement_yn,
    buildingAreaTotal: cleanNumber(row.building_area_total),
    heatingYn: row.heating_yn,
    coolingYn: row.cooling_yn,
    fireplacesTotal: cleanNumber(row.fireplaces_total),
    spaYn: row.spa_yn,
    // Exterior / lot
    lotSizeSqft: cleanNumber(row.lot_size_sqft),
    lotFeatures: formatMlsMultiSelect(row.lot_features),
    fencing: formatMlsMultiSelect(row.fencing),
    directionFaces: cleanText(row.direction_faces),
    viewDescription: formatMlsMultiSelect(row.view_description),
    roof: formatMlsMultiSelect(row.roof),
    constructionMaterials: formatMlsMultiSelect(row.construction_materials),
    foundationDetails: formatMlsMultiSelect(row.foundation_details),
    propertyAttachedYn: row.property_attached_yn,
    // Parking
    parkingTotal: cleanNumber(row.parking_total),
    carportSpaces: cleanNumber(row.carport_spaces),
    garageYn: row.garage_yn,
    // Utilities
    sewer: formatMlsMultiSelect(row.sewer),
    water: formatMlsMultiSelect(row.water),
    // Financial / tax
    county: cleanText(row.county),
    taxYear: cleanNumber(row.tax_year),
    parcelNumber: cleanText(row.parcel_number),
    associationFee: cleanNumber(row.association_fee),
    associationFeeFrequency: cleanText(row.association_fee_frequency),
    walkScore: cleanNumber(row.walk_score),
    // Listing dates
    listDate: row.ListDate,
    cumulativeDaysOnMarket: cleanNumber(row.CumulativeDaysOnMarket),
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

// Hard ceiling on a single point-lookup. A healthy lookup is ~10ms (indexed),
// so anything past this is a stalled pooler connection, not a slow query — we
// ABORT it (freeing the connection) and let fetchOneOrThrow retry on a fresh
// one. This is what turns the 30s+ cold-listing hang into a bounded render.
const LISTING_FETCH_TIMEOUT_MS = 4000

/**
 * One indexed point-lookup against a single column. Returns the row, or null
 * for a genuine miss; sets `error` for a transient DB failure (so the caller
 * can retry and never cache an error-null). Bounded by AbortSignal so a stalled
 * connection surfaces as a (retryable) error instead of hanging the render.
 */
async function fetchByColumn(
  supabase: NonNullable<ReturnType<typeof supabaseAnon>>,
  column: 'ListNumber' | 'ListingKey',
  value: string,
): Promise<{ row: ListingRow | null; error: unknown }> {
  // Mixed-case columns go bare to PostgREST (the client encodes them). Both
  // ListNumber (MLS#) and ListingKey (RETS key) are uniquely indexed — see
  // supabase/migrations/20260402120000_performance_indexes.sql + 20260330100000.
  // newest-modified first so a relisted MLS# resolves to the current row.
  try {
    const { data, error } = await supabase
      .from('listings')
      .select(DETAIL_SELECT)
      .eq(column, value)
      .order('ModificationTimestamp', { ascending: false })
      .limit(1)
      .abortSignal(AbortSignal.timeout(LISTING_FETCH_TIMEOUT_MS))
    if (error) return { row: null, error }
    const row = Array.isArray(data) && data.length > 0 ? (data[0] as unknown as ListingRow) : null
    // IDX compliance (ODS Rule B/G, NAR 7.58): a listing whose seller opted out
    // of internet display, or whose listing broker is not an IDX participant,
    // must NOT be publicly displayed. Treat as a genuine miss → notFound().
    if (row && (row.permit_internet_yn === false || row.idx_participant === false)) {
      return { row: null, error: null }
    }
    return { row, error: null }
  } catch (err) {
    // AbortError (timeout) or a thrown network failure — treat as transient so
    // fetchOneOrThrow retries on a fresh connection instead of hanging.
    return { row: null, error: err }
  }
}

/**
 * Raw lookup. Returns the detail, or null for a GENUINE miss (no such listing).
 * THROWS on a transient DB error (after 2 in-process retries) so the caller
 * never caches a null that came from an error — see getListingDetail.
 *
 * RESOLUTION (2026-06-01): canonical listing URLs embed the MLS `ListNumber`
 * (e.g. /homes-for-sale/bend/.../61072-manhae-220220595 → "220220595"), while
 * internal links (geo grids) pass the RETS `ListingKey`. The old code queried
 * ONLY `ListingKey`, so every MLS-numbered URL resolved to null → notFound().
 * That bricked listing detail across the site. Now we resolve by EITHER column.
 * A purely-numeric value is almost always an MLS#, so we try `ListNumber` first
 * to save the second round-trip on the hot (search → listing) path; otherwise
 * `ListingKey` first. Both columns are uniquely indexed, so each is a fast point
 * lookup.
 */
async function fetchOneOrThrow(listingKey: string): Promise<GetListingDetailResult> {
  const supabase = supabaseAnon()
  if (!supabase) return null
  const numericFirst = /^\d{5,}$/.test(listingKey.trim())
  const order: Array<'ListNumber' | 'ListingKey'> = numericFirst
    ? ['ListNumber', 'ListingKey']
    : ['ListingKey', 'ListNumber']

  let lastError: unknown = null
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let sawError = false
    for (const column of order) {
      const { row, error } = await fetchByColumn(supabase, column, listingKey)
      if (error) {
        lastError = error
        sawError = true
        break // restart the whole attempt — don't treat a DB error as a miss
      }
      if (row) return rowToDetail(row)
    }
    // Both columns returned cleanly with no row → genuine miss, cache the null.
    if (!sawError) return null
  }
  throw new Error(
    `listings detail lookup failed for ${listingKey}: ` +
      (lastError instanceof Error ? lastError.message : JSON.stringify(lastError)),
  )
}

/**
 * Listing-detail lookup.
 *
 * RESILIENCE (2026-05-31): same poison-null fix as getGeoSnapshot. The old code
 * returned null on BOTH a genuine miss AND a transient DB error, and
 * unstable_cache cached that null — pinning the listing to notFound() ("can't
 * open the listing") for the whole revalidate window. The 2026-05-28 cache-key
 * bump note below is the SAME bug biting earlier via a different trigger. Now a
 * DB error throws (never cached) and we retry once uncached before giving up, so
 * a healthy listing can never get stuck behind a cached not-found.
 */
export const getListingDetail = async (listingKey: string): Promise<GetListingDetailResult> => {
  InputSchema.parse({ listingKey })
  const cached = unstable_cache(
    () => fetchOneOrThrow(listingKey),
    // v3 cache-key bump 2026-05-31 — evicts poison-null entries cached before the
    // throw-on-error fix (Vercel Data Cache persists across deploys). v2 bump
    // (2026-05-28) did the same for the column-quoting bug. Without this, listings
    // cached null during a transient blip stay "Listing Not Found" until TTL.
    // v4 bump 2026-06-18 — media_suppressed gate nulls photoUrl (owner media-removal
    // requests); evicts entries cached before the suppression check existed.
    ['listing-detail-v4', listingKey],
    {
      revalidate: CACHE_WINDOWS.listingDetail,
      tags: [cacheTag.listings, cacheTag.listing(listingKey)],
    }
  )
  try {
    return await cached()
  } catch {
    try {
      return await fetchOneOrThrow(listingKey)
    } catch {
      return null
    }
  }
}
