import { describe, expect, it } from 'vitest'
import { compTierLadder } from '@/lib/cma/comp-tiers'
import {
  CANTER_GOLD_RECOMMEND,
  applyExclusivePocketDateAdj,
  applyExclusivePocketStoryAdj,
  canterRecommendNearGold,
  exclusivePocketPathNote,
  selectionIsExclusivePocket,
} from '@/lib/pricing/exclusive-pocket-date-adj'
import { pricingTierLadder } from '@/lib/pricing/ladder'
import { classifyRungName, type RungClass } from '@/lib/pricing/rung-class'
import type { MarketPath } from '@/lib/pricing/market-path'

/** The file's own definition, written out so a new prefix cannot hide inside the classifier. */
function expectedLadderClass(name: string): Exclude<RungClass, 'broker-selected' | 'unclassified'> {
  if (name.startsWith('own-street-') || name.startsWith('subdivision-') || name.startsWith('pocket-')) return 'exclusive'
  return 'widen'
}

const rising: MarketPath = {
  factor: 1.21,
  fromPpsf: 340,
  toPpsf: 411,
  monthlyRate: 0.032,
  months: 6,
  regime: 'rising',
  capped: false,
  source: 'index',
  referenceMonths: ['2026-06-01', '2026-07-01', '2026-08-01'],
  reversedWithinSpan: false,
}

const cooling: MarketPath = {
  factor: 0.94,
  fromPpsf: 360,
  toPpsf: 338,
  monthlyRate: -0.01,
  months: 6,
  regime: 'falling',
  capped: false,
  source: 'index',
  referenceMonths: ['2026-06-01', '2026-07-01', '2026-08-01'],
  reversedWithinSpan: false,
}

describe('selectionIsExclusivePocket', () => {
  it('is true for pocket / subdivision / own-street only', () => {
    expect(selectionIsExclusivePocket(['pocket-6mo', 'subdivision-12mo'])).toBe(true)
    expect(selectionIsExclusivePocket(['own-street-24mo', 'pocket-3mo'])).toBe(true)
  })

  it('is false once geography widens — do not twin picker exclusivity', () => {
    expect(selectionIsExclusivePocket(['pocket-6mo', 'nearby-2mi-9mo'])).toBe(false)
    expect(selectionIsExclusivePocket(['subdivision-12mo', 'city-5mi-18mo'])).toBe(false)
    expect(selectionIsExclusivePocket(['pocket-6mo', 'similar-sub-6mo'])).toBe(false)
    expect(selectionIsExclusivePocket(['pocket-6mo', 'widened-disclosed-24mo'])).toBe(false)
    expect(selectionIsExclusivePocket([])).toBe(false)
    expect(selectionIsExclusivePocket(['gla-bracket'])).toBe(false)
    // A size-bracket sale is outside the pocket. It must not leave the set exclusive.
    expect(selectionIsExclusivePocket(['subdivision-6mo', 'gla-bracket'])).toBe(false)
    expect(selectionIsExclusivePocket(['pocket-12mo', 'subdivision-3mo', 'gla-bracket'])).toBe(false)
    expect(selectionIsExclusivePocket(['subdivision-6mo', 'neighborhood-24mo', 'citywide-12mo'])).toBe(false)
    expect(selectionIsExclusivePocket(['subdivision-6mo', 'neighborhood-6mo'])).toBe(false)
    expect(selectionIsExclusivePocket(['subdivision-6mo', 'adjacent-subdivision-12mo'])).toBe(false)
    expect(selectionIsExclusivePocket(['pocket-6mo', 'community-12mo'])).toBe(false)
    expect(selectionIsExclusivePocket(['own-street-24mo', 'adjacent-sub-6mo'])).toBe(false)
    expect(selectionIsExclusivePocket(['broker-selected'])).toBe(false)
    expect(selectionIsExclusivePocket(['subdivision-12mo', 'broker-selected'])).toBe(true)
  })

  it('classifies every rung either ladder can emit', () => {
    const names = [
      ...pricingTierLadder().map((tier) => tier.name),
      ...pricingTierLadder({ customOrNew: true }).map((tier) => tier.name),
      ...compTierLadder('Cedar Plat').map((tier) => tier.name),
    ]
    expect(names.length).toBeGreaterThan(40)
    for (const name of names) {
      expect(classifyRungName(name), name).toBe(expectedLadderClass(name))
    }
    expect(classifyRungName('gla-bracket')).toBe('widen')
    expect(classifyRungName('broker-selected')).toBe('broker-selected')
    expect(classifyRungName('invented-rung-9mo')).toBe('unclassified')
    expect(selectionIsExclusivePocket(['subdivision-6mo', 'invented-rung-9mo'])).toBe(false)
  })
})

describe('applyExclusivePocketDateAdj', () => {
  it('leaves a city-widened path untouched', () => {
    expect(applyExclusivePocketDateAdj(rising, false)).toEqual(rising)
    expect(applyExclusivePocketDateAdj(cooling, false)).toEqual(cooling)
  })

  it('refuses upward city-index pump on an exclusive pocket', () => {
    const applied = applyExclusivePocketDateAdj(rising, true)
    expect(applied.factor).toBe(1)
    expect(applied.regime).toBe('flat')
    expect(applied.capped).toBe(true)
    expect(exclusivePocketPathNote('1025 E Horse Back', rising, applied)).toMatch(/exclusive pocket/)
    expect(exclusivePocketPathNote('1025 E Horse Back', rising, applied)).toMatch(/21\.0%/)
    expect(exclusivePocketPathNote('1025 E Horse Back', rising, applied)).toMatch(/pumped|size and story/)
  })

  it('contract: flex-style-cooling-date-adj-allowed-on-exclusive-pocket', () => {
    const applied = applyExclusivePocketDateAdj(cooling, true)
    expect(applied.factor).toBe(0.94)
    expect(applied.regime).toBe('falling')
    expect(exclusivePocketPathNote('1025 E Horse Back', cooling, applied)).toMatch(/Flex-style cooling/)
    expect(exclusivePocketPathNote('1025 E Horse Back', cooling, applied)).toMatch(/-6\.0%/)
  })
})

describe('applyExclusivePocketStoryAdj', () => {
  it('contract: story-adj-killed-entirely — always zero even when widened', () => {
    expect(applyExclusivePocketStoryAdj(94_500, false)).toBe(0)
    expect(applyExclusivePocketStoryAdj(-94_500, false)).toBe(0)
    expect(applyExclusivePocketStoryAdj(94_500, true)).toBe(0)
    expect(applyExclusivePocketStoryAdj(0, true)).toBe(0)
  })
})

describe('Canter gold re-anchor ~$680', () => {
  it('contract: canter-gold-near-680k — Flex $659 retired as refuse bar', () => {
    expect(CANTER_GOLD_RECOMMEND).toBe(680_000)
    expect(canterRecommendNearGold(680_000)).toBe(true)
    expect(canterRecommendNearGold(700_000)).toBe(true)
    expect(canterRecommendNearGold(640_000)).toBe(true) // 40k tolerance
    expect(canterRecommendNearGold(620_000)).toBe(false)
    expect(canterRecommendNearGold(800_000)).toBe(false)
  })
})
