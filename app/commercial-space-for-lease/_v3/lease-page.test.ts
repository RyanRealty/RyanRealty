import { describe, expect, it } from 'vitest'
import type { ListingTile } from '@/lib/data'
import {
  LEASE_PAGE_HEADING,
  leaseCityGroups,
  leaseCityLedgerRows,
  leaseItemList,
  LEASE_META_MAX,
  leaseMetaDescription,
  leaseTotal,
} from './lease-page'

function tile(over: Partial<ListingTile> & Pick<ListingTile, 'listingKey'>): ListingTile {
  return {
    listNumber: '220221425',
    status: 'Active',
    listPrice: 1.4,
    closePrice: null,
    closeDate: null,
    beds: null,
    baths: null,
    sqft: 480,
    streetNumber: '671',
    streetName: 'Greenwood',
    streetSuffix: 'Ave',
    city: 'Bend',
    citySlug: 'bend',
    postalCode: '97701',
    subdivisionName: null,
    subdivisionSlug: null,
    lat: 44.06,
    lng: -121.3,
    photoUrl: 'https://cdn.example/lease.jpg',
    propertyType: 'G',
    propertySubType: null,
    onMarketDate: null,
    modifiedAt: null,
    pricePerSqft: null,
    lotSizeAcres: null,
    yearBuilt: null,
    garageSpaces: null,
    poolYn: null,
    hasVirtualTour: null,
    tourUrl: null,
    dom: 4,
    priceDropCount: null,
    addressSlug: '671-greenwood-ave',
    boundaryCity: 'Bend',
    boundaryNeighborhood: null,
    boundarySubdivision: null,
    ...over,
  }
}

const TILES = [
  tile({ listingKey: 'r1', city: 'Redmond', listPrice: 1.75, streetNumber: '10', streetName: 'Sixth' }),
  tile({ listingKey: 'b1', listPrice: 1.4 }),
  tile({ listingKey: 'b2', listPrice: 0.9, streetNumber: '20' }),
  tile({ listingKey: 'b3', listPrice: 985, streetNumber: '30' }),
  tile({ listingKey: 'b4', listPrice: 3000, streetNumber: '65315', streetName: 'Highway 97' }),
  tile({ listingKey: 'pb1', city: 'Powell Butte', listPrice: 3.33, streetNumber: '40' }),
  tile({ listingKey: 'sale-1', propertyType: 'A', listPrice: 650_000, streetNumber: '50' }),
  tile({ listingKey: 'b1', listPrice: 1.4 }),
]
const UNITS = {
  r1: '$/SF/Mo',
  b1: '$/SF/Mo',
  b2: '$/SF/Mo',
  b3: '$ Amt/Mo',
  // 65315 Highway 97, Bend: a whole-space amount filed as $/SF/Mo.
  b4: '$/SF/Mo',
  pb1: '$/SF/Mo',
}

describe('leaseCityGroups', () => {
  const groups = leaseCityGroups(TILES, UNITS)

  it('groups leases by town in the site order, each lease once, sales left out', () => {
    expect(groups.map((g) => g.label)).toEqual(['Bend', 'Redmond', 'Powell Butte'])
    expect(groups[0]!.rows.map((r) => r.listingKey)).toEqual(['b1', 'b2', 'b3', 'b4'])
    expect(leaseTotal(groups)).toBe(6)
  })

  it('counts each town for lease, anchors it, and doors it to its own page', () => {
    const bend = groups[0]!
    expect(bend.countLabel).toBe('4 for lease')
    expect(bend.anchor).toBe('lease-bend')
    expect(bend.cityHref).toBe('/cities/bend')
    expect(groups[2]!.slug).toBe('powell-butte')
    expect(groups[2]!.cityHref).toBe('/cities/powell-butte')
  })

  it('gives each town a rate line that covers every lease it counts, never mixing or converting units', () => {
    // 0.90 and 1.40 publish per sq ft per month; 985 is a monthly amount for
    // the space; 3000 contradicts its own unit and is counted as not published.
    expect(groups[0]!.rateSummary).toBe(
      '2 from $0.90 to $1.40 per sq ft per month · 1 at $985 per month · 1 rate not published',
    )
    expect(groups[1]!.rateSummary).toBe('$1.75 per sq ft per month')
  })

  it('says a town\'s rates are not published rather than dropping the line', () => {
    const [town] = leaseCityGroups([tile({ listingKey: 'x1', city: 'Sisters', listPrice: 1.25 })], {})
    expect(town!.rateSummary).toBe('Lease rate not published')
  })

  it('carries each lease its unit so the card prints the rent with it', () => {
    expect(groups[0]!.rows.find((r) => r.listingKey === 'b3')!.leaseRateOption).toBe('$ Amt/Mo')
  })

  it('is empty when nothing is listed', () => {
    expect(leaseCityGroups([], {})).toEqual([])
    expect(leaseCityGroups([tile({ listingKey: 'sale', propertyType: 'A' })], {})).toEqual([])
  })
})

describe('leaseCityLedgerRows', () => {
  it('draws each town\'s count as a share of the busiest town and links to its dial', () => {
    const rows = leaseCityLedgerRows(leaseCityGroups(TILES, UNITS))
    expect(rows[0]).toEqual({
      href: '#lease-bend',
      what: 'Bend',
      value: '4 for lease',
      weight: 1,
      detail: '2 from $0.90 to $1.40 per sq ft per month · 1 at $985 per month · 1 rate not published',
    })
    expect(rows[1]!.weight).toBe(0.25)
  })
})

describe('leaseItemList', () => {
  const list = leaseItemList(leaseCityGroups(TILES, UNITS), 'https://ryan-realty.com')!

  it('names every lease with its rent in words and never carries a price', () => {
    expect(list.type).toBe('itemList')
    expect(list.name).toBe(LEASE_PAGE_HEADING)
    expect(list.items).toHaveLength(6)
    expect(list.items[0]!.name).toBe('671 Greenwood Ave, Bend · for lease at $1.40 per sq ft per month')
    expect(list.items[0]!.url.startsWith('https://ryan-realty.com/')).toBe(true)
    const highway = list.items.find((i) => i.name.startsWith('65315 Highway 97'))!
    expect(highway.name).toContain('lease rate not published')
    for (const item of list.items) {
      expect(Object.keys(item).sort()).toEqual(['name', 'url'])
    }
  })

  it('is null with nothing to list', () => {
    expect(leaseItemList([], 'https://ryan-realty.com')).toBeNull()
  })
})

describe('leaseMetaDescription', () => {
  it('names the busiest towns that have a lease today', () => {
    expect(leaseMetaDescription(leaseCityGroups(TILES, UNITS))).toBe(
      'Commercial space for lease in Bend, Powell Butte and Redmond, each with its asking rent and unit from the regional MLS. Talk to a Ryan Realty broker.',
    )
  })

  it('names fewer towns rather than overrun the snippet budget', () => {
    const many = ['Bend', 'Redmond', 'Prineville', 'Madras', 'Sisters', 'Powell Butte'].flatMap((city, i) =>
      Array.from({ length: 6 - i }, (_, j) =>
        tile({ listingKey: `${city}-${j}`, city, streetNumber: String(100 + j) }),
      ),
    )
    const text = leaseMetaDescription(leaseCityGroups(many, {}))
    expect(text.length).toBeLessThanOrEqual(LEASE_META_MAX)
    expect(text.startsWith('Commercial space for lease in Bend, Redmond')).toBe(true)
    expect(text.endsWith('Talk to a Ryan Realty broker.')).toBe(true)
  })

  it('names no town when none has a lease', () => {
    expect(leaseMetaDescription([])).not.toMatch(/Bend|Redmond/)
    expect(leaseMetaDescription([]).length).toBeLessThanOrEqual(LEASE_META_MAX)
  })

  it('never uses an em dash', () => {
    expect(leaseMetaDescription(leaseCityGroups(TILES, UNITS))).not.toContain('\u2014')
    expect(leaseMetaDescription([])).not.toContain('\u2014')
  })
})
