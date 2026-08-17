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
import { getPricingMarketIndex } from '@/lib/data'
import { citySlug } from '@/lib/pricing/classes'
import { priceCmaSet } from '@/lib/pricing/estimate'
import { selectCompsPreferringFacts } from '@/lib/pricing/select'
import type { MarketIndexPoint } from '@/lib/pricing/market-path'

export async function loadBpoEngineInputs(subject: CmaSubject) {
  const [selection, market, site, marketIndex] = await Promise.all([
    selectCompsPreferringFacts(subject),
    getCmaMarketContext(subject),
    resolveCmaSiteData(subject),
    getPricingMarketIndex(citySlug(subject.city)),
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
}): { adj: CmaAdjustedComp[]; p: CmaPricing } | null {
  const adj = opts.adjustComps(opts.subject, opts.set, opts.market).map((c) => {
    const tier = opts.tierByKey.get(c.listingKey)
    return tier === 'weak' ? { ...c, weight: +(c.weight * 0.5).toFixed(4) } : c
  })
  const p = priceCmaSet({
    subject: opts.subject,
    adjusted: adj,
    market: opts.market,
    input: { priceOverride: opts.priceOverride ?? null },
    selection: opts.selection,
    marketIndex: opts.marketIndex,
    asOf: opts.asOf,
    computePricing: opts.computePricing,
  })
  return p ? { adj, p } : null
}

export function bpoCompMap(subject: CmaSubject, comps: CmaComp[], tiersUsed: string[]) {
  return buildCmaMapDataUri(subject, comps, { tiersUsed })
}
