import { describe, expect, it } from 'vitest'
import { homeHeroSearchItems, homeHeroTypedItem } from './home-hero-search-items'
import type { HomeRailCard } from './home-rail-items'

const card = (over: Partial<HomeRailCard>): HomeRailCard => ({
  listingKey: 'k',
  href: '/homes-for-sale/bend/k',
  photoUrls: ['https://cdn.example/p.jpg'],
  price: 1_624_900,
  addressLine: '2075 Trenton Avenue',
  cityLine: 'Bend',
  beds: 4,
  baths: 3,
  sqft: 3413,
  pricePerSqft: null,
  propertyType: 'A',
  propertySubType: 'Single Family Residence',
  subdivisionName: null,
  city: 'Bend',
  listNumber: null,
  badges: [],
  hasTour: false,
  tourUrl: null,
  tourLabel: '',
  statusLabel: null,
  ...over,
})

const towns = [
  { slug: 'redmond', name: 'Redmond', activeCount: 257, medianPrice: 595_000, photo: '/r.jpg' },
  { slug: 'bend', name: 'Bend', activeCount: 723, medianPrice: 899_000, photo: '/b.jpg' },
  { slug: 'sunriver', name: 'Sunriver', activeCount: 50, medianPrice: 893_000, photo: null },
  { slug: 'terrebonne', name: 'Terrebonne', activeCount: null, medianPrice: null, photo: null },
]

const communities = [
  { slug: 'eagle-crest', name: 'Eagle Crest', city: 'Redmond', href: '/communities/eagle-crest', photo: '/e.jpg', forSale: 104, medianList: 650_000 },
  { slug: 'sunriver', name: 'Sunriver', city: 'Sunriver', href: '/communities/sunriver', photo: '/s.jpg', forSale: 85, medianList: 772_000 },
  { slug: 'tetherow', name: 'Tetherow', city: 'Bend', href: '/communities/tetherow', photo: '/t.jpg', forSale: 22, medianList: 1_922_500 },
  { slug: 'crosswater', name: 'Crosswater', city: 'Sunriver', href: '/communities/crosswater', photo: '/c.jpg' },
]

describe('homeHeroSearchItems (the front door before a query)', () => {
  const items = homeHeroSearchItems({ towns, communities, homes: [card({})], homesHeading: 'Homes in Bend and nearby' })

  it('leads with the towns, busiest first, each count with its unit and drawn on the group scale', () => {
    const t = items.filter((i) => i.group === 'Towns')
    expect(t.map((i) => i.title)).toEqual(['Bend', 'Redmond', 'Sunriver', 'Terrebonne'])
    expect(t[0]).toMatchObject({ meta: '723 houses for sale', measure: 1, id: '/homes-for-sale/bend' })
    expect(t[1]!.measure).toBeCloseTo(257 / 723)
    expect(t[0]!.preview?.figures).toEqual([
      { value: '723', label: 'houses for sale' },
      { value: '$899,000', label: 'median list price' },
    ])
  })

  it('prints nothing, never a zero, for a town with no published count', () => {
    const terrebonne = items.find((i) => i.title === 'Terrebonne')!
    expect(terrebonne.meta).toBeUndefined()
    expect(terrebonne.measure).toBeUndefined()
    expect(terrebonne.preview?.figures).toEqual([])
  })

  it('lists counted communities only, without the one that shares a town\'s name', () => {
    const c = items.filter((i) => i.group === 'Resorts and communities')
    expect(c.map((i) => i.title)).toEqual(['Eagle Crest', 'Tetherow'])
    expect(c[0]).toMatchObject({ meta: '104 homes for sale', measure: 1, description: 'Redmond' })
    expect(c[1]!.preview?.figures).toEqual([
      { value: '22', label: 'homes for sale' },
      { value: '$1,922,500', label: 'median list price' },
    ])
  })

  it('ends with the shelf\'s homes: photograph, exact ask, facts', () => {
    const h = items.filter((i) => i.group === 'Homes in Bend and nearby')
    expect(h).toHaveLength(1)
    expect(h[0]).toMatchObject({
      id: '/homes-for-sale/bend/k',
      title: '2075 Trenton Avenue',
      meta: '$1,624,900',
      thumb: 'https://cdn.example/p.jpg',
      description: '4 bd · 3 ba · 3,413 sq ft · Bend',
    })
  })

  it('never prints a lease or an unpriced listing as an ask', () => {
    const none = homeHeroSearchItems({
      towns: [],
      communities: [],
      homes: [card({ propertyType: 'G' }), card({ price: null })],
      homesHeading: 'Homes',
    })
    expect(none).toEqual([])
  })
})

describe('homeHeroTypedItem', () => {
  const known = new Map([['bend', { id: '/homes-for-sale/bend', title: 'Bend', group: 'Towns', meta: '723 houses for sale' }]])
  it('returns a known place as its counted row', () => {
    expect(homeHeroTypedItem({ kind: 'city', label: 'Bend', href: '/cities/bend', sublabel: '1044' }, known)).toMatchObject({
      id: '/homes-for-sale/bend',
      meta: '723 houses for sale',
      group: 'Places',
    })
  })
  it('keeps the suggestion\'s own words otherwise, and never a bare count', () => {
    expect(homeHeroTypedItem({ kind: 'city', label: 'Madras', href: '/cities/madras', sublabel: '88' }, known)).toEqual({
      id: '/cities/madras',
      title: 'Madras',
      group: 'Places',
      description: 'City',
    })
    expect(homeHeroTypedItem({ kind: 'address', label: '1 Main St', href: '/homes-for-sale/bend/1-main-st' }, known)).toEqual({
      id: '/homes-for-sale/bend/1-main-st',
      title: '1 Main St',
      group: 'Addresses',
    })
  })
})
