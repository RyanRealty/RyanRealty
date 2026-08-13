import { describe, it, expect } from 'vitest'
import type { PriceDrop } from '@/lib/data'
import { priceDropFieldItems } from '@/app/price-drops/_v3/drops-field-items'
import { priceDropDatasetSchemas } from '@/app/price-drops/_v3/drops-jsonld'
import { medianPositive } from '@/app/price-drops/_v3/drops-constants'

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

describe('priceDropFieldItems', () => {
  it('drops a row with no street', () => {
    const items = priceDropFieldItems([
      drop({ streetNumber: null, streetName: null, streetSuffix: null }),
    ])
    expect(items).toHaveLength(0)
  })

  it('sorts by lastDropPct descending', () => {
    const items = priceDropFieldItems([
      drop({ listingKey: 'small', lastDropPct: 2.1, streetNumber: '1' }),
      drop({ listingKey: 'big', lastDropPct: 12.4, streetNumber: '2' }),
    ])
    expect(items.map((row) => row.id)).toEqual(['big', 'small'])
  })

  it('never prints an em dash or en dash in a named row', () => {
    const items = priceDropFieldItems([drop()])
    expect(items).toHaveLength(1)
    expect(items[0].priceLabel).toMatch(/^\$/)
    expect(items[0].meta).toMatch(/was \$/)
    expect(items[0].meta).toMatch(/-8\.3%/)
    expect(JSON.stringify(items)).not.toContain('\u2014')
    expect(JSON.stringify(items)).not.toContain('\u2013')
  })
})

describe('priceDropDatasetSchemas', () => {
  it('emits nothing when the window is empty so a zero cannot publish', () => {
    expect(
      priceDropDatasetSchemas({
        pageUrl: 'https://ryan-realty.com/price-drops',
        placeName: 'Central Oregon',
        total: 0,
        totalReducedLabel: null,
        medianDropPctLabel: null,
        fetchedAt: new Date().toISOString(),
      }),
    ).toEqual([])
  })

  it('emits Dataset + webPage when total is live', () => {
    const schemas = priceDropDatasetSchemas({
      pageUrl: 'https://ryan-realty.com/price-drops',
      placeName: 'Central Oregon',
      total: 12,
      totalReducedLabel: '$1.2M',
      medianDropPctLabel: '4.5%',
      fetchedAt: '2026-08-12T17:00:00.000Z',
    })
    expect(schemas).toHaveLength(2)
    expect(schemas[0]).toMatchObject({ type: 'dataset', dateModified: '2026-08-12T17:00:00.000Z' })
    expect(schemas[1]).toMatchObject({ type: 'webPage' })
    expect(JSON.stringify(schemas)).not.toContain('\u2014')
  })
})

describe('medianPositive', () => {
  it('ignores null and non-positive values', () => {
    expect(medianPositive([null, 0, 4, 2, 6])).toBe(4)
  })
})
