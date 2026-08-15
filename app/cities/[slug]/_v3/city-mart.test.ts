import { describe, expect, it } from 'vitest'
import type { CoMarketAnnualRow } from '@/lib/data/analytics/getCoMarketAnnual'
import {
  cityInstrumentSource,
  pickPlaceMart,
  placeMartFigures,
  placeMartYearLabel,
  presentPlaceMart,
  regionMartContextTrace,
} from './city-mart'

function row(overrides: Partial<CoMarketAnnualRow> = {}): CoMarketAnnualRow {
  return {
    year: 2024,
    typeScope: 'all',
    soldCount: 2000,
    totalVolume: 1_500_000_000,
    medianClose: 600000,
    meanClose: 650000,
    propertyTypeBreakdown: {},
    methodology: 'closed_cte+service_area_v1',
    source: 'mart',
    computedAt: '2026-08-14T00:00:00.000Z',
    ...overrides,
  }
}

describe('place mart shaping', () => {
  it('omits a missing mart row instead of printing zero', () => {
    expect(presentPlaceMart(row({ source: 'missing', soldCount: 0, totalVolume: 0 }), 'city')).toBeNull()
    expect(presentPlaceMart(row({ soldCount: 0, totalVolume: 0 }), 'city')).toBeNull()
    expect(placeMartFigures(null, '/housing-market/history?year=2024')).toEqual([])
  })

  it('prefers the city cell over the region cell', () => {
    const picked = pickPlaceMart(row({ totalVolume: 2e9 }), row({ totalVolume: 3.931e9 }))
    expect(picked?.grain).toBe('city')
    expect(picked?.totalVolume).toBe(2e9)
  })

  it('falls back to the region cell when the city cell is missing', () => {
    const picked = pickPlaceMart(row({ source: 'missing', soldCount: 0, totalVolume: 0 }), row())
    expect(picked?.grain).toBe('region')
  })

  it('labels city and region grains honestly', () => {
    expect(placeMartYearLabel('city', 2024)).toBe('all property types, 2024')
    expect(placeMartYearLabel('region', 2024)).toBe('Central Oregon 2024, all types')
  })

  it('prints compact volume with the year label', () => {
    const figures = placeMartFigures(presentPlaceMart(row(), 'city'), '/housing-market/history?year=2024')
    expect(figures).toHaveLength(1)
    expect(figures[0]?.value).toBe('$1.5B')
    expect(figures[0]?.label).toBe('all property types, 2024')
  })

  it('keeps the pulse trace when the mart row is missing', () => {
    expect(cityInstrumentSource('pulse SFR trace', null, 'Bend')).toBe('pulse SFR trace')
  })

  it('names the neighborhood mart figure as region context', () => {
    expect(regionMartContextTrace({ ...row(), grain: 'region' })).toMatch(
      /Central Oregon 2024, all property types/,
    )
  })
})
