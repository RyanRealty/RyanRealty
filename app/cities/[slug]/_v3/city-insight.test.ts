import { describe, expect, it } from 'vitest'
import {
  buildCityInsightBoard,
  cityInsightCount,
  cityInsightMoney,
  CITY_INSIGHT_MIN_MONTHS,
  CITY_INSIGHT_MONTHS,
} from './city-insight'

function month(i: number, median: number | null, sold: number | null) {
  const m = String((i % 12) + 1).padStart(2, '0')
  const y = 2025 + Math.floor(i / 12)
  return { periodStart: `${y}-${m}-01`, medianSalePrice: median, soldCount: sold }
}

const TWELVE = Array.from({ length: 12 }, (_, i) => month(i, 700_000 + i * 1_000, 80 + i))

describe('buildCityInsightBoard', () => {
  it('publishes the verdict prose it was handed and the months-of-supply door', () => {
    const board = buildCityInsightBoard({
      placeName: 'Bend',
      marketHref: '/housing-market/bend',
      verdictProse: "A seller's market.",
      months: TWELVE,
    })
    expect(board.supplyProse).toBe("A seller's market.")
    expect(board.supplyHref).toBe('/months-of-supply')
    expect(board.supplyHrefLabel).toMatch(/months of supply/i)
  })

  it('keeps only the newest CITY_INSIGHT_MONTHS, oldest first, because that is what the card draws', () => {
    const board = buildCityInsightBoard({
      placeName: 'Bend',
      marketHref: '/housing-market/bend',
      verdictProse: null,
      months: TWELVE,
    })
    expect(board.path).not.toBeNull()
    expect(board.path!.points).toHaveLength(CITY_INSIGHT_MONTHS)
    // The last row in, the last point out.
    expect(board.path!.points.at(-1)!.median).toBe(700_000 + 11 * 1_000)
    expect(board.path!.points.at(-1)!.sold).toBe(91)
    const medians = board.path!.points.map((p) => p.median)
    expect([...medians].sort((a, b) => a - b)).toEqual(medians)
  })

  it('drops a month that is missing EITHER metric — no zero fill (§0)', () => {
    const months = [...TWELVE, month(12, 812_000, null), month(13, null, 77)]
    const board = buildCityInsightBoard({
      placeName: 'Bend',
      marketHref: '/housing-market/bend',
      verdictProse: null,
      months,
    })
    const medians = board.path!.points.map((p) => p.median)
    expect(medians).not.toContain(812_000)
    expect(board.path!.points.every((p) => p.sold > 0 && p.median > 0)).toBe(true)
  })

  it('withholds the path rather than drawing a zigzag from too few months', () => {
    const board = buildCityInsightBoard({
      placeName: 'Bend',
      marketHref: '/housing-market/bend',
      verdictProse: null,
      months: TWELVE.slice(0, CITY_INSIGHT_MIN_MONTHS - 1),
    })
    expect(board.path).toBeNull()
  })

  it('publishes the range the line covers, so the drawing reads without a scrub', () => {
    const board = buildCityInsightBoard({
      placeName: 'Bend',
      marketHref: '/housing-market/bend',
      verdictProse: null,
      months: TWELVE,
    })
    const r = board.path!.range
    // TWELVE rises $1,000 a month from 700,000; the last eight are 704k..711k,
    // rounded to thousands by the same formatter the rest of the page uses.
    expect(r.medianLow).toBe('$704,000')
    expect(r.medianHigh).toBe('$711,000')
    expect(r.soldLow).toBe('84')
    expect(r.soldHigh).toBe('91')
  })

  it('names both metrics, the window and the in-progress rule in the trace', () => {
    const board = buildCityInsightBoard({
      placeName: 'Bend',
      marketHref: '/housing-market/bend',
      verdictProse: null,
      months: TWELVE,
    })
    const source = board.path!.source
    expect(source).toContain('Oregon Data Share')
    expect(source).toContain('Bend')
    expect(source).toMatch(/median sale price/i)
    expect(source).toMatch(/homes sold/i)
    expect(source).toMatch(/month in progress is not plotted/i)
    expect(board.path!.window).toBe(
      `${board.path!.points[0].label} - ${board.path!.points.at(-1)!.label}`,
    )
    expect(board.path!.href).toBe('/housing-market/bend')
  })

  it('formats a price the way the rest of the page formats prices, and a count as a count', () => {
    expect(cityInsightMoney(749_500)).toBe('$750,000')
    expect(cityInsightCount(1_046)).toBe('1,046')
  })
})
