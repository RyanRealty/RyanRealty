import { describe, expect, it } from 'vitest'
import { homeRailItemList } from './home-jsonld'
import type { HomeRailCard, HomeRailRow } from './home-rail-items'

function card(partial: Partial<HomeRailCard> & Pick<HomeRailCard, 'listingKey' | 'href' | 'addressLine'>): HomeRailCard {
  return {
    photoUrls: ['https://example.com/a.jpg'],
    price: 625000,
    cityLine: 'Bend, OR',
    beds: 3,
    baths: 2,
    sqft: 1800,
    pricePerSqft: 347,
    propertyType: 'Residential',
    propertySubType: 'Single Family Residence',
    subdivisionName: null,
    city: 'Bend',
    listNumber: '220000000',
    badges: [],
    hasTour: false,
    tourUrl: null,
    tourLabel: 'Tour',
    statusLabel: null,
    ...partial,
  }
}

describe('homeRailItemList', () => {
  it('emits an ItemList of photographed rail homes', () => {
    const rows: HomeRailRow[] = [
      {
        id: 'homes-local',
        heading: 'Homes in Bend and nearby',
        seeAll: { href: '/homes-for-sale/bend', label: 'See all homes' },
        cards: [
          card({ listingKey: 'a', href: '/homes-for-sale/bend/1-main-st-2201', addressLine: '1 Main St' }),
          card({ listingKey: 'b', href: '/homes-for-sale/bend/2-pine-st-2202', addressLine: '2 Pine St', price: 410000 }),
        ],
      },
    ]
    const ld = homeRailItemList(rows)
    expect(ld).toMatchObject({
      '@type': 'ItemList',
      name: 'Homes for sale in Central Oregon',
      numberOfItems: 2,
    })
    const elements = ld?.itemListElement as Array<{ name: string; url: string }>
    expect(elements[0]?.name).toContain('1 Main St')
    expect(elements[0]?.url).toContain('/homes-for-sale/bend/1-main-st-2201')
  })

  it('withholds when no rail cards exist', () => {
    expect(homeRailItemList([])).toBeNull()
  })

  it('labels a fractional share ask in the ItemList name', () => {
    const rows: HomeRailRow[] = [
      {
        id: 'homes-local',
        heading: 'Homes in Bend and nearby',
        seeAll: { href: '/homes-for-sale/bend', label: 'See all homes' },
        cards: [
          card({
            listingKey: 'share',
            href: '/homes-for-sale/redmond/1-eagle-crest-220190868',
            addressLine: '1 Eagle Crest',
            propertySubType: 'Tenancy in Common',
            city: 'Redmond',
            listNumber: '220190868',
          }),
        ],
      },
    ]
    const ld = homeRailItemList(rows)
    const elements = ld?.itemListElement as Array<{ name: string }>
    expect(elements[0]?.name).toMatch(/Tenancy in common/i)
  })
})
