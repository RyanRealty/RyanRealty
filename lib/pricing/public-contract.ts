/**
 * Public listing-page pricing contract.
 *
 * Listed close pick stays ask × 0.98 in estimate.ts. This module never
 * reprints that haircut as "our read." Over/under vs market uses the
 * comps-implied close. Unlisted houses get a range. New construction and
 * numbered builder-phase plats refuse on the public page (Kiesow / Walnut /
 * Quartz class). Published CMA is a page-level check, not a competing kind.
 *
 * Range band is the leftover-cut backtest median abs (8.55%), rounded up
 * to 9%. Cite: scripts/pricing-backtest.mjs, 2026-08-14T16:48:36Z, n=174.
 */

export const PUBLIC_RANGE_BAND = 0.09

export type PublicRefuseReason =
  | 'thin-set'
  | 'new-construction'
  | 'builder-phase'
  | 'facts-not-ready'
  | 'no-gla'

export type PublicListingRead =
  | {
      kind: 'listed-over-under'
      listPrice: number
      compsClose: number
      deltaPct: number
      n: number
      rangeLow: number
      rangeHigh: number
    }
  | {
      kind: 'unlisted-range'
      compsClose: number
      rangeLow: number
      rangeHigh: number
      n: number
    }
  | { kind: 'refuse'; reason: PublicRefuseReason }

export type PublicListingReadInput = {
  factsReady: boolean
  n: number
  compsClose: number | null
  listPrice: number | null
  sqft: number | null
  newConstruction: boolean
  subdivision: string | null
  sameSubdivisionTight: boolean
}

export function isBuilderPhase(subdivision: string | null | undefined): boolean {
  if (!subdivision) return false
  return /\bphase\s*\d/i.test(subdivision)
}

export function publishedCmaWins(hasPublished: boolean): boolean {
  return hasPublished
}

function roundThousand(n: number): number {
  return Math.round(n / 1000) * 1000
}

function rangeAround(compsClose: number): { rangeLow: number; rangeHigh: number } {
  return {
    rangeLow: roundThousand(compsClose * (1 - PUBLIC_RANGE_BAND)),
    rangeHigh: roundThousand(compsClose * (1 + PUBLIC_RANGE_BAND)),
  }
}

export function publicListingRead(input: PublicListingReadInput): PublicListingRead {
  if (!input.factsReady) return { kind: 'refuse', reason: 'facts-not-ready' }
  if (input.n < 3) return { kind: 'refuse', reason: 'thin-set' }
  if (input.sqft == null && input.compsClose == null && input.listPrice == null) {
    return { kind: 'refuse', reason: 'no-gla' }
  }
  if (input.newConstruction) return { kind: 'refuse', reason: 'new-construction' }
  if (isBuilderPhase(input.subdivision)) return { kind: 'refuse', reason: 'builder-phase' }

  if (input.compsClose == null) return { kind: 'refuse', reason: 'no-gla' }

  const { rangeLow, rangeHigh } = rangeAround(input.compsClose)

  if (input.listPrice != null) {
    return {
      kind: 'listed-over-under',
      listPrice: input.listPrice,
      compsClose: input.compsClose,
      deltaPct: (input.compsClose - input.listPrice) / input.listPrice,
      n: input.n,
      rangeLow,
      rangeHigh,
    }
  }

  return {
    kind: 'unlisted-range',
    compsClose: input.compsClose,
    rangeLow,
    rangeHigh,
    n: input.n,
  }
}
