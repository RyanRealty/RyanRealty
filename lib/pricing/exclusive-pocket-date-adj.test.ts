import { describe, expect, it } from 'vitest'
import {
  applyExclusivePocketDateAdj,
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
  })

  it('zeros the city-index factor on an exclusive pocket', () => {
    const applied = applyExclusivePocketDateAdj(rising, true)
    expect(applied.factor).toBe(1)
    expect(applied.regime).toBe('flat')
    expect(applied.capped).toBe(true)
    expect(exclusivePocketPathNote('1025 E Horse Back', rising)).toMatch(/exclusive pocket/)
    expect(exclusivePocketPathNote('1025 E Horse Back', rising)).toMatch(/21\.0%/)
  })
})
