import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GetMetricInput, MetricResult } from '@/lib/data/market-truth/getMetric'
import {
  getPublicDetachedMix,
  publicMixHasRow,
  publicMixItems,
} from '@/lib/data/market-truth/public-mix'

const { getMetricsMock } = vi.hoisted(() => ({ getMetricsMock: vi.fn() }))
vi.mock('@/lib/data/market-truth/getMetric', () => ({
  getMetrics: (...args: unknown[]) => getMetricsMock(...args),
}))

const SRC = readFileSync(resolve('lib/data/market-truth/public-mix.ts'), 'utf8')

function metric(
  partial: Partial<MetricResult> & Pick<MetricResult, 'statId'>,
): MetricResult {
  return {
    geoType: 'city',
    geoSlug: 'bend',
    segment: 'detached',
    value: null,
    valueText: null,
    isPublishable: true,
    provenance: {
      sampleN: 2096,
      method: 'true_count / n D12 floor',
      excludedN: 0,
      completeThrough: '2026-08-22',
      windowMonths: 12,
      definitionId: 'mt-v1',
      computedAt: '2026-08-23T01:00:00Z',
      isFloor: false,
      withheldReason: null,
    },
    ...partial,
  }
}

describe('public mix / feature floors', () => {
  beforeEach(() => {
    getMetricsMock.mockReset()
  })

  it('reads mix cells through getMetrics and labels D12 floors at least', () => {
    expect(SRC).toMatch(/getMetrics/)
    expect(SRC).toMatch(/feature_share/)
    expect(SRC).toMatch(/financing_mix/)
    expect(SRC).toMatch(/bedroom_distribution/)
    expect(SRC).toMatch(/at least/)
    expect(SRC).toMatch(/garageTrueShare/)
    expect(SRC).not.toMatch(/from\('market_metric'\)/)
    expect(SRC).not.toMatch(/commercial_lease/)
    const city = readFileSync(resolve('app/housing-market/[...slug]/page.tsx'), 'utf8')
    const hub = readFileSync(resolve('app/housing-market/page.tsx'), 'utf8')
    const region = readFileSync(resolve('app/housing-market/central-oregon/page.tsx'), 'utf8')
    const jsonRoute = readFileSync(resolve('app/data/market/[geoType]/[geoSlug]/route.ts'), 'utf8')
    expect(city).toMatch(/getPublicDetachedMix/)
    expect(hub).toMatch(/getPublicDetachedMix/)
    expect(region).toMatch(/getPublicDetachedMix/)
    expect(jsonRoute).toMatch(/mix: feed\.mix/)
    const home = readFileSync(resolve('app/page.tsx'), 'utf8')
    const cities = readFileSync(resolve('app/cities/[slug]/page.tsx'), 'utf8')
    const zip = readFileSync(resolve('app/zip/[zip]/page.tsx'), 'utf8')
    const comm = readFileSync(resolve('app/communities/[slug]/page.tsx'), 'utf8')
    const nbh = readFileSync(resolve('app/cities/[slug]/[neighborhoodSlug]/page.tsx'), 'utf8')
    // The HOMEPAGE dropped the mix read 2026-08-27 ("the answer, not the
    // report"): its market section prints five figures and a door to
    // /housing-market, which owns the full set. It must not read mix only to
    // discard it.
    expect(home).not.toMatch(/getPublicDetachedMix/)
    // City restyle (2026-08-29): mix stays on the report. The city face
    // prints a few figures and a door, same as the homepage.
    expect(cities).not.toMatch(/getPublicDetachedMix/)
    expect(zip).toMatch(/getPublicDetachedMix/)
    expect(comm).toMatch(/getPublicDetachedMix/)
    // Neighborhood restyle (2026-08-29): mix stays on the report. The
    // neighborhood face prints a few figures and a door, same as the city.
    expect(nbh).not.toMatch(/getPublicDetachedMix/)
    expect(home).not.toMatch(/buildPublicMixFigures/)
    expect(cities).not.toMatch(/buildPublicMixFigures/)
    expect(nbh).not.toMatch(/buildPublicMixFigures/)
  })

  it('publishes garage as a true share and other flags as at-least floors', async () => {
    getMetricsMock.mockImplementation(async (inputs: GetMetricInput[]) =>
      inputs.map((input) => {
        if (input.stat === 'feature_share') {
          return metric({
            statId: 'feature_share',
            value: 0.41,
            valueText: JSON.stringify({
              fireplace_yn: 0.41,
              garage_yn: 0.73,
              pool_yn: 0.08,
              waterfront_yn: 0.02,
            }),
            provenance: {
              sampleN: 2096,
              method: 'true_count / n D12 floor',
              excludedN: 0,
              completeThrough: '2026-08-22',
              windowMonths: 12,
              definitionId: 'mt-v1',
              computedAt: '2026-08-23T01:00:00Z',
              isFloor: true,
              withheldReason: null,
            },
          })
        }
        if (input.stat === 'financing_mix') {
          return metric({
            statId: 'financing_mix',
            valueText: JSON.stringify({ conventional: 0.61, cash: 0.22, fha: 0.09, va: 0.04 }),
          })
        }
        if (input.stat === 'bedroom_distribution') {
          return metric({
            statId: 'bedroom_distribution',
            valueText: JSON.stringify({ '3': 900, '4': 700, '2': 300, unknown: 50 }),
          })
        }
        return null
      }),
    )
    const row = await getPublicDetachedMix({ geoType: 'city', geoSlug: 'bend' })
    expect(getMetricsMock).toHaveBeenCalled()
    const items = publicMixItems(row)
    expect(publicMixHasRow(row)).toBe(true)
    expect(items.find((item) => item.key === 'feat:garage_yn')?.value).toBe('73.0%')
    expect(items.find((item) => item.key === 'feat:garage_yn')?.label).toBe('garage · 12 months')
    expect(items.find((item) => item.key === 'feat:fireplace_yn')?.value).toBe('at least 41.0%')
    expect(items.find((item) => item.key === 'feat:pool_yn')?.value).toBe('at least 8.0%')
    expect(items.find((item) => item.key === 'feat:waterfront_yn')).toBeUndefined()
    expect(items.find((item) => item.key === 'fin:conventional')?.value).toBe('61.0%')
    expect(items.find((item) => item.key === 'fin:va')).toBeUndefined()
    expect(items.some((item) => item.label.includes('3-bed'))).toBe(true)
  })

  it('omits a leftover mix miss instead of printing 0%', async () => {
    getMetricsMock.mockResolvedValue([null, null, null])
    const row = await getPublicDetachedMix({ geoType: 'city', geoSlug: 'madras' })
    expect(publicMixHasRow(row)).toBe(false)
    expect(publicMixItems(row)).toEqual([])
  })
})
