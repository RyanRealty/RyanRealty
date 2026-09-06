/**
 * Pure pricing matcher. Given a subject and a candidate pool (already fetched),
 * walk the 3/6/9 → distance → similar-subdivision ladder. No I/O.
 */

import { resortCommunityCompatible } from '@/lib/cma/resort-guard'
import { bathCountCompatible, distanceMiles, proximityLabel, resolveMarketArea } from '@/lib/cma/market-area'
import { crossesMajorDivide, unmappedCrossesKnownBank } from '@/lib/pricing/divides'
import { crossesUs97, differentUs97Bank } from '@/lib/pricing/highway-cross'
import {
  classifyAgeBand,
  customBathCompatible,
  customLotCompatible,
  hoaCompatible,
  horseInfrastructureCompatible,
  irrigationClassFromRemarks,
  irrigationCompatible,
  isCustomOrNewSubject,
  isNewBuild,
  lotCompatible,
  newConstructionCompatible,
  plausibleListedClose,
  productCompatible,
  resolveIrrigationClass,
  sewerCompatible,
  SAME_NEIGHBORHOOD_TIER_RATIO,
  similarPerformingSubdivision,
  waterCompatible,
  yearQualityCompatible,
  type HoaClass,
  type IrrigationClass,
  type LotClass,
  type ProductKey,
  type SewerClass,
  type StoryClass,
  type WaterClass,
} from '@/lib/pricing/classes'
import {
  PRICING_MAX_COMPS,
  PRICING_MIN_COMPS,
  PRICING_TARGET_COMPS,
  pricingTierLadder,
  type AppleStrictness,
  type PricingTier,
} from '@/lib/pricing/ladder'

export type PricingSubject = {
  listingKey: string | null
  streetAddress: string
  city: string
  citySlug: string
  subdivision: string | null
  subdivisionNorm: string | null
  latitude: number | null
  longitude: number | null
  beds: number | null
  baths: number | null
  sqft: number
  lotAcres: number | null
  yearBuilt: number | null
  storyClass: StoryClass
  productClass: ProductKey
  waterClass: WaterClass
  sewerClass: SewerClass
  hoaClass: HoaClass
  lotClass: LotClass
  ruralAcreage: boolean
  /** City of Bend GIS mesh slug, or null outside every polygon. */
  marketArea?: string | null
  newConstruction?: boolean | null
  /** MLS property_sub_type — "New Construction" classifies even when YN is null. */
  propertySubType?: string | null
  /** Zoning of record. Hard cut only when both sides have a non-empty string. */
  zoning?: string | null
  publicRemarks?: string | null
  /** Subject irrigation from remarks and/or OWRD. Sales use remarks only. */
  irrigationClass?: IrrigationClass | null
}

export type PricingSale = {
  listingKey: string
  listNumber: string | null
  address: string
  city: string
  citySlug: string
  subdivision: string | null
  subdivisionNorm: string | null
  latitude: number | null
  longitude: number | null
  beds: number | null
  baths: number | null
  sqft: number
  lotAcres: number | null
  yearBuilt: number | null
  storyClass: StoryClass
  productClass: ProductKey
  waterClass: WaterClass
  sewerClass: SewerClass
  hoaClass: HoaClass
  lotClass: LotClass
  closePrice: number
  closeDate: string
  concessionsAmount: number | null
  concessionsYn: string | null
  originalAsk: number | null
  lastAsk: number | null
  daysToOffer: number | null
  cdom: number | null
  dropCount: number
  closePpsf: number
  photoUrl: string | null
  publicRemarks: string | null
  marketArea?: string | null
  newConstruction?: boolean | null
  zoning?: string | null
}

export type SubdivisionCell = {
  medianPpsf: number
  n: number
}

export type SelectedPricingComp = PricingSale & {
  selectionTier: string
  proximity: string | null
  monthsBeforeAsOf: number
}

export type PricingMatchResult = {
  comps: SelectedPricingComp[]
  tiersUsed: string[]
  trace: string[]
  reachedTarget: boolean
  starved: boolean
}

function monthsBetween(laterIso: string, earlierIso: string): number {
  const ms = new Date(laterIso).getTime() - new Date(earlierIso).getTime()
  return ms / (30.44 * 86_400_000)
}

function ageOk(subjectYear: number | null, compYear: number | null, asOfYear: number, maxYears: number | null): boolean {
  if (maxYears == null) return true
  if (subjectYear == null || compYear == null) return true
  const a = classifyAgeBand(subjectYear, asOfYear)
  const b = classifyAgeBand(compYear, asOfYear)
  if (a === 'unknown' || b === 'unknown') return true
  return Math.abs(subjectYear - compYear) <= maxYears
}

function storyOk(subject: StoryClass, comp: StoryClass, requireSame: boolean): boolean {
  if (!requireSame) return true
  if (subject === 'unknown' || comp === 'unknown') return true
  return subject === comp
}

function slopOk(subject: number | null, comp: number | null, slop: number | null): boolean {
  if (slop == null) return true
  if (subject == null || comp == null) return true
  return Math.abs(subject - comp) <= slop
}

function normalizeZoning(raw: string | null | undefined): string | null {
  const s = raw?.trim().toUpperCase() ?? ''
  return s || null
}

function zoningCompatible(subjectZone: string | null | undefined, saleZone: string | null | undefined): boolean {
  const a = normalizeZoning(subjectZone)
  const b = normalizeZoning(saleZone)
  if (!a || !b) return true
  return a === b
}

function applesOk(
  subject: PricingSubject,
  sale: PricingSale,
  level: AppleStrictness,
  asOfYear?: number,
): boolean {
  if (!productCompatible(subject.productClass, sale.productClass)) return false
  const customOrNew = isCustomOrNewSubject(
    {
      yearBuilt: subject.yearBuilt,
      newConstructionYn: subject.newConstruction,
      remarks: subject.publicRemarks,
      propertySubType: subject.propertySubType,
    },
    asOfYear,
  )
  // Custom/new: ±1 whole bath (Perspective 3ba vs Rim View 4ba). Exact floor
  // match still holds for ordinary resale.
  if (customOrNew) {
    if (!customBathCompatible(subject.baths, sale.baths)) return false
    if (!customLotCompatible(subject.lotAcres, sale.lotAcres)) return false
  } else {
    if (!bathCountCompatible(subject.baths, sale.baths)) return false
    if (!lotCompatible(subject.lotAcres, sale.lotAcres)) return false
  }
  if (!resortCommunityCompatible(subject.subdivision, sale.subdivision)) return false
  // Water and sewer stay hard on every rung. A well house and a city-water
  // house are different products in this market; widening distance does not
  // make them comparable.
  if (!waterCompatible(subject.waterClass, sale.waterClass)) return false
  if (!sewerCompatible(subject.sewerClass, sale.sewerClass)) return false
  if (crossesMajorDivide(subject.marketArea, sale.marketArea)) return false
  if (
    crossesUs97(
      { lat: subject.latitude ?? NaN, lng: subject.longitude ?? NaN },
      { lat: sale.latitude ?? NaN, lng: sale.longitude ?? NaN },
    ) ||
    differentUs97Bank(
      { lat: subject.latitude ?? NaN, lng: subject.longitude ?? NaN },
      { lat: sale.latitude ?? NaN, lng: sale.longitude ?? NaN },
    )
  ) {
    return false
  }
  // Unmapped rural vs a mapped Parkway/Deschutes bank: keep for ordinary
  // acreage. Custom/new outside the Bend GIS mesh (Rim View / North Rim) must
  // still reach year-quality peers that land inside Awbrey Butte — inventing a
  // bank from a null mesh starves the set. Both-mapped bank crosses still die
  // above via crossesMajorDivide.
  if (
    !customOrNew &&
    subject.ruralAcreage &&
    unmappedCrossesKnownBank(subject.marketArea, sale.marketArea)
  ) {
    return false
  }
  const subjectIrrigation = resolveIrrigationClass(subject.publicRemarks, null, subject.irrigationClass)
  const saleIrrigation = irrigationClassFromRemarks(sale.publicRemarks)
  if (!irrigationCompatible(subjectIrrigation, saleIrrigation)) return false
  if (subject.ruralAcreage || (subject.lotAcres ?? 0) >= 1) {
    if (!horseInfrastructureCompatible(subject.publicRemarks, sale.publicRemarks)) return false
  }
  if (!zoningCompatible(subject.zoning, sale.zoning)) return false
  if (level === 'product_lot' || level === 'utilities') return true
  return hoaCompatible(subject.hoaClass, sale.hoaClass)
}

function cellFor(
  cells: Map<string, SubdivisionCell>,
  citySlug: string,
  subdivisionNorm: string | null,
): SubdivisionCell | null {
  if (!subdivisionNorm) return null
  return cells.get(`${citySlug}:${subdivisionNorm}`) ?? null
}

function passesTier(
  subject: PricingSubject,
  sale: PricingSale,
  tier: PricingTier,
  asOf: string,
  cells: Map<string, SubdivisionCell>,
): { ok: boolean; miles: number | null } {
  if (subject.listingKey && sale.listingKey === subject.listingKey) return { ok: false, miles: null }
  if (subject.streetAddress && sale.address.toLowerCase() === subject.streetAddress.toLowerCase()) {
    return { ok: false, miles: null }
  }
  if (sale.closeDate >= asOf) return { ok: false, miles: null }
  if (!plausibleListedClose(sale.closePrice, sale.lastAsk)) return { ok: false, miles: null }
  if (monthsBetween(asOf, sale.closeDate) > tier.monthsBack) return { ok: false, miles: null }
  if (!tier.ignoreCity && sale.citySlug !== subject.citySlug) return { ok: false, miles: null }
  if (tier.sameSubdivision) {
    if (!subject.subdivisionNorm || sale.subdivisionNorm !== subject.subdivisionNorm) {
      return { ok: false, miles: null }
    }
  }
  const sqftLo = subject.sqft * (1 - tier.sqftBand)
  const sqftHi = subject.sqft * (1 + tier.sqftBand)
  if (sale.sqft < sqftLo || sale.sqft > sqftHi) return { ok: false, miles: null }

  const asOfYear = Number(asOf.slice(0, 4))
  if (!applesOk(subject, sale, tier.apples, asOfYear)) return { ok: false, miles: null }
  if (!ageOk(subject.yearBuilt, sale.yearBuilt, asOfYear, tier.ageYears)) return { ok: false, miles: null }
  if (!storyOk(subject.storyClass, sale.storyClass, tier.sameStory)) return { ok: false, miles: null }
  if (!slopOk(subject.beds, sale.beds, tier.bedSlop)) return { ok: false, miles: null }
  if (!slopOk(subject.baths, sale.baths, tier.bathSlop)) return { ok: false, miles: null }

  const customOrNew = isCustomOrNewSubject(
    {
      yearBuilt: subject.yearBuilt,
      newConstructionYn: subject.newConstruction,
      remarks: subject.publicRemarks,
      propertySubType: subject.propertySubType,
    },
    asOfYear,
  )
  // Custom/new uses the 15-year generation band. The 0–2 year new-vs-resale
  // cut would drop a 2022 custom peer for a 2024 custom subject.
  if (
    !customOrNew &&
    !newConstructionCompatible(
      isNewBuild(subject.yearBuilt, asOfYear, subject.newConstruction),
      isNewBuild(sale.yearBuilt, asOfYear, sale.newConstruction),
    )
  ) {
    return { ok: false, miles: null }
  }
  if (
    !yearQualityCompatible(
      {
        yearBuilt: subject.yearBuilt,
        newConstructionYn: subject.newConstruction,
        remarks: subject.publicRemarks,
        propertySubType: subject.propertySubType,
      },
      { yearBuilt: sale.yearBuilt, newConstructionYn: sale.newConstruction, remarks: sale.publicRemarks },
      asOfYear,
    )
  ) {
    return { ok: false, miles: null }
  }

  // Price-tier + neighborhood cuts on every rung that leaves the subdivision.
  // Same-subdivision sales are the same tier and the same polygon by definition.
  // Custom/new year-quality peers skip the $/sqft tier cut so a North Rim
  // custom sale is not tossed as "too luxury" against a custom subject.
  if (!tier.sameSubdivision) {
    const subjectArea = subject.marketArea ?? resolveMarketArea(subject.latitude, subject.longitude) ?? null
    const saleArea = sale.marketArea ?? resolveMarketArea(sale.latitude, sale.longitude) ?? null
    const customPeer = isCustomOrNewSubject(
      {
        yearBuilt: subject.yearBuilt,
        newConstructionYn: subject.newConstruction,
        remarks: subject.publicRemarks,
      },
      asOfYear,
    )
    // Mapped vs unmapped is a different market for ordinary resale. Custom/new
    // subjects outside the Bend GIS mesh still keep year-quality peers that
    // resolve into a neighboring polygon (North Rim → Awbrey Butte). True
    // Parkway/Deschutes crosses stay hard in applesOk.
    if (subjectArea !== saleArea && !customPeer) {
      return { ok: false, miles: null }
    }
    const subj = cellFor(cells, subject.citySlug, subject.subdivisionNorm)
    const comp = cellFor(cells, sale.citySlug, sale.subdivisionNorm)
    if (
      !customPeer &&
      !similarPerformingSubdivision(
        subj?.medianPpsf ?? null,
        subj?.n ?? 0,
        comp?.medianPpsf ?? null,
        comp?.n ?? 0,
        subjectArea != null ? SAME_NEIGHBORHOOD_TIER_RATIO : undefined,
      )
    ) {
      return { ok: false, miles: null }
    }
  }

  const miles = distanceMiles(
    { lat: subject.latitude, lng: subject.longitude },
    { lat: sale.latitude, lng: sale.longitude },
  )
  if (tier.maxMiles != null) {
    if (miles == null || miles > tier.maxMiles) return { ok: false, miles }
  }
  return { ok: true, miles }
}

const GLA_BRACKET_BAND = 0.25

function toSelected(subject: PricingSubject, sale: PricingSale, asOf: string, tierName: string): SelectedPricingComp {
  return {
    ...sale,
    selectionTier: tierName,
    proximity: proximityLabel(
      { lat: subject.latitude, lng: subject.longitude },
      { lat: sale.latitude, lng: sale.longitude },
    ),
    monthsBeforeAsOf: +monthsBetween(asOf, sale.closeDate).toFixed(1),
  }
}

function glaWithinBand(subjectSqft: number, saleSqft: number, band: number): boolean {
  return saleSqft >= subjectSqft * (1 - band) && saleSqft <= subjectSqft * (1 + band)
}

function saleMiles(subject: PricingSubject, sale: PricingSale): number {
  return (
    distanceMiles(
      { lat: subject.latitude, lng: subject.longitude },
      { lat: sale.latitude, lng: sale.longitude },
    ) ?? 0
  )
}

function bracketEligible(
  subject: PricingSubject,
  sale: PricingSale,
  asOf: string,
  wantLarger: boolean,
): boolean {
  if (subject.listingKey && sale.listingKey === subject.listingKey) return false
  if (subject.streetAddress && sale.address.toLowerCase() === subject.streetAddress.toLowerCase()) return false
  if (sale.closeDate >= asOf) return false
  if (!plausibleListedClose(sale.closePrice, sale.lastAsk)) return false
  const asOfYear = Number(asOf.slice(0, 4))
  if (!applesOk(subject, sale, 'product_lot', asOfYear)) return false
  const customOrNew = isCustomOrNewSubject(
    {
      yearBuilt: subject.yearBuilt,
      newConstructionYn: subject.newConstruction,
      remarks: subject.publicRemarks,
      propertySubType: subject.propertySubType,
    },
    asOfYear,
  )
  if (
    !customOrNew &&
    !newConstructionCompatible(
      isNewBuild(subject.yearBuilt, asOfYear, subject.newConstruction),
      isNewBuild(sale.yearBuilt, asOfYear, sale.newConstruction),
    )
  ) {
    return false
  }
  if (
    !yearQualityCompatible(
      {
        yearBuilt: subject.yearBuilt,
        newConstructionYn: subject.newConstruction,
        remarks: subject.publicRemarks,
        propertySubType: subject.propertySubType,
      },
      { yearBuilt: sale.yearBuilt, newConstructionYn: sale.newConstruction, remarks: sale.publicRemarks },
      asOfYear,
    )
  ) {
    return false
  }
  if (!glaWithinBand(subject.sqft, sale.sqft, GLA_BRACKET_BAND)) return false
  if (wantLarger) return sale.sqft > subject.sqft
  return sale.sqft < subject.sqft
}

/**
 * After the ladder: if every kept sale sits on one side of the subject's GLA
 * and the unused pool already has an apples sale on the other side inside
 * ±25%, swap out the farthest same-side sale. Never invents a comp.
 */
function bracketGla(
  subject: PricingSubject,
  comps: SelectedPricingComp[],
  pool: PricingSale[],
  asOf: string,
): { comps: SelectedPricingComp[]; note: string | null } {
  if (comps.length === 0) return { comps, note: null }
  const allLarger = comps.every((c) => c.sqft > subject.sqft)
  const allSmaller = comps.every((c) => c.sqft < subject.sqft)
  if (!allLarger && !allSmaller) return { comps, note: null }

  const kept = new Set(comps.map((c) => c.listingKey))
  const wantLarger = allSmaller
  const candidates = pool.filter((sale) => !kept.has(sale.listingKey) && bracketEligible(subject, sale, asOf, wantLarger))
  if (candidates.length === 0) return { comps, note: null }

  candidates.sort((a, b) => {
    const size = Math.abs(a.sqft - subject.sqft) - Math.abs(b.sqft - subject.sqft)
    if (size !== 0) return size
    return b.closeDate.localeCompare(a.closeDate)
  })
  const incoming = candidates[0]!

  const outgoing = comps.reduce((worst, c) => {
    const size = Math.abs(c.sqft - subject.sqft) - Math.abs(worst.sqft - subject.sqft)
    if (size > 0) return c
    if (size < 0) return worst
    return saleMiles(subject, c) > saleMiles(subject, worst) ? c : worst
  })

  const next = comps.filter((c) => c.listingKey !== outgoing.listingKey)
  next.push(toSelected(subject, incoming, asOf, 'gla-bracket'))
  return {
    comps: next,
    note: `GLA bracket: replaced ${outgoing.address} (${outgoing.sqft} sqft) with ${incoming.address} (${incoming.sqft} sqft) so the set is not all ${allLarger ? 'larger' : 'smaller'} than the subject.`,
  }
}

function similarity(subject: PricingSubject, sale: PricingSale, asOf: string): number {
  const size = 1 / (1 + Math.abs(sale.sqft - subject.sqft) / subject.sqft)
  const recency = 1 / (1 + monthsBetween(asOf, sale.closeDate) / 9)
  const age =
    subject.yearBuilt != null && sale.yearBuilt != null
      ? 1 / (1 + Math.abs(subject.yearBuilt - sale.yearBuilt) / 20)
      : 0.85
  const story = subject.storyClass !== 'unknown' && subject.storyClass === sale.storyClass ? 1 : 0.75
  const miles =
    distanceMiles(
      { lat: subject.latitude, lng: subject.longitude },
      { lat: sale.latitude, lng: sale.longitude },
    ) ?? 2
  const dist = 1 / (1 + miles / 2)
  const customOrNew = isCustomOrNewSubject(
    {
      yearBuilt: subject.yearBuilt,
      newConstructionYn: subject.newConstruction,
      remarks: subject.publicRemarks,
      propertySubType: subject.propertySubType,
    },
    Number(asOf.slice(0, 4)),
  )
  if (customOrNew) {
    // Year + quality outrank radius for this class (dist 0.18 used to beat age 0.16).
    return size * 0.26 + recency * 0.20 + age * 0.28 + story * 0.14 + dist * 0.12
  }
  return size * 0.28 + recency * 0.22 + age * 0.16 + story * 0.16 + dist * 0.18
}

export function walkPricingLadder(
  subject: PricingSubject,
  pool: PricingSale[],
  opts: {
    asOf: string
    cells?: Map<string, SubdivisionCell>
    tiers?: PricingTier[]
  },
): PricingMatchResult {
  const asOf = opts.asOf.slice(0, 10)
  const cells = opts.cells ?? new Map()
  const asOfYearForLadder = Number(asOf.slice(0, 4))
  const customLadder = isCustomOrNewSubject(
    {
      yearBuilt: subject.yearBuilt,
      newConstructionYn: subject.newConstruction,
      remarks: subject.publicRemarks,
      propertySubType: subject.propertySubType,
    },
    asOfYearForLadder,
  )
  const tiers = opts.tiers ?? pricingTierLadder({ customOrNew: customLadder })
  const byKey = new Map<string, SelectedPricingComp>()
  const tiersUsed: string[] = []
  const trace: string[] = [
    `As-of ${asOf}. Same subdivision first (3 then 6 then 9 months, then a wider GLA band on the same street), then distance, then similar-performing subdivisions. Hard cuts: product (townhouse ≠ condo ≠ detached), rural/urban, resort, water, sewer, whole baths, US-97/Parkway and Deschutes banks, irrigated vs dry, horse/barn infrastructure on acreage, zoning when both sides have a zone, new vs resale, custom/new year-and-quality, neighborhood once the search leaves the subdivision, HOA on the tight rungs, and a 30% subdivision $/sqft tier gap.`,
  ]

  if (!subject.sqft || subject.sqft < 300) {
    const note = 'Subject has no usable living area, so there is nothing to compare.'
    return { comps: [], tiersUsed, trace: [note], reachedTarget: false, starved: true }
  }

  for (const tier of tiers) {
    if (tier.sameSubdivision && !subject.subdivisionNorm) continue
    if (tier.ruralOnly && !subject.ruralAcreage) continue
    if (tier.name.startsWith('city-') && subject.ruralAcreage) continue
    let added = 0
    for (const sale of pool) {
      if (byKey.has(sale.listingKey)) continue
      const { ok, miles } = passesTier(subject, sale, tier, asOf, cells)
      if (!ok) continue
      byKey.set(sale.listingKey, toSelected(subject, sale, asOf, tier.name))
      added++
    }
    if (added > 0) {
      tiersUsed.push(tier.name)
      trace.push(
        `${tier.name}: +${added} (running ${byKey.size}). GLA ±${Math.round(tier.sqftBand * 100)}%${
          tier.maxMiles != null ? `, ≤${tier.maxMiles} mi` : ''
        }${tier.sameSubdivision ? ', same subdivision' : ''}.`,
      )
      if (tier.disclosure) trace.push(tier.disclosure)
    }
    if (byKey.size >= PRICING_TARGET_COMPS) break
  }

  const ranked = [...byKey.values()].sort((a, b) => similarity(subject, b, asOf) - similarity(subject, a, asOf))
  const sliced = ranked.slice(0, PRICING_MAX_COMPS)
  const bracketed = bracketGla(subject, sliced, pool, asOf)
  if (bracketed.note) {
    if (!tiersUsed.includes('gla-bracket')) tiersUsed.push('gla-bracket')
    trace.push(bracketed.note)
  }
  const comps = [...bracketed.comps].sort((a, b) => b.closeDate.localeCompare(a.closeDate))
  const reachedTarget = comps.length >= PRICING_TARGET_COMPS
  if (comps.length < PRICING_MIN_COMPS) {
    trace.push(`Only ${comps.length} comparable sale(s) after the full ladder. The estimate needs broker review.`)
  } else {
    trace.push(`Final set: ${comps.length} closed sales from ${tiersUsed.join(', ') || 'none'}.`)
  }
  return { comps, tiersUsed, trace, reachedTarget, starved: !reachedTarget }
}
