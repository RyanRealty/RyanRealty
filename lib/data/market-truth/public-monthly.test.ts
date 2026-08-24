import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GetMetricInput, MetricResult } from '@/lib/data/market-truth/getMetric'
import {
  completeMonthKeys,
  leftoverOrCacheMonthly,
  leftoverNeighborhoodOrCityMonthly,
  dropCurrentMonth,
  getPublicDetachedMonthly,
} from '@/lib/data/market-truth/public-monthly'

const { getMetricsMock } = vi.hoisted(() => ({ getMetricsMock: vi.fn() }))
vi.mock('@/lib/data/market-truth/getMetric', () => ({
  getMetrics: (...args: unknown[]) => getMetricsMock(...args),
}))

const SRC = readFileSync(resolve('lib/data/market-truth/public-monthly.ts'), 'utf8')

function metric(partial: Partial<MetricResult> & Pick<MetricResult, 'statId' | 'value'>): MetricResult {
  return {
    geoType: 'city',
    geoSlug: 'bend',
    segment: 'detached',
    valueText: null,
    isPublishable: true,
    provenance: {
      sampleN: 40,
      method: 'percentile_cont_0.5',
      excludedN: 0,
      completeThrough: '2026-08-22',
      windowMonths: 1,
      definitionId: 'mt-v1',
      computedAt: '2026-08-24T01:00:00Z',
      isFloor: false,
      withheldReason: null,
    },
    ...partial,
  }
}

describe('leftover monthly chart overlay', () => {
  beforeEach(() => {
    getMetricsMock.mockReset()
  })

  it('reads window=1 leftover through getMetrics, not cache', () => {
    expect(SRC).toMatch(/getMetrics/)
    expect(SRC).toMatch(/windowMonths: PUBLIC_MONTHLY_WINDOW_MONTHS/)
    expect(SRC).toMatch(/median_close/)
    expect(SRC).toMatch(/closed_count/)
    expect(SRC).not.toMatch(/from\('market_stats_cache'\)/)
    expect(SRC).not.toMatch(/mom_median_price/)
    const city = readFileSync(resolve('app/housing-market/[...slug]/page.tsx'), 'utf8')
    const hub = readFileSync(resolve('app/housing-market/page.tsx'), 'utf8')
    const region = readFileSync(resolve('app/housing-market/central-oregon/page.tsx'), 'utf8')
    const home = readFileSync(resolve('app/page.tsx'), 'utf8')
    const cities = readFileSync(resolve('app/cities/[slug]/page.tsx'), 'utf8')
    const zip = readFileSync(resolve('app/zip/[zip]/page.tsx'), 'utf8')
    const annual = readFileSync(resolve('app/housing-market/annual-review/page.tsx'), 'utf8')
    const comm = readFileSync(resolve('app/communities/[slug]/page.tsx'), 'utf8')
    const nbh = readFileSync(resolve('app/cities/[slug]/[neighborhoodSlug]/page.tsx'), 'utf8')
    expect(city).toMatch(/getPublicDetachedMonthly/)
    expect(hub).toMatch(/getPublicDetachedMonthly/)
    expect(region).toMatch(/getPublicDetachedMonthly/)
    expect(home).toMatch(/getPublicDetachedMonthly/)
    expect(cities).toMatch(/getPublicDetachedMonthly/)
    expect(zip).toMatch(/getPublicDetachedMonthly/)
    expect(annual).toMatch(/getPublicDetachedMonthly/)
    expect(comm).toMatch(/getPublicDetachedMonthly/)
    expect(nbh).toMatch(/getPublicDetachedMonthly/)
    expect(comm).toMatch(/leftoverNeighborhoodOrCityMonthly/)
    expect(nbh).toMatch(/leftoverNeighborhoodOrCityMonthly/)
    expect(comm).toMatch(/geoType: 'neighborhood'/)
    expect(nbh).toMatch(/geoType: 'neighborhood'/)
    expect(zip).toMatch(/getPublicDetachedMonthly\(\{\s*geoType: 'city'/)
    const sql = readFileSync(
      resolve('scripts/sql/compute_market_metrics_monthly_shadow.sql'),
      'utf8',
    )
    expect(sql).toMatch(/window_months = 1/)
    expect(sql).toMatch(/median_close/)
    expect(sql).not.toMatch(/mom_median_price/)
    expect(sql).toMatch(/segment = 'detached'/)
    const nbhSql = readFileSync(
      resolve('scripts/sql/compute_market_metrics_monthly_neighborhood_shadow.sql'),
      'utf8',
    )
    expect(nbhSql).toMatch(/geo_type = 'neighborhood'/)
    expect(nbhSql).toMatch(/window_months = 1/)
    expect(nbhSql).not.toMatch(/mom_median_price/)
    expect(nbhSql).not.toMatch(/geo_type IN \('city', 'region'\)/)
    const cron = readFileSync(resolve('app/api/cron/refresh-sale-pricing-facts/route.ts'), 'utf8')
    expect(cron).toMatch(/compute_market_metrics_monthly_neighborhood_shadow/)
  })

  it('drops the in-progress month and lists complete months oldest first', () => {
    expect(completeMonthKeys('2026-08', 3)).toEqual(['2026-05', '2026-06', '2026-07'])
    expect(
      dropCurrentMonth(
        [
          { periodStart: '2026-07-01', medianSalePrice: 1 },
          { periodStart: '2026-08-01', medianSalePrice: 2 },
        ],
        '2026-08',
      ).map((row) => row.periodStart),
    ).toEqual(['2026-07-01'])
  })

  it('does not fill a leftover monthly miss from cache', () => {
    const leftover: Array<{
      periodStart: string
      periodEnd: string
      medianClose: number | null
      closedCount: number | null
    }> = [1, 2, 3, 4, 5, 7].map((month) => ({
      periodStart: `2026-${String(month).padStart(2, '0')}-01`,
      periodEnd: `2026-${String(month).padStart(2, '0')}-28`,
      medianClose: 750000,
      closedCount: 80,
    }))
    leftover.push({
      periodStart: '2026-06-01',
      periodEnd: '2026-06-30',
      medianClose: null,
      closedCount: null,
    })
    const picked = leftoverOrCacheMonthly(
      leftover,
      [{ periodStart: '2026-06-01', medianSalePrice: 1641, soldCount: 16 }],
      6,
    )
    expect(picked.leftoverUsed).toBe(true)
    expect(picked.months.find((row) => row.periodStart.startsWith('2026-06'))).toBeUndefined()
  })

  it('omits an unpublished leftover month from getMetrics', async () => {
    getMetricsMock.mockImplementation(async (inputs: GetMetricInput[]) =>
      inputs.map((input) => {
        if (input.periodEnd === '2026-06-30') {
          return metric({ statId: input.stat, value: 750000, isPublishable: false })
        }
        return metric({ statId: input.stat, value: input.stat === 'closed_count' ? 80 : 750000 })
      }),
    )
    const leftover = await getPublicDetachedMonthly({
      geoType: 'city',
      geoSlug: 'bend',
      currentMonthKey: '2026-08',
    })
    expect(leftover.find((row) => row.periodStart.startsWith('2026-06'))?.medianClose).toBeNull()
  })

  it('falls back to cache when leftover cannot plot', () => {
    const picked = leftoverOrCacheMonthly(
      [{ periodStart: '2026-07-01', periodEnd: '2026-07-31', medianClose: 750000, closedCount: 80 }],
      [{ periodStart: '2026-07-01', medianSalePrice: 740000, soldCount: 70 }],
      6,
    )
    expect(picked.leftoverUsed).toBe(false)
    expect(picked.months[0]?.medianSalePrice).toBe(740000)
  })

  it('prefers leftover neighborhood monthly over leftover city', () => {
    const leftoverNeighborhood = [1, 2, 3, 4, 5, 6].map((month) => ({
      periodStart: `2026-0${month}-01`,
      periodEnd: `2026-0${month}-28`,
      medianClose: 880000,
      closedCount: 12,
    }))
    const leftoverCity = leftoverNeighborhood.map((row) => ({ ...row, medianClose: 759450 }))
    const picked = leftoverNeighborhoodOrCityMonthly({
      leftoverNeighborhood,
      leftoverCity,
      neighborhoodCache: [{ periodStart: '2026-06-01', medianSalePrice: 1 }],
      cityCache: [{ periodStart: '2026-06-01', medianSalePrice: 759450 }],
      currentMonthKey: '2026-08',
      neighborhoodCacheSparse: true,
    })
    expect(picked.leftoverUsed).toBe(true)
    expect(picked.cityFallback).toBe(false)
    expect(picked.months[0]?.medianSalePrice).toBe(880000)
  })

  it('does not fill a neighborhood leftover miss from leftover city when local cache is dense', () => {
    const picked = leftoverNeighborhoodOrCityMonthly({
      leftoverNeighborhood: [],
      leftoverCity: [1, 2, 3, 4, 5, 6].map((month) => ({
        periodStart: `2026-0${month}-01`,
        periodEnd: `2026-0${month}-28`,
        medianClose: 759450,
        closedCount: 80,
      })),
      neighborhoodCache: [1, 2, 3, 4, 5, 6, 7, 8].map((month) => ({
        periodStart: `2025-${String(month).padStart(2, '0')}-01`,
        medianSalePrice: 500000 + month,
      })),
      cityCache: [{ periodStart: '2026-06-01', medianSalePrice: 759450 }],
      currentMonthKey: '2026-08',
      neighborhoodCacheSparse: false,
    })
    expect(picked.leftoverUsed).toBe(false)
    expect(picked.cityFallback).toBe(false)
    expect(picked.months[0]?.medianSalePrice).toBe(500001)
  })

  it('uses leftover city monthly only when neighborhood leftover cannot plot and cache is sparse', () => {
    const leftoverCity = [1, 2, 3, 4, 5, 6].map((month) => ({
      periodStart: `2026-0${month}-01`,
      periodEnd: `2026-0${month}-28`,
      medianClose: 759450,
      closedCount: 80,
    }))
    const picked = leftoverNeighborhoodOrCityMonthly({
      leftoverNeighborhood: [],
      leftoverCity,
      neighborhoodCache: [{ periodStart: '2026-07-01', medianSalePrice: 400000 }],
      cityCache: [{ periodStart: '2026-07-01', medianSalePrice: 1641 }],
      currentMonthKey: '2026-08',
      neighborhoodCacheSparse: true,
    })
    expect(picked.leftoverUsed).toBe(true)
    expect(picked.cityFallback).toBe(true)
    expect(picked.months[0]?.medianSalePrice).toBe(759450)
  })
})
