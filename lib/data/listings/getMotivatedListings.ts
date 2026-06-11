/**
 * getMotivatedListings — fetch active SFR listings with a motivation score.
 *
 * Motivation is computed from real MLS signals only — no fabrication:
 *   - price_drop_count: number of distinct price reductions
 *   - largest_price_drop_pct: biggest single reduction (% of original)
 *   - total reduction %: (OriginalListPrice - ListPrice) / OriginalListPrice
 *   - public_remarks lexicon: curated phrases sellers/agents use when
 *     motivation is genuine
 *   - DaysOnMarket (secondary): long DOM with no cuts signals seller need
 *
 * Score is 0–100. Listings with zero motivation signal are excluded.
 * Results are ordered by score DESC (most motivated first).
 *
 * Reads from the `listings` table (mixed-case Spark columns). The
 * listing_tile_mv does not project OriginalListPrice, largest_price_drop_pct,
 * or public_remarks, so this DAL reads listings directly.
 *
 * Lives entirely behind the DAL boundary at lib/data/ — pages import from
 * @/lib/data only.
 */

import { supabaseAnon } from '@/lib/data/client'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { cacheTag } from '@/lib/data/cache/unstable-cache'
import type { ListingStatus } from '@/lib/data/types/listing'
import { SERVICE_AREA_CITIES_PROPER } from '@/lib/data/listings/service-area'

// ─── Motivation lexicon ────────────────────────────────────────────────────

/**
 * Phrases that indicate seller motivation when found in public_remarks.
 * Each unique phrase match contributes to the motivation score.
 * Case-insensitive substring match. Curated to avoid false positives.
 */
const MOTIVATION_PHRASES: ReadonlyArray<string> = [
  'motivated',
  'must sell',
  'bring offers',
  'priced to sell',
  'make an offer',
  'make offer',
  'seller financing',
  'as-is',
  'as is',
  'below appraisal',
  'relocating',
  'motivated seller',
  'bring all offers',
  'priced below',
  'reduced',
]

// ─── Types ────────────────────────────────────────────────────────────────

export type MotivatedListing = {
  // Standard tile fields (mirrors ListingTile)
  listingKey: string
  listNumber: string | null
  status: ListingStatus
  listPrice: number | null
  beds: number | null
  baths: number | null
  sqft: number | null
  streetNumber: string | null
  streetName: string | null
  city: string | null
  citySlug: string | null
  postalCode: string | null
  subdivisionName: string | null
  subdivisionSlug: string | null
  lat: number | null
  lng: number | null
  photoUrl: string | null
  propertyType: string | null
  propertySubType: string | null
  onMarketDate: string | null
  modifiedAt: string | null
  pricePerSqft: number | null
  lotSizeAcres: number | null
  yearBuilt: number | null
  garageSpaces: number | null
  poolYn: boolean | null
  hasVirtualTour: boolean | null
  dom: number | null
  priceDropCount: number | null
  addressSlug: string | null
  boundaryCity: string | null
  boundaryNeighborhood: string | null
  boundarySubdivision: string | null
  // Motivation-specific fields
  /** 0–100 composite motivation score. Higher = more motivated. */
  motivationScore: number
  /** Human-readable signals that drove this listing's score. */
  reasons: string[]
  /** Original list price as entered on MLS. */
  originalListPrice: number | null
  /** Total reduction % from original list price. Positive means reduced. */
  totalReductionPct: number | null
  /** Largest single price drop as % of price at time of that cut. */
  largestPriceDropPct: number | null
  /** First 300 chars of public remarks (for badge context, never fabricated). */
  remarksSnippet: string | null
}

export type GetMotivatedListingsInput = {
  /** Scope to a single city (case-insensitive). Omit for region-wide. */
  city?: string
  /** Reserved for future neighborhood/community scoping. */
  geoType?: 'city' | 'neighborhood' | 'community'
  /** Reserved for future neighborhood/community scoping. */
  geoSlug?: string
  /** Max results to return (after scoring + filtering). Default 24. */
  limit?: number
  /** Offset for pagination. Default 0. */
  offset?: number
}

export type GetMotivatedListingsResult = {
  listings: MotivatedListing[]
  total: number
}

// ─── DB projection ────────────────────────────────────────────────────────

/**
 * Supabase JS select string — uses the column names PostgREST accepts.
 * Mixed-case columns like ListingKey work without quoting in .select().
 * Lower-case columns (price_drop_count, etc.) work the same way.
 */
const PROJECTION = [
  'ListingKey, ListNumber, StandardStatus, ListPrice',
  'BedroomsTotal, BathroomsTotal, TotalLivingAreaSqFt',
  'StreetNumber, StreetName, City, PostalCode, SubdivisionName',
  'Latitude, Longitude, PhotoURL',
  'PropertyType, property_sub_type, OnMarketDate, ModificationTimestamp',
  'DaysOnMarket, OriginalListPrice',
  'price_drop_count, largest_price_drop_pct, public_remarks',
  'price_per_sqft, lot_size_acres, year_built, garage_spaces, pool_yn, has_virtual_tour',
  'boundary_city, boundary_neighborhood, boundary_subdivision',
].join(', ')

// Active statuses that are buyer-relevant
const ACTIVE_STATUSES = ['Active', 'Coming Soon', 'Active Under Contract']

// ─── Scoring ─────────────────────────────────────────────────────────────

/**
 * Compute a 0–100 motivation score for one listing.
 *
 * Component weights (calibrated to signal strength):
 *
 *   (A) Total reduction % from OriginalListPrice → up to 40 pts
 *       Linear: 20% cut = 40 pts. 5% = 10 pts, 10% = 20 pts, 15% = 30 pts.
 *
 *   (B) Number of price cuts (price_drop_count) → up to 25 pts
 *       Diminishing: 1 cut = 10 pts, 2 = 18 pts, 3 = 22 pts, 4+ = 25 pts.
 *
 *   (C) Public remarks lexicon match → up to 20 pts
 *       5 pts per unique phrase, capped at 20.
 *
 *   (D) DOM secondary signal → up to 15 pts
 *       60+ days = 5 pts, 90+ = 10 pts, 120+ = 15 pts.
 *
 * Score 0 means NO motivation signal — these listings are excluded from results.
 */
function scoreListing(row: RawRow): { score: number; reasons: string[] } {
  const reasons: string[] = []
  let score = 0

  // (A) Total reduction % from original list price
  const origPrice = row.OriginalListPrice
  const curPrice = row.ListPrice
  if (origPrice && curPrice && origPrice > curPrice && origPrice > 0) {
    const reductionPct = ((origPrice - curPrice) / origPrice) * 100
    const pts = Math.min(40, Math.round((reductionPct / 20) * 40))
    if (pts > 0) {
      score += pts
      const dollarCut = Math.round((origPrice - curPrice) / 1000) * 1000
      reasons.push(`Reduced $${dollarCut.toLocaleString()}`)
    }
  }

  // (B) Price cut count
  const cuts = row.price_drop_count ?? 0
  if (cuts >= 1) {
    const pts = cuts === 1 ? 10 : cuts === 2 ? 18 : cuts === 3 ? 22 : 25
    score += pts
    reasons.push(cuts === 1 ? '1 price cut' : `${cuts} price cuts`)
  }

  // (C) Lexicon match in public_remarks
  const remarksLower = (row.public_remarks ?? '').toLowerCase()
  let lexPts = 0
  const matched = new Set<string>()
  for (const phrase of MOTIVATION_PHRASES) {
    if (remarksLower.includes(phrase) && !matched.has(phrase)) {
      matched.add(phrase)
      lexPts = Math.min(20, lexPts + 5)
    }
  }
  if (lexPts > 0) {
    score += lexPts
    reasons.push('Seller motivated')
  }

  // (D) Days on market (secondary signal)
  const dom = row.DaysOnMarket ?? 0
  if (dom >= 120) {
    score += 15
    reasons.push(`${dom} days on market`)
  } else if (dom >= 90) {
    score += 10
    reasons.push(`${dom} days on market`)
  } else if (dom >= 60) {
    score += 5
    reasons.push(`${dom} days on market`)
  }

  return { score: Math.min(100, score), reasons }
}

// ─── Raw row type ─────────────────────────────────────────────────────────

type RawRow = {
  ListingKey: string | null
  ListNumber: string | null
  StandardStatus: string | null
  ListPrice: number | null
  BedroomsTotal: number | null
  BathroomsTotal: number | null
  TotalLivingAreaSqFt: number | null
  StreetNumber: string | null
  StreetName: string | null
  City: string | null
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
  OriginalListPrice: number | null
  price_drop_count: number | null
  largest_price_drop_pct: number | null
  public_remarks: string | null
  price_per_sqft: number | null
  lot_size_acres: number | null
  year_built: number | null
  garage_spaces: number | null
  pool_yn: boolean | null
  has_virtual_tour: boolean | null
  boundary_city: string | null
  boundary_neighborhood: string | null
  boundary_subdivision: string | null
}

// ─── Row → MotivatedListing ───────────────────────────────────────────────

function toMotivatedListing(
  row: RawRow,
  score: number,
  reasons: string[]
): MotivatedListing {
  const city = row.City
  const citySlug = city ? city.toLowerCase().replace(/\s+/g, '-') : null
  const subdivisionSlug = row.SubdivisionName
    ? row.SubdivisionName.toLowerCase().replace(/\s+/g, '-')
    : null
  const addrParts = [row.StreetNumber, row.StreetName, city]
    .filter(Boolean)
    .map((s) => (s as string).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))
  const addressSlug = addrParts.length > 0 ? addrParts.join('-') : null

  const origPrice = row.OriginalListPrice
  const curPrice = row.ListPrice
  const totalReductionPct =
    origPrice && curPrice && origPrice > curPrice && origPrice > 0
      ? ((origPrice - curPrice) / origPrice) * 100
      : null

  return {
    listingKey: row.ListingKey ?? '',
    listNumber: row.ListNumber,
    status: (row.StandardStatus ?? 'Active') as ListingStatus,
    listPrice: row.ListPrice,
    beds: row.BedroomsTotal,
    baths: row.BathroomsTotal,
    sqft: row.TotalLivingAreaSqFt,
    streetNumber: row.StreetNumber,
    streetName: row.StreetName,
    city: row.City,
    citySlug,
    postalCode: row.PostalCode,
    subdivisionName: row.SubdivisionName,
    subdivisionSlug,
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
    addressSlug,
    boundaryCity: row.boundary_city,
    boundaryNeighborhood: row.boundary_neighborhood,
    boundarySubdivision: row.boundary_subdivision,
    motivationScore: score,
    reasons,
    originalListPrice: row.OriginalListPrice,
    totalReductionPct,
    largestPriceDropPct: row.largest_price_drop_pct,
    remarksSnippet: row.public_remarks ? row.public_remarks.slice(0, 300) : null,
  }
}

// ─── Core fetch (throws on error — no poison-null caching) ────────────────

/**
 * We overfetch to account for listings that score 0 after in-memory
 * scoring. Active SFR listings with at least one signal (price cut OR
 * OriginalListPrice > ListPrice OR non-null remarks) are fetched, scored,
 * sorted, then paginated.
 */
const OVERFETCH = 500

async function fetchMotivatedListings(
  input: GetMotivatedListingsInput
): Promise<GetMotivatedListingsResult> {
  const limit = Math.min(input.limit ?? 24, 200)
  const offset = input.offset ?? 0
  const city = input.city?.trim()

  const supabase = supabaseAnon()
  if (!supabase) return { listings: [], total: 0 }

  let query = supabase
    .from('listings')
    .select(PROJECTION)
    .in('StandardStatus', ACTIVE_STATUSES)
    .eq('PropertyType', 'A') // SFR only
    .not('PhotoURL', 'is', null) // must have a photo
    .gte('BedroomsTotal', 1) // exclude raw land parcels
    .limit(OVERFETCH)

  if (city) {
    // Case-insensitive city match — listings.City is display-case
    query = query.ilike('City', city)
  } else {
    // Service-area guard (audit P0-3 2026-06-10): region-wide pull scopes to
    // the Central Oregon allowlist — the MLS feed is statewide.
    query = query.in('City', SERVICE_AREA_CITIES_PROPER as string[])
  }

  // Require at least one motivation signal to narrow the scan
  query = query.or(
    'price_drop_count.gt.0,public_remarks.not.is.null'
  )

  const { data, error } = await query
  if (error) {
    throw new Error(`[getMotivatedListings] supabase error: ${error.message}`)
  }

  if (!data || data.length === 0) {
    return { listings: [], total: 0 }
  }

  // Score each listing in memory, drop zero-signal rows
  type ScoredEntry = { row: RawRow; score: number; reasons: string[] }
  const scored: ScoredEntry[] = []

  for (const rawRow of data) {
    const row = rawRow as unknown as RawRow
    const { score, reasons } = scoreListing(row)
    if (score > 0) {
      scored.push({ row, score, reasons })
    }
  }

  // Sort by score DESC (most motivated first)
  scored.sort((a, b) => b.score - a.score)

  const total = scored.length
  const page = scored.slice(offset, offset + limit)
  const listings = page.map(({ row, score, reasons }) =>
    toMotivatedListing(row, score, reasons)
  )

  return { listings, total }
}

// ─── Public cached entry point ────────────────────────────────────────────

/**
 * Fetch motivated seller listings, cached for 600 seconds.
 * Throws on DB error — no poison-null caching.
 * makeResilientCached retries once uncached before returning the fallback.
 */
export const getMotivatedListings = (
  input: GetMotivatedListingsInput = {}
): Promise<GetMotivatedListingsResult> => {
  const key = JSON.stringify({
    city: input.city?.toLowerCase().trim() ?? null,
    geoType: input.geoType ?? null,
    geoSlug: input.geoSlug ?? null,
    limit: input.limit ?? 24,
    offset: input.offset ?? 0,
  })
  return makeResilientCached(
    () => fetchMotivatedListings(input),
    // v2 (2026-06-10, audit P0-3): region-wide pull now service-area scoped.
    ['motivated-listings-v2', key],
    { revalidate: 600, tags: [cacheTag.listings] },
    { listings: [], total: 0 }
  )()
}
