/**
 * Remarkable shape (anonymized streets). The live row priced at $1,159,000
 * because the endpoint rule used raw weights and a gla-bracket sale was
 * treated as an exclusive pocket, which zeroed the size adjustment.
 *
 * Both fixes together: capped weights on the ends, size adjustment on,
 * then the same active nudge. Expected about $1,368,000.
 */
import { describe, expect, it } from 'vitest'
import { adjustCmaCompAlongMarket, listPriceFromEngine } from '@/lib/pricing/estimate'
import { selectionIsExclusivePocket } from '@/lib/pricing/exclusive-pocket-date-adj'
import { finishRecommendedAfterActives } from '@/lib/cma/finish-recommended'
import { pocketClosedSupportPrice } from '@/lib/pricing/active-dom-nudge'
import type { CmaComp, CmaSubject } from '@/lib/cma/types'

const SUBJECT_SQFT = 3_500
const LAST_ASK = 1_845_000

const ROWS = [
  { id: 'colonial-a', sub: 'Awbrey Village', sold: 1_195_000, sqft: 2_755, timeAdj: 0, weight: 0.2442, tier: 'subdivision-3mo' },
  { id: 'colonial-b', sub: 'Awbrey Village', sold: 1_172_000, sqft: 3_012, timeAdj: -50_748, weight: 0.3222, tier: 'subdivision-6mo' },
  { id: 'colonial-c', sub: 'Awbrey Village', sold: 1_165_000, sqft: 3_269, timeAdj: -4_310, weight: 0.0392, tier: 'subdivision-12mo' },
  { id: 'bungalow', sub: 'Awbrey Village', sold: 1_150_000, sqft: 3_416, timeAdj: -4_255, weight: 0.033, tier: 'pocket-12mo' },
  { id: 'bracket', sub: 'Awbrey Butte', sold: 1_500_000, sqft: 3_525, timeAdj: -89_400, weight: 0.0234, tier: 'gla-bracket' },
]

function timeAdjusted(row: (typeof ROWS)[number]): number {
  return row.sold + row.timeAdj
}

function withSize(row: (typeof ROWS)[number]) {
  const time = timeAdjusted(row)
  const ppsf = time / row.sqft
  const size = Math.round((SUBJECT_SQFT - row.sqft) * ppsf * 0.5)
  return {
    ppsfTimeAdjusted: ppsf,
    adjustedPrice: time + size,
    weight: row.weight,
    subdivision: row.sub,
    selectionTier: row.tier,
  }
}

const ACTIVES = [
  { status: 'Active', listPrice: 1_295_000, daysOnMarket: 71 },
  { status: 'Active', listPrice: 1_199_900, daysOnMarket: 123 },
]

describe('Remarkable shape before and after the two fixes', () => {
  it('a gla-bracket tier is not an exclusive pocket, so size adjustment applies', () => {
    const tiers = ['own-street-24mo', 'subdivision-3mo', 'subdivision-6mo', 'pocket-12mo', 'gla-bracket']
    expect(selectionIsExclusivePocket(tiers)).toBe(false)
    expect(selectionIsExclusivePocket(tiers.filter((t) => t !== 'gla-bracket'))).toBe(true)

    const subject = { sqft: SUBJECT_SQFT, latitude: null, longitude: null } as CmaSubject
    const comp = {
      address: '10 Bracket Ln',
      city: 'Bend',
      sqft: 3_000,
      closePrice: 1_000_000,
      closeDate: '2026-01-01',
      latitude: null,
      longitude: null,
    } as CmaComp
    const off = adjustCmaCompAlongMarket({
      subject,
      subjectStory: 'unknown',
      comp,
      saleStory: 'unknown',
      points: [],
      asOf: '2026-09-27',
      exclusivePocket: false,
    })
    const on = adjustCmaCompAlongMarket({
      subject,
      subjectStory: 'unknown',
      comp,
      saleStory: 'unknown',
      points: [],
      asOf: '2026-09-27',
      exclusivePocket: true,
    })
    expect(on.adjusted.sizeAdjustment).toBe(0)
    expect(off.adjusted.sizeAdjustment).not.toBe(0)
    expect(off.adjusted.adjustedPrice).toBe(off.adjusted.timeAdjustedPrice + off.adjusted.sizeAdjustment)
  })

  it('priced the stored shape at about $1,159,000 before and about $1,368,000 after', () => {
    const unsized = ROWS.map((row) => {
      const time = timeAdjusted(row)
      return {
        ppsfTimeAdjusted: time / row.sqft,
        adjustedPrice: time,
        weight: row.weight,
        subdivision: row.sub,
        selectionTier: row.tier,
      }
    })
    // Before: raw share under 5% dropped the bracket sale, size stayed 0,
    // and the list sat on the band top then took the 3% active drop.
    const rawTotal = ROWS.reduce((s, r) => s + r.weight, 0)
    const rawKept = unsized.filter((r) => r.weight / rawTotal + 1e-12 >= 0.05)
    const rawPrices = rawKept.map((r) => r.adjustedPrice).sort((a, b) => a - b)
    const beforeLow = Math.floor(rawPrices[0]! / 5000) * 5000
    const beforeHigh = Math.ceil(rawPrices[rawPrices.length - 1]! / 5000) * 5000
    const beforeRec = Math.round((beforeHigh * 0.97) / 1000) * 1000
    expect(rawKept.map((r) => r.selectionTier)).not.toContain('gla-bracket')
    expect(beforeLow).toBe(1_120_000)
    expect(beforeHigh).toBe(1_195_000)
    expect(beforeRec).toBe(1_159_000)

    const sized = ROWS.map(withSize)
    const engine = listPriceFromEngine({
      subjectSqft: SUBJECT_SQFT,
      lastAsk: LAST_ASK,
      adjusted: sized,
      saleToAskRatios: [],
      qualitySet: true,
    })
    const low = engine.rangeRule!.adjustedLow
    const high = engine.rangeRule!.adjustedHigh
    const clamped = Math.min(Math.max(engine.recommendedList!, low), high)
    const finished = finishRecommendedAfterActives(
      { recommended: clamped, valueLow: low, valueHigh: high, notes: [] },
      {
        actives: ACTIVES,
        pocketClosedSupport: pocketClosedSupportPrice(sized, 'Awbrey Village'),
      },
    )
    expect(engine.rangeRule?.kept).toBe(5)
    expect(low).toBe(1_155_000)
    expect(high).toBe(1_410_000)
    expect(finished.recommended).toBe(1_368_000)
    expect(finished.recommended).toBeGreaterThan(beforeRec)
  })
})
