/**
 * One-row listing facts for Sarah's listing-page answers.
 *
 * Per docs/DATABASE_FOR_AI_AGENTS.md §0 / §4: read `listings` by ListNumber
 * (public MLS id), quoted mixed-case columns via supabase-js bare names,
 * IDX opt-out excluded. OtherStructures / feature bags live only in
 * `details` (not first-class). This is a PK-narrowed single-row read, not
 * a market aggregation.
 */
import { supabaseAnon } from '@/lib/data/client'
import { cleanText, formatMlsMultiSelect } from '@/lib/data/listings/mls-multiselect'

export type SarahListingFacts = {
  listNumber: string
  listingKey: string | null
  streetNumber: string | null
  streetName: string | null
  city: string | null
  subdivision: string | null
  status: string | null
  yearBuilt: number | null
  bedrooms: number | null
  bathrooms: number | null
  livingSqft: number | null
  garageSpaces: number | null
  garageYn: boolean | null
  lotAcres: number | null
  lotFeatures: string | null
  hoaMonthly: number | null
  associationYn: boolean | null
  associationFee: number | null
  associationFeeFrequency: string | null
  propertySubType: string | null
  publicRemarks: string | null
  otherStructures: string | null
  interiorFeatures: string | null
  exteriorFeatures: string | null
  county: string | null
  parcelNumber: string | null
  latitude: number | null
  longitude: number | null
}

const FACTS_SELECT = [
  'ListNumber',
  'ListingKey',
  'StreetNumber',
  'StreetName',
  'City',
  'SubdivisionName',
  'StandardStatus',
  'year_built',
  'BedroomsTotal',
  'BathroomsTotal',
  'TotalLivingAreaSqFt',
  'garage_spaces',
  'garage_yn',
  'lot_size_acres',
  'lot_features',
  'hoa_monthly',
  'association_yn',
  'association_fee',
  'association_fee_frequency',
  'property_sub_type',
  'public_remarks',
  'county',
  'parcel_number',
  'Latitude',
  'Longitude',
  'permit_internet_yn',
  'idx_participant',
  // toast-ok: one ListNumber row; OtherStructures is not a typed column.
  'OtherStructures:details->>OtherStructures',
  'InteriorFeatures:details->>InteriorFeatures',
  'ExteriorFeatures:details->>ExteriorFeatures',
].join(',')

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function asBool(value: unknown): boolean | null {
  if (value === true || value === false) return value
  return null
}

function asText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  return cleanText(value)
}

export async function getSarahListingFacts(mlsNumber: string): Promise<SarahListingFacts | null> {
  const sb = supabaseAnon()
  if (!sb) return null
  const k = String(mlsNumber ?? '').trim()
  if (!k) return null

  const { data } = await sb
    .from('listings')
    .select(FACTS_SELECT)
    .eq('ListNumber', k)
    .not('permit_internet_yn', 'is', false)
    .not('idx_participant', 'is', false)
    .maybeSingle()
  if (!data) return null

  const row = data as unknown as Record<string, unknown>
  const year = asNumber(row.year_built)
  const hoaMonthly = asNumber(row.hoa_monthly)
  return {
    listNumber: String(row.ListNumber ?? k),
    listingKey: asText(row.ListingKey),
    streetNumber: asText(row.StreetNumber),
    streetName: asText(row.StreetName),
    city: asText(row.City),
    subdivision: asText(row.SubdivisionName),
    status: asText(row.StandardStatus),
    yearBuilt: year != null && year > 0 ? year : null,
    bedrooms: asNumber(row.BedroomsTotal),
    bathrooms: asNumber(row.BathroomsTotal),
    livingSqft: asNumber(row.TotalLivingAreaSqFt),
    garageSpaces: asNumber(row.garage_spaces),
    garageYn: asBool(row.garage_yn),
    lotAcres: asNumber(row.lot_size_acres),
    lotFeatures: formatMlsMultiSelect(asText(row.lot_features)),
    hoaMonthly: hoaMonthly != null && hoaMonthly > 0 ? hoaMonthly : null,
    associationYn: asBool(row.association_yn),
    associationFee: asNumber(row.association_fee),
    associationFeeFrequency: asText(row.association_fee_frequency),
    propertySubType: asText(row.property_sub_type),
    publicRemarks: asText(row.public_remarks),
    otherStructures: formatMlsMultiSelect(asText(row.OtherStructures)),
    interiorFeatures: formatMlsMultiSelect(asText(row.InteriorFeatures)),
    exteriorFeatures: formatMlsMultiSelect(asText(row.ExteriorFeatures)),
    county: asText(row.county),
    parcelNumber: asText(row.parcel_number),
    latitude: asNumber(row.Latitude),
    longitude: asNumber(row.Longitude),
  }
}
