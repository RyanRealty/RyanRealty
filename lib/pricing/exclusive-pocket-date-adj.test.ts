import { describe, expect, it } from 'vitest'
import {
  applyExclusivePocketDateAdj,
  applyExclusivePocketStoryAdj,
  exclusivePocketPathNote,
  selectionIsExclusivePocket,
} from '@/lib/pricing/exclusive-pocket-date-adj'
import type { MarketPath } from '@/lib/pricing/market-path'

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
