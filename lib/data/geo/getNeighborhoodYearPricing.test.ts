import { describe, expect, it } from 'vitest'
import {
  ALL_BEND_DISTRICTS_SLUG,
  filterNeighborhoodYearPricing,
  mapNeighborhoodYearPricingRow,
  type NeighborhoodYearPricingRow,
} from './getNeighborhoodYearPricing'

describe('mapNeighborhoodYearPricingRow', () => {
  it('maps a live MV row, coercing PostgREST numerics', () => {
    // Verified live 2026-08-19: bend-awbrey-butte 2025.
    expect(
      mapNeighborhoodYearPricingRow({
        geo_slug: 'bend-awbrey-butte',
        geo_label: 'Awbrey Butte',
        year: 2025,
        closings: 135,
        median_close: '1285000',
        median_ppsf: '446.73',
        total_volume: '210000000',
      }),
    ).toEqual({
      geoSlug: 'bend-awbrey-butte',
      geoLabel: 'Awbrey Butte',
      year: 2025,
      closings: 135,
      medianClose: 1_285_000,
      medianPpsf: 446.73,
      totalVolume: 210_000_000,
    })
  })

  it('drops a row that cannot key a district-year', () => {
    const base = {
      geo_slug: 'bend-old-bend',
      geo_label: 'Old Bend',
      year: 2025,
      closings: 20,
      median_close: '897500',
      median_ppsf: null,
      total_volume: null,
    }
    expect(mapNeighborhoodYearPricingRow({ ...base, geo_slug: '  ' })).toBeNull()
    expect(mapNeighborhoodYearPricingRow({ ...base, year: 2025.5 })).toBeNull()
    expect(mapNeighborhoodYearPricingRow({ ...base, closings: 0 })).toBeNull()
  })

  it('keeps a null median as null rather than zero', () => {
    const row = mapNeighborhoodYearPricingRow({
      geo_slug: 'bend-old-bend',
      geo_label: 'Old Bend',
      year: 2025,
      closings: 20,
      median_close: null,
      median_ppsf: null,
      total_volume: null,
    })!
    expect(row.medianClose).toBeNull()
    expect(row.medianPpsf).toBeNull()
  })
})

describe('filterNeighborhoodYearPricing', () => {
  const ROWS: NeighborhoodYearPricingRow[] = [
    { geoSlug: 'bend-awbrey-butte', geoLabel: 'Awbrey Butte', year: 1997, closings: 46, medianClose: 259_500, medianPpsf: 109.43, totalVolume: null },
    { geoSlug: 'bend-awbrey-butte', geoLabel: 'Awbrey Butte', year: 2025, closings: 135, medianClose: 1_285_000, medianPpsf: 446.73, totalVolume: null },
    { geoSlug: ALL_BEND_DISTRICTS_SLUG, geoLabel: 'All Bend districts', year: 2025, closings: 1513, medianClose: 740_000, medianPpsf: 396.83, totalVolume: null },
  ]

  it('filters one district out of the shared pull', () => {
    expect(
      filterNeighborhoodYearPricing(ROWS, { geoSlug: 'bend-awbrey-butte' }).map((r) => r.year),
    ).toEqual([1997, 2025])
  })

  it('filters the synthetic union by its own slug', () => {
    expect(
      filterNeighborhoodYearPricing(ROWS, { geoSlug: ALL_BEND_DISTRICTS_SLUG }),
    ).toHaveLength(1)
  })

  it('windows by year', () => {
    expect(filterNeighborhoodYearPricing(ROWS, { fromYear: 2000 })).toHaveLength(2)
    expect(filterNeighborhoodYearPricing(ROWS, { toYear: 1999 })).toHaveLength(1)
  })
})
