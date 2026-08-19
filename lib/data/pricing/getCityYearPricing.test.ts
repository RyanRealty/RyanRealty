import { describe, expect, it } from 'vitest'
import {
  MIN_CLOSINGS_PER_YEAR,
  filterCityYearPricing,
  mapCityYearPricingRow,
  type CityYearPricingRow,
} from './getCityYearPricing'

const dbRow = {
  city_slug: 'bend',
  city: 'Bend',
  year: 2024,
  closings: 514,
  median_close: '759900',
  median_ppsf: '389.5',
  median_days_to_offer: 18,
  median_sale_to_original: '0.9845',
  new_construction_count: 103,
}

describe('mapCityYearPricingRow', () => {
  it('maps numerics (PostgREST numeric arrives as string) and derives the share', () => {
    const row = mapCityYearPricingRow(dbRow)
    expect(row).not.toBeNull()
    expect(row!.citySlug).toBe('bend')
    expect(row!.city).toBe('Bend')
    expect(row!.year).toBe(2024)
    expect(row!.closings).toBe(514)
    expect(row!.medianClose).toBe(759900)
    expect(row!.medianPpsf).toBe(389.5)
    expect(row!.medianDaysToOffer).toBe(18)
    expect(row!.medianSaleToOriginal).toBe(0.9845)
    expect(row!.newConstructionCount).toBe(103)
    expect(row!.newConstructionShare).toBeCloseTo(103 / 514, 12)
  })

  it('keeps a null median null — a year with no measurable leg is not zero', () => {
    const row = mapCityYearPricingRow({
      ...dbRow,
      median_days_to_offer: null,
      median_sale_to_original: null,
    })
    expect(row!.medianDaysToOffer).toBeNull()
    expect(row!.medianSaleToOriginal).toBeNull()
    // The medians that do exist survive beside the nulls.
    expect(row!.medianClose).toBe(759900)
  })

  it('drops a row that cannot identify itself', () => {
    expect(mapCityYearPricingRow({ ...dbRow, city_slug: ' ' })).toBeNull()
    expect(mapCityYearPricingRow({ ...dbRow, year: Number.NaN })).toBeNull()
    expect(mapCityYearPricingRow({ ...dbRow, closings: 0 })).toBeNull()
  })

  it('falls back to the slug when the display name is blank', () => {
    const row = mapCityYearPricingRow({ ...dbRow, city: '  ' })
    expect(row!.city).toBe('bend')
  })

  it('states the HAVING floor the RPC applies', () => {
    expect(MIN_CLOSINGS_PER_YEAR).toBe(3)
  })
})

describe('filterCityYearPricing', () => {
  const rows: CityYearPricingRow[] = [
    { citySlug: 'bend', city: 'Bend', year: 2015, closings: 400, medianClose: 350000, medianPpsf: 200, medianDaysToOffer: 10, medianSaleToOriginal: 0.99, newConstructionCount: 40, newConstructionShare: 0.1 },
    { citySlug: 'bend', city: 'Bend', year: 2025, closings: 500, medianClose: 760000, medianPpsf: 390, medianDaysToOffer: 18, medianSaleToOriginal: 0.98, newConstructionCount: 50, newConstructionShare: 0.1 },
    { citySlug: 'madras', city: 'Madras', year: 2015, closings: 30, medianClose: 150000, medianPpsf: 110, medianDaysToOffer: 40, medianSaleToOriginal: 0.97, newConstructionCount: 3, newConstructionShare: 0.1 },
  ]

  it('filters by city slug, case-insensitive on the input side', () => {
    expect(filterCityYearPricing(rows, { citySlug: 'Bend' }).map((r) => r.year)).toEqual([2015, 2025])
  })

  it('filters by year window, inclusive both ends', () => {
    expect(filterCityYearPricing(rows, { fromYear: 2015, toYear: 2015 }).map((r) => r.citySlug)).toEqual([
      'bend',
      'madras',
    ])
    expect(filterCityYearPricing(rows, { fromYear: 2016 }).map((r) => r.year)).toEqual([2025])
  })

  it('returns everything when unconstrained', () => {
    expect(filterCityYearPricing(rows)).toHaveLength(3)
  })
})

describe('getCityYearPricing source discipline', () => {
  it('reads through the RPC, never paging sale_pricing_facts through PostgREST', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync(new URL('./getCityYearPricing.ts', import.meta.url), 'utf8')
    expect(src).toMatch(/rpc\('city_year_pricing'/)
    expect(src).not.toMatch(/from\('sale_pricing_facts'\)/)
    // Errors throw so the resilient cache never stores a blip as "no data".
    expect(src).toMatch(/if \(error\) throw/)
  })
})
