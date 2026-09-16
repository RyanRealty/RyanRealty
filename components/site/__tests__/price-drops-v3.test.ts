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
        shownCount: 0,
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
      shownCount: 12,
      totalReducedLabel: '$1.2M',
      medianDropPctLabel: '4.5%',
      fetchedAt: '2026-08-12T17:00:00.000Z',
    })
    expect(schemas).toHaveLength(2)
    expect(schemas[0]).toMatchObject({ type: 'dataset', dateModified: '2026-08-12T17:00:00.000Z' })
    expect(schemas[1]).toMatchObject({ type: 'webPage' })
    expect(JSON.stringify(schemas)).not.toContain('\u2014')
  })

  // SITE-108 (§0): `total` is the whole window; the dollar sum and the median
  // are computed from the rendered rows only. When those differ, every figure
  // says which set it covers so a 48-row sum cannot read as the 262-row total.
  it('names the rendered scope when the page shows fewer than the window holds', () => {
    const [dataset] = priceDropDatasetSchemas({
      pageUrl: 'https://ryan-realty.com/price-drops',
      placeName: 'Central Oregon',
      total: 262,
      shownCount: 48,
      totalReducedLabel: '$1.2M',
      medianDropPctLabel: '6.8%',
      fetchedAt: '2026-09-15T17:00:00.000Z',
    })
    const named = (dataset as unknown as {
      variableMeasured: Array<{ name: string; value: unknown }>
    }).variableMeasured
    expect(named[0]).toMatchObject({ name: 'Price reductions (7-day window)', value: 262 })
    expect(named[1].name).toBe('Total asking-price cuts (48 shown)')
    expect(named[2].name).toBe('Median drop (48 shown)')
  })

  it('leaves the scope unsaid when the page renders the whole window', () => {
    const [dataset] = priceDropDatasetSchemas({
      pageUrl: 'https://ryan-realty.com/price-drops',
      placeName: 'Central Oregon',
      total: 9,
      shownCount: 9,
      totalReducedLabel: '$400K',
      medianDropPctLabel: '3.0%',
      fetchedAt: '2026-09-15T17:00:00.000Z',
    })
    const named = (dataset as unknown as { variableMeasured: Array<{ name: string }> })
      .variableMeasured
    expect(named[1].name).toBe('Total asking-price cuts')
    expect(named[2].name).toBe('Median drop')
  })
})

describe('medianPositive', () => {
  it('ignores null and non-positive values', () => {
    expect(medianPositive([null, 0, 4, 2, 6])).toBe(4)
  })
})
