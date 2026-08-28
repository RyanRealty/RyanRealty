import { describe, it, expect } from 'vitest'
import type { UpcomingOpenHouseRow } from '@/lib/data'
import type { ListingTile } from '@/lib/data/types/listing'
import { assembleOpenHouses, medianPositive } from '@/app/open-houses/_v3/oh-listings'
import { formatClock, openHouseWhen } from '@/app/open-houses/_v3/oh-when'
import { openHouseFieldItems } from '@/app/open-houses/_v3/oh-field-items'
import { addIsoDays, thisWeekendIso } from '@/app/open-houses/_v3/oh-constants'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { OpenHouseListing } from '@/app/open-houses/_v3/oh-listings'

function row(over: Partial<UpcomingOpenHouseRow> = {}): UpcomingOpenHouseRow {
  return {
    id: 'oh-1',
    open_house_key: 'k1',
    listing_key: 'L1',
    event_date: '2026-08-15',
    start_time: '14:00:00',
    end_time: '16:00:00',
    host_agent_name: null,
    remarks: null,
    rsvp_count: 0,
    ...over,
  }
}

function tile(over: Partial<ListingTile> = {}): ListingTile {
  return {
    listingKey: 'L1',
    listNumber: '220000001',
    status: 'Active',
    listPrice: 625_000,
    closePrice: null,
    closeDate: null,
    beds: 3,
    baths: 2,
    sqft: 1800,
    streetNumber: '123',
    streetName: 'Pine',
    streetSuffix: 'St',
    city: 'Bend',
    citySlug: 'bend',
    postalCode: '97701',
    subdivisionName: 'Awbrey Butte',
    subdivisionSlug: 'awbrey-butte',
    lat: 44.06,
    lng: -121.31,
    photoUrl: '/p.jpg',
    propertyType: 'A',
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
    dom: 12,
    priceDropCount: null,
    addressSlug: null,
    boundaryCity: 'Bend',
    boundaryNeighborhood: null,
    boundarySubdivision: null,
    ...over,
  } as ListingTile
}

function house(over: Partial<OpenHouseListing> = {}): OpenHouseListing {
  return {
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
    city: 'Bend',
    state: null,
    postalCode: '97701',
    streetNumber: '123',
    streetName: 'Pine',
    streetSuffix: 'St',
    unparsedAddress: '123 Pine St',
    photoUrl: null,
    lat: 44.06,
    lng: -121.31,
    href: '/homes-for-sale/bend/123-pine-st-220000001',
    ...over,
  }
}

describe('assembleOpenHouses', () => {
  it('joins a tile and prefers the hero photo', () => {
    const heroes = new Map([['L1', '/hero.jpg']])
    const out = assembleOpenHouses([row()], [tile()], heroes)
    expect(out).toHaveLength(1)
    expect(out[0].photoUrl).toBe('/hero.jpg')
    expect(out[0].unparsedAddress).toBe('123 Pine')
    expect(out[0].href).toContain('220000001')
  })

  it('drops rows that fail the city filter', () => {
    const out = assembleOpenHouses([row()], [tile()], new Map(), { city: 'Redmond' })
    expect(out).toHaveLength(0)
  })

  it('drops rows below minPrice', () => {
    const out = assembleOpenHouses([row()], [tile({ listPrice: 400_000 })], new Map(), {
      minPrice: 500_000,
    })
    expect(out).toHaveLength(0)
  })
})

describe('medianPositive', () => {
  it('returns null when nothing is positive', () => {
    expect(medianPositive([null, 0, -1])).toBeNull()
  })

  it('returns the middle of an odd set', () => {
    expect(medianPositive([3, 1, 2])).toBe(2)
  })
})

describe('formatClock', () => {
  it('returns empty for empty input', () => {
    expect(formatClock('')).toBe('')
    expect(formatClock(null)).toBe('')
  })

  it('prints a short 12-hour clock', () => {
    expect(formatClock('14:00:00')).toBe('2pm')
    expect(formatClock('14:30:00')).toBe('2:30pm')
    expect(formatClock('09:00')).toBe('9am')
  })
})

describe('openHouseWhen', () => {
  it('names the Pacific calendar day and the hours without an em dash', () => {
    const label = openHouseWhen('2026-08-15', '14:00:00', '16:00:00')
    expect(label).toMatch(/Aug/)
    expect(label).toMatch(/15/)
    expect(label).toContain('2pm-4pm')
    expect(label).not.toContain('\u2014')
    expect(label).not.toContain('\u2013')
    expect(label).not.toContain(';')
  })
})

describe('openHouseFieldItems', () => {
  it('drops a row with no street', () => {
    const items = openHouseFieldItems([
      house({ unparsedAddress: null, streetNumber: null, streetName: null, streetSuffix: null }),
    ])
    expect(items).toHaveLength(0)
  })

  it('drops a row with no list price', () => {
    const items = openHouseFieldItems([house({ listPrice: null })])
    expect(items).toHaveLength(0)
  })

  it('names a price through formatPrice and never prints an em dash', () => {
    const items = openHouseFieldItems([house()])
    expect(items).toHaveLength(1)
    expect(items[0].priceLabel).toMatch(/^\$/)
    expect(items[0].title).toBe('123 Pine St, Bend')
    expect(JSON.stringify(items)).not.toContain('\u2014')
    expect(JSON.stringify(items)).not.toContain('\u2013')
  })

  it('puts day and time on the Field door badge', () => {
    const items = openHouseFieldItems([house()])
    expect(items[0].badge).toContain('2pm-4pm')
  })

  it('passes a live listing photograph onto the Field row', () => {
    const items = openHouseFieldItems([house({ photoUrl: '/hero.jpg' })])
    expect(items).toHaveLength(1)
    expect(items[0].photoSrc).toBe('/hero.jpg')
  })

  it('omits photoSrc when the join carried no photograph', () => {
    const items = openHouseFieldItems([house({ photoUrl: '   ' })])
    expect(items).toHaveLength(1)
    expect(items[0].photoSrc).toBeUndefined()
  })
})

describe('thisWeekendIso', () => {
  it('names Saturday and Sunday from a Wednesday', () => {
    expect(thisWeekendIso('2026-08-26')).toEqual({
      dateFrom: '2026-08-29',
      dateTo: '2026-08-30',
    })
  })

  it('keeps a Saturday as the start of this weekend', () => {
    expect(thisWeekendIso('2026-08-29')).toEqual({
      dateFrom: '2026-08-29',
      dateTo: addIsoDays('2026-08-29', 1),
    })
  })
})

describe('open-houses page contract', () => {
  it('puts the H1 on the Field above the photographs and keeps a buyer ask', () => {
    const src = readFileSync(join(process.cwd(), 'app/open-houses/page.tsx'), 'utf8')
    const board = readFileSync(join(process.cwd(), 'app/open-houses/_v3/OpenHousesBoard.tsx'), 'utf8')
    expect(src.indexOf('<OpenHousesBoard')).toBeLessThan(src.indexOf('<V3Instrument'))
    expect(src).toMatch(/See homes for sale/)
    expect(src).not.toMatch(/Value my home/)
    expect(src).toMatch(/heading="Open houses in Central Oregon"/)
    expect(board).toMatch(/v3-field-place-name/)
    expect(board).toMatch(/<V3Field/)
    expect(board).not.toMatch(/oh-board/)
    expect(board).not.toMatch(/open-houses-board\.css/)
  })
})
