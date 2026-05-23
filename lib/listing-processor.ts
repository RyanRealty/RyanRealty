/**
 * Transform Spark API listing into DB schema. Section 7.4, Appendix A.
 * Uses Supabase service role. All errors reported to Sentry.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'
import * as Sentry from '@sentry/nextjs'
import type { SparkListing, SparkMediaItem } from './spark-odata'

function getServiceSupabase(): SupabaseClient {
  return createServiceClient()
}

function toSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

function parseDate(val: unknown): string | null {
  if (val == null) return null
  if (typeof val === 'string') {
    const d = val.slice(0, 10)
    return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null
  }
  return null
}

function parseTs(val: unknown): string | null {
  if (val == null) return null
  if (typeof val === 'string') return val
  return null
}

function parseNum(val: unknown): number | null {
  if (val == null) return null
  const n = Number(val)
  return Number.isFinite(n) ? n : null
}

function isExpiredOrWithdrawnStatus(s: string | null | undefined): boolean {
  const t = String(s ?? '').trim().toLowerCase()
  return /expired/i.test(t) || /withdrawn/i.test(t) || /cancelled/i.test(t) || /canceled/i.test(t)
}

/** Build full address from Spark listing (UnparsedAddress or parts). */
function buildFullAddress(raw: SparkListing): string {
  const unparsed = (raw.UnparsedAddress ?? '').trim()
  if (unparsed) return unparsed
  const parts = [raw.StreetNumber, raw.StreetName, raw.StreetSuffix, raw.City, raw.StateOrProvince, raw.PostalCode].filter(Boolean) as string[]
  return parts.join(', ') || `unknown-${raw.ListingKey ?? 'no-key'}`
}

/** Insert or ignore one expired/withdrawn listing for superuser prospecting. Exported for backfill action. */
export async function upsertExpiredListingFromSpark(supabase: SupabaseClient, raw: SparkListing): Promise<void> {
  void supabase
  const listingKey = raw.ListingKey ?? ''
  if (!listingKey) return
  const fullAddress = buildFullAddress(raw)
  const listAgentName = (raw.ListAgentName ?? [raw.ListAgentFirstName, raw.ListAgentLastName].filter(Boolean).join(' ')) || null
  const expiredAt = parseTs(raw.StatusChangeTimestamp) ?? parseTs(raw.ModificationTimestamp) ?? new Date().toISOString()
  const { upsertExpiredListingRow } = await import('@/lib/data')
  const res = await upsertExpiredListingRow({
    listing_key: listingKey,
    full_address: fullAddress,
    city: raw.City ?? null,
    state: raw.StateOrProvince ?? null,
    postal_code: raw.PostalCode ?? null,
    owner_name: null,
    list_agent_name: listAgentName,
    list_office_name: raw.ListOfficeName ?? null,
    list_price: parseNum(raw.ListPrice) ?? null,
    original_list_price: parseNum(raw.OriginalListPrice) ?? null,
    days_on_market: parseNum(raw.DaysOnMarket) ?? null,
    expired_at: expiredAt,
    standard_status: raw.StandardStatus ?? null,
    updated_at: new Date().toISOString(),
  })
  if (!res.ok) Sentry.captureException(new Error(res.error ?? 'upsert failed'), { extra: { listingKey } })
}

export interface ProcessSparkListingResult {
  isNew: boolean
  hasStatusChange: boolean
  hasPriceChange: boolean
  listingId: string
}

/**
 * Find or create community by SubdivisionName (exact then normalized name match).
 */
async function ensureCommunity(supabase: SupabaseClient, subdivisionName: string | null | undefined): Promise<string | null> {
  void supabase
  const name = subdivisionName?.trim()
  if (!name) return null
  const slug = toSlug(name)
  const { findCommunityIdByName, findCommunityIdBySlug, insertCommunityRowReturnId } = await import('@/lib/data')
  const existing = await findCommunityIdByName(name)
  if (existing) return existing
  const bySlug = await findCommunityIdBySlug(slug)
  if (bySlug) return bySlug
  const inserted = await insertCommunityRowReturnId(name, slug)
  if (!inserted) Sentry.captureException(new Error('community insert failed'), { extra: { subdivisionName: name } })
  return inserted
}

/**
 * Find or create property by UnparsedAddress; set geography from Lat/Long if present.
 */
async function ensureProperty(supabase: SupabaseClient, raw: SparkListing): Promise<string> {
  void supabase
  const {
    findPropertyIdByAddress,
    insertPropertyAddressOnly,
    insertPropertyFullRow,
    updatePropertyById,
  } = await import('@/lib/data')
  const unparsed = (raw.UnparsedAddress ?? '').trim() || [raw.StreetNumber, raw.StreetName, raw.StreetSuffix, raw.City, raw.StateOrProvince, raw.PostalCode].filter(Boolean).join(', ')
  if (!unparsed) {
    const fallback = `unknown-${raw.ListingKey ?? 'no-key'}`
    const inserted = await insertPropertyAddressOnly(fallback)
    if (inserted) return inserted
    const existing = await findPropertyIdByAddress(fallback)
    if (existing) return existing
    throw new Error('Could not create or find property for listing without address')
  }
  const communityId = await ensureCommunity(supabase, raw.SubdivisionName)
  const lat = parseNum(raw.Latitude)
  const lng = parseNum(raw.Longitude)
  const existing = await findPropertyIdByAddress(unparsed)
  if (existing) {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (communityId != null) updates.community_id = communityId
    if (lat != null) updates.latitude = lat
    if (lng != null) updates.longitude = lng
    await updatePropertyById(existing, updates)
    return existing
  }
  const inserted = await insertPropertyFullRow({
    unparsed_address: unparsed,
    street_number: raw.StreetNumber ?? null,
    street_name: raw.StreetName ?? null,
    street_suffix: raw.StreetSuffix ?? null,
    unit_number: raw.UnitNumber ?? null,
    city: raw.City ?? null,
    state: raw.StateOrProvince ?? null,
    postal_code: raw.PostalCode ?? null,
    county: raw.CountyOrParish ?? null,
    community_id: communityId,
    parcel_number: raw.ParcelNumber ?? null,
    latitude: lat,
    longitude: lng,
  })
  if (!inserted) {
    const err = new Error('Property insert returned no id')
    Sentry.captureException(err, { extra: { unparsed } })
    throw err
  }
  return inserted
}

/**
 * Process one Spark listing: property + listing upsert, photos, agents, status/price history.
 * Returns isNew, hasStatusChange, hasPriceChange, listingId (listings.id uuid).
 */
export async function processSparkListing(raw: SparkListing): Promise<ProcessSparkListingResult> {
  const supabase = getServiceSupabase()
  const listingKey = raw.ListingKey ?? ''
  if (!listingKey) {
    const err = new Error('processSparkListing: missing ListingKey')
    Sentry.captureException(err, { extra: { raw: JSON.stringify(raw).slice(0, 200) } })
    throw err
  }

  const propertyId = await ensureProperty(supabase, raw)
  const { findListingBySnakeKey } = await import('@/lib/data')
  const existingRow = await findListingBySnakeKey(listingKey)
  const isNew = !existingRow?.id
  const oldStatus = existingRow?.standard_status ?? null
  const oldPrice = existingRow?.list_price ?? null
  const newStatus = raw.StandardStatus ?? null
  const newPrice = parseNum(raw.ListPrice) ?? null
  const hasStatusChange = !isNew && oldStatus !== newStatus
  const hasPriceChange = !isNew && oldPrice !== null && newPrice !== null && oldPrice !== newPrice

  const listingRow = {
    listing_key: listingKey,
    listing_id: raw.ListingId ?? null,
    property_id: propertyId,
    standard_status: newStatus,
    mls_status: raw.MlsStatus ?? null,
    list_price: newPrice,
    original_list_price: parseNum(raw.OriginalListPrice) ?? null,
    close_price: parseNum(raw.ClosePrice) ?? null,
    listing_contract_date: parseDate(raw.ListingContractDate),
    on_market_date: parseDate(raw.OnMarketDate),
    close_date: parseDate(raw.CloseDate),
    modification_timestamp: parseTs(raw.ModificationTimestamp),
    status_change_timestamp: parseTs(raw.StatusChangeTimestamp),
    price_change_timestamp: parseTs(raw.PriceChangeTimestamp),
    beds_total: parseNum(raw.BedsTotal) ?? null,
    baths_full: parseNum(raw.BathsFull) ?? null,
    baths_half: parseNum(raw.BathsHalf) ?? null,
    baths_total_integer: parseNum(raw.BathroomsTotalInteger) ?? null,
    living_area: parseNum(raw.LivingArea) ?? null,
    lot_size_acres: parseNum(raw.LotSizeAcres) ?? null,
    lot_size_sqft: parseNum(raw.LotSizeSquareFeet) ?? null,
    year_built: parseNum(raw.YearBuilt) ?? null,
    levels: parseNum(raw.Levels) ?? null,
    garage_spaces: parseNum(raw.GarageSpaces) ?? null,
    property_type: raw.PropertyType ?? null,
    property_sub_type: raw.PropertySubType ?? null,
    subdivision_name: raw.SubdivisionName ?? null,
    public_remarks: raw.PublicRemarks ?? null,
    directions: raw.Directions ?? null,
    architectural_style: raw.ArchitecturalStyle ?? null,
    construction_materials: raw.ConstructionMaterials ?? null,
    roof: raw.Roof ?? null,
    flooring: raw.Flooring ?? null,
    heating: raw.Heating ?? null,
    cooling: raw.Cooling ?? null,
    fireplace_yn: raw.FireplaceYN === true,
    fireplace_features: raw.FireplaceFeatures ?? null,
    interior_features: raw.InteriorFeatures ?? null,
    exterior_features: raw.ExteriorFeatures ?? null,
    kitchen_appliances: raw.KitchenAppliances ?? null,
    pool_features: raw.PoolFeatures ?? null,
    view: raw.View ?? null,
    waterfront_yn: raw.WaterFrontYN === true,
    water_source: raw.WaterSource ?? null,
    sewer: raw.Sewer ?? null,
    association_yn: raw.AssociationYN === true,
    association_fee: parseNum(raw.AssociationFee) ?? null,
    association_fee_frequency: raw.AssociationFeeFrequency ?? null,
    tax_amount: parseNum(raw.TaxAmount) ?? null,
    elementary_school: raw.ElementarySchool ?? null,
    middle_school: raw.MiddleOrJuniorSchool ?? null,
    high_school: raw.HighSchool ?? null,
    photos_count: parseNum(raw.PhotosCount) ?? null,
    virtual_tour_url: raw.VirtualTourURLUnbranded ?? null,
    vow_avm_display_yn: raw.VOWAutomatedValuationDisplayYN === true,
    new_construction_yn: raw.NewConstructionYN === true,
    senior_community_yn: raw.SeniorCommunityYN === true,
    days_on_market: parseNum(raw.DaysOnMarket) ?? null,
    cumulative_days_on_market: parseNum(raw.CumulativeDaysOnMarket) ?? null,
    raw_data: raw as Record<string, unknown>,
    updated_at: new Date().toISOString(),
  }

  const {
    upsertListingSnakeRow,
    insertStatusHistoryRow,
    insertPriceHistoryRow,
    replaceListingPhotosForKey,
    deleteListingAgentsForKey,
    insertListingAgentRow,
  } = await import('@/lib/data')
  const upsertResult = await upsertListingSnakeRow(listingRow)
  if (upsertResult.error) {
    Sentry.captureException(new Error(upsertResult.error), { extra: { listingKey } })
    throw new Error(upsertResult.error)
  }
  const listingId = upsertResult.id ?? existingRow?.id
  if (!listingId) throw new Error('No listing id after upsert')

  if (hasStatusChange && newStatus && oldStatus !== newStatus) {
    await insertStatusHistoryRow({
      listing_key: listingKey,
      old_status: oldStatus,
      new_status: newStatus,
      changed_at: parseTs(raw.StatusChangeTimestamp) ?? new Date().toISOString(),
    })
    if (isExpiredOrWithdrawnStatus(newStatus)) {
      await upsertExpiredListingFromSpark(supabase, raw)
    }
  }
  if (hasPriceChange && oldPrice != null && newPrice != null) {
    const changePct = oldPrice !== 0 ? ((newPrice - oldPrice) / oldPrice) * 100 : null
    await insertPriceHistoryRow({
      listing_key: listingKey,
      old_price: oldPrice,
      new_price: newPrice,
      change_pct: changePct,
      changed_at: parseTs(raw.PriceChangeTimestamp) ?? new Date().toISOString(),
    })
  }

  const media = raw.Media as SparkMediaItem[] | undefined
  if (Array.isArray(media) && media.length > 0) {
    const photos = media
      .filter((m) => m.MediaURL)
      .sort((a, b) => (a.Order ?? 0) - (b.Order ?? 0))
      .map((m, i) => ({
        listing_key: listingKey,
        photo_url: m.MediaURL!,
        sort_order: i,
        is_hero: i === 0,
        source: 'spark',
      }))
    await replaceListingPhotosForKey(listingKey, photos)
  }

  await deleteListingAgentsForKey(listingKey)
  const listAgentName = (raw.ListAgentName ?? [raw.ListAgentFirstName, raw.ListAgentLastName].filter(Boolean).join(' ')) || null
  if (listAgentName || raw.ListAgentMlsId || raw.ListOfficeName) {
    await insertListingAgentRow({
      listing_key: listingKey,
      agent_role: 'list',
      agent_name: listAgentName,
      agent_first_name: raw.ListAgentFirstName ?? null,
      agent_last_name: raw.ListAgentLastName ?? null,
      agent_mls_id: raw.ListAgentMlsId ?? null,
      agent_license: raw.ListAgentStateLicense ?? null,
      agent_email: raw.ListAgentEmail ?? null,
      office_name: raw.ListOfficeName ?? null,
      office_mls_id: raw.ListOfficeMlsId ?? null,
      office_phone: raw.ListOfficePhone ?? null,
    })
  }
  const buyerAgentName = (raw.BuyerAgentName ?? [raw.BuyerAgentFirstName, raw.BuyerAgentLastName].filter(Boolean).join(' ')) || null
  if (buyerAgentName || raw.BuyerAgentMlsId || raw.BuyerOfficeName) {
    await insertListingAgentRow({
      listing_key: listingKey,
      agent_role: 'buyer',
      agent_name: buyerAgentName,
      agent_mls_id: raw.BuyerAgentMlsId ?? null,
      office_name: raw.BuyerOfficeName ?? null,
      office_mls_id: raw.BuyerOfficeMlsId ?? null,
    })
  }

  return { isNew, hasStatusChange, hasPriceChange, listingId }
}
