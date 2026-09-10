import { describe, it, expect } from 'vitest'
import type { PriceDrop } from '@/lib/data'
import { priceDropFieldItems } from './drops-field-items'

function drop(over: Partial<PriceDrop> = {}): PriceDrop {
  return {
    listingKey: 'L1',
    listNumber: '220000001',
    streetNumber: '500',
    streetName: 'Columbia',
    streetSuffix: 'St',
    city: 'Bend',
    citySlug: 'bend',
    postalCode: '97701',
    subdivisionName: 'Old Bend',
    subdivisionSlug: 'old-bend',
    addressSlug: null,
    lat: 44.06,
    lng: -121.31,
    photoUrl: '/p.jpg',
    beds: 3,
    baths: 2,
    sqft: 1600,
    listPrice: 549_000,
    originalListPrice: 599_000,
    lastDropAmount: 50_000,
    lastDropPct: 8.3,
    totalDropPct: 8.3,
    priceDropCount: 1,
    daysSinceLastChange: 2,
    lastPriceChangeDate: '2026-08-10T00:00:00.000Z',
    dom: 21,
    boundaryCity: 'Bend',
    boundaryNeighborhood: null,
    boundarySubdivision: 'Old Bend',
    ...over,
  }
}

describe('priceDropFieldItems photographs', () => {
  it('passes the live listing photograph and drop percent onto the Field row', () => {
    const items = priceDropFieldItems([drop()])
    expect(items).toHaveLength(1)
    expect(items[0].photoSrc).toBe('/p.jpg')
    expect(items[0].overlay).toBe('-8.3%')
    expect(items[0].dropLine).toBe('was $599,000, -8.3%')
    expect(items[0].specs).toBe('3 bd · 2 ba · 1,600 sqft · Old Bend')
    expect(items[0].meta).toContain('3 bd')
    expect(items[0].meta).toContain('was $599,000')
  })

  it('asks Spark for the row size so a prefetched drops Flight never names a 1600 plate', () => {
    const spark = 'https://cdn.resize.sparkplatform.com/ore/1600x1200/true/20260501165710852242000000-o.jpg'
    const items = priceDropFieldItems([drop({ photoUrl: spark })])
    expect(items[0]?.photoSrc).toBe(
      'https://cdn.resize.sparkplatform.com/ore/320x240/true/20260501165710852242000000-o.jpg',
    )
  })
})
