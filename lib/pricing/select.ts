/**
 * Fetch + walk. The CMA / BPO / expired path calls this instead of scanning
 * listings for comps once sale_pricing_facts is populated.
 */

import { isRuralAcreage } from '@/lib/cma/comp-tiers'
import { marketAreaName, resolveMarketArea } from '@/lib/cma/market-area'
import type { CmaSubject } from '@/lib/cma/types'
import { cmaSubjectToPricing } from '@/lib/pricing/subject'
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
import { walkPricingLadder, type PricingMatchResult } from '@/lib/pricing/match'
import type { CmaMarketContext, CmaPricing } from '@/lib/cma/types'
import type { MarketIndexPoint } from '@/lib/pricing/market-path'

export { cmaSubjectToPricing } from '@/lib/pricing/subject'

export async function selectPricingComps(
  subject: CmaSubject,
  opts: { asOf?: string; waterRaw?: unknown; sewerRaw?: unknown; levelsRaw?: unknown } = {},
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
  })
  const asOf = (opts.asOf ?? new Date().toISOString()).slice(0, 10)
  const closeAfter = new Date(asOf)
  closeAfter.setMonth(closeAfter.getMonth() - 18)
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
  const walked = walkPricingLadder(pricingSubject, [...byKey.values()], { asOf, cells })
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

/** Facts ran → stay on facts even when n is 0–2. CMA build already fails below 3. */
export function pickCompSource(match: { factsReady: boolean; comps?: unknown[] }): 'facts' | 'listings' {
  return match.factsReady ? 'facts' : 'listings'
}

export async function selectCompsPreferringFacts(subject: CmaSubject): Promise<CompSelection> {
  const { selectComps } = await import('@/lib/cma/comps')
  const match = await selectPricingComps(subject)
  if (pickCompSource(match) === 'facts') {
    return matchToCompSelection(subject, match)
  }
  return selectComps(subject)
}
