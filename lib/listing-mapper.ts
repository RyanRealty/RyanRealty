/**
 * Unified Listing Field Mapper
 *
 * ONE canonical mapper used by all sync paths (delta, full, terminal).
 * Replaces mapSparkToRow() in sync-delta and sparkListingToSupabaseRow() in spark.ts.
 *
 * - Maps ALL Spark StandardFields to typed columns using RESO field names with v1 fallbacks
 * - Stores the FULL StandardFields object in `details` (never the thin 3-key version)
 * - Sanitizes masked "****" values via toNum()/toTimestamp()
 * - Extracts all 65 Tier 2 promoted fields
 * - Computes all 17 Tier 1 derived metrics
 */

// ---------------------------------------------------------------------------
// Sanitizers — handle Spark's "****" masking and type coercion
// ---------------------------------------------------------------------------

/** Numeric coercion. Returns null for masked "****", empty strings, NaN. */
export function toNum(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === 'number') return Number.isNaN(v) ? null : v
  if (typeof v === 'string') {
    if (v === '' || /^\*+$/.test(v)) return null
    const n = Number(v)
    return Number.isNaN(n) ? null : n
  }
  return null
}

/** Integer coercion for counters (DOM, rooms, etc.). */
export function toInt(v: unknown): number | null {
  const n = toNum(v)
  if (n == null) return null
  const r = Math.round(n)
  return Number.isFinite(r) ? r : null
}

/** Timestamp string validation. Returns null for masked or invalid dates. */
export function toTimestamp(v: unknown): string | null {
  if (v == null || typeof v !== 'string') return null
  if (/^\*+$/.test(v) || v.trim() === '') return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : v
}

/** Date-only string (YYYY-MM-DD). Returns null for masked or invalid. */
export function toDate(v: unknown): string | null {
  if (v == null || typeof v !== 'string') return null
  if (/^\*+$/.test(v) || v.trim() === '') return null
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

/** Boolean coercion. Handles true/false strings and "Yes"/"No". */
export function toBool(v: unknown): boolean | null {
  if (v == null) return null
  if (typeof v === 'boolean') return v
  if (typeof v === 'string') {
    const lower = v.toLowerCase().trim()
    if (lower === 'true' || lower === 'yes' || lower === '1') return true
    if (lower === 'false' || lower === 'no' || lower === '0') return false
    if (/^\*+$/.test(v)) return null
  }
  return null
}

/** Safe text extraction. Returns null for masked, empty, or non-string values.
 *  Handles Spark JSON feature objects like {"Frame": true, "Concrete": true} → "Frame, Concrete"
 */
/**
 * Agent-only confidential MLS keys that must NEVER land in the anon-readable
 * listings.details (attack finding 2026-07-11). Single source of truth mirrored
 * by the SQL rr_private_keys() in migration 20260712000000. The sync mapper
 * strips these from `details` (redactPublicDetails) and the sync route diverts
 * them into the service-role-only listing_private table (extractPrivateDetails).
 */
export const PRIVATE_DETAIL_KEYS = [
  'PrivateRemarks', 'PrivateOfficeRemarks', 'ShowingInstructions',
  'ShowingContactName', 'ShowingContactPhone', 'ShowingPhoneNumber',
  'OwnerName', 'OwnerPhone', 'OccupantName', 'OccupantPhone',
  'ContingencyRemarks',
] as const

/** `details` with every confidential key removed — safe for the anon-readable column. */
export function redactPublicDetails(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...fields }
  for (const k of PRIVATE_DETAIL_KEYS) delete out[k]
  return out
}

/** The confidential keys pulled out for the service-role-only listing_private table; null when none present. */
export function extractPrivateDetails(fields: Record<string, unknown>): Record<string, unknown> | null {
  const priv: Record<string, unknown> = {}
  for (const k of PRIVATE_DETAIL_KEYS) {
    const v = fields[k]
    if (v != null && !(typeof v === 'string' && (v.trim() === '' || /^\*+$/.test(v)))) priv[k] = v
  }
  return Object.keys(priv).length > 0 ? priv : null
}

export function toText(v: unknown): string | null {
  if (v == null) return null
  if (typeof v === 'string') {
    if (/^\*+$/.test(v) || v.trim() === '') return null
    // Try parsing JSON objects stored as strings (from JSONB extraction)
    if (v.startsWith('{') && v.endsWith('}')) {
      try {
        const parsed = JSON.parse(v)
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          const keys = Object.keys(parsed).filter(k => parsed[k] === true)
          return keys.length > 0 ? keys.join(', ') : null
        }
      } catch { /* not JSON, return as-is */ }
    }
    return v.trim()
  }
  // Handle arrays from Spark (e.g., ["Frame", "Stone"])
  if (Array.isArray(v)) return v.filter(Boolean).join(', ') || null
  // Handle Spark JSON feature objects like {Frame: true, Concrete: true}
  if (typeof v === 'object' && v !== null) {
    const obj = v as Record<string, unknown>
    const keys = Object.keys(obj).filter(k => obj[k] === true)
    return keys.length > 0 ? keys.join(', ') : null
  }
  return null
}

// ---------------------------------------------------------------------------
// Spark field accessor — handles RESO vs v1 field name variations
// ---------------------------------------------------------------------------

type Fields = Record<string, unknown>

/** Try multiple field names, return first non-null value. */
function pick(f: Fields, ...keys: string[]): unknown {
  for (const k of keys) {
    if (f[k] != null) return f[k]
  }
  return null
}

/** Check if a value is masked (Spark sends "********" for restricted fields). */
function isMasked(v: unknown): boolean {
  return typeof v === 'string' && /^\*+$/.test(v)
}

/** Parse a Spark feature field into a plain object. Handles both objects and JSON strings. */
function parseFeatureObj(f: Fields, fieldKey: string): Record<string, unknown> | null {
  const raw = f[fieldKey]
  if (raw == null || isMasked(raw)) return null
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    return raw as Record<string, unknown>
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) return parsed
    } catch { /* not JSON */ }
  }
  return null
}

/** Check if a JSON feature object contains a specific key (e.g., {"Pool": true}). */
function featureHas(f: Fields, fieldKey: string, featureName: string): boolean | null {
  const obj = parseFeatureObj(f, fieldKey)
  if (obj == null) return null
  return obj[featureName] === true
}

/** Check if a feature object has ANY truthy key except the excluded ones (e.g., "None"). */
function featureHasAnyExcept(f: Fields, fieldKey: string, exclude: string[]): boolean | null {
  const obj = parseFeatureObj(f, fieldKey)
  if (obj == null) return null
  const keys = Object.keys(obj).filter(k => obj[k] === true)
  if (keys.length === 0) return null
  const meaningful = keys.filter(k => !exclude.includes(k))
  return meaningful.length > 0 ? true : false
}

/**
 * Resolve pool_yn: prefer PoolYN, fall back to PoolFeatures/AssociationAmenities/CommunityFeatures.
 * Private pools (In Ground, Above Ground, Private, Outdoor Pool) won't be in association data.
 */
function resolvePoolYn(f: Fields): boolean | null {
  const direct = toBool(pick(f, 'PoolYN', 'PoolPrivateYN'))
  if (direct !== null) return direct
  // Check PoolFeatures — any key besides "None" means there's a pool
  const hasPool = featureHasAnyExcept(f, 'PoolFeatures', ['None'])
  if (hasPool === true) return true
  if (hasPool === false) return false  // PoolFeatures exists with only "None"
  // Fall back to amenities/community features
  if (featureHas(f, 'AssociationAmenities', 'Pool') === true) return true
  if (featureHas(f, 'CommunityFeatures', 'Pool') === true) return true
  return null
}

/**
 * Resolve waterfront_yn: prefer WaterfrontYN, fall back to WaterFrontYN and WaterfrontFeatures.
 */
function resolveWaterfrontYn(f: Fields): boolean | null {
  const direct = toBool(pick(f, 'WaterfrontYN', 'WaterFrontYN'))
  if (direct !== null) return direct
  return featureHasAnyExcept(f, 'WaterfrontFeatures', ['None'])
}

/**
 * Resolve basement_yn: prefer BasementYN, fall back to Basement feature object.
 */
function resolveBasementYn(f: Fields): boolean | null {
  const direct = toBool(pick(f, 'BasementYN'))
  if (direct !== null) return direct
  return featureHasAnyExcept(f, 'Basement', ['None'])
}

/**
 * Resolve fireplace_yn: prefer FireplaceYN, fall back to FireplaceFeatures.
 */
function resolveFireplaceYn(f: Fields): boolean | null {
  const direct = toBool(pick(f, 'FireplaceYN'))
  if (direct !== null) return direct
  return featureHasAnyExcept(f, 'FireplaceFeatures', ['None'])
}

/**
 * Resolve heating_yn: prefer HeatingYN, fall back to Heating feature object.
 */
function resolveHeatingYn(f: Fields): boolean | null {
  const direct = toBool(pick(f, 'HeatingYN'))
  if (direct !== null) return direct
  return featureHasAnyExcept(f, 'Heating', ['None'])
}

/**
 * Resolve cooling_yn: prefer CoolingYN, fall back to Cooling feature object.
 */
function resolveCoolingYn(f: Fields): boolean | null {
  const direct = toBool(pick(f, 'CoolingYN'))
  if (direct !== null) return direct
  return featureHasAnyExcept(f, 'Cooling', ['None'])
}

/**
 * Resolve school_district: prefer SchoolDistrict, fall back to district-specific fields.
 */
function resolveSchoolDistrict(f: Fields): string | null {
  const direct = toText(pick(f, 'SchoolDistrict'))
  if (direct !== null) return direct
  return toText(pick(f, 'HighSchoolDistrict', 'ElementarySchoolDistrict', 'MiddleOrJuniorSchoolDistrict'))
}

// ---------------------------------------------------------------------------
// HOA monthly normalization
// ---------------------------------------------------------------------------

function normalizeHoaMonthly(fee: number | null, frequency: string | null): number | null {
  if (fee == null || fee <= 0) return null
  if (!frequency) return fee // assume monthly if unknown
  const lower = frequency.toLowerCase()
  if (lower.includes('month')) return fee
  if (lower.includes('quarter')) return Math.round(fee / 3 * 100) / 100
  if (lower.includes('semi')) return Math.round(fee / 6 * 100) / 100
  if (lower.includes('annual')) return Math.round(fee / 12 * 100) / 100
  if (lower.includes('bi-month')) return Math.round(fee / 2 * 100) / 100
  return fee // default to monthly
}

// ---------------------------------------------------------------------------
// Photo URL extraction
// ---------------------------------------------------------------------------

function extractPhotoUrl(photos: unknown): string | null {
  if (!Array.isArray(photos) || photos.length === 0) return null
  const primary = photos.find((p: Record<string, unknown>) => p?.Primary) ?? photos[0]
  if (!primary) return null
  return (
    primary.Uri1600 ?? primary.Uri1280 ?? primary.Uri1024 ??
    primary.Uri800 ?? primary.Uri640 ?? primary.Uri300 ?? null
  ) as string | null
}

// ---------------------------------------------------------------------------
// Tier 1 computations — pricing ratios and derived metrics
// ---------------------------------------------------------------------------

function safeDiv(a: number | null, b: number | null, decimals: number): number | null {
  if (a == null || b == null || b === 0) return null
  return Math.round((a / b) * Math.pow(10, decimals)) / Math.pow(10, decimals)
}

export interface Tier1Input {
  listPrice: number | null
  closePrice: number | null
  originalListPrice: number | null
  sqft: number | null
  lotAcres: number | null
  lotSqft: number | null
  bedrooms: number | null
  bathrooms: number | null
  rooms: number | null
  yearBuilt: number | null
  aboveGrade: number | null
  buildingTotal: number | null
  hoaMonthly: number | null
  taxAnnual: number | null
  taxAssessed: number | null
}

export function computeTier1(input: Tier1Input) {
  const {
    listPrice, closePrice, originalListPrice, sqft, lotAcres, lotSqft,
    bedrooms, bathrooms, rooms, yearBuilt, aboveGrade, buildingTotal,
    hoaMonthly, taxAnnual, taxAssessed
  } = input

  const currentYear = new Date().getFullYear()

  // PITI calculation: 6.5% rate, 20% down, 30yr, insurance 0.35%
  let piti: number | null = null
  if (listPrice != null && listPrice > 0) {
    const rate = 0.065
    const monthlyRate = rate / 12
    const months = 360
    const principal = listPrice * 0.80
    const pi = principal * monthlyRate * Math.pow(1 + monthlyRate, months)
      / (Math.pow(1 + monthlyRate, months) - 1)
    const taxMonthly = (taxAnnual ?? listPrice * 0.012) / 12
    const insuranceMonthly = listPrice * 0.0035 / 12
    piti = Math.round((pi + taxMonthly + insuranceMonthly + (hoaMonthly ?? 0)) * 100) / 100
  }

  return {
    price_per_sqft: safeDiv(listPrice, sqft, 2),
    close_price_per_sqft: safeDiv(closePrice, sqft, 2),
    sale_to_list_ratio: safeDiv(closePrice, originalListPrice, 4),
    sale_to_final_list_ratio: safeDiv(closePrice, listPrice, 4),
    total_price_change_pct: originalListPrice && listPrice
      ? Math.round(((listPrice - originalListPrice) / originalListPrice) * 10000) / 100
      : null,
    total_price_change_amt: originalListPrice != null && listPrice != null
      ? listPrice - originalListPrice
      : null,
    price_per_acre: safeDiv(listPrice, lotAcres, 2),
    price_per_bedroom: safeDiv(listPrice, bedrooms, 2),
    price_per_room: safeDiv(listPrice, rooms, 2),
    property_age: yearBuilt != null ? currentYear - yearBuilt : null,
    sqft_efficiency: safeDiv(sqft, lotSqft, 4),
    bed_bath_ratio: safeDiv(bedrooms, bathrooms, 2),
    above_grade_pct: safeDiv(aboveGrade, buildingTotal, 4),
    hoa_annual_cost: hoaMonthly != null ? hoaMonthly * 12 : null,
    hoa_pct_of_price: hoaMonthly != null && listPrice
      ? Math.round((hoaMonthly * 12 / listPrice) * 10000) / 100
      : null,
    tax_rate: safeDiv(taxAnnual, taxAssessed, 4) != null
      ? safeDiv(taxAnnual, taxAssessed, 4)! * 100
      : null,
    estimated_monthly_piti: piti,
  }
}

// ---------------------------------------------------------------------------
// Listing quality score
// ---------------------------------------------------------------------------

export function computeListingQualityScore(row: {
  photos_count: number | null
  virtual_tour_url: string | null
  public_remarks: string | null
  has_virtual_tour: boolean
  openHouses: unknown
}): number {
  let score = 0
  // Photos: up to 60 pts (2 pts per photo, max 30 photos)
  score += Math.min(row.photos_count ?? 0, 30) * 2
  // Virtual tour URL: 15 pts
  if (row.virtual_tour_url) score += 15
  // Remarks length: 5-10 pts
  score += (row.public_remarks?.length ?? 0) > 200 ? 10 : 5
  // Open houses: 10 pts
  if (row.openHouses != null && (Array.isArray(row.openHouses) ? row.openHouses.length > 0 : true)) score += 10
  // Has video tour: 5 pts
  if (row.has_virtual_tour) score += 5
  return Math.min(score, 100)
}

// ---------------------------------------------------------------------------
// Main mapper: sparkToListingRow()
// ---------------------------------------------------------------------------

export interface SparkStandardFields {
  [key: string]: unknown
}

/**
 * Maps Spark StandardFields to a complete listing row.
 * Used by delta sync, full sync, and terminal finalization.
 *
 * @param fields - The StandardFields object from Spark API
 * @param resultId - Optional fallback ID from the Spark result envelope
 * @returns A flat object matching the listings table schema
 */
export function sparkToListingRow(
  fields: SparkStandardFields,
  resultId?: string
): Record<string, unknown> {
  // --- Core identification ---
  const listingKey = toText(pick(fields, 'ListingKey')) ?? resultId ?? null
  const listNumber = toText(pick(fields, 'ListNumber', 'ListingId')) ?? resultId ?? null

  // --- Core fields with RESO/v1 fallbacks ---
  const listPrice = toNum(pick(fields, 'ListPrice'))
  const closePrice = toNum(pick(fields, 'ClosePrice'))
  const originalListPrice = toNum(pick(fields, 'OriginalListPrice'))
  const bedrooms = toInt(pick(fields, 'BedroomsTotal', 'BedsTotal'))
  const bathrooms = toNum(pick(fields, 'BathroomsTotal', 'BathsTotal'))
  const sqft = toNum(pick(fields, 'TotalLivingAreaSqFt', 'BuildingAreaTotal', 'LivingArea'))
  const state = toText(pick(fields, 'StateOrProvince', 'State'))

  // --- Status ---
  const status = toText(pick(fields, 'StandardStatus', 'MlsStatus', 'ListStatus'))
  const isClosed = status ? /closed/i.test(status) : false

  // --- Agent name ---
  const agentFirst = toText(fields.ListAgentFirstName) ?? ''
  const agentLast = toText(fields.ListAgentLastName) ?? ''
  const listAgentName = [agentFirst, agentLast].filter(Boolean).join(' ')
    || toText(fields.ListAgentName) || null

  // --- Photos ---
  const photos = fields.Photos
  const photoUrl = extractPhotoUrl(photos)

  // --- Dates ---
  const listDate = toTimestamp(pick(fields, 'ListDate', 'OnMarketDate'))
  const onMarketDate = toTimestamp(pick(fields, 'OnMarketDate', 'ListDate'))
  const closeDate = toTimestamp(fields.CloseDate)

  // --- Open Houses ---
  const rawOpenHouses = fields.OpenHouses
  const openHouses = Array.isArray(rawOpenHouses)
    ? rawOpenHouses.map((oh: Record<string, unknown>) => ({
        Date: oh?.Date ?? undefined,
        StartTime: oh?.StartTime ?? undefined,
        EndTime: oh?.EndTime ?? undefined,
      }))
    : []

  // --- Tier 2 extractions ---
  const lotAcres = toNum(pick(fields, 'LotSizeAcres'))
  const lotSqft = toNum(pick(fields, 'LotSizeSquareFeet', 'LotSizeArea'))
  const buildingAreaTotal = toNum(pick(fields, 'BuildingAreaTotal'))
  const aboveGrade = toNum(pick(fields, 'AboveGradeFinishedArea'))
  const belowGrade = toNum(pick(fields, 'BelowGradeFinishedArea'))
  const yearBuilt = toInt(pick(fields, 'YearBuilt'))
  const roomsTotal = toInt(pick(fields, 'RoomsTotal'))
  const taxAnnual = toNum(pick(fields, 'TaxAmount', 'TaxAnnualAmount'))
  const taxAssessed = toNum(pick(fields, 'TaxAssessedValue'))
  const assocFee = toNum(pick(fields, 'AssociationFee'))
  const assocFreq = toText(pick(fields, 'AssociationFeeFrequency'))
  const hoaMonthly = normalizeHoaMonthly(assocFee, assocFreq)
  const photosCount = toInt(pick(fields, 'PhotosCount', 'PhotosTotal'))
  const publicRemarks = toText(fields.PublicRemarks)
  const virtualTourUrl = toText(pick(fields, 'VirtualTourURLUnbranded', 'VirtualTourURLBranded'))

  // --- Compute Tier 1 ---
  const tier1 = computeTier1({
    listPrice,
    closePrice,
    originalListPrice,
    sqft,
    lotAcres,
    lotSqft,
    bedrooms,
    bathrooms,
    rooms: roomsTotal,
    yearBuilt,
    aboveGrade,
    buildingTotal: buildingAreaTotal,
    hoaMonthly,
    taxAnnual,
    taxAssessed,
  })

  // --- Listing quality score ---
  const hasVirtualTour = !!(fields.Videos && Array.isArray(fields.Videos) && (fields.Videos as unknown[]).length > 0)
  const qualityScore = computeListingQualityScore({
    photos_count: photosCount,
    virtual_tour_url: virtualTourUrl,
    public_remarks: publicRemarks,
    has_virtual_tour: hasVirtualTour,
    openHouses: rawOpenHouses,
  })

  return {
    // --- Core columns (existing) ---
    ListingKey: listingKey,
    ListNumber: listNumber,
    ListPrice: listPrice,
    StandardStatus: status,
    StreetNumber: toText(fields.StreetNumber),
    StreetName: toText(fields.StreetName),
    City: toText(fields.City),
    State: state,
    PostalCode: toText(fields.PostalCode),
    SubdivisionName: toText(fields.SubdivisionName),
    BedroomsTotal: bedrooms,
    BathroomsTotal: bathrooms,
    TotalLivingAreaSqFt: sqft,
    PropertyType: toText(fields.PropertyType),
    Latitude: toNum(fields.Latitude),
    Longitude: toNum(fields.Longitude),
    PhotoURL: photoUrl,
    ModificationTimestamp: toTimestamp(fields.ModificationTimestamp),
    ListDate: listDate,
    OnMarketDate: onMarketDate,
    CloseDate: closeDate,
    ClosePrice: closePrice,
    OriginalListPrice: originalListPrice,
    DaysOnMarket: toInt(fields.DaysOnMarket),
    CumulativeDaysOnMarket: toInt(fields.CumulativeDaysOnMarket),
    ListOfficeName: toText(fields.ListOfficeName),
    ListAgentName: listAgentName,
    OpenHouses: openHouses.length > 0 ? openHouses : null,
    has_virtual_tour: hasVirtualTour,
    media_finalized: isClosed,

    // --- FULL details, MINUS the agent-only confidential keys (they divert to
    //     the service-role-only listing_private table via the sync route). The
    //     anon role reads details, so PrivateRemarks/ShowingInstructions/etc.
    //     must never be persisted here (attack finding 2026-07-11). ---
    details: redactPublicDetails(fields as Record<string, unknown>),

    // --- Tier 2: Property Basics ---
    property_sub_type: toText(pick(fields, 'PropertySubType')),
    year_built: yearBuilt,
    levels: toText(pick(fields, 'Levels')),
    architectural_style: toText(pick(fields, 'ArchitecturalStyle')),
    new_construction_yn: toBool(pick(fields, 'NewConstructionYN')),
    property_attached_yn: toBool(pick(fields, 'PropertyAttachedYN')),
    foundation_details: toText(pick(fields, 'FoundationDetails')),

    // --- IDX compliance flags (ODS Rule B/G, NAR 7.58) ---
    // The full Spark replication feed includes listings a seller opted out of
    // internet display (PermitInternetYN=false) and listings whose broker is not
    // an IDX participant (IDXParticipant=false). Persisting these on every sync
    // keeps the public-display filters (MV + getListingDetail) honoring an
    // opt-out that lands AFTER a listing is already in the table.
    permit_internet_yn: toBool(pick(fields, 'PermitInternetYN')),
    permit_address_internet_yn: toBool(pick(fields, 'PermitAddressInternetYN')),
    idx_participant: toBool(pick(fields, 'IDXParticipant')),

    // --- Tier 2: Structure & Dimensions ---
    building_area_total: buildingAreaTotal,
    above_grade_finished_area: aboveGrade,
    below_grade_finished_area: belowGrade,
    stories_total: toInt(pick(fields, 'StoriesTotal', 'Stories')),
    rooms_total: roomsTotal,
    construction_materials: toText(pick(fields, 'ConstructionMaterials')),
    roof: toText(pick(fields, 'Roof')),
    basement_yn: resolveBasementYn(fields),

    // --- Tier 2: Lot & Exterior ---
    lot_size_acres: lotAcres,
    lot_size_sqft: lotSqft,
    lot_features: toText(pick(fields, 'LotFeatures')),
    pool_yn: resolvePoolYn(fields),
    spa_yn: toBool(pick(fields, 'SpaYN')),
    fireplace_yn: resolveFireplaceYn(fields),
    fireplaces_total: toInt(pick(fields, 'FireplacesTotal')),
    fencing: toText(pick(fields, 'Fencing')),
    waterfront_yn: resolveWaterfrontYn(fields),
    horse_yn: toBool(pick(fields, 'HorseYN')),
    direction_faces: toText(pick(fields, 'DirectionFaces')),

    // --- Tier 2: Parking ---
    garage_yn: toBool(pick(fields, 'GarageYN')),
    garage_spaces: toInt(pick(fields, 'GarageSpaces')),
    carport_yn: toBool(pick(fields, 'CarportYN')),
    carport_spaces: toInt(pick(fields, 'CarportSpaces')),
    parking_total: toInt(pick(fields, 'ParkingTotal')),

    // --- Tier 2: Systems ---
    heating_yn: resolveHeatingYn(fields),
    cooling_yn: resolveCoolingYn(fields),
    sewer: toText(pick(fields, 'Sewer')),
    water: toText(pick(fields, 'Water')),

    // --- Tier 2: Bathrooms ---
    baths_full: toInt(pick(fields, 'BathsFull')),
    baths_half: toInt(pick(fields, 'BathsHalf')),

    // --- Tier 2: Financial ---
    tax_annual_amount: taxAnnual,
    tax_assessed_value: taxAssessed,
    tax_year: toInt(pick(fields, 'TaxYear')),
    association_yn: toBool(pick(fields, 'AssociationYN')),
    association_fee: assocFee,
    association_fee_frequency: assocFreq,
    hoa_monthly: hoaMonthly,
    buyer_financing: toText(pick(fields, 'BuyerFinancing')),
    concessions_amount: toNum(pick(fields, 'ConcessionsAmount')),

    // --- Tier 2: Location & Schools ---
    county: toText(pick(fields, 'CountyOrParish', 'County')),
    elementary_school: toText(pick(fields, 'ElementarySchool')),
    middle_school: toText(pick(fields, 'MiddleOrJuniorSchool')),
    high_school: toText(pick(fields, 'HighSchool')),
    school_district: resolveSchoolDistrict(fields),
    view_description: toText(pick(fields, 'View')),
    parcel_number: toText(pick(fields, 'ParcelNumber')),
    walk_score: toInt(pick(fields, 'WalkScore')),
    cross_street: toText(pick(fields, 'CrossStreet')),
    irrigation_water_rights_yn: toBool(pick(fields, 'IrrigationWaterRightsYN')),

    // --- Tier 2: Dates ---
    pending_timestamp: toTimestamp(pick(fields, 'PendingTimestamp')),
    purchase_contract_date: toDate(pick(fields, 'PurchaseContractDate')),
    off_market_date: toDate(pick(fields, 'OffMarketDate')),
    original_entry_timestamp: toTimestamp(pick(fields, 'OriginalEntryTimestamp')),
    status_change_timestamp: toTimestamp(pick(fields, 'StatusChangeTimestamp')),
    listing_contract_date: toDate(pick(fields, 'ListingContractDate')),
    original_on_market_timestamp: toTimestamp(pick(fields, 'OriginalOnMarketTimestamp', 'OriginalOnMarketDate')),
    back_on_market_timestamp: toTimestamp(pick(fields, 'BackOnMarketTimestamp')),

    // --- Tier 2: Agent & Office ---
    list_agent_email: toText(pick(fields, 'ListAgentEmail')),
    list_agent_mls_id: toText(pick(fields, 'ListAgentMlsId')),
    buyer_agent_name: toText(pick(fields, 'BuyerAgentName')),
    buyer_agent_mls_id: toText(pick(fields, 'BuyerAgentMlsId')),
    buyer_office_name: toText(pick(fields, 'BuyerOfficeName')),

    // --- Tier 2: Media & Marketing ---
    photos_count: photosCount,
    public_remarks: publicRemarks,
    virtual_tour_url: virtualTourUrl,
    home_warranty_yn: toBool(pick(fields, 'HomeWarrantyYN')),
    senior_community_yn: toBool(pick(fields, 'SeniorCommunityYN')),

    // --- Tier 1: Computed pricing ratios & metrics ---
    ...tier1,

    // --- Tier 3: Listing quality (computed here; other Tier 3 columns
    //     are computed from price_history/status_history in the sync route) ---
    listing_quality_score: qualityScore,
  }
}

// ---------------------------------------------------------------------------
// History item mapper (consolidated from 4 implementations)
// ---------------------------------------------------------------------------

export interface SparkHistoryItem {
  [key: string]: unknown
}

/**
 * Maps a single Spark history item to a listing_history row.
 * Consolidates the 4 previous implementations into one.
 */
export function sparkHistoryItemToRow(
  listingKey: string,
  item: SparkHistoryItem
): Record<string, unknown> {
  const dateRaw = item.ModificationTimestamp ?? item.Date
  let eventDate: string | null = null
  if (typeof dateRaw === 'string' && dateRaw.trim()) {
    const d = new Date(dateRaw.trim())
    if (!isNaN(d.getTime())) eventDate = d.toISOString()
  }

  const priceNum = toNum(item.Price) ?? toNum(item.PriceAtEvent)
  const priceChange = toNum(item.PriceChange)

  const description =
    typeof item.Description === 'string'
      ? item.Description
      : item.Field != null && item.PreviousValue != null && item.NewValue != null
        ? `${item.Field}: ${String(item.PreviousValue)} → ${String(item.NewValue)}`
        : null

  return {
    listing_key: listingKey,
    event_date: eventDate,
    event: typeof item.Event === 'string' ? item.Event : null,
    description: description ?? null,
    price: priceNum,
    price_change: priceChange,
    raw: item as Record<string, unknown>,
  }
}
