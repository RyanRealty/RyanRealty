import { describe, it, expect } from 'vitest'
import {
  buildJsonLd,
  listingItemList,
  listingItemListFromHomes,
  listingItemListFromPhotoCards,
  LISTING_ITEM_LIST_CAP,
} from './json-ld'

const rec = (v: unknown) => v as Record<string, unknown> | undefined

// buildJsonLd is the JSON-LD source for listings, breadcrumbs, FAQ, datasets, and
// places (rich results + AI citation). The offer rule is data-accuracy/honesty:
// an off-market home must NOT advertise a live purchasable price. Audit p3.2.
describe('buildJsonLd', () => {
  describe('realEstateListing offers (a sold/pending home is not for sale)', () => {
    const base = { type: 'realEstateListing', name: '123 Main St', listPrice: 750000 } as const

    it('publishes RealEstateListing, not a residence type Google will not treat as a listing', () => {
      expect(buildJsonLd(base)['@type']).toBe('RealEstateListing')
    })

    it('names bedrooms on the machine node so a bed-count query can match (SITE-99)', () => {
      const node = buildJsonLd({ ...base, beds: 4, baths: 3 })
      expect(node.numberOfBedrooms).toBe(4)
      expect(node.numberOfRooms).toBe(4)
      expect(node.numberOfBathroomsTotal).toBe(3)
    })

    it('Active -> InStock offer at the list price', () => {
      const offer = rec(buildJsonLd({ ...base, availability: 'Active' }).offers)
      expect(offer).toMatchObject({
        '@type': 'Offer',
        price: 750000,
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
      })
    })
    it('no availability defaults to InStock (backwards-compatible)', () => {
      expect(rec(buildJsonLd(base).offers)?.availability).toBe('https://schema.org/InStock')
    })
    it('Active Under Contract -> PreOrder', () => {
      expect(
        rec(buildJsonLd({ ...base, availability: 'Active Under Contract' }).offers)?.availability,
      ).toBe('https://schema.org/PreOrder')
    })
    it('off-market statuses emit NO offer', () => {
      for (const s of ['Closed', 'Pending', 'Withdrawn', 'Expired', 'Canceled']) {
        expect(buildJsonLd({ ...base, availability: s }).offers).toBeUndefined()
      }
    })
    // Coming Soon is a pre-marketing state that must never reach a public
    // surface, so it emits no structured data at all. Critically it must NOT
    // fall through to the InStock default, which would advertise a listing we
    // are not permitted to show as purchasable. See lib/listing-status-public.ts.
    it('Coming Soon emits NO offer (never InStock)', () => {
      for (const s of ['Coming Soon', 'coming soon', 'ComingSoon']) {
        expect(buildJsonLd({ ...base, availability: s }).offers).toBeUndefined()
      }
    })
    it('no list price -> no offer', () => {
      expect(buildJsonLd({ type: 'realEstateListing', name: 'X' }).offers).toBeUndefined()
    })
  })

  // SITE-20. Dropping the Offer is right; dropping the FACT with it is not. On
  // 55550 Heidi Court (MLS 220219603, Closed) the emitted node carried a
  // $1,250,000 description, no offers node and no availability — nothing
  // machine-readable said the home had sold.
  describe('realEstateListing node availability (the fact survives the dropped Offer)', () => {
    const base = { type: 'realEstateListing', name: '123 Main St', listPrice: 750000 } as const

    it('Closed states SoldOut on the node and still emits no Offer', () => {
      const node = buildJsonLd({ ...base, availability: 'Closed' })
      expect(node.availability).toBe('https://schema.org/SoldOut')
      expect(node.offers).toBeUndefined()
    })

    it.each(['Withdrawn', 'Expired', 'Canceled'])('%s states OutOfStock and no Offer', (s) => {
      const node = buildJsonLd({ ...base, availability: s })
      expect(node.availability).toBe('https://schema.org/OutOfStock')
      expect(node.offers).toBeUndefined()
    })

    it('the node and the Offer agree on the on-market statuses', () => {
      const active = buildJsonLd({ ...base, availability: 'Active' })
      expect(active.availability).toBe('https://schema.org/InStock')
      expect(rec(active.offers)?.availability).toBe('https://schema.org/InStock')
      const auc = buildJsonLd({ ...base, availability: 'Active Under Contract' })
      expect(auc.availability).toBe('https://schema.org/PreOrder')
      expect(rec(auc.offers)?.availability).toBe('https://schema.org/PreOrder')
    })

    it('Coming Soon states nothing at all', () => {
      const node = buildJsonLd({ ...base, availability: 'Coming Soon' })
      expect(node.availability).toBeUndefined()
      expect(node.offers).toBeUndefined()
    })
  })

  it('breadcrumb numbers positions from 1 and absolutizes item URLs', () => {
    const r = buildJsonLd({
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Bend', url: '/bend' },
      ],
    })
    expect(r['@type']).toBe('BreadcrumbList')
    const items = r.itemListElement as Array<Record<string, unknown>>
    expect(items[0]).toMatchObject({ position: 1, name: 'Home' })
    expect(items[1]).toMatchObject({ position: 2, name: 'Bend' })
    expect(items[1].item).toMatch(/^https?:\/\/.+\/bend$/)
  })

  it('faqPage maps to Question / acceptedAnswer', () => {
    const r = buildJsonLd({ type: 'faqPage', items: [{ question: 'Q1?', answer: 'A1.' }] })
    expect(r['@type']).toBe('FAQPage')
    expect((r.mainEntity as Array<Record<string, unknown>>)[0]).toMatchObject({
      '@type': 'Question',
      name: 'Q1?',
      acceptedAnswer: { '@type': 'Answer', text: 'A1.' },
    })
  })

  it('dataset variableMeasured maps StatValue -> PropertyValue and prunes empty unitText', () => {
    const r = buildJsonLd({
      type: 'dataset',
      name: 'Bend market',
      description: 'Live single-family market statistics',
      variableMeasured: [
        { name: 'Active Listings', value: 88 },
        { name: 'Median List Price', value: 650000, unitText: 'USD' },
      ],
    })
    const vars = r.variableMeasured as Array<Record<string, unknown>>
    expect(vars[0]).toMatchObject({ '@type': 'PropertyValue', name: 'Active Listings', value: 88 })
    expect(vars[0].unitText).toBeUndefined()
    expect(vars[1]).toMatchObject({ name: 'Median List Price', value: 650000, unitText: 'USD' })
  })

  it('prune drops null/undefined fields (webPage without description)', () => {
    const r = buildJsonLd({ type: 'webPage', name: 'About' })
    expect(r.name).toBe('About')
    expect('description' in r).toBe(false)
  })

  it('webPage belongs to the sitewide WebSite node by @id', () => {
    const r = buildJsonLd({ type: 'webPage', name: 'Team', url: '/team', aboutOrganization: true })
    expect(rec(r.isPartOf)?.['@id']).toMatch(/#website$/)
    expect(rec(r.mainEntity)?.['@id']).toMatch(/#organization$/)
  })

  it('already-absolute URLs pass through unchanged', () => {
    const r = buildJsonLd({ type: 'article', headline: 'H', url: 'https://example.com/x' })
    expect(r.url).toBe('https://example.com/x')
  })

  it('service points provider at #organization and names the area', () => {
    const r = buildJsonLd({
      type: 'service',
      name: 'Value my home',
      serviceType: 'Comparative market analysis',
      url: '/sell/valuation',
      areaServed: 'Bend, Oregon',
      providerOrganization: true,
    })
    expect(r['@type']).toBe('Service')
    expect(r.name).toBe('Value my home')
    expect(r.serviceType).toBe('Comparative market analysis')
    expect(rec(r.provider)?.['@id']).toMatch(/#organization$/)
    expect(rec(r.areaServed)).toMatchObject({ '@type': 'Place', name: 'Bend, Oregon' })
    expect(String(r.url)).toMatch(/\/sell\/valuation$/)
  })
})

describe('listingItemList', () => {
  it('withholds an empty set and builds ItemList input otherwise', () => {
    expect(listingItemList('Homes for sale in Bend', [])).toBeNull()
    expect(
      listingItemList('Homes for sale in Bend', [
        { name: '$750,000 · 1 Main St', url: '/homes-for-sale/bend/1-main-st-2201' },
      ]),
    ).toEqual({
      type: 'itemList',
      name: 'Homes for sale in Bend',
      items: [{ name: '$750,000 · 1 Main St', url: '/homes-for-sale/bend/1-main-st-2201' }],
    })
  })

  it('drops browse URLs that are not listing canonicals', () => {
    expect(
      listingItemList('Homes for sale in Bend', [
        { name: 'Bend', url: '/homes-for-sale/bend' },
        { name: 'Tetherow', url: '/homes-for-sale/bend/tetherow' },
      ]),
    ).toBeNull()
  })

  it(`caps at the homepage rail (${LISTING_ITEM_LIST_CAP})`, () => {
    const items = Array.from({ length: LISTING_ITEM_LIST_CAP + 3 }, (_, i) => ({
      name: `$${i + 1} Main`,
      url: `/homes-for-sale/bend/${i + 1}-main-st-220${i + 1}`,
    }))
    expect(listingItemList('Homes for sale in Bend', items)?.items).toHaveLength(LISTING_ITEM_LIST_CAP)
  })

  it('buildJsonLd emits absolute listing URLs', () => {
    const input = listingItemList('Homes for sale in Bend', [
      { name: '$750,000 · 1 Main St', url: '/homes-for-sale/bend/1-main-st-2201' },
    ])
    expect(input).not.toBeNull()
    const json = buildJsonLd(input!)
    expect(json['@type']).toBe('ItemList')
    const elements = json.itemListElement as Array<{ url: string; name: string }>
    expect(elements[0]?.url).toMatch(/\/homes-for-sale\/bend\/1-main-st-2201$/)
    expect(elements[0]?.name).toBe('$750,000 · 1 Main St')
  })
})

describe('listingItemListFromPhotoCards', () => {
  it('names price and street from the photographed card', () => {
    const list = listingItemListFromPhotoCards('Homes for sale in Bend', [
      { href: '/homes-for-sale/bend/1-main-st-2201', title: '1 Main St', price: '$795k' },
    ])
    expect(list?.items[0]).toEqual({
      name: '$795k · 1 Main St',
      url: '/homes-for-sale/bend/1-main-st-2201',
    })
  })

  it('withholds when no photographed cards exist', () => {
    expect(listingItemListFromPhotoCards('Homes for sale in Bend', [])).toBeNull()
  })
})

describe('listingItemListFromHomes', () => {
  const home = {
    href: '/homes-for-sale/bend/tetherow/1-tetherow-rd-2201',
    addressLine: '1 Tetherow Rd',
    price: 750000,
    propertyType: 'Residential',
    photoUrl: 'https://example.com/a.jpg',
  }

  it('withholds homes without a photograph', () => {
    expect(
      listingItemListFromHomes('Homes for sale in Tetherow', [{ ...home, photoUrl: null }]),
    ).toBeNull()
  })

  it('names the published ask and street', () => {
    const list = listingItemListFromHomes('Homes for sale in Tetherow', [home])
    expect(list?.items[0]?.name).toBe('$750,000 · 1 Tetherow Rd')
    expect(list?.items[0]?.url).toBe('/homes-for-sale/bend/tetherow/1-tetherow-rd-2201')
  })
})
