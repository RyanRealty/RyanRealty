import { describe, expect, it } from 'vitest'
import type { ListingTile } from '@/lib/data'
import {
  LEASE_PAGE_HEADING,
  leaseCityGroups,
  leaseCityLedgerRows,
  leaseLedgerNote,
  leaseTownReveal,
  leaseItemList,
  LEASE_META_MAX,
  leaseMetaDescription,
  leaseTotal,
  LEASE_DIAL_MIN,
  leaseCompactHeading,
  leaseCompactNote,
  leaseMapPoints,
  leaseMapTowns,
  leaseTownTiers,
  leaseRowsLargestFirst,
  leaseRentStrips,
  leaseTownLargest,
  leaseTownSize,
  leaseLedgerKey,
} from './lease-page'
import { leaseMapModel } from './lease-map'

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
    const { reveal, media, also, ...rest } = rows[0]!
    // The line under the bar: the square feet Bend's four leases list, the
    // most of any town, so the longest line (2026-09-30, "no second encoding").
    expect(also).toEqual({ weight: 1, value: '1,920 sq ft' })
    expect(rows[1]!.also).toEqual({ weight: 0.25, value: '480 sq ft' })
    expect(rest).toEqual({
      href: '#lease-bend',
      what: 'Bend',
      value: '4 for lease',
      weight: 1,
      detail: '2 from $0.90 to $1.40 per sq ft per month\n1 at $985 per month\n1 rate not published',
    })
    // The hover line is the rows' own kinds and sizes (leaseTownReveal).
    expect(reveal).toBe(leaseTownReveal(leaseCityGroups(TILES, UNITS)[0]!.rows) ?? undefined)
    // The row's picture is one of the town's own photographed leases, or none.
    const photos = leaseCityGroups(TILES, UNITS)[0]!.rows.map((r) => r.photoUrl).filter(Boolean)
    if (photos.length > 0) expect(media?.src).toBeTruthy()
    else expect(media).toBeUndefined()
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

describe('leaseTownReveal', () => {
  const row = (propertySubType: string | null, sqft: number | null) =>
    ({ propertySubType, sqft }) as unknown as Parameters<typeof leaseTownReveal>[0][number]
  it('names the kinds of space, most first, and the span of listed sizes', () => {
    expect(leaseTownReveal([row('Office', 1200), row('Retail', 800), row('Office', 12000)])).toBe(
      'Office 2 · Retail 1; 800 to 12,000 sq ft',
    )
  })
  it('says how many list a size when some do not, and nothing when none carry either', () => {
    expect(leaseTownReveal([row('Office', 1500), row('Office', null)])).toBe('Office 2; 1,500 sq ft (1 lists a size)')
    expect(leaseTownReveal([row(null, null)])).toBeNull()
  })
})

describe('leaseLedgerNote', () => {
  it('states the count, the towns and the square feet listed between them', () => {
    const groups = leaseCityGroups(TILES, UNITS)
    expect(leaseLedgerNote(groups)).toBe('6 spaces for lease in 3 towns, 2,880 sq ft listed between them.')
  })
  it('says how many list no size, so the sum never reads as every space', () => {
    const tiles = [tile({ listingKey: 'a', sqft: 1000 }), tile({ listingKey: 'b', sqft: null, streetNumber: '2' })]
    expect(leaseLedgerNote(leaseCityGroups(tiles, {}))).toBe(
      '2 spaces for lease in Bend, 1,000 sq ft listed between them (1 lists no size).',
    )
    const none = [tile({ listingKey: 'c', sqft: null })]
    expect(leaseLedgerNote(leaseCityGroups(none, {}))).toBe('1 space for lease in Bend.')
  })
  it('is null with nothing listed', () => {
    expect(leaseLedgerNote([])).toBeNull()
  })
})

describe('leaseLedgerKey', () => {
  it('keys the bar and, when any space lists a size, the line under it', () => {
    expect(leaseLedgerKey(leaseCityGroups(TILES, UNITS))).toEqual({
      value: 'Spaces for lease',
      also: 'Square feet listed',
    })
    expect(leaseLedgerKey(leaseCityGroups([tile({ listingKey: 'n', sqft: null })], {}))).toEqual({
      value: 'Spaces for lease',
    })
  })
})

describe('leaseRowsLargestFirst (2026-09-30: the lead card by a rule, never a hand-picked listing)', () => {
  const units = { s: '$/SF/Mo', m: '$/SF/Mo', l: '$/SF/Mo', u: '$/SF/Mo', w: undefined as unknown as string }
  const tiles = [
    tile({ listingKey: 's', sqft: 480, streetNumber: '1' }),
    tile({ listingKey: 'w', sqft: 53_874, streetNumber: '2' }),
    tile({ listingKey: 'u', sqft: null, streetNumber: '3' }),
    tile({ listingKey: 'l', sqft: 11_250, streetNumber: '4' }),
    tile({ listingKey: 'm', sqft: 3_578, streetNumber: '5' }),
  ]
  it('opens on the largest space whose rent publishes; unsized after; unpublished rents last', () => {
    const [bend] = leaseCityGroups(tiles, units)
    expect(bend!.rows.map((r) => r.listingKey)).toEqual(['l', 'm', 's', 'u', 'w'])
  })
  it('keeps the given order between equal sizes', () => {
    const rows = leaseCityGroups(tiles, units)[0]!.rows
    const same = rows.map((r) => ({ ...r, sqft: 1000 }))
    expect(leaseRowsLargestFirst(same).map((r) => r.listingKey)).toEqual(['l', 'm', 's', 'u', 'w'])
  })
  it('puts a space with no photograph of it after the photographed ones in its rent group (2026-10-01)', () => {
    // 'l' (the largest priced space) files no photograph: the dial opens on 'm'.
    const [bend] = leaseCityGroups(tiles, units, {}, { l: null })
    expect(bend!.rows.map((r) => r.listingKey)).toEqual(['m', 's', 'u', 'l', 'w'])
  })
})

describe('the lead photograph (getLeaseLeadPhotos, 2026-10-01)', () => {
  const tiles = [
    tile({ listingKey: 'plan', sqft: 36_000, photoUrl: 'https://cdn.example/lot-lines.jpg' }),
    tile({ listingKey: 'suite', sqft: 9_600, photoUrl: 'https://cdn.example/aerial.jpg' }),
    tile({ listingKey: 'unread', sqft: 1_200, photoUrl: 'https://cdn.example/front.jpg' }),
  ]
  const units = { plan: '$/SF/Mo', suite: '$/SF/Mo', unread: '$/SF/Mo' }
  const [town] = leaseCityGroups(tiles, units, {}, { plan: null, suite: 'https://cdn.example/suite-203.jpg' })
  const byKey = new Map(town!.rows.map((r) => [r.listingKey, r]))
  it('replaces the tile photo with the lead photograph, or none when the listing files none', () => {
    expect(byKey.get('plan')!.photoUrl).toBeNull()
    expect(byKey.get('suite')!.photoUrl).toBe('https://cdn.example/suite-203.jpg')
  })
  it('keeps the tile photo for a lease the photo read did not return', () => {
    expect(byKey.get('unread')!.photoUrl).toBe('https://cdn.example/front.jpg')
  })
  it('names the largest space without a picture when it files no photograph of itself', () => {
    const largest = leaseTownLargest(town!)!
    expect(largest.row.listingKey).toBe('plan')
    expect(largest.photo).toBeNull()
  })
})

describe('leaseTownSize and leaseTownLargest', () => {
  const tiles = [
    tile({ listingKey: 'a', sqft: 1200, streetNumber: '10', streetName: 'Main' }),
    tile({ listingKey: 'b', sqft: 36_000, streetNumber: '330', streetName: 'Evergreen', photoUrl: null }),
    tile({ listingKey: 'c', sqft: null, streetNumber: '12' }),
  ]
  const [town] = leaseCityGroups(tiles, { a: '$/SF/Mo', b: '$/SF/Mo', c: '$/SF/Mo' })
  it('sums the sizes the leases list and counts them', () => {
    expect(leaseTownSize(town!.rows)).toEqual({ sqft: 37_200, sized: 2 })
  })
  it('names the largest listed space, with no photograph when it has none', () => {
    const largest = leaseTownLargest(town!)!
    expect(largest.sqft).toBe(36_000)
    expect(largest.row.listingKey).toBe('b')
    expect(largest.photo).toBeNull()
  })
  it('is null when no lease lists a size', () => {
    const [none] = leaseCityGroups([tile({ listingKey: 'z', sqft: null })], {})
    expect(leaseTownLargest(none!)).toBeNull()
  })
})

describe('leaseRentStrips', () => {
  it('plots only rents filed and published per sq ft per month, on one axis for every town', () => {
    const model = leaseRentStrips(leaseCityGroups(TILES, UNITS))!
    // 3.33 is the top rent, so the axis ends at the next half dollar.
    expect(model.max).toBe(3.5)
    expect(model.ticks.map((t) => t.label)).toEqual(['$1', '$2', '$3'])
    // Bend: 0.90 and 1.40 plot; $985 per month and the contradicted 3000 do not.
    expect(model.dots.bend!.map((d) => d.rate).sort()).toEqual([0.9, 1.4])
    expect(model.dots['powell-butte']!.map((d) => d.x)).toEqual([95.14])
  })
  it('draws a lease that lists no size as a ring (no diameter)', () => {
    const tiles = [tile({ listingKey: 'a', sqft: null }), tile({ listingKey: 'b', sqft: 5000, streetNumber: '2' })]
    const model = leaseRentStrips(leaseCityGroups(tiles, { a: '$/SF/Mo', b: '$/SF/Mo' }))!
    const byKey = Object.fromEntries(model.dots.bend!.map((d) => [d.key, d]))
    expect(byKey.a!.d).toBeNull()
    expect(byKey.b!.d).toBeGreaterThan(0)
  })
  it('is null when nothing plots', () => {
    expect(leaseRentStrips(leaseCityGroups([tile({ listingKey: 'x', listPrice: 985 })], { x: '$ Amt/Mo' }))).toBeNull()
  })
})

describe('leaseTownTiers (2026-09-30: every town the same dial block)', () => {
  const many = (city: string, n: number, prefix: string) =>
    Array.from({ length: n }, (_, i) =>
      tile({ listingKey: `${prefix}${i}`, city, streetNumber: String(100 + i), lat: 44.2 + i / 1000, lng: -121.1 }),
    )
  const units = (tiles: ListingTile[]) => Object.fromEntries(tiles.map((t) => [t.listingKey, '$/SF/Mo']))

  it('the busiest town leads; the rest follow busiest first, ties in the page order', () => {
    const tiles = [
      ...many('Sisters', 3, 's'),
      ...many('Redmond', LEASE_DIAL_MIN, 'r'),
      ...many('Bend', 6, 'b'),
      ...many('Madras', 3, 'm'),
      ...many('Powell Butte', 1, 'p'),
    ]
    const groups = leaseCityGroups(tiles, units(tiles))
    const { lead, rest } = leaseTownTiers(groups)
    expect(lead!.label).toBe('Bend')
    expect(rest.map((g) => g.label)).toEqual(
      ['Redmond', ...groups.filter((g) => g.rows.length === 3).map((g) => g.label), 'Powell Butte'],
    )
  })

  it('nothing listed, nothing to lead', () => {
    expect(leaseTownTiers([])).toEqual({ lead: null, rest: [] })
  })

  it('names the other towns and counts their spaces', () => {
    const tiles = [...many('Sisters', 3, 's'), ...many('Madras', 1, 'm'), ...many('Bend', 9, 'b')]
    const { rest } = leaseTownTiers(leaseCityGroups(tiles, units(tiles)))
    expect(leaseCompactHeading(rest)).toBe('Also for lease in Sisters and Madras')
    expect(leaseCompactNote(rest)).toBe(
      "4 spaces in 2 more towns, busiest first. Each dot is one space's asking rent per sq ft per month, drawn to its size, on one scale for every town. Open a town for its spaces, each with its rent and its terms.",
    )
  })
})

describe('the lease map (2026-09-30: no map on a page about geography)', () => {
  const groups = leaseCityGroups(TILES, UNITS)
  const points = leaseMapPoints(groups)

  it('every lease with coordinates is one dot, labelled with its rent in its unit', () => {
    expect(points.map((p) => p.key).sort()).toEqual(['b1', 'b2', 'b3', 'b4', 'pb1', 'r1'])
    const b1 = points.find((p) => p.key === 'b1')!
    expect(b1.label).toContain('/sq ft/mo')
    expect(b1.label).toContain('480 sq ft')
    // 65315 Highway 97: a whole-space amount filed per sq ft is never printed as a rate.
    expect(points.find((p) => p.key === 'b4')!.label).toContain('Lease rate not published')
    for (const p of points) expect(p.label).not.toMatch(/\$\d[\d,.]*(?!\/)(\s|$)/)
  })

  it('pairs each dot and town with its ledger row by order', () => {
    const towns = leaseMapTowns(groups)
    const ledger = leaseCityLedgerRows(groups)
    towns.forEach((town, i) => {
      expect(town.row).toBe(i + 1)
      expect(town.href).toBe(ledger[i]!.href)
      expect(town.countLabel).toBe(ledger[i]!.value)
    })
    for (const p of points) expect(towns.find((t) => t.slug === p.town)!.row).toBe(p.row)
  })

  it('projects inside the frame, sizes by square feet, and draws a ring for a lease with no size', () => {
    const withUnsized = [...TILES, tile({ listingKey: 'b9', sqft: null, streetNumber: '90', lat: 44.1, lng: -121.25 })]
    const g = leaseCityGroups(withUnsized, { ...UNITS, b9: '$/SF/Mo' })
    const model = leaseMapModel(leaseMapPoints(g), leaseMapTowns(g), null)!
    expect(model.dots).toHaveLength(7)
    for (const dot of model.dots) {
      expect(dot.x).toBeGreaterThanOrEqual(0)
      expect(dot.x).toBeLessThanOrEqual(100)
      expect(dot.y).toBeGreaterThanOrEqual(0)
      expect(dot.y).toBeLessThanOrEqual(100)
    }
    expect(model.dots.find((d) => d.key === 'b9')!.unsized).toBe(true)
    expect(model.unsizedCount).toBe(1)
    expect(model.sizeRange).toEqual(expect.objectContaining({ min: 480, max: 480 }))
    expect(model.towns.map((t) => t.label)).toEqual(g.map((x) => x.label))
  })

  it('draws no map when no lease carries coordinates', () => {
    const g = leaseCityGroups([tile({ listingKey: 'x', lat: null, lng: null })], { x: '$/SF/Mo' })
    expect(leaseMapModel(leaseMapPoints(g), leaseMapTowns(g), null)).toBeNull()
  })
})
