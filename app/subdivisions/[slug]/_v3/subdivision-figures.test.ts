import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { MarketStats } from '@/lib/data'
import { platClosedYearChart, platStatsFigures, subdivisionSalesChart } from './subdivision-figures'

const SRC = resolve('app/subdivisions/[slug]/_v3/subdivision-figures.ts')

function stats(over: Partial<MarketStats> = {}): MarketStats {
  return {
    geoType: 'subdivision',
    geoSlug: 'ridge-at-eagle-crest',
    periodType: 'ytd',
    periodStart: '2026-01-01T00:00:00.000Z',
    periodEnd: '2026-08-23T00:00:00.000Z',
    medianSalePrice: 909_950,
    medianListPrice: null,
    medianDaysOnMarket: 26,
    monthsOfSupply: 4.4,
    mosVerdict: 'balanced',
    saleToListRatio: 0.99,
    soldCount: 9,
    activeCount: 3,
    yoyChangePct: 8.1,
    refreshedAt: '2026-08-23T00:00:00.000Z',
    methodologyVersion: 'v3',
    ...over,
  }
}

describe('platStatsFigures', () => {
  it('withholds closed-sale prices and omits cache soldCount', () => {
    const figures = platStatsFigures(stats())
    expect(figures.map((f) => f.label)).toEqual(['median days on market'])
    expect(figures.map((f) => f.value).join(' ')).not.toContain('$')
    expect(platStatsFigures(stats({ soldCount: 0, medianDaysOnMarket: null }))).toEqual([])
  })

  it('still gates closed-sale prices through publishSubdivisionClosedPrice', () => {
    const src = readFileSync(SRC, 'utf8')
    expect(src).toMatch(/publishSubdivisionClosedPrice/)
    expect(src).not.toMatch(/median sale price/)
    expect(src).not.toMatch(/stats\.soldCount/)
  })
})

describe('subdivisionSalesChart', () => {
  it('captions the series as MLS plat-name closed counts', () => {
    const chart = subdivisionSalesChart('Kitty Hawk', [
      { year: 2024, closedCount: 3, medianClosePrice: 317_000 },
      { year: 2023, closedCount: 2, medianClosePrice: 287_500 },
    ])
    expect(chart?.caption).toContain('MLS plat name')
    expect(chart?.caption).not.toMatch(/recorded[\s-]plat/i)
    expect(chart?.series?.[0]?.name).toBe('Closed counts')
    expect(JSON.stringify(chart)).not.toContain('$')
    expect(JSON.stringify(chart)).not.toMatch(/months of supply/i)
  })
})

/**
 * SITE-24. The series a sub-plat of a resort can have. subdivisionSalesChart
 * above is an MLS SubdivisionName join and is EMPTY for these plats — every
 * home inside Golf Homes At Tetherow is filed under "Tetherow" — so the market
 * band printed "Too few recent sales here to chart." over a plat holding 107
 * closed sales inside its own recorded boundary. Live map, 2026-09-09:
 * {"2012":2,"2013":4,"2014":13,"2015":19,"2016":16,"2017":8,"2018":7,"2019":7,
 *  "2020":5,"2021":5,"2022":3,"2023":5,"2024":2,"2025":7,"2026":4} = 107.
 */
describe('platClosedYearChart', () => {
  const tetherow = {
    2012: 2, 2013: 4, 2014: 13, 2015: 19, 2016: 16, 2017: 8, 2018: 7, 2019: 7,
    2020: 5, 2021: 5, 2022: 3, 2023: 5, 2024: 2, 2025: 7, 2026: 4,
  }

  it('draws the plat boundary series in year order, one point per year', () => {
    const chart = platClosedYearChart('Golf Homes at Tetherow', tetherow)
    expect(chart).toBeDefined()
    const points = chart!.series![0]!.points
    expect(points).toHaveLength(15)
    expect(points.map((p) => p.at)).toEqual([...Array(15)].map((_, i) => 2012 + i))
    expect(points.map((p) => p.value).reduce((a, b) => a + b, 0)).toBe(107)
  })

  it('names the boundary in the caption, so it is not read as the name-joined series', () => {
    const chart = platClosedYearChart('Golf Homes at Tetherow', tetherow)!
    expect(String(chart.caption)).toContain('inside the recorded Golf Homes at Tetherow plat')
    // The count is every property type, and the caption says so rather than
    // letting the reader carry over the sibling chart's single-family scope.
    expect(String(chart.caption)).toContain('every property type')
  })

  it('labels the running year "to date" and never compares it to a full one', () => {
    const thisYear = new Date().getFullYear()
    const chart = platClosedYearChart('A Plat', { [thisYear - 1]: 9, [thisYear]: 4 })!
    const last = chart.series![0]!.points.at(-1)!
    expect(String(last.label)).toBe('4 to date')
    if (chart.claim) expect(String(chart.claim)).not.toMatch(/year over year/i)
  })

  it('is undefined below two years — a single year is not a line', () => {
    expect(platClosedYearChart('A Plat', { 2024: 40 })).toBeUndefined()
    expect(platClosedYearChart('A Plat', {})).toBeUndefined()
    expect(platClosedYearChart('A Plat', null)).toBeUndefined()
  })

  it('drops a zero year rather than plotting a gap as a real observation', () => {
    const chart = platClosedYearChart('A Plat', { 2020: 3, 2021: 0, 2022: 5 })!
    expect(chart.series![0]!.points.map((p) => p.at)).toEqual([2020, 2022])
  })
})
