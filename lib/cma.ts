/**
 * CMA (Comparative Market Analysis) computation engine.
 * Fetches subject property, finds closed comps via PostGIS, applies adjustments, stores valuation.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'

function getServiceSupabase(): SupabaseClient {
  return createServiceClient()
}

const ADJUSTMENT = {
  perBed: 15_000,
  perBath: 10_000,
  perYearAge: 2_000,
  perQuarterAcre: 5_000,
  perGarage: 15_000,
  pool: 20_000,
} as const

export type CMASubject = {
  propertyId: string
  address: string
  beds: number | null
  baths: number | null
  sqft: number | null
  lotAcres: number | null
  yearBuilt: number | null
  garageSpaces: number | null
  poolYn: boolean
  propertyType: string | null
  communityId: string | null
  listingKey: string | null
  vowAvmDisplayYn: boolean
}

export type CMACompRow = {
  listing_key: string
  listing_id: string | null
  address: string | null
  close_price: number | null
  close_date: string | null
  beds_total: number | null
  baths_full: number | null
  living_area: number | null
  lot_size_acres: number | null
  year_built: number | null
  garage_spaces: number | null
  pool_yn: boolean
  property_type: string | null
  distance_miles: number | null
}

export type CMACompResult = {
  listingKey: string
  address: string
  soldPrice: number
  soldDate: string
  beds: number
  baths: number
  sqft: number | null
  lotAcres: number | null
  distanceMiles: number
  adjustments: { reason: string; amount: number }[]
  adjustedPrice: number
  similarityScore: number
}

export type CMAResult = {
  estimatedValue: number
  valueLow: number
  valueHigh: number
  confidence: 'high' | 'medium' | 'low'
  comps: CMACompResult[]
  methodology: string
  valuationId: string
}

function buildCMAResult(
  subject: CMASubject,
  compsFiltered: CMACompRow[],
  valuationId: string
): CMAResult | null {
  if (compsFiltered.length === 0) return null

  const compResults: CMACompResult[] = []
  const adjustedPrices: number[] = []
  for (const comp of compsFiltered) {
    const { adjustments, adjustedPrice } = computeAdjustments(subject, comp)
    const sold = comp.close_price ?? 0
    const sim = similarityScore(subject, comp, adjustedPrice, sold)
    compResults.push({
      listingKey: comp.listing_key,
      address: comp.address ?? '',
      soldPrice: sold,
      soldDate: comp.close_date ?? '',
      beds: comp.beds_total ?? 0,
      baths: comp.baths_full ?? 0,
      sqft: comp.living_area ?? null,
      lotAcres: comp.lot_size_acres ?? null,
      distanceMiles: comp.distance_miles ?? 0,
      adjustments,
      adjustedPrice,
      similarityScore: sim,
    })
    adjustedPrices.push(adjustedPrice)
  }

  adjustedPrices.sort((a, b) => a - b)
  const valueLow = percentile(adjustedPrices, 0.1)
  const valueHigh = percentile(adjustedPrices, 0.9)
  const weights = compResults.map((c: CMACompResult) => c.similarityScore)
  const totalWeight = weights.reduce((a, b) => a + b, 0)
  const estimatedValue =
    totalWeight > 0
      ? compResults.reduce((sum, c, i) => sum + c.adjustedPrice * (weights[i]! / totalWeight), 0)
      : adjustedPrices[0] ?? 0
  // Confidence is the JOINT product of comp count, range width, and whether
  // we actually have subject data to filter on. A 10-comp pool that spans
  // $80k–$1.2M is NOT high confidence — old logic produced exactly that.
  const rangeWidth = estimatedValue > 0 ? (valueHigh - valueLow) / estimatedValue : 1
  const subjectBlind = subject.beds == null && subject.sqft == null && subject.yearBuilt == null
  let confidence: 'high' | 'medium' | 'low'
  if (subjectBlind) {
    confidence = 'low'
  } else if (compResults.length >= 5 && rangeWidth <= 0.3) {
    confidence = 'high'
  } else if (compResults.length >= 3 && rangeWidth <= 0.5) {
    confidence = 'medium'
  } else {
    confidence = 'low'
  }

  const methodology =
    'Weighted average of adjusted comparable sales. Adjustments: sqft (price/sqft), beds ($15k), baths ($10k), age ($2k/yr), lot ($5k/0.25ac), garage ($15k), pool ($20k).'

  return {
    estimatedValue: Math.round(estimatedValue),
    valueLow: Math.round(valueLow),
    valueHigh: Math.round(valueHigh),
    confidence,
    comps: compResults,
    methodology,
    valuationId,
  }
}

function num(v: unknown): number | null {
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function parseCompRow(r: Record<string, unknown>): CMACompRow {
  return {
    listing_key: String(r.listing_key ?? ''),
    listing_id: r.listing_id != null ? String(r.listing_id) : null,
    address: r.address != null ? String(r.address) : null,
    close_price: num(r.close_price),
    close_date: r.close_date != null ? String(r.close_date) : null,
    beds_total: num(r.beds_total) != null ? Math.round(Number(r.beds_total)) : null,
    baths_full: num(r.baths_full),
    living_area: num(r.living_area),
    lot_size_acres: num(r.lot_size_acres),
    year_built: num(r.year_built) != null ? Math.round(Number(r.year_built)) : null,
    garage_spaces: num(r.garage_spaces) != null ? Math.round(Number(r.garage_spaces)) : null,
    pool_yn: Boolean(r.pool_yn),
    property_type: r.property_type != null ? String(r.property_type) : null,
    distance_miles: num(r.distance_miles),
  }
}

/** Fetch subject property and its most-recent matching listing.
 * Looks across ALL statuses (Active, Pending, Closed) — many properties
 * only have a historical Closed listing, and refusing to pull from it
 * leaves the CMA blind to beds/baths/sqft and lets garbage comps through.
 */
async function getSubject(
  supabase: SupabaseClient,
  propertyId: string
): Promise<CMASubject | null> {
  const { data: prop, error: propErr } = await supabase
    .from('properties')
    .select('id, unparsed_address, community_id, street_number, street_name, city, postal_code')
    .eq('id', propertyId)
    .single()
  if (propErr || !prop) return null

  const p = prop as { id: string; unparsed_address: string; community_id?: string; street_number?: string; city?: string; postal_code?: string }

  // Find the matching listing by address. Take the most recently modified
  // record across ALL statuses — Active first if one exists, otherwise the
  // last Closed (which carries the historic beds/baths/sqft).
  //
  // CRITICAL: NO server-side ORDER BY here. listings is 589K+ rows; the
  // postal_code index alone returns ~500-2000 rows per zip, and the
  // ModificationTimestamp DESC sort over that set triggers a Sort node
  // that takes >60s and hits statement_timeout. We pull up to 20 rows
  // by the indexed equality on PostalCode + StreetNumber and do the
  // status/recency selection in JS. Retry transient errors so PostgREST
  // flaps don't leave the subject blind.
  let listing: Record<string, unknown> | null = null
  if (p.city) {
    let matches: Record<string, unknown>[] | null = null
    for (let attempt = 0; attempt < 3; attempt++) {
      let query = supabase
        .from('listings')
        .select('ListingKey, BedroomsTotal, BathroomsTotal, TotalLivingAreaSqFt, PropertyType, StandardStatus, lot_size_acres, year_built, ModificationTimestamp')
      if (p.postal_code) query = query.eq('PostalCode', p.postal_code)
      if (p.street_number) query = query.eq('StreetNumber', p.street_number)
      query = query.ilike('City', p.city)
      const { data, error } = await query.limit(20)
      if (!error) {
        matches = (data as Record<string, unknown>[] | null) ?? []
        break
      }
      console.warn(`[cma] getSubject listings lookup attempt ${attempt + 1}/3 error:`, error.message)
      await new Promise((r) => setTimeout(r, attempt === 0 ? 500 : 1500))
    }
    if (matches == null) {
      console.warn(`[cma] getSubject: listings lookup gave up for ${p.unparsed_address}`)
    }
    // Sort in JS: most-recently-modified first.
    const rows = (matches ?? []).slice().sort((a, b) => {
      const at = String(a.ModificationTimestamp ?? '')
      const bt = String(b.ModificationTimestamp ?? '')
      return bt.localeCompare(at)
    })
    const active = rows.find((r) => {
      const s = String(r.StandardStatus ?? '').toLowerCase()
      return s.includes('active') || s.includes('pending') || s.includes('for sale')
    })
    listing = active ?? rows[0] ?? null
  }

  return {
    propertyId: p.id,
    address: p.unparsed_address ?? '',
    beds: num(listing?.BedroomsTotal) ?? null,
    baths: num(listing?.BathroomsTotal) ?? null,
    sqft: num(listing?.TotalLivingAreaSqFt) ?? null,
    lotAcres: num(listing?.lot_size_acres) ?? null,
    yearBuilt: num(listing?.year_built) != null ? Math.round(Number(listing?.year_built)) : null,
    garageSpaces: null,
    poolYn: false,
    propertyType: listing?.PropertyType != null ? String(listing.PropertyType) : null,
    communityId: p.community_id ?? null,
    listingKey: listing?.ListingKey != null ? String(listing.ListingKey) : null,
    vowAvmDisplayYn: true, // Always show CMA when available
  }
}

/**
 * Resolve the close price using the canonical fallback chain:
 * ClosePrice → details->>'ClosePrice' → ListPrice (last resort)
 * See .cursor/rules/cma-data-model.mdc
 */
function resolveClosePrice(row: Record<string, unknown>): number | null {
  // 1. Explicit ClosePrice column
  const explicit = num(row.ClosePrice)
  if (explicit != null && explicit > 0) return explicit

  // 2. ClosePrice from details JSON
  const details = row.details as Record<string, unknown> | null | undefined
  if (details) {
    const fromDetails = num(details.ClosePrice)
    if (fromDetails != null && fromDetails > 0) return fromDetails
  }

  // 3. Last resort: ListPrice
  const listPrice = num(row.ListPrice)
  if (listPrice != null && listPrice > 0) return listPrice

  return null
}

/**
 * Direct query fallback for finding comps — queries listings table
 * directly using RESO column names when the PostGIS RPC is unavailable.
 * Uses the canonical ClosePrice fallback chain.
 *
 * `lotAcresRange` lets the caller restrict candidates to a specific lot
 * window at the SQL layer. Critical for rural acreage subjects: pulling
 * 50 in-town starter homes only to reject all of them later wastes the
 * candidate budget and leaves the post-filter set empty.
 */
async function getCompsDirectQuery(
  supabase: SupabaseClient,
  city: string,
  subdivision: string | null,
  monthsBack: number,
  maxCount: number,
  lotAcresRange?: { min: number; max: number } | null
): Promise<CMACompRow[]> {
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - monthsBack)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  // Query closed listings — pull lot/year/property-type so filterComps
  // can actually reject vacant land and grossly mismatched lot sizes.
  // PropertyType='A' is the RESO code for residential single-family.
  let query = supabase
    .from('listings')
    .select('ListingKey, ListNumber, StreetNumber, StreetName, City, ClosePrice, CloseDate, BedroomsTotal, BathroomsTotal, TotalLivingAreaSqFt, PropertyType, property_sub_type, SubdivisionName, ListPrice, details, lot_size_acres, year_built')
    .ilike('StandardStatus', '%Closed%')
    .not('CloseDate', 'is', null)
    .gte('CloseDate', cutoffStr)
    .ilike('City', city)
    // Residential only — exclude Land, Lots, Commercial, etc.
    // PropertyType='A' is the RESO single-family-residential code in this
    // MLS; 'Residential' is the descriptive form. Accept either.
    .or('PropertyType.eq.A,PropertyType.ilike.%Residential%')

  if (subdivision) {
    query = query.ilike('SubdivisionName', subdivision)
  }

  // SQL-layer lot range filter for rural subjects — saves the candidate
  // budget so we don't return 50 in-town SFRs only to reject them all.
  if (lotAcresRange) {
    query = query
      .gte('lot_size_acres', lotAcresRange.min)
      .lte('lot_size_acres', lotAcresRange.max)
  }

  const { data } = await query
    .order('CloseDate', { ascending: false })
    .limit(maxCount * 4) // Fetch extra; the filter below trims many.

  if (!data?.length) return []

  const results: CMACompRow[] = []
  for (const r of data as Record<string, unknown>[]) {
    const closePrice = resolveClosePrice(r)
    if (closePrice == null || closePrice <= 0) continue
    // Bend SFR floor: anything sub-$200K in 2025+ is land, distressed,
    // or a partial-interest sale. Not a useful comp for a livable home.
    if (closePrice < 200_000) continue
    // Need living area to make a price/sqft adjustment; rows with no
    // sqft are usually land or condo sub-units we don't want in the pool.
    const sqft = num(r.TotalLivingAreaSqFt)
    if (sqft == null || sqft < 500) continue

    results.push({
      listing_key: String(r.ListingKey ?? ''),
      listing_id: r.ListNumber != null ? String(r.ListNumber) : null,
      address: [r.StreetNumber, r.StreetName].filter(Boolean).join(' ') + (r.City ? `, ${r.City}` : ''),
      close_price: closePrice,
      close_date: r.CloseDate != null ? String(r.CloseDate).slice(0, 10) : null,
      beds_total: num(r.BedroomsTotal) != null ? Math.round(Number(r.BedroomsTotal)) : null,
      baths_full: num(r.BathroomsTotal),
      living_area: sqft,
      lot_size_acres: num(r.lot_size_acres),
      year_built: num(r.year_built) != null ? Math.round(Number(r.year_built)) : null,
      garage_spaces: null,
      pool_yn: false,
      property_type: r.PropertyType != null ? String(r.PropertyType) : null,
      distance_miles: 0,
    })

    if (results.length >= maxCount) break
  }

  return results
}

/** Fetch comp candidates: try RPC first, fall back to direct query. */
async function getCompCandidates(
  supabase: SupabaseClient,
  propertyId: string,
  communityId: string | null,
  subject: CMASubject
): Promise<CMACompRow[]> {
  // RURAL SUBJECTS bypass the RPC entirely. The get_cma_comps PostGIS
  // function doesn't surface lot_size_acres, so its 2-mile-radius pick
  // pulls in-town starters for any Tumalo/Sisters/Powell Butte address —
  // which the fail-closed lot guard then strips to zero. Going direct
  // ensures the SQL lot-range filter is what shapes the candidate pool.
  const isRural = subject.lotAcres != null && subject.lotAcres >= 1
  let rows: CMACompRow[] = []
  if (!isRural) {
    try {
      const rpcResult = await supabase.rpc('get_cma_comps', {
        p_subject_property_id: propertyId,
        p_radius_miles: 2,
        p_months_back: 12,
        p_max_count: 10,
      })
      if (!rpcResult.error && rpcResult.data?.length) {
        rows = (rpcResult.data as Record<string, unknown>[]).map(parseCompRow)
      }
    } catch {
      // RPC unavailable — fall through to direct query
    }
  }

  // Compute a lot-size window for rural subjects so the SQL pulls a
  // candidate set we can actually use. We mirror the post-hoc filterComps
  // window (1/3..3x) but center it on the subject lot.
  const lotRange = subject.lotAcres != null && subject.lotAcres > 0
    ? { min: subject.lotAcres / 3, max: subject.lotAcres * 3 }
    : null

  // If RPC returned no results, use direct query fallback
  if (rows.length < 3 && subject.address) {
    const addressParts = subject.address.split(',').map((s) => s.trim())
    const city = addressParts[1] || addressParts[0] || ''
    if (city) {
      const directComps = await getCompsDirectQuery(supabase, city, null, 12, 15, lotRange)
      const seen = new Set(rows.map((c) => c.listing_key))
      for (const comp of directComps) {
        if (!seen.has(comp.listing_key)) {
          seen.add(comp.listing_key)
          rows.push(comp)
        }
      }
    }
  }

  // Broader search if still not enough
  if (rows.length < 3 && subject.address) {
    const addressParts = subject.address.split(',').map((s) => s.trim())
    const city = addressParts[1] || ''
    if (city) {
      const broader = await getCompsDirectQuery(supabase, city, null, 24, 20, lotRange)
      const seen = new Set(rows.map((c) => c.listing_key))
      for (const comp of broader) {
        if (!seen.has(comp.listing_key)) {
          seen.add(comp.listing_key)
          rows.push(comp)
        }
      }
    }
  }

  return rows.slice(0, 10)
}

/** Filter comps by similarity. When subject data is unknown, skip that filter. */
function filterComps(subject: CMASubject, rows: CMACompRow[]): CMACompRow[] {
  const subBeds = subject.beds
  const subSqft = subject.sqft
  const subYear = subject.yearBuilt
  const subLot = subject.lotAcres
  return rows.filter((r) => {
    if (r.close_price == null || r.close_price <= 0) return false
    // Re-enforce Bend SFR floor at the filter layer (defense in depth).
    if (r.close_price < 200_000) return false
    // Drop anything not flagged residential.
    if (r.property_type) {
      const pt = r.property_type.toLowerCase()
      if (
        pt.includes('land') ||
        pt.includes('lot') ||
        pt.includes('commercial') ||
        pt.includes('farm')
      ) {
        return false
      }
    }
    // Only filter by beds if we know the subject's bed count
    if (subBeds != null && subBeds > 0) {
      const beds = r.beds_total ?? 0
      if (beds > 0 && Math.abs(beds - subBeds) > 1) return false
    }
    // Only filter by sqft if we know both
    if (subSqft != null && subSqft > 0) {
      const sqft = r.living_area ?? 0
      if (sqft > 0) {
        const pct = Math.abs(sqft - subSqft) / subSqft
        if (pct > 0.25) return false
      }
    }
    // Lot size: a 2.28-acre Tumalo property does not comp against a 0.1-acre
    // in-town starter, period. When subject lot is known, require comp lot
    // to be known AND within ~3x. Fail-closed: a comp with unknown lot
    // gets rejected for any rural (≥1 ac) subject — the PostGIS RPC
    // returns comps without lot data, and treating "unknown" as "pass"
    // pollutes rural valuations with in-town starters.
    if (subLot != null && subLot >= 1) {
      if (r.lot_size_acres == null || r.lot_size_acres <= 0) return false
      const ratio = r.lot_size_acres / subLot
      if (ratio > 3 || ratio < 1 / 3) return false
    } else if (subLot != null && subLot > 0 && r.lot_size_acres != null && r.lot_size_acres > 0) {
      // Urban subject (<1 ac): apply ratio bound only when both are known.
      const ratio = r.lot_size_acres / subLot
      if (ratio > 3 || ratio < 1 / 3) return false
    }
    // Only filter by year if we know both
    if (subYear != null && subYear > 0) {
      const year = r.year_built ?? 0
      if (year > 0 && Math.abs(year - subYear) > 15) return false
    }
    return true
  })
}

/** Compute adjustment and adjusted price for one comp. */
function computeAdjustments(
  subject: CMASubject,
  comp: CMACompRow
): { adjustments: { reason: string; amount: number }[]; adjustedPrice: number } {
  const sold = comp.close_price ?? 0
  const adjustments: { reason: string; amount: number }[] = []
  let total = 0

  const pricePerSqft = (comp.living_area ?? 0) > 0 ? sold / comp.living_area! : 0
  const subSqft = subject.sqft ?? 0
  const compSqft = comp.living_area ?? 0
  if (pricePerSqft > 0 && subSqft > 0 && compSqft > 0) {
    const diff = subSqft - compSqft
    const amt = Math.round(pricePerSqft * diff)
    total += amt
    adjustments.push({ reason: 'Sqft', amount: amt })
  }

  const bedDiff = (subject.beds ?? 0) - (comp.beds_total ?? 0)
  if (bedDiff !== 0) {
    const amt = bedDiff * ADJUSTMENT.perBed
    total += amt
    adjustments.push({ reason: 'Beds', amount: amt })
  }
  const bathDiff = (subject.baths ?? 0) - (comp.baths_full ?? 0)
  if (bathDiff !== 0) {
    const amt = Math.round(bathDiff * ADJUSTMENT.perBath)
    total += amt
    adjustments.push({ reason: 'Baths', amount: amt })
  }
  const yearSub = subject.yearBuilt ?? 0
  const yearComp = comp.year_built ?? 0
  if (yearSub > 0 && yearComp > 0) {
    const yearDiff = yearSub - yearComp
    if (yearDiff !== 0) {
      const amt = yearDiff * ADJUSTMENT.perYearAge
      total += amt
      adjustments.push({ reason: 'Age', amount: amt })
    }
  }
  const lotSub = subject.lotAcres ?? 0
  const lotComp = comp.lot_size_acres ?? 0
  if (lotSub > 0 || lotComp > 0) {
    const quarterAcreDiff = ((lotSub - lotComp) / 0.25)
    const amt = Math.round(quarterAcreDiff * ADJUSTMENT.perQuarterAcre)
    if (amt !== 0) {
      total += amt
      adjustments.push({ reason: 'Lot', amount: amt })
    }
  }
  const garageDiff = (subject.garageSpaces ?? 0) - (comp.garage_spaces ?? 0)
  if (garageDiff !== 0) {
    const amt = garageDiff * ADJUSTMENT.perGarage
    total += amt
    adjustments.push({ reason: 'Garage', amount: amt })
  }
  if (subject.poolYn !== comp.pool_yn) {
    const amt = subject.poolYn ? ADJUSTMENT.pool : -ADJUSTMENT.pool
    total += amt
    adjustments.push({ reason: 'Pool', amount: amt })
  }

  return { adjustments, adjustedPrice: sold + total }
}

/** Similarity score 0–1: closer and more similar = higher. */
function similarityScore(
  subject: CMASubject,
  comp: CMACompRow,
  adjustedPrice: number,
  soldPrice: number
): number {
  const compSqft = comp.living_area ?? 0
  const subSqft = subject.sqft ?? 0
  let score = 1
  if (subSqft > 0 && compSqft > 0) {
    const pct = Math.abs(compSqft - subSqft) / subSqft
    score *= 1 - Math.min(pct, 0.5)
  }
  const bedDiff = Math.abs((subject.beds ?? 0) - (comp.beds_total ?? 0))
  score *= 1 - bedDiff * 0.1
  const dist = comp.distance_miles ?? 1
  score *= 1 / (1 + dist * 0.2)
  const pricePct = soldPrice > 0 ? Math.abs(adjustedPrice - soldPrice) / soldPrice : 0
  score *= 1 - Math.min(pricePct, 0.3)
  return Math.max(0.1, Math.min(1, score))
}

/** Percentile of sorted array (0–1). */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const i = p * (sorted.length - 1)
  const lo = Math.floor(i)
  const hi = Math.ceil(i)
  if (lo === hi) return sorted[lo]!
  return sorted[lo]! + (i - lo) * (sorted[hi]! - sorted[lo]!)
}

/**
 * Run full CMA for a property: fetch subject, find comps, adjust, store valuation, return result.
 */
export async function computeCMA(propertyId: string): Promise<CMAResult | null> {
  const supabase = getServiceSupabase()
  const subject = await getSubject(supabase, propertyId)
  if (!subject) {
    console.warn(`[cma] computeCMA: getSubject returned null for property ${propertyId}`)
    return null
  }

  const candidates = await getCompCandidates(supabase, propertyId, subject.communityId, subject)
  console.warn(
    `[cma] computeCMA propertyId=${propertyId} subject: beds=${subject.beds} baths=${subject.baths} sqft=${subject.sqft} lot=${subject.lotAcres} year=${subject.yearBuilt} candidates=${candidates.length}`
  )
  const compsFiltered = filterComps(subject, candidates)
  console.warn(
    `[cma] computeCMA propertyId=${propertyId} filtered=${compsFiltered.length}/${candidates.length} after residential+price+lot+sqft+bed+year guards`
  )
  if (compsFiltered.length === 0) {
    console.warn(
      `[cma] computeCMA: zero comps survived filter for property ${propertyId} (subject beds=${subject.beds} sqft=${subject.sqft} lot=${subject.lotAcres})`
    )
    return null
  }
  const interim = buildCMAResult(subject, compsFiltered, 'pending')
  if (!interim) {
    console.warn(`[cma] computeCMA: buildCMAResult returned null for property ${propertyId}`)
    return null
  }

  const { data: valuation, error: valErr } = await supabase
    .from('valuations')
    .insert({
      property_id: propertyId,
      estimated_value: interim.estimatedValue,
      value_low: interim.valueLow,
      value_high: interim.valueHigh,
      confidence: interim.confidence,
      comp_count: interim.comps.length,
      // 2.2 (2026-05-14): bypass PostGIS RPC for rural (≥1 ac) subjects
      // 2.1 (2026-05-14): fail-closed on unknown comp lot for rural subjects
      // 2.0 (2026-05-14): residential-only filter, $200K floor, lot guard, range confidence
      // 1.x: original (deprecated — buggy)
      methodology_version: '2.2',
    })
    .select('id')
    .single()

  if (valErr || !valuation) return null
  const valuationId = (valuation as { id: string }).id

  for (const c of interim.comps) {
    const reason = c.adjustments.map((a) => `${a.reason}:${a.amount}`).join('; ')
    await supabase.from('valuation_comps').insert({
      valuation_id: valuationId,
      comp_listing_key: c.listingKey,
      comp_address: c.address,
      comp_sold_price: c.soldPrice,
      comp_sold_date: c.soldDate,
      comp_sqft: c.sqft,
      adjustment_amount: c.adjustedPrice - c.soldPrice,
      adjustment_reason: reason,
      distance_miles: c.distanceMiles,
      similarity_score: c.similarityScore,
    })
  }

  return { ...interim, valuationId }
}

/**
 * Compute CMA directly from listing identity (ListingKey or ListNumber) without properties table dependency.
 */
export async function computeCMAByListingKey(listingKeyOrMls: string): Promise<CMAResult | null> {
  const key = String(listingKeyOrMls ?? '').trim()
  if (!key) return null

  const supabase = getServiceSupabase()
  const { data: listing, error } = await supabase
    .from('listings')
    .select('ListingKey, ListNumber, StreetNumber, StreetName, City, BedroomsTotal, BathroomsTotal, TotalLivingAreaSqFt, PropertyType')
    .or(`ListingKey.eq.${key},ListNumber.eq.${key}`)
    .order('ModificationTimestamp', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !listing) return null

  const row = listing as Record<string, unknown>
  const subject: CMASubject = {
    propertyId: String(row.ListingKey ?? row.ListNumber ?? key),
    address: [row.StreetNumber, row.StreetName, row.City].filter(Boolean).join(', '),
    beds: num(row.BedroomsTotal),
    baths: num(row.BathroomsTotal),
    sqft: num(row.TotalLivingAreaSqFt),
    lotAcres: null,
    yearBuilt: null,
    garageSpaces: null,
    poolYn: false,
    propertyType: row.PropertyType != null ? String(row.PropertyType) : null,
    communityId: null,
    listingKey: row.ListingKey != null ? String(row.ListingKey) : null,
    vowAvmDisplayYn: true,
  }

  const { data: rpcRows, error: rpcError } = await supabase.rpc('get_cma_comps_by_listing_key', {
    p_listing_key: key,
    p_radius_miles: 2,
    p_months_back: 12,
    p_max_count: 15,
  })
  if (rpcError || !Array.isArray(rpcRows) || rpcRows.length === 0) return null

  const parsed = (rpcRows as Record<string, unknown>[]).map(parseCompRow)
  const compsFiltered = filterComps(subject, parsed)
  return buildCMAResult(subject, compsFiltered, `listing-${key}`)
}

/** Get cached CMA for a property (by property_id). Returns null if none or expired. */
export async function getCachedCMA(propertyId: string): Promise<CMAResult | null> {
  const supabase = getServiceSupabase()
  // Only serve valuations from the current methodology version. 1.x rows
  // were missing the residential-only filter and the lot-size guard, so
  // they're effectively garbage even if recent. Returning null here forces
  // a fresh computeCMA on the next worker run.
  const { data: val } = await supabase
    .from('valuations')
    .select('id, estimated_value, value_low, value_high, confidence, comp_count, methodology_version')
    .eq('property_id', propertyId)
    .gte('methodology_version', '2.2')
    .order('computed_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!val) return null
  const v = val as {
    id: string
    estimated_value: number
    value_low: number
    value_high: number
    confidence: string
    comp_count: number
  }
  const { data: compRows } = await supabase
    .from('valuation_comps')
    .select('*')
    .eq('valuation_id', v.id)
    .order('similarity_score', { ascending: false })
  const comps = (compRows ?? []).map((r: Record<string, unknown>) => ({
    listingKey: String(r.comp_listing_key ?? ''),
    address: String(r.comp_address ?? ''),
    soldPrice: Number(r.comp_sold_price ?? 0),
    soldDate: String(r.comp_sold_date ?? ''),
    beds: 0,
    baths: 0,
    sqft: r.comp_sqft != null ? Number(r.comp_sqft) : null,
    lotAcres: null as number | null,
    distanceMiles: Number(r.distance_miles ?? 0),
    adjustments: [] as { reason: string; amount: number }[],
    adjustedPrice: Number(r.comp_sold_price ?? 0) + Number(r.adjustment_amount ?? 0),
    similarityScore: Number(r.similarity_score ?? 0),
  }))
  return {
    estimatedValue: v.estimated_value,
    valueLow: v.value_low ?? v.estimated_value,
    valueHigh: v.value_high ?? v.estimated_value,
    confidence: v.confidence as 'high' | 'medium' | 'low',
    comps,
    methodology: 'Weighted average of adjusted comparable sales.',
    valuationId: v.id,
  }
}
