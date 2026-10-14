/**
 * Shared CMA pricing engine entry for BPO builds.
 * Keeps lib/bpo/build.ts inside its file-size budget.
 */

import { getCmaMarketContext } from '@/lib/cma/market'
import { resolveCmaSiteData } from '@/lib/cma/county'
import { buildCmaMapDataUri } from '@/lib/cma/map'
import { adjustComps, computePricing } from '@/lib/cma/pricing'
import type { CompSelection } from '@/lib/cma/comps'
import type { CmaAdjustedComp, CmaComp, CmaMarketContext, CmaPricing, CmaSubject } from '@/lib/cma/types'
import { getPricingMarketIndex } from '@/lib/data/pricing/facts'
import { citySlug } from '@/lib/pricing/classes'
import { pricingMarketFor } from '@/lib/cma/subject-units'
import { priceCmaSet } from '@/lib/pricing/estimate'
import { reviewWeightFactor } from '@/lib/cma/review-weight'
import { selectCompsPreferringFacts } from '@/lib/pricing/select'
import type { MarketIndexPoint } from '@/lib/pricing/market-path'

export async function loadBpoEngineInputs(
  subject: CmaSubject,
  opts: { aduFallback?: { heldAfterReview: number } | null; unitsFallback?: { heldAfterReview: number } | null } = {},
) {
  const [selection, market, site, marketIndex] = await Promise.all([
    selectCompsPreferringFacts(subject, {
      // The re-entry after a review drop on an ADU-first set (BpoBuildInput.aduFallback).
      aduPass: opts.aduFallback ? 'ordinary' : 'first',
      aduSalesHeld: opts.aduFallback?.heldAfterReview,
      // The multi-unit ladder's re-entry (BpoBuildInput.unitsFallback).
      unitsPass: opts.unitsFallback ? 'class' : 'first',
      unitSalesHeld: opts.unitsFallback?.heldAfterReview,
    }),
    getCmaMarketContext(subject),
    resolveCmaSiteData(subject),
    // A 2-4 unit home is not moved by the single-family index (see the CMA build).
    subject.multiUnit ? Promise.resolve([]) : getPricingMarketIndex(citySlug(subject.city)),
  ])
  return { selection, market, site, marketIndex }
}

export function priceBpoAdjusted(opts: {
  subject: CmaSubject
  set: CmaComp[]
  market: CmaMarketContext | null
  selection: CompSelection
  marketIndex: MarketIndexPoint[]
  asOf: string
  tierByKey: Map<string, string>
  priceOverride?: number | null
  adjustComps: typeof adjustComps
  computePricing: typeof computePricing
}): { adj: CmaAdjustedComp[]; p: CmaPricing | null } {
  // A 2-4 unit home is not moved by the single-family year-over-year figure (lib/cma/subject-units.ts).
  const pricingMarket = pricingMarketFor(opts.subject, opts.market)
  const adj = opts.adjustComps(opts.subject, opts.set, pricingMarket).map((c) => {
    const factor = reviewWeightFactor(opts.tierByKey.get(c.listingKey))
    return factor < 1 ? { ...c, weight: +(c.weight * factor).toFixed(4) } : c
  })
  const p = priceCmaSet({
    subject: opts.subject,
    adjusted: adj,
    market: pricingMarket,
    input: { priceOverride: opts.priceOverride ?? null },
    selection: opts.selection,
    marketIndex: opts.marketIndex,
    asOf: opts.asOf,
    computePricing: opts.computePricing,
  })
  return { adj, p }
}

export function bpoCompMap(subject: CmaSubject, comps: CmaComp[], tiersUsed: string[]) {
  return buildCmaMapDataUri(subject, comps, { tiersUsed })
}
