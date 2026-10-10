/**
 * Two anonymized shapes that were labeled an exclusive pocket because a
 * wider rung was not recognized. Same comps, weights, and caps. Size
 * adjustment comes back when the rung is recognized. Story adjustment
 * stays at zero. The city index is not in the stored rows, so the time
 * move is the one already on each sale.
 */
import { describe, expect, it } from 'vitest'
import { applyFailedAskCap } from '@/lib/cma/expired-audit'
import { finishRecommendedAfterActives } from '@/lib/cma/finish-recommended'
import { pocketClosedSupportPrice } from '@/lib/pricing/active-dom-nudge'
import { listPriceFromEngine, roundPriceDown, roundPriceUp } from '@/lib/pricing/estimate'
import { selectionIsExclusivePocket } from '@/lib/pricing/exclusive-pocket-date-adj'

const RECENT_OFF = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString()

type Row = {
  sold: number
  sqft: number
  timeAdj: number
  weight: number
  tier: string
  sub: string
}

function adjusted(rows: readonly Row[], subjectSqft: number, exclusive: boolean) {
  return rows.map((row) => {
    const time = row.sold + row.timeAdj
    const ppsf = time / row.sqft
    const size = exclusive ? 0 : Math.round((subjectSqft - row.sqft) * ppsf * 0.5)
    return {
      ppsfTimeAdjusted: ppsf,
      adjustedPrice: time + size,
      weight: row.weight,
      subdivision: row.sub,
      selectionTier: row.tier,
    }
  })
}

function price(args: {
  rows: readonly Row[]
  subjectSqft: number
  tiers: readonly string[]
  lastAsk: number | null
  failedAsk: number | null
  actives: readonly { status: string; listPrice: number; daysOnMarket: number }[]
  subjectSub: string
}) {
  const exclusive = selectionIsExclusivePocket(args.tiers)
  const sales = adjusted(args.rows, args.subjectSqft, exclusive)
  const engine = listPriceFromEngine({
    subjectSqft: args.subjectSqft,
    lastAsk: null,
    adjusted: sales,
    saleToAskRatios: [],
    asOfSaleToOriginal: 0.9667,
    qualitySet: false,
  })
  const low = engine.rangeRule!.adjustedLow
  const high = engine.rangeRule!.adjustedHigh
  const highEnd = Math.min(engine.highEndList ?? high, high)
  const conservative = Math.min(engine.conservativeList ?? low, highEnd)
  const recommended = Math.min(Math.max(engine.recommendedList ?? conservative, conservative), highEnd)
  const pricing = {
    conservative,
    recommended,
    highEnd,
    valueLow: roundPriceDown(low),
    valueHigh: roundPriceUp(high),
    needsReview: false,
    reviewReason: null as string | null,
    notes: [] as string[],
    clamp: null,
  }
  if (args.failedAsk != null) {
    applyFailedAskCap(pricing, { lastFailedListPrice: args.failedAsk, offMarketDate: RECENT_OFF })
  }
  const finished = finishRecommendedAfterActives(pricing, {
    actives: args.actives,
    pocketClosedSupport: pocketClosedSupportPrice(sales, args.subjectSub),
  })
  return { exclusive, engine, finished, sales }
}

describe('wider rungs are not an exclusive pocket', () => {
  it('prices a five-sale ranch shape with a citywide rung and a neighborhood rung (five price-setting sales, Matt 2026-10-07)', () => {
    const tiers = ['subdivision-6mo', 'subdivision-24mo', 'neighborhood-24mo', 'citywide-12mo']
    expect(selectionIsExclusivePocket(tiers)).toBe(false)
    // The stored four-sale shape plus one more Cedar Ranch sale: under five
    // the set is a comp shortage and nothing prices.
    const rows: Row[] = [
      { sold: 1_375_000, sqft: 2_914, timeAdj: 0, weight: 0.8569, tier: 'subdivision-6mo', sub: 'Cedar Ranch' },
      { sold: 1_460_000, sqft: 3_149, timeAdj: -63_218, weight: 0.4112, tier: 'citywide-12mo', sub: 'Other Knoll' },
      { sold: 1_000_000, sqft: 3_072, timeAdj: -15_600, weight: 0.0535, tier: 'subdivision-24mo', sub: 'Cedar Ranch' },
      { sold: 1_000_000, sqft: 2_430, timeAdj: 0, weight: 0.0175, tier: 'neighborhood-24mo', sub: 'Cedar Ranch' },
      { sold: 1_300_000, sqft: 3_000, timeAdj: 0, weight: 0.3, tier: 'subdivision-24mo', sub: 'Cedar Ranch' },
    ]
    const out = price({
      rows,
      subjectSqft: 3_391,
      tiers,
      lastAsk: 1_495_000,
      failedAsk: 1_495_000,
      actives: [{ status: 'Active', listPrice: 1_399_000, daysOnMarket: 72 }],
      subjectSub: 'Cedar Ranch',
    })
    expect(out.exclusive).toBe(false)
    // All five adjusted prices set the range, $1,035,511 to $1,487,539.
    // No city index in the stored row, so the small upward date move on
    // the oldest same-plat sale is not applied.
    expect(out.sales.map((sale) => sale.adjustedPrice)).toEqual([1_487_539, 1_450_453, 1_035_511, 1_197_737, 1_384_717])
    expect(out.engine.rangeRule?.rule).toBe('min-max')
    expect(out.engine.rangeRule?.kept).toBe(5)
    expect(out.finished.recommended).toBe(1_413_000)
    expect(out.finished.valueLow).toBe(1_035_000)
    expect(out.finished.valueHigh).toBe(1_490_000)
    expect(out.finished.conservative).toBeLessThanOrEqual(out.finished.recommended)
    expect(out.finished.recommended).toBeLessThanOrEqual(out.finished.highEnd)
  })

  it('prices three own-plat sales plus two neighborhood sales from another plat', () => {
    const tiers = ['subdivision-6mo', 'neighborhood-6mo']
    expect(selectionIsExclusivePocket(tiers)).toBe(false)
    const rows: Row[] = [
      { sold: 670_000, sqft: 2_386, timeAdj: 0, weight: 0.3165, tier: 'subdivision-6mo', sub: 'Copper Flat' },
      { sold: 700_000, sqft: 1_946, timeAdj: 0, weight: 0.5136, tier: 'neighborhood-6mo', sub: 'Point Villas' },
      { sold: 699_000, sqft: 2_275, timeAdj: 0, weight: 0.5617, tier: 'subdivision-6mo', sub: 'Copper Flat' },
      { sold: 732_000, sqft: 2_018, timeAdj: -31_696, weight: 0.3899, tier: 'subdivision-6mo', sub: 'Copper Flat' },
      { sold: 700_000, sqft: 1_883, timeAdj: -30_310, weight: 0.3038, tier: 'neighborhood-6mo', sub: 'Point Villas' },
    ]
    const misread = price({
      rows,
      subjectSqft: 2_275,
      tiers: ['subdivision-6mo'],
      lastAsk: 698_000,
      failedAsk: 698_000,
      actives: [
        { status: 'Active', listPrice: 737_800, daysOnMarket: 81 },
        { status: 'Active', listPrice: 659_000, daysOnMarket: 66 },
      ],
      subjectSub: 'Copper Flat',
    })
    expect(misread.exclusive).toBe(true)
    const out = price({
      rows,
      subjectSqft: 2_275,
      tiers,
      lastAsk: 698_000,
      failedAsk: 698_000,
      actives: [
        { status: 'Active', listPrice: 737_800, daysOnMarket: 81 },
        { status: 'Active', listPrice: 659_000, daysOnMarket: 66 },
      ],
      subjectSub: 'Copper Flat',
    })
    expect(out.exclusive).toBe(false)
    expect(out.sales.map((sale) => sale.adjustedPrice)).toEqual([654_415, 759_173, 699_000, 744_897, 739_398])
    // All five set the range, $654,415 to $759,173. The $698,000 ask sits
    // inside that spread. The list finishes at $677,000, under the ask.
    expect(out.engine.rangeRule?.rule).toBe('min-max')
    expect(out.engine.rangeRule?.kept).toBe(5)
    expect(out.finished.valueLow).toBe(654_000)
    expect(out.finished.valueHigh).toBe(760_000)
    expect(out.finished.recommended).toBe(677_000)
    expect(out.finished.conservative).toBeLessThanOrEqual(out.finished.recommended)
    expect(out.finished.recommended).toBeLessThanOrEqual(out.finished.highEnd)
    // The exclusive misread keeps the same five sales too. Its list moves
    // because those ends now count.
    expect(misread.finished.recommended).toBe(692_000)
  })
})
