/**
 * Pure pricing matcher. Given a subject and a candidate pool (already fetched),
 * walk the 3/6/9 → distance → similar-subdivision ladder. No I/O.
 */

import { resortCommunityCompatible } from '@/lib/cma/resort-guard'
import { distanceMiles, proximityLabel, resolveMarketArea } from '@/lib/cma/market-area'
import {
  classifyAgeBand,
  hoaCompatible,
  isNewBuild,
  lotCompatible,
  newConstructionCompatible,
  plausibleListedClose,
  productCompatible,
  sewerCompatible,
  SAME_NEIGHBORHOOD_TIER_RATIO,
  similarPerformingSubdivision,
  waterCompatible,
  type AgeBand,
  type HoaClass,
  type LotClass,
  type ProductKey,
  type SewerClass,
  type StoryClass,
  type WaterClass,
} from '@/lib/pricing/classes'
import {
  PRICING_MAX_COMPS,
  PRICING_MIN_COMPS,
  PRICING_QUALITY_STOP,
  PRICING_TARGET_COMPS,
  isPricingQualityRung,
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

function applesOk(subject: PricingSubject, sale: PricingSale, level: AppleStrictness): boolean {
  if (!productCompatible(subject.productClass, sale.productClass)) return false
  if (!lotCompatible(subject.lotAcres, sale.lotAcres)) return false
  if (!resortCommunityCompatible(subject.subdivision, sale.subdivision)) return false
  // Water and sewer stay hard on every rung. A well house and a city-water
  // house are different products in this market; widening distance does not
  // make them comparable.
  if (!waterCompatible(subject.waterClass, sale.waterClass)) return false
  if (!sewerCompatible(subject.sewerClass, sale.sewerClass)) return false
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
  if (!applesOk(subject, sale, tier.apples)) return { ok: false, miles: null }

  const asOfYear = Number(asOf.slice(0, 4))
  if (!ageOk(subject.yearBuilt, sale.yearBuilt, asOfYear, tier.ageYears)) return { ok: false, miles: null }
  if (!storyOk(subject.storyClass, sale.storyClass, tier.sameStory)) return { ok: false, miles: null }
  if (!slopOk(subject.beds, sale.beds, tier.bedSlop)) return { ok: false, miles: null }
  if (!slopOk(subject.baths, sale.baths, tier.bathSlop)) return { ok: false, miles: null }

  if (
    !newConstructionCompatible(
      isNewBuild(subject.yearBuilt, asOfYear, subject.newConstruction),
      isNewBuild(sale.yearBuilt, asOfYear, sale.newConstruction),
    )
  ) {
    return { ok: false, miles: null }
  }

  // Price-tier + neighborhood cuts on every rung that leaves the subdivision.
  // Same-subdivision sales are the same tier and the same polygon by definition.
  if (!tier.sameSubdivision) {
    const subjectArea = subject.marketArea ?? resolveMarketArea(subject.latitude, subject.longitude) ?? null
    const saleArea = sale.marketArea ?? resolveMarketArea(sale.latitude, sale.longitude) ?? null
    // Mapped vs unmapped is a different market. Fail-open here let Highway 20
    // sales into Boyd Acres because Bend GIS is the only mesh.
    if (subjectArea !== saleArea) {
      return { ok: false, miles: null }
    }
    const subj = cellFor(cells, subject.citySlug, subject.subdivisionNorm)
    const comp = cellFor(cells, sale.citySlug, sale.subdivisionNorm)
    if (
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
  const tiers = opts.tiers ?? pricingTierLadder()
  const byKey = new Map<string, SelectedPricingComp>()
  const tiersUsed: string[] = []
  const trace: string[] = [
    `As-of ${asOf}. Same subdivision first (3 then 6 then 9 months, then a wider GLA band on the same street), then distance, then similar-performing subdivisions. Hard cuts: product, rural/urban, resort, water, sewer, new vs resale, neighborhood once the search leaves the subdivision, HOA on the tight rungs, and a 30% subdivision $/sqft tier gap.`,
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
      byKey.set(sale.listingKey, {
        ...sale,
        selectionTier: tier.name,
        proximity: proximityLabel(
          { lat: subject.latitude, lng: subject.longitude },
          { lat: sale.latitude, lng: sale.longitude },
        ),
        monthsBeforeAsOf: +monthsBetween(asOf, sale.closeDate).toFixed(1),
      })
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
    if (isPricingQualityRung(tier) && byKey.size >= PRICING_QUALITY_STOP) {
      trace.push(
        `Stopped at ${byKey.size} apples on ${tier.name}. Three tight sales beat a wider mix.`,
      )
      break
    }
    if (byKey.size >= PRICING_TARGET_COMPS) break
  }

  const ranked = [...byKey.values()].sort((a, b) => similarity(subject, b, asOf) - similarity(subject, a, asOf))
  const comps = ranked.slice(0, PRICING_MAX_COMPS).sort((a, b) => b.closeDate.localeCompare(a.closeDate))
  const reachedTarget = comps.length >= PRICING_TARGET_COMPS
  if (comps.length < PRICING_MIN_COMPS) {
    trace.push(`Only ${comps.length} comparable sale(s) after the full ladder. The estimate needs broker review.`)
  } else {
    trace.push(`Final set: ${comps.length} closed sales from ${tiersUsed.join(', ') || 'none'}.`)
  }
  return { comps, tiersUsed, trace, reachedTarget, starved: !reachedTarget }
}
