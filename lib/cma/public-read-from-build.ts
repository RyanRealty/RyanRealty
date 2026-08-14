/**
 * Public listing-page contract from a finished CMA/BPO price set.
 *
 * The document can still print a number on new construction. The public page
 * must not. This helper is the one mapping so build_summary and the stamp
 * writer do not drift.
 */

import type { CmaSubject } from '@/lib/cma/types'
import { isNewBuild } from '@/lib/pricing/classes'
import { predictedCloseFromAdjusted } from '@/lib/pricing/estimate'
import { publicListingRead, type PublicListingRead } from '@/lib/pricing/public-contract'

export function sameSubdivisionTight(tiersUsed: string[]): boolean {
  return tiersUsed.length > 0 && tiersUsed.every((t) => t.startsWith('subdivision-') && !t.includes('wide'))
}

export function publicReadFromBuild(opts: {
  factsReady: boolean
  comps: Array<{ ppsfTimeAdjusted: number }>
  subject: Pick<CmaSubject, 'sqft' | 'lastListPrice' | 'yearBuilt' | 'newConstructionYn' | 'subdivision'>
  tiersUsed: string[]
  asOfYear?: number
}): PublicListingRead {
  return publicListingRead({
    factsReady: opts.factsReady,
    n: opts.comps.length,
    compsClose: predictedCloseFromAdjusted(opts.subject.sqft ?? 0, opts.comps),
    listPrice: opts.subject.lastListPrice,
    sqft: opts.subject.sqft,
    newConstruction:
      isNewBuild(opts.subject.yearBuilt, opts.asOfYear ?? new Date().getFullYear(), opts.subject.newConstructionYn) ===
      true,
    subdivision: opts.subject.subdivision,
    sameSubdivisionTight: sameSubdivisionTight(opts.tiersUsed),
  })
}
