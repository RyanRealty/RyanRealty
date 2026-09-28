/**
 * Exclusive-pocket rows whose sale cluster is tighter than the minimum
 * width. The open pulls the closed-band low down, then a sitting active
 * pulls the recommendation toward that low. The earlier conservative tier
 * has to come with it. The recommendation and the closed band do not move.
 *
 * Streets and plats here are made up. The dollar shapes match two builds
 * that failed range-consistency after the active nudge.
 */
import { describe, expect, it } from 'vitest'
import { finishRecommendedAfterActives } from '@/lib/cma/finish-recommended'
import { nudgeRecommendedDownForHighDomActives } from '@/lib/pricing/active-dom-nudge'

const SITTING = [{ status: 'Active', listPrice: 700_000, daysOnMarket: 90 }]

function finish(args: {
  conservative: number
  recommended: number
  highEnd: number
  valueLow: number
  valueHigh: number
}) {
  const nudged = nudgeRecommendedDownForHighDomActives({
    recommended: args.recommended,
    bandLow: args.valueLow,
    bandHigh: args.valueHigh,
    actives: SITTING,
  })
  const finished = finishRecommendedAfterActives(
    { ...args, notes: [] },
    { actives: SITTING },
  )
  return { nudged, finished }
}

describe('minimum-width band and the active nudge stay ordered', () => {
  it('keeps the recommendation under a tight list tier inside the opened band', () => {
    // Opened low 537k, list tier still 554k-564k, nudge lands at 547k.
    const { nudged, finished } = finish({
      conservative: 554_000,
      recommended: 564_000,
      highEnd: 564_000,
      valueLow: 537_000,
      valueHigh: 566_000,
    })
    expect(nudged.recommended).toBe(547_000)
    expect(finished.recommended).toBe(547_000)
    expect(finished.valueLow).toBe(537_000)
    expect(finished.valueHigh).toBe(566_000)
    expect(finished.conservative).toBeLessThanOrEqual(finished.recommended)
    expect(finished.recommended).toBeLessThanOrEqual(finished.highEnd!)
    expect(finished.conservative).toBe(547_000)
    expect(finished.highEnd).toBe(564_000)
  })

  it('keeps a one-hundred-dollar sale cluster from sitting above the nudged list', () => {
    // Floor left conservative on the lowest adjusted sale. Minimum width
    // opened the closed low to 609k. The nudge follows that low.
    const { nudged, finished } = finish({
      conservative: 624_900,
      recommended: 625_000,
      highEnd: 625_000,
      valueLow: 609_000,
      valueHigh: 641_000,
    })
    expect(nudged.recommended).toBe(613_000)
    expect(finished.recommended).toBe(613_000)
    expect(finished.valueLow).toBe(609_000)
    expect(finished.valueHigh).toBe(641_000)
    expect(finished.conservative).toBe(613_000)
    expect(finished.highEnd).toBe(625_000)
    expect(finished.conservative).toBeLessThanOrEqual(finished.recommended)
    expect(finished.recommended).toBeLessThanOrEqual(finished.highEnd!)
  })
})
