/**
 * Stamp closed-comp DOM from the earliest list date (history / original entry)
 * when that date is earlier than the current OnMarketDate.
 */
import { stampClosedCompDom } from '@/lib/cma/closed-comp-dom-stamp'
import type { CmaComp } from '@/lib/cma/types'
import { getClosedCompListStarts } from '@/lib/data/cma/localOutcomeReads'

export { stampClosedCompDom } from '@/lib/cma/closed-comp-dom-stamp'

export async function hydrateClosedCompDaysOnMarket(comps: CmaComp[]): Promise<CmaComp[]> {
  if (comps.length === 0) return comps
  try {
    const starts = await getClosedCompListStarts(comps.map((c) => c.listingKey))
    if (starts.size === 0) return comps
    return comps.map((comp) => {
      const extras = starts.get(comp.listingKey)
      if (!extras) return comp
      return stampClosedCompDom(comp, extras)
    })
  } catch (err) {
    // History lookup is additive. A Next-cache or PostgREST miss must not
    // kill selectComps / the CMA build — letter then keeps late MLS DOM.
    console.error('[hydrateClosedCompDaysOnMarket]', err)
    return comps
  }
}
