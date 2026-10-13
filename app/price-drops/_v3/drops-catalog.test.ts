import { describe, expect, it } from 'vitest'
import {
  catalogCityOptions,
  filterPriceDropCatalog,
  PRICE_DROP_CATALOG_PAGE_SIZE,
} from './drops-catalog'
import type { PriceDropFieldItem } from './drops-field-items'

function item(over: Partial<PriceDropFieldItem> & Pick<PriceDropFieldItem, 'id'>): PriceDropFieldItem {
  return {
    href: `/homes-for-sale/listing/${over.id}`,
    priceLabel: '$500,000',
    title: '1 Test St',
    listPrice: 500_000,
    beds: 3,
    city: 'Bend',
    listing: {
      listingKey: `${over.id}`,
      href: `/homes-for-sale/listing/${over.id}`,
      price: 500_000,
      addressLine: '1 Test St',
      cityLine: 'Bend',
      beds: 3,
      baths: 2,
      sqft: 1600,
      propertyType: 'A',
      propertySubType: null,
      subdivisionName: null,
      city: 'Bend',
      listNumber: null,
    },
    ...over,
  }
}

const rows = [
  item({ id: 'bend-3', city: 'Bend', listPrice: 549_000, beds: 3 }),
  item({ id: 'redmond-4', city: 'Redmond', listPrice: 425_000, beds: 4 }),
  item({ id: 'sisters-2', city: 'Sisters', listPrice: 1_200_000, beds: 2 }),
]

describe('filterPriceDropCatalog', () => {
  it('returns every row when filters are open', () => {
    expect(filterPriceDropCatalog(rows, { city: '', priceMax: null, bedsMin: null })).toHaveLength(3)
  })

  it('filters by city, price ceiling, and bedroom floor', () => {
    expect(
      filterPriceDropCatalog(rows, { city: 'Bend', priceMax: null, bedsMin: null }).map((r) => r.id),
    ).toEqual(['bend-3'])
    expect(
      filterPriceDropCatalog(rows, { city: '', priceMax: 500_000, bedsMin: null }).map((r) => r.id),
    ).toEqual(['redmond-4'])
    expect(
      filterPriceDropCatalog(rows, { city: '', priceMax: null, bedsMin: 4 }).map((r) => r.id),
    ).toEqual(['redmond-4'])
  })

  it('filters by a factual deal signal', () => {
    const signaled = [
      item({ id: 'repeat', signals: { repeatCuts: true } }),
      item({ id: 'plain' }),
    ]
    expect(
      filterPriceDropCatalog(signaled, { city: '', priceMax: null, bedsMin: null, signal: 'repeatCuts' }).map(
        (row) => row.id,
      ),
    ).toEqual(['repeat'])
  })

  it('drops a row with no price when a price ceiling is set', () => {
    expect(
      filterPriceDropCatalog([item({ id: 'missing', listPrice: undefined })], {
        city: '',
        priceMax: 500_000,
        bedsMin: null,
      }),
    ).toEqual([])
  })
})

describe('catalogCityOptions', () => {
  it('lists unique cities, sorted', () => {
    expect(catalogCityOptions(rows)).toEqual(['Bend', 'Redmond', 'Sisters'])
  })
})

describe('PRICE_DROP_CATALOG_PAGE_SIZE', () => {
  it('pages in a crawlable first chunk', () => {
    expect(PRICE_DROP_CATALOG_PAGE_SIZE).toBe(24)
  })
})
