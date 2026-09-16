import { describe, expect, it } from 'vitest'
import {
  buildZipInsightBoard,
  zipInsightDelta,
  zipInsightHasPages,
  zipInsightMoney,
} from './zip-insight'

function months(count: number, start = '2024-01-01'): Array<{
  periodStart: string
  medianSalePrice: number | null
  soldCount: number | null
}> {
  const [year, month] = start.split('-').map(Number)
  const out = []
  for (let i = 0; i < count; i += 1) {
    const d = new Date(Date.UTC(year!, month! - 1 + i, 1))
    out.push({
      periodStart: d.toISOString().slice(0, 10),
      medianSalePrice: 500_000 + i * 1_000,
      soldCount: 10 + (i % 5),
    })
  }
  return out
}

describe('buildZipInsightBoard', () => {
  it('builds compare + pace from 24 priced months and names a city fallback', () => {
    const board = buildZipInsightBoard({
      zip: '97702',
      cityName: 'Bend',
      cityFallback: true,
      months: months(24),
      bedrooms: [
        { key: '3', share: 0.42, floor: false },
        { key: '4', share: 0.31, floor: false },
        { key: '2', share: 0.18, floor: false },
      ],
      financing: [],
    })
    expect(board.compare).not.toBeNull()
    expect(board.pace).not.toBeNull()
    expect(board.mix?.kind).toBe('bedrooms')
    expect(board.mix?.segments.length).toBeGreaterThanOrEqual(2)
    expect(board.compare?.source).toMatch(/Bend/)
    expect(board.compare?.source).toMatch(/97702/)
    expect(zipInsightHasPages(board)).toBe(true)
  })

  it('omits compare when the series is shorter than two years', () => {
    const board = buildZipInsightBoard({
      zip: '97702',
      cityName: 'Bend',
      cityFallback: false,
      months: months(8),
      bedrooms: [],
      financing: [
        { key: 'conventional', share: 0.6, floor: false },
        { key: 'cash', share: 0.25, floor: false },
      ],
    })
    expect(board.compare).toBeNull()
    expect(board.pace).not.toBeNull()
    expect(board.mix?.kind).toBe('financing')
    expect(board.pace?.source).toMatch(/ZIP 97702/)
    expect(zipInsightHasPages(board)).toBe(true)
  })

  it('returns no pages when leftover months and mix are empty', () => {
    const board = buildZipInsightBoard({
      zip: '97702',
      cityName: 'Bend',
      cityFallback: false,
      months: [],
      bedrooms: [],
      financing: [],
    })
    expect(zipInsightHasPages(board)).toBe(false)
  })
})

describe('zip insight faces', () => {
  it('prints compact money and a signed delta', () => {
    expect(zipInsightMoney(725_000)).toBe('$725K')
    expect(zipInsightDelta(800_000, 400_000)).toBe('+100.0%')
    expect(zipInsightDelta(400_000, 800_000)).toMatch(/50\.0%/)
  })
})
