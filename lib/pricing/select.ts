/**
 * Fetch + walk. The CMA / BPO / expired path calls this instead of scanning
 * listings for comps once sale_pricing_facts is populated.
 */

import { isRuralAcreage } from '@/lib/cma/comp-tiers'
import { marketAreaName, resolveMarketArea } from '@/lib/cma/market-area'
import type { CmaSubject } from '@/lib/cma/types'
import {
  classifyHoa,
  classifyLot,
  classifyProduct,
  classifySewer,
  classifyStory,
  classifyWater,
  citySlug,
  isCustomOrNewSubject,
  normSubdivision,
  type IrrigationClass,
  type StoryClass,
} from '@/lib/pricing/classes'
import {
  countSalePricingFacts,
  getListingWaterSource,
  getPricingMarketIndex,
  getPricingSubdivisionCells,
  selectPricingFactsPool,
} from '@/lib/data/pricing/facts'
import { estimateClosePrice, pricingSaleToCmaComp } from '@/lib/pricing/estimate'
import type { SelectedPricingComp } from '@/lib/pricing/match'
import type { CompSelection } from '@/lib/cma/comps'
import { emptyExclusions } from '@/lib/cma/comp-trace'
import { PRICING_MIN_COMPS, PRICING_TARGET_COMPS } from '@/lib/pricing/ladder'
import { walkPricingLadder, type PricingMatchResult, type PricingSubject } from '@/lib/pricing/match'
import type { CmaMarketContext, CmaPricing } from '@/lib/cma/types'
import type { MarketIndexPoint } from '@/lib/pricing/market-path'

export function cmaSubjectToPricing(
  subject: CmaSubject,
  extras: {
    waterRaw?: unknown
    sewerRaw?: unknown
    levelsRaw?: unknown
    storyClass?: StoryClass
    zoning?: string | null
    irrigationClass?: IrrigationClass | null
  } = {},
): PricingSubject {
  const area = resolveMarketArea(subject.latitude, subject.longitude)
  const zoningFromSubject =
    'zoning' in subject ? (subject as CmaSubject & { zoning?: string | null }).zoning : undefined
  return {
    listingKey: subject.listingKey,
    streetAddress: subject.streetAddress,
    city: subject.city,
    citySlug: citySlug(subject.city),
    subdivision: subject.subdivision,
    subdivisionNorm: normSubdivision(subject.subdivision),
    latitude: subject.latitude,
    longitude: subject.longitude,
    beds: subject.beds,
    baths: subject.baths,
    sqft: subject.sqft ?? 0,
    lotAcres: subject.lotAcres,
    yearBuilt: subject.yearBuilt,
    storyClass: extras.storyClass ?? classifyStory(extras.levelsRaw ?? subject.levelsRaw, null),
    productClass: classifyProduct(subject.propertySubType),
    waterClass: classifyWater(extras.waterRaw ?? subject.waterRaw),
    sewerClass: classifySewer(extras.sewerRaw ?? subject.sewerRaw),
    hoaClass: classifyHoa(subject.associationYn ?? null, subject.associationFee ?? subject.hoaMonthly ?? null),
    lotClass: classifyLot(subject.lotAcres),
    ruralAcreage: isRuralAcreage(subject, area),
    marketArea: area,
    newConstruction: subject.newConstructionYn ?? null,
    zoning: extras.zoning ?? zoningFromSubject ?? null,
    publicRemarks: subject.publicRemarks,
    irrigationClass: extras.irrigationClass ?? null,
  }
}

export async function selectPricingComps(
  subject: CmaSubject,
  opts: {
    asOf?: string
    waterRaw?: unknown
    sewerRaw?: unknown
    levelsRaw?: unknown
    subjectIrrigation?: IrrigationClass | null
  } = {},
): Promise<PricingMatchResult & { factsReady: boolean }> {
  const factsReady = (await countSalePricingFacts()) >= 1000
  if (!factsReady) {
    return {
      comps: [],
      tiersUsed: [],
      trace: ['sale_pricing_facts is still backfilling. The listings ladder is the fallback.'],
      reachedTarget: false,
      starved: true,
      factsReady: false,
    }
  }
  let waterRaw = opts.waterRaw
  if (waterRaw == null && subject.listingKey) {
    waterRaw = await getListingWaterSource(subject.listingKey)
  }
  const pricingSubject = cmaSubjectToPricing(subject, {
    waterRaw,
    sewerRaw: opts.sewerRaw,
    levelsRaw: opts.levelsRaw,
    irrigationClass: opts.subjectIrrigation,
  })
  const asOf = (opts.asOf ?? new Date().toISOString()).slice(0, 10)
  const asOfYear = Number(asOf.slice(0, 4))
  const customOrNew = isCustomOrNewSubject(
    {
      yearBuilt: pricingSubject.yearBuilt,
      newConstructionYn: pricingSubject.newConstruction,
      remarks: pricingSubject.publicRemarks,
      propertySubType: subject.propertySubType,
      standardStatus: subject.standardStatus,
    },
    asOfYear,
  )
  // Custom/new: pull 30 months so the 24-month custom rungs have a pool.
  const closeAfter = new Date(asOf)
  closeAfter.setMonth(closeAfter.getMonth() - (customOrNew ? 30 : 18))
  const sqft = pricingSubject.sqft
  const [pool, ruralPool, cells] = await Promise.all([
    selectPricingFactsPool({
      citySlug: pricingSubject.citySlug,
      closeBefore: asOf,
      closeAfter: closeAfter.toISOString().slice(0, 10),
      sqftMin: Math.round(sqft * 0.6),
      sqftMax: Math.round(sqft * 1.4),
      productClass: pricingSubject.productClass,
      limit: 800,
    }),
    pricingSubject.ruralAcreage
      ? selectPricingFactsPool({
          citySlug: null,
          ignoreCity: true,
          closeBefore: asOf,
          closeAfter: closeAfter.toISOString().slice(0, 10),
          sqftMin: Math.round(sqft * 0.6),
          sqftMax: Math.round(sqft * 1.4),
          productClass: pricingSubject.productClass,
          limit: 800,
        })
      : Promise.resolve([]),
    getPricingSubdivisionCells(pricingSubject.citySlug),
  ])
  const byKey = new Map(pool.map((s) => [s.listingKey, s]))
  for (const s of ruralPool) if (!byKey.has(s.listingKey)) byKey.set(s.listingKey, s)
  const walked = walkPricingLadder(
    pricingSubject,
    [...byKey.values()].map((s) => ({
      ...s,
      marketArea: s.marketArea ?? resolveMarketArea(s.latitude, s.longitude),
    })),
    { asOf, cells },
  )
  return { ...walked, factsReady: true }
}

export async function priceSubjectFromFacts(
  subject: CmaSubject,
  opts: {
    asOf?: string
    waterRaw?: unknown
    sewerRaw?: unknown
    levelsRaw?: unknown
    market?: CmaMarketContext | null
    subjectIrrigation?: IrrigationClass | null
  } = {},
): Promise<{
  match: PricingMatchResult & { factsReady: boolean }
  pricing: CmaPricing | null
  predictedClose: number | null
  compsImpliedClose: number | null
  recommendedList: number | null
  medianDaysToOffer: number | null
  pathNotes: string[]
  regime: string
  index: MarketIndexPoint[]
}> {
  const asOf = (opts.asOf ?? new Date().toISOString()).slice(0, 10)
  const match = await selectPricingComps(subject, opts)
  let waterRaw = opts.waterRaw
  if (waterRaw == null && subject.listingKey) {
    waterRaw = await getListingWaterSource(subject.listingKey)
  }
  const pricingSubject = cmaSubjectToPricing(subject, {
    waterRaw,
    sewerRaw: opts.sewerRaw,
    levelsRaw: opts.levelsRaw,
    irrigationClass: opts.subjectIrrigation,
  })
  const index = await getPricingMarketIndex(pricingSubject.citySlug)
  const est = estimateClosePrice({
    subject,
    subjectStory: pricingSubject.storyClass,
    comps: match.comps,
    compStories: match.comps.map((c) => c.storyClass),
    points: index,
    asOf,
    market: opts.market ?? null,
  })
  return { match, ...est, index }
}

export function matchToCompSelection(
  subject: CmaSubject,
  match: PricingMatchResult,
): CompSelection & { pricingSales: SelectedPricingComp[] } {
  const area = resolveMarketArea(subject.latitude, subject.longitude)
  return {
    comps: match.comps.map(pricingSaleToCmaComp),
    excludedOutliers: [],
    tiersUsed: match.tiersUsed,
    trace: match.trace,
    pricingSource: 'facts',
    pricingSales: match.comps,
    diagnostics: {
      market_area: marketAreaName(area),
      market_area_resolved: area != null,
      rural_acreage: isRuralAcreage(subject, area),
      subject: {
        sqft: subject.sqft ?? null,
        lot_acres: subject.lotAcres ?? null,
        subdivision: subject.subdivision ?? null,
        subdivision_raw: subject.subdivision ?? null,
        product_sub_type: subject.propertySubType ?? null,
      },
      ladder: [],
      tiers_used: match.tiersUsed,
      reached_target: match.reachedTarget,
      starved: match.starved,
      starved_at: match.starved ? match.tiersUsed[match.tiersUsed.length - 1] ?? null : null,
      starved_reason: match.starved ? 'The pricing ladder did not reach five apples-to-apples sales.' : null,
      target_comps: PRICING_TARGET_COMPS,
      min_comps: PRICING_MIN_COMPS,
      candidates: match.comps.length,
      excluded_totals: emptyExclusions(),
      outliers_excluded: 0,
      final_count: match.comps.length,
      final_tier_counts: Object.fromEntries(
        match.tiersUsed.map((t) => [t, match.comps.filter((c) => c.selectionTier === t).length]),
      ),
      disclosures: match.trace.filter((t) => t.includes('Fannie') || t.includes('subdivision')),
    },
  }
}

/**
 * Facts win when they produced a priceable set. Under 3 sales, ordinary resale
 * falls back to the listings ladder.
 *
 * Custom/new must NOT fall back: the listings ladder still uses exact baths and
 * unmappedCrossesKnownBank, which re-starves Perspective-class peers and can
 * pad TARGET_COMPS with 1970s stock the facts year-quality gate already refused
 * (live Rim View after a8ab9ded). Stay on facts even at 1–2 comps so the build
 * fails cleanly and recordBuildFailure can clear the stale kept-set draft.
 */
export function pickCompSource(match: {
  factsReady: boolean
  comps?: unknown[]
  customOrNew?: boolean
}): 'facts' | 'listings' {
  // Custom/new NEVER falls back to listings — even when facts are not ready.
  // The listings ladder still uses exact baths + unmappedCrossesKnownBank and
  // can pad TARGET_COMPS with 1970s stock (live Rim View 144→2, 47/34/33).
  // Stay on facts and fail clean so recordBuildFailure clears the stale draft.
  if (match.customOrNew) return 'facts'
  if (!match.factsReady) return 'listings'
  const n = match.comps?.length ?? 0
  if (n >= 3) return 'facts'
  return 'listings'
}

export async function selectCompsPreferringFacts(
  subject: CmaSubject,
  opts: { subjectIrrigation?: IrrigationClass | null } = {},
): Promise<CompSelection> {
  const { selectComps } = await import('@/lib/cma/comps')
  const match = await selectPricingComps(subject, opts)
  const customOrNew = isCustomOrNewSubject({
    yearBuilt: subject.yearBuilt,
    newConstructionYn: subject.newConstructionYn,
    remarks: subject.publicRemarks,
    propertySubType: subject.propertySubType,
    standardStatus: subject.standardStatus,
  })
  // Belt: never invoke the listings ladder for custom/new, full stop.
  if (customOrNew || pickCompSource({ ...match, customOrNew }) === 'facts') {
    return matchToCompSelection(subject, match)
  }
  return selectComps(subject, opts)
}
