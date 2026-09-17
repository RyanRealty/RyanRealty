import { describe, expect, it } from 'vitest'
import type { CoMarketAnnualRow } from '@/lib/data/analytics/getCoMarketAnnual'
import {
  buildCityInsightBoard,
  cityInsightPageCount,
  cityInsightSources,
} from './city-insight'
import { cityHomesRows } from './city-homes'
import { closedTrace } from './geo-figures'
import type { ListingTile } from '@/lib/data'

const INTERNAL = /Market Truth|mt-v1|leftover|MarketPulse|definition_id|stat_id|market_metric/i

function month(periodStart: string, medianSalePrice: number, soldCount: number) {
  return { periodStart, medianSalePrice, soldCount }
}

function months(startYear: number, startMonth: number, count: number) {
  const out = []
  let year = startYear
  let monthIndex = startMonth
  for (let i = 0; i < count; i += 1) {
    const key = `${year}-${String(monthIndex).padStart(2, '0')}-01`
    out.push(month(key, 700000 + i * 1000, 80 + (i % 12)))
    monthIndex += 1
    if (monthIndex > 12) {
      monthIndex = 1
      year += 1
    }
  }
  return out
}

function mart(year: number): CoMarketAnnualRow {
  return {
    geoType: 'city',
    geoSlug: 'bend',
    year,
    typeScope: 'all',
    soldCount: 2100,
    totalVolume: 1_600_000_000,
    medianClose: 760000,
    meanClose: 800000,
    propertyTypeBreakdown: { A: 1600, D: 300, F: 200 },
    methodology: 'v1',
    source: 'mart',
    computedAt: '2026-09-01T00:00:00Z',
  }
}

describe('buildCityInsightBoard', () => {
  it('publishes three city pages with visitor-English sources', () => {
    const board = buildCityInsightBoard({
      cityName: 'Bend',
      monthly: months(2024, 1, 24),
      closedSeries: [mart(2025)],
    })
    expect(cityInsightPageCount(board)).toBe(3)
    for (const line of cityInsightSources(board)) {
      expect(line).toMatch(/Oregon Data Share MLS/)
      expect(line).toMatch(/Bend/)
      expect(line).not.toMatch(INTERNAL)
    }
  })

  it('omits a page that cannot be sourced', () => {
    const board = buildCityInsightBoard({
      cityName: 'Madras',
      monthly: months(2026, 1, 4),
      closedSeries: [],
    })
    expect(board.compare).toBeNull()
    expect(cityInsightPageCount(board)).toBeLessThan(2)
  })
})

describe('visitor English traces', () => {
  it('does not print Market Truth, mt-v1, MarketPulse, or leftover in the closed-sales line', () => {
    const closed = closedTrace('Bend', [
      { value: '$750,000', label: 'median sale' },
    ])
    expect(closed).toMatch(/Oregon Data Share MLS/)
    expect(closed).not.toMatch(INTERNAL)
  })
})

describe('cityHomesRows', () => {
  it('keeps price, address, and beds/baths/sqft, and drops photo-only rows', () => {
    const tiles = [
      {
        listingKey: 'k1',
        listNumber: '220111',
        status: 'Active',
        listPrice: 749000,
        closePrice: null,
        closeDate: null,
        beds: 3,
        baths: 2,
        sqft: 1800,
        streetNumber: '12',
        streetName: 'Ladera',
        streetSuffix: 'Road',
        city: 'Bend',
        citySlug: 'bend',
        postalCode: '97702',
        subdivisionName: 'Ladera',
        subdivisionSlug: 'ladera',
        lat: null,
        lng: null,
        photoUrl: 'https://example.com/a.jpg',
        propertyType: 'A',
        propertySubType: 'Single Family Residence',
        onMarketDate: null,
        modifiedAt: null,
        pricePerSqft: 416,
        lotSizeAcres: null,
        yearBuilt: 2018,
        garageSpaces: null,
        poolYn: null,
        hasVirtualTour: false,
        tourUrl: null,
      },
      {
        listingKey: 'k2',
        listNumber: '220112',
        status: 'Active',
        listPrice: null,
        closePrice: null,
        closeDate: null,
        beds: null,
        baths: null,
        sqft: null,
        streetNumber: null,
        streetName: null,
        city: 'Bend',
        citySlug: 'bend',
        postalCode: null,
        subdivisionName: null,
        subdivisionSlug: null,
        lat: null,
        lng: null,
        photoUrl: 'https://example.com/b.jpg',
        propertyType: 'A',
        propertySubType: 'Single Family Residence',
        onMarketDate: null,
        modifiedAt: null,
        pricePerSqft: null,
        lotSizeAcres: null,
        yearBuilt: null,
        garageSpaces: null,
        poolYn: null,
        hasVirtualTour: false,
        tourUrl: null,
      },
    ] as unknown as ListingTile[]
    const rows = cityHomesRows(tiles)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.addressLine).toMatch(/Ladera/)
    expect(rows[0]?.price).toBe(749000)
    expect(rows[0]?.beds).toBe(3)
    expect(rows[0]?.baths).toBe(2)
    expect(rows[0]?.sqft).toBe(1800)
    expect(rows[0]?.href).toMatch(/220111/)
  })
})
