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

/** Fetch subject property and its active listing (for stats and VOW flag). */
async function getSubject(
  supabase: SupabaseClient,
  propertyId: string
): Promise<CMASubject | null> {
  const { data: prop, error: propErr } = await supabase
    .from('properties')
    .select('id, unparsed_address, community_id')
    .eq('id', propertyId)
    .single()
  if (propErr || !prop) return null

  const { data: listing } = await supabase
    .from('listings')
    .select(
      'listing_key, beds_total, baths_full, living_area, lot_size_acres, year_built, garage_spaces, pool_features, property_type, vow_avm_display_yn'
    )
    .eq('property_id', propertyId)
    .or('standard_status.ilike.%Active%,standard_status.ilike.%Pending%,standard_status.ilike.%For Sale%')
    .order('modification_timestamp', { ascending: false })
    .limit(1)
    .maybeSingle()

  const subListing = listing as Record<string, unknown> | null
  const poolFeatures = subListing?.pool_features as string | null | undefined
  return {
    propertyId: (prop as { id: string }).id,
    address: (prop as { unparsed_address: string }).unparsed_address ?? '',
    beds: num(subListing?.beds_total) ?? null,
    baths: num(subListing?.baths_full) ?? null,
    sqft: num(subListing?.living_area) ?? null,
    lotAcres: num(subListing?.lot_size_acres) ?? null,
    yearBuilt: num(subListing?.year_built) ?? null,
    garageSpaces: num(subListing?.garage_spaces) ?? null,
    poolYn: Boolean(poolFeatures && String(poolFeatures).trim() !== ''),
    propertyType: subListing?.property_type != null ? String(subListing.property_type) : null,
    communityId: (prop as { community_id?: string }).community_id ?? null,
    listingKey: subListing?.listing_key != null ? String(subListing.listing_key) : null,
    vowAvmDisplayYn: Boolean(subListing?.vow_avm_display_yn),
  }
}

/** Fetch comp candidates: radius first, then community fallback. */
async function getCompCandidates(
  supabase: SupabaseClient,
  propertyId: string,
  communityId: string | null
): Promise<CMACompRow[]> {
  const rows = await supabase.rpc('get_cma_comps', {
    p_subject_property_id: propertyId,
    p_radius_miles: 1,
    p_months_back: 6,
    p_max_count: 10,
  }).then((r) => (r.data ?? []).map((row: Record<string, unknown>) => parseCompRow(row)))

  if (rows.length < 3) {
    const expanded = await supabase.rpc('get_cma_comps', {
      p_subject_property_id: propertyId,
      p_radius_miles: 2,
      p_months_back: 12,
      p_max_count: 10,
    }).then((r) => (r.data ?? []).map((row: Record<string, unknown>) => parseCompRow(row)))
    const seen = new Set(rows.map((c: CMACompRow) => c.listing_key))
    for (const row of expanded) {
      if (!seen.has(row.listing_key)) {
        seen.add(row.listing_key)
        rows.push(row)
      }
    }
  }

  if (rows.length < 3 && communityId) {
    const byCommunity = await supabase.rpc('get_cma_comps_by_community', {
      p_community_id: communityId,
      p_exclude_property_id: propertyId,
      p_months_back: 12,
      p_max_count: 10,
    }).then((r) => (r.data ?? []).map((row: Record<string, unknown>) => parseCompRow(row)))
    const seen = new Set(rows.map((c: CMACompRow) => c.listing_key))
    for (const row of byCommunity) {
      if (!seen.has(row.listing_key)) {
        seen.add(row.listing_key)
        rows.push(row)
      }
    }
  }

  return rows.slice(0, 10)
}

/** Filter comps by similarity: beds ±1, sqft ±25%, year ±15. */
function filterComps(subject: CMASubject, rows: CMACompRow[]): CMACompRow[] {
  const subBeds = subject.beds ?? 0
  const subSqft = subject.sqft ?? 0
  const subYear = subject.yearBuilt ?? 0
  return rows.filter((r) => {
    if (r.close_price == null || r.close_price <= 0) return false
    const beds = r.beds_total ?? 0
    const sqft = r.living_area ?? 0
    const year = r.year_built ?? 0
    if (Math.abs(beds - subBeds) > 1) return false
    if (subSqft > 0 && sqft > 0) {
      const pct = Math.abs(sqft - subSqft) / subSqft
      if (pct > 0.25) return false
    }
    if (subYear > 0 && year > 0 && Math.abs(year - subYear) > 15) return false
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
  if (!subject) return null

  const candidates = await getCompCandidates(supabase, propertyId, subject.communityId)
  const compsFiltered = filterComps(subject, candidates)
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
  const confidence: 'high' | 'medium' | 'low' =
    compResults.length >= 5 ? 'high' : compResults.length >= 3 ? 'medium' : 'low'

  const methodology =
    'Weighted average of adjusted comparable sales. Adjustments: sqft (price/sqft), beds ($15k), baths ($10k), age ($2k/yr), lot ($5k/0.25ac), garage ($15k), pool ($20k).'

  const { data: valuation, error: valErr } = await supabase
    .from('valuations')
    .insert({
      property_id: propertyId,
      estimated_value: Math.round(estimatedValue),
      value_low: Math.round(valueLow),
      value_high: Math.round(valueHigh),
      confidence,
      comp_count: compResults.length,
      methodology_version: '1.0',
    })
    .select('id')
    .single()

  if (valErr || !valuation) return null
  const valuationId = (valuation as { id: string }).id

  for (const c of compResults) {
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

/** Get cached CMA for a property (by property_id). Returns null if none or expired. */
export async function getCachedCMA(propertyId: string): Promise<CMAResult | null> {
  const supabase = getServiceSupabase()
  const { data: val } = await supabase
    .from('valuations')
    .select('id, estimated_value, value_low, value_high, confidence, comp_count, methodology_version')
    .eq('property_id', propertyId)
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
