import { describe, expect, it } from 'vitest'
import { v3Text } from '@/components/site/v3'
import {
  PLACE_CHART_MIN_CLOSES,
  TOO_FEW_SALES_LINE,
  cityVerdictCaption,
  leftoverClosedCount,
  placeClosesHold,
  placeCostChart,
  platRecentClosedCount,
  tooFewSalesItems,
  withoutMosTile,
} from './place-graphics'

describe('placeClosesHold', () => {
  it('needs six closes for a typical', () => {
    expect(PLACE_CHART_MIN_CLOSES).toBe(6)
    expect(placeClosesHold(6)).toBe(true)
    expect(placeClosesHold(5)).toBe(false)
    expect(placeClosesHold(null)).toBe(false)
    expect(placeClosesHold(undefined)).toBe(false)
  })
})

describe('leftoverClosedCount', () => {
  it('prefers leftover 12-month sold, else sums monthly sold counts', () => {
    expect(leftoverClosedCount({ sold12mo: 22 })).toBe(22)
    expect(
      leftoverClosedCount({ sold12mo: null }, [
        { soldCount: 2 },
        { soldCount: 3 },
        { soldCount: null },
      ]),
    ).toBe(5)
    expect(leftoverClosedCount({ sold12mo: null }, [{ soldCount: null }])).toBeNull()
  })
})

describe('platRecentClosedCount', () => {
  it('uses the last complete year, not a partial current year', () => {
    expect(
      platRecentClosedCount(
        [
          { year: 2026, closedCount: 1 },
          { year: 2025, closedCount: 9 },
          { year: 2024, closedCount: 4 },
        ],
        new Date('2026-09-06T12:00:00Z'),
      ),
    ).toBe(9)
    expect(
      platRecentClosedCount([{ year: 2026, closedCount: 3 }], new Date('2026-09-06T12:00:00Z')),
    ).toBe(3)
    expect(platRecentClosedCount([])).toBeNull()
  })
})

describe('placeCostChart', () => {
  it('omits the drawing when n is thin', () => {
    const chart = { caption: v3Text('Typical price'), series: [] }
    expect(placeCostChart(22, chart)).toBe(chart)
    expect(placeCostChart(4, chart)).toBeUndefined()
    expect(placeCostChart(22, undefined)).toBeUndefined()
  })
})

describe('cityVerdictCaption', () => {
  it('states months of homes on the market, then the verdict', () => {
    expect(
      cityVerdictCaption({ mos: 3.9, verdict: { kind: 'sellers', label: "seller's market" } }),
    ).toBe("3.9 months of homes on the market. A seller's market.")
    expect(cityVerdictCaption({ mos: 3.9, verdict: { kind: 'unknown', label: 'unknown' } })).toBeNull()
    expect(cityVerdictCaption({ mos: null, verdict: { kind: 'sellers', label: "seller's market" } })).toBeNull()
  })
})

describe('withoutMosTile', () => {
  it('drops the months-of-supply tile and keeps cost/pace figures', () => {
    const figures = [
      { value: v3Text('$950,000'), label: v3Text('median list price') },
      { value: v3Text('3.9'), label: v3Text('months of supply') },
      { value: v3Text('23'), label: v3Text('days to an offer, last 90 days') },
    ]
    expect(withoutMosTile(figures).map((figure) => String(figure.label))).toEqual([
      'median list price',
      'days to an offer, last 90 days',
    ])
  })
})

describe('tooFewSalesItems', () => {
  it('uses the locked Quiet line', () => {
    expect(tooFewSalesItems()).toEqual([{ kind: 'prose', body: TOO_FEW_SALES_LINE }])
  })
})
