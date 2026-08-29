import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { MarketStats } from '@/lib/data'
import { platStatsFigures, subdivisionSalesChart } from './subdivision-figures'

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
  it('captions the series as closed single-family sales for this neighborhood', () => {
    const chart = subdivisionSalesChart('Kitty Hawk', [
      { year: 2024, closedCount: 3, medianClosePrice: 317_000 },
      { year: 2023, closedCount: 2, medianClosePrice: 287_500 },
    ])
    expect(chart?.caption).toBe('Closed single-family sales, Kitty Hawk.')
    expect(chart?.caption).not.toMatch(/\bplat\b/i)
    expect(chart?.series?.[0]?.name).toBe('Closed counts')
    expect(JSON.stringify(chart)).not.toContain('$')
    expect(JSON.stringify(chart)).not.toMatch(/months of supply/i)
  })
})
