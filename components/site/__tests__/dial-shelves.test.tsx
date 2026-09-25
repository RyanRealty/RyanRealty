/**
 * The shelves that were listing carousels are listing dials (Matt 2026-09-24,
 * "Let's get all of those carousels in place"): the homepage and /cities
 * shelves, the /price-drops and /open-houses folds, the /new-construction
 * lead shelf and the type pages' film.
 *
 * What these hold is the section 0 half of the change: each dial lists the
 * same homes, in the same order, with the same figures and the same doors the
 * carousel did. Server markup only; turning the dial is exercised against a
 * running page.
 */
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { PriceDrop } from '@/lib/data'
import {
  listingRowFromRailCard,
  railCardFromListingRow,
  type HomeRailCard,
  type HomeRailRow,
} from '@/app/_v3/home-rail-items'
import { HomeHomesRails } from '@/app/_v3/HomeHomesRails'
import { priceDropFieldItems } from '@/app/price-drops/_v3/drops-field-items'
import { PriceDropPhotos } from '@/app/price-drops/_v3/PriceDropPhotos.client'
import { openHouseFieldItems } from '@/app/open-houses/_v3/oh-field-items'
import type { OpenHouseListing } from '@/app/open-houses/_v3/oh-listings'
import { dialRailPositionAt } from '@/components/site/v3/dial-rail-position.shim'
import { readListingDialIndex } from '@/components/site/v3/useListingDialIndex'

function card(over: Partial<HomeRailCard> & Pick<HomeRailCard, 'listingKey'>): HomeRailCard {
  return {
    href: `/homes-for-sale/bend/${over.listingKey}`,
    photoUrls: [`https://cdn.resize.sparkplatform.com/ore/800x600/true/${over.listingKey}-o.jpg`],
    price: 649_000,
    addressLine: '1234 NW Portland Ave',
    cityLine: 'Bend 97703',
    beds: 3,
    baths: 2,
    sqft: 1_850,
    pricePerSqft: 351,
    propertyType: 'A',
    propertySubType: 'Single Family Residence',
    subdivisionName: 'Northwest Crossing',
    city: 'Bend',
    listNumber: '220200001',
    badges: [{ kind: 'new', label: 'New' }],
    hasTour: false,
    tourUrl: null,
    tourLabel: '3D Walkthrough',
    statusLabel: null,
    ...over,
  }
}

function hrefs(html: string): string[] {
  return [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!)
}

describe('listingRowFromRailCard', () => {
  it('carries every figure and the door the rail card carried', () => {
    const c = card({ listingKey: 'a', badges: [{ kind: 'drop', label: 'Cut $10K' }], statusLabel: 'Pending' })
    const row = listingRowFromRailCard(c)
    expect(row).toMatchObject({
      listingKey: 'a',
      href: c.href,
      photoUrl: c.photoUrls[0],
      price: 649_000,
      addressLine: c.addressLine,
      cityLine: c.cityLine,
      beds: 3,
      baths: 2,
      sqft: 1_850,
      pricePerSqft: 351,
      propertyType: 'A',
      listNumber: '220200001',
      badges: c.badges,
      statusLabel: 'Pending',
    })
    // The round trip back to a rail card changes nothing the card prints.
    const back = railCardFromListingRow(row)
    expect(back.price).toBe(c.price)
    expect(back.href).toBe(c.href)
    expect(back.badges).toEqual(c.badges)
  })
})

describe('HomeHomesRails on the dial', () => {
  const rows: HomeRailRow[] = [
    {
      id: 'homes-local',
      heading: 'Homes in Bend and nearby',
      seeAll: { href: '/homes-for-sale/bend', label: 'See all homes' },
      cards: [card({ listingKey: 'l1' }), card({ listingKey: 'l2' }), card({ listingKey: 'l3' })],
    },
    {
      id: 'homes-price-cuts',
      heading: 'Price cuts',
      seeAll: { href: '/price-drops', label: 'See price cuts' },
      cards: [card({ listingKey: 'c1' }), card({ listingKey: 'c2' }), card({ listingKey: 'c3' })],
    },
  ]
  const html = renderToStaticMarkup(<HomeHomesRails rows={rows} emptyMessage="none" />)

  it('is one dial per shelf, each under the shelf heading and id it had', () => {
    expect(html.match(/class="[^"]*v3-dial /g)?.length).toBe(2)
    expect(html).toContain('id="homes-local"')
    expect(html).toContain('id="homes-price-cuts"')
    expect(html).toContain('Homes in Bend and nearby')
    expect(html).toContain('Price cuts')
  })

  it('lists every card of every shelf as a link, in shelf order, with each see-all door', () => {
    const links = hrefs(html)
    const order = ['l1', 'l2', 'l3', 'c1', 'c2', 'c3'].map((k) => links.indexOf(`/homes-for-sale/bend/${k}`))
    expect(order.every((i) => i >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(links).toContain('/homes-for-sale/bend')
    expect(links).toContain('/price-drops')
    expect(html).not.toContain('v3-carousel')
  })

  it('prints each ask exactly, never rounded', () => {
    expect(html).toContain('$649,000')
  })

  it('says so when there is nothing to shelve', () => {
    expect(renderToStaticMarkup(<HomeHomesRails rows={[]} emptyMessage="Nothing today." />)).toContain(
      'Nothing today.',
    )
  })
})

describe('dialRailPositionAt (shim until the primitive ships it)', () => {
  it('cycles bottom, left, right by page order so adjacent dials differ', () => {
    expect([0, 1, 2, 3, 4].map(dialRailPositionAt)).toEqual(['bottom', 'left', 'right', 'bottom', 'left'])
    expect(dialRailPositionAt(-1)).toBe('bottom')
    expect(dialRailPositionAt(Number.NaN)).toBe('bottom')
  })
})

describe('readListingDialIndex', () => {
  function root(ids: string[]) {
    return {
      querySelectorAll: () => ids.map((id) => ({ id })),
    } as unknown as ParentNode
  }

  it('reads the index off the selected tab of THIS dial', () => {
    expect(readListingDialIndex(root(['film-tab-3']), 'film', 12)).toBe(3)
  })

  it('ignores another dial, an out-of-range index and a malformed id', () => {
    expect(readListingDialIndex(root(['other-tab-2']), 'film', 12)).toBeNull()
    expect(readListingDialIndex(root(['film-tab-12']), 'film', 12)).toBeNull()
    expect(readListingDialIndex(root(['film-tab-x']), 'film', 12)).toBeNull()
  })
})

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
    photoUrl: 'https://cdn.resize.sparkplatform.com/ore/1600x1200/true/l1-o.jpg',
    beds: 3,
    baths: 2,
    sqft: 1600,
    listPrice: 549_500,
    originalListPrice: 599_000,
    lastDropAmount: 49_500,
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

describe('price drops on the dial', () => {
  const items = priceDropFieldItems([
    drop(),
    drop({ listingKey: 'L2', streetNumber: '600', lastDropPct: 12.1, listPrice: 700_000, originalListPrice: 796_000 }),
  ])

  it('builds the dial row from the same drop, in the same cut-percent order', () => {
    expect(items.map((i) => i.id)).toEqual(['L2', 'L1'])
    expect(items.map((i) => i.listing.listingKey)).toEqual(['L2', 'L1'])
    for (const item of items) {
      expect(item.listing.href).toBe(item.href)
      expect(item.listing.badges).toEqual([{ kind: 'drop', label: item.dropLine }])
    }
    const l1 = items.find((i) => i.id === 'L1')!
    expect(l1.listing.price).toBe(549_500)
    expect(l1.listing.addressLine).toBe('500 Columbia St')
    expect(l1.listing.cityLine).toBe('Bend 97701 · Old Bend')
  })

  it('renders every cut house as a link with its exact ask and its cut', () => {
    const html = renderToStaticMarkup(<PriceDropPhotos id="pd-cuts-all" items={items} label="Cuts" />)
    for (const item of items) expect(hrefs(html)).toContain(item.href)
    expect(html).toContain('$549,500')
    expect(html).toContain('was $599,000, -8.3%')
    expect(html).not.toContain('v3-carousel')
  })
})

describe('open houses on the dial', () => {
  const house: OpenHouseListing = {
    id: 'oh-1',
    listingKey: 'L1',
    listNumber: '220000001',
    eventDate: '2026-08-15',
    startTime: '14:00:00',
    endTime: '16:00:00',
    listPrice: 625_000,
    beds: 3,
    baths: 2,
    sqft: 1800,
    subdivisionName: 'Awbrey Butte',
    propertyType: 'A',
    city: 'Bend',
    state: null,
    postalCode: '97701',
    streetNumber: '123',
    streetName: 'Pine',
    streetSuffix: 'St',
    unparsedAddress: '123 Pine St',
    photoUrl: '/hero.jpg',
    lat: 44.06,
    lng: -121.31,
    href: '/homes-for-sale/bend/123-pine-st-220000001',
  }

  it('puts the day and hours on the photograph in the card words', () => {
    const [item] = openHouseFieldItems([house])
    expect(item!.listing.badges).toEqual([{ kind: 'open', label: item!.when }])
    expect(item!.listing.href).toBe(item!.href)
    expect(item!.listing.price).toBe(625_000)
    expect(item!.listing.propertyType).toBe('A')
  })
})
