/**
 * Rule 16's under-the-ask test reads the weighted price of the sales that
 * set the price, not the list tier (Matt 2026-10-08, delegated).
 *
 * 3037 Purcell: the setting sales blend to $561,188, under the $565,000 ask.
 * The list tier was $576,000 (weighted close / city sale-to-ask, clamped to
 * the widened band top), so the pull took 1.65% off the ask and printed
 * $555,000. The weighted price was already under the ask. Leave it, at the
 * thousand the letter calls "near $X": $561,000.
 *
 * 62475 Woodsman: the setting sales blend to $1,577,841, under the
 * $1,600,000 ask. The list tier entered at $1,620,000 and the pull printed
 * $1,576,000. The cover is $1,578,000.
 *
 * When the weighted price is at or above the ask, the pull is unchanged.
 */
import { describe, expect, it } from 'vitest'
import { applyFailedAskCap } from '@/lib/cma/expired-audit'
import { priceUnderFailedAsk } from '@/lib/pricing/failed-ask-under'

const AS_OF = new Date('2026-10-08T19:00:00Z')

function pricing(over: {
  conservative: number
  recommended: number
  highEnd: number
  valueLow: number
  valueHigh: number
  weightedPrice: number | null
  saleLow?: number
}): Parameters<typeof applyFailedAskCap>[0] {
  return {
    conservative: over.conservative,
    recommended: over.recommended,
    highEnd: over.highEnd,
    valueLow: over.valueLow,
    valueHigh: over.valueHigh,
    needsReview: false,
    reviewReason: null,
    notes: [],
    reconciliation: { weightedPrice: over.weightedPrice },
    rangeRule: over.saleLow != null ? { saleLow: over.saleLow } : null,
  }
}

describe('rule 16: a weighted price already under the ask is the recommendation', () => {
  it('3037 Purcell: $561,188 under a $565,000 ask stays $561,000, and the $576,000 list tier is not used', () => {
    const ask = 565_000
    const x = pricing({
      // List tier: 561188 / 0.9571, clamped to the widened band top.
      conservative: 572_000,
      recommended: 576_000,
      highEnd: 576_000,
      // Widened band the cap sees, before the pin back onto the sales.
      valueLow: 547_000,
      valueHigh: 576_000,
      saleLow: 550_951,
      weightedPrice: 561_188,
    })
    const pulled = priceUnderFailedAsk(ask, { daysOnMarket: 39, originalListPrice: ask })
    expect(pulled).toBe(555_000)

    const r = applyFailedAskCap(x, {
      lastFailedListPrice: ask,
      offMarketDate: '2026-10-06',
      asOf: AS_OF,
      daysOnMarket: 39,
      originalListPrice: ask,
    })

    expect(r.applied).toBe(false)
    expect(x.recommended).toBe(561_000)
    expect(x.recommended).not.toBe(pulled)
    expect(x.clamp).toBeNull()
    expect(x.needsReview).toBe(false)
    // The list floor must not sit above the weighted price. The actives pull
    // stops on this tier, so it falls to the closed-sale low.
    expect(x.conservative).toBe(550_951)
    expect(x.highEnd).toBe(561_000)
    expect(x.highEnd).toBeLessThan(ask)
  })

  it('62475 Woodsman: $1,577,841 under a $1,600,000 ask stays $1,578,000, and the $1,620,000 list tier is not used', () => {
    const ask = 1_600_000
    const x = pricing({
      conservative: 1_620_000,
      recommended: 1_620_000,
      highEnd: 1_620_000,
      valueLow: 1_504_281,
      valueHigh: 1_618_053,
      weightedPrice: 1_577_841,
    })
    const pulled = priceUnderFailedAsk(ask, { daysOnMarket: 208, originalListPrice: 1_695_000 })
    expect(pulled).toBe(1_576_000)

    const r = applyFailedAskCap(x, {
      lastFailedListPrice: ask,
      offMarketDate: '2026-09-30',
      asOf: AS_OF,
      daysOnMarket: 208,
      originalListPrice: 1_695_000,
    })

    expect(r.applied).toBe(false)
    expect(x.recommended).toBe(1_578_000)
    expect(x.recommended).not.toBe(pulled)
    expect(x.clamp).toBeNull()
    expect(x.conservative).toBe(1_504_281)
    expect(x.highEnd).toBe(1_578_000)
    expect(x.highEnd).toBeLessThan(ask)
  })

  it('a weighted price at the ask still takes the pull', () => {
    const ask = 565_000
    const x = pricing({
      conservative: 572_000,
      recommended: 576_000,
      highEnd: 576_000,
      valueLow: 550_951,
      valueHigh: 570_165,
      weightedPrice: ask,
    })
    const r = applyFailedAskCap(x, {
      lastFailedListPrice: ask,
      offMarketDate: '2026-10-06',
      asOf: AS_OF,
      daysOnMarket: 39,
      originalListPrice: ask,
    })
    expect(r.applied).toBe(true)
    expect(x.recommended).toBe(priceUnderFailedAsk(ask, { daysOnMarket: 39, originalListPrice: ask }))
    expect(x.recommended).toBe(555_000)
    expect(x.recommended).toBeLessThan(ask)
  })

  it('a weighted price above the ask still takes the pull', () => {
    const ask = 565_000
    const x = pricing({
      conservative: 590_000,
      recommended: 610_000,
      highEnd: 620_000,
      valueLow: 540_000,
      valueHigh: 630_000,
      weightedPrice: 600_000,
    })
    const r = applyFailedAskCap(x, {
      lastFailedListPrice: ask,
      offMarketDate: '2026-10-06',
      asOf: AS_OF,
      daysOnMarket: 39,
      originalListPrice: ask,
    })
    expect(r.applied).toBe(true)
    expect(x.recommended).toBe(555_000)
    expect(x.recommended).toBeLessThan(ask)
  })

  it('a weighted price whose nearest thousand is the ask still takes the pull', () => {
    const ask = 565_000
    // 564,500 rounds to 565,000, which is the ask. That is not under the ask.
    const x = pricing({
      conservative: 570_000,
      recommended: 580_000,
      highEnd: 590_000,
      valueLow: 540_000,
      valueHigh: 600_000,
      weightedPrice: 564_500,
    })
    const r = applyFailedAskCap(x, {
      lastFailedListPrice: ask,
      offMarketDate: '2026-10-06',
      asOf: AS_OF,
    })
    expect(Math.round(564_500 / 1000) * 1000).toBe(ask)
    expect(r.applied).toBe(true)
    expect(x.recommended).toBe(priceUnderFailedAsk(ask))
    expect(x.recommended).toBe(564_000)
    expect(x.recommended).toBeLessThan(ask)
  })

  it('a recommendation already under the weighted thousand is not raised, and is not pulled again', () => {
    const ask = 565_000
    const x = pricing({
      conservative: 530_000,
      recommended: 540_000,
      highEnd: 550_000,
      valueLow: 520_000,
      valueHigh: 570_000,
      weightedPrice: 561_188,
    })
    const r = applyFailedAskCap(x, {
      lastFailedListPrice: ask,
      offMarketDate: '2026-10-06',
      asOf: AS_OF,
      daysOnMarket: 39,
      originalListPrice: ask,
    })
    expect(r.applied).toBe(false)
    expect(x.recommended).toBe(540_000)
    expect(x.clamp).toBeNull()
  })
})
