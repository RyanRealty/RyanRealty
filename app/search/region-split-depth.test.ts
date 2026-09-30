import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/data', () => ({ getDetachedOverlays: vi.fn() }))
vi.mock('@/lib/data/market-truth/public-pace', () => ({
  EMPTY_PUBLIC_PACE: {},
  getPublicDetachedPace: vi.fn(),
}))

import { buildMarketFaq } from '@/lib/site/market-faq'
import { buildRegionMarketDatasetSchema } from './[...slug]/city-market-dataset'
import { buildRegionMarketBand, regionCityDoors } from './region-split-depth'

// Synthetic inputs: these test the shaping, not the market. No figure here is published.
const faq = buildMarketFaq('Central Oregon', {
  grain: 'region',
  source: 'market-truth',
  activeCount: 1234,
  pulseActiveCount: 1234,
  medianListPrice: 700000,
  monthsOfSupply: 4.02,
  medianDaysToPending: 21,
  soldCount12mo: 3000,
  refreshedAt: '2026-09-24T12:00:00Z',
})

describe('buildRegionMarketBand (SITE-201)', () => {
  it('draws every figure from the Dataset variables, formatted as the FAQ prints them', () => {
    const band = buildRegionMarketBand(faq)!
    const vars = new Map(faq.datasetVariables.map((v) => [v.name, v.value]))
    const byKey = new Map(band.figures.map((f) => [f.key, f]))
    expect(byKey.get('active')?.value).toBe(Number(vars.get('Active Listings')).toLocaleString('en-US'))
    expect(byKey.get('median-list')?.value).toBe('$700,000')
    // 4.02 is balanced; the boundary-safe display is 4.1, never a 4.0 that reads seller's.
    expect(byKey.get('supply')?.value).toBe('4.1')
    expect(byKey.get('supply')?.label).toContain('balanced market')
    expect(band.headline).toBe('Central Oregon is a balanced market right now')
    for (const f of band.figures) {
      expect(faq.faqs.map((q) => q.answer).join(' ')).toContain(f.value)
    }
    const dataset = buildRegionMarketDatasetSchema({
      regionName: 'Central Oregon',
      pagePath: '/homes-for-sale',
      regionMarketFaq: faq,
    })
    expect(dataset && 'variableMeasured' in dataset ? dataset.variableMeasured : []).toBe(faq.datasetVariables)
  })

  it('a withheld figure is absent, and no figures means no band', () => {
    expect(buildRegionMarketBand(null)).toBeNull()
    expect(buildRegionMarketBand(buildMarketFaq('Central Oregon', { grain: 'region' }))).toBeNull()
    const partial = buildRegionMarketBand(
      buildMarketFaq('Central Oregon', { grain: 'region', source: 'market-truth', medianListPrice: 650000 }),
    )!
    expect(partial.figures.map((f) => f.key)).toEqual(['median-list'])
    expect(partial.headline).toBe('The Central Oregon housing market right now')
  })

  it('city doors name each city and never repeat a destination', () => {
    const doors = regionCityDoors()
    expect(doors.length).toBeGreaterThan(3)
    expect(doors[0]).toEqual({ href: '/homes-for-sale/bend', label: 'Bend homes for sale' })
    expect(new Set(doors.map((d) => d.href)).size).toBe(doors.length)
    for (const d of doors) expect(d.label).toMatch(/ homes for sale$/)
  })
})
