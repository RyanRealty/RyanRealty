import { describe, expect, it } from 'vitest'
import { placeFigureRows, type CityPlaceItem } from '@/app/cities/[slug]/_v3/city-sections'
import { openHouseRows } from '@/lib/kb/place-open-houses'
import type { OpenHouseListing } from '@/app/open-houses/_v3/oh-listings'

/**
 * SITE-07 quality pass (2026-09-09). The thesis: a neighborhood's plats read
 * as its own children. The subdivisions ledger printed "Awbrey Butte
 * Homesite…" six times as one ellipsized string; the row builder now drops
 * the containing place's name and the primitive lets the label wrap. And the
 * open-house rows carry the calendar tile the walk layout leads with, split
 * HERE so the primitive formats nothing.
 */

function item(name: string, over: Partial<CityPlaceItem> = {}): CityPlaceItem {
  return {
    name,
    href: `/subdivisions/${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    activeCount: 3,
    medianPrice: 900_000,
    img: '',
    ...over,
  }
}

describe('placeFigureRows within a containing place', () => {
  const items = [
    item('Awbrey Butte Homesites Phase Twenty-two'),
    item('Awbrey Butte Homesites Phase Thirteen', { activeCount: 6 }),
    item('North Rim on Awbrey Butte'),
    item('Awbrey Butte'),
  ]

  it('drops the containing place from a child that opens with it, and nothing else', () => {
    const rows = placeFigureRows(items, 'Awbrey Butte subdivision', 'Awbrey Butte')
    expect(rows.map((r) => r.what)).toEqual([
      'Homesites Phase Twenty-two',
      'Homesites Phase Thirteen',
      'North Rim on Awbrey Butte',
      'Awbrey Butte',
    ])
  })

  it('keeps the phase: in a ledger it is what tells two plats apart', () => {
    const rows = placeFigureRows(items, 'Awbrey Butte subdivision', 'Awbrey Butte')
    expect(new Set(rows.map((r) => r.what)).size).toBe(rows.length)
  })

  it('touches only the label: href, count, weight and kind label are unchanged', () => {
    const plain = placeFigureRows(items, 'Awbrey Butte subdivision')
    const within = placeFigureRows(items, 'Awbrey Butte subdivision', 'Awbrey Butte')
    for (let i = 0; i < plain.length; i += 1) {
      expect(within[i]!.href).toBe(plain[i]!.href)
      expect(within[i]!.value).toBe(plain[i]!.value)
      expect(within[i]!.weight).toBe(plain[i]!.weight)
      expect(within[i]!.when).toBe(plain[i]!.when)
    }
    expect(plain[0]!.what).toBe('Awbrey Butte Homesites Phase Twenty-two')
  })

  it('leaves a list of peers alone when no containing place is named', () => {
    const rows = placeFigureRows([item('Bend Golf Club'), item('Bend')], 'Central Oregon city')
    expect(rows.map((r) => r.what)).toEqual(['Bend Golf Club', 'Bend'])
  })
})

function openHouse(over: Partial<OpenHouseListing> = {}): OpenHouseListing {
  return {
    id: 'oh-1',
    listingKey: 'k1',
    listNumber: '220000001',
    eventDate: '2026-09-10',
    startTime: '12:00:00',
    endTime: '15:00:00',
    listPrice: 925_000,
    beds: 3,
    baths: 2,
    sqft: 1800,
    subdivisionName: 'Awbrey Butte',
    city: 'Bend',
    state: 'OR',
    postalCode: '97703',
    streetNumber: '2765',
    streetName: 'High Lakes',
    streetSuffix: 'Loop',
    unparsedAddress: '2765 High Lakes Loop',
    photoUrl: null,
    lat: 44.08,
    lng: -121.33,
    href: '/listing/k1',
    ...over,
  }
}

describe('openHouseRows carries the calendar tile for the walk layout', () => {
  it('splits the civil day into weekday, day and month, and leaves the hours in when', () => {
    const [row] = openHouseRows([openHouse()])
    expect(row!.date).toEqual({ weekday: 'Thu', day: '10', month: 'Sep' })
    expect(row!.when).toBe('12pm-3pm')
    expect(row!.what).toBe('2765 High Lakes Loop')
    expect(row!.value).toBe('$925,000')
  })

  it('keeps the Pacific day: 2026-09-10 is a Thursday, not the prior evening', () => {
    const [row] = openHouseRows([openHouse({ eventDate: '2026-09-10' })])
    expect(row!.date!.weekday).toBe('Thu')
    const [sunday] = openHouseRows([openHouse({ eventDate: '2026-09-13' })])
    expect(sunday!.date).toEqual({ weekday: 'Sun', day: '13', month: 'Sep' })
  })

  it('falls back to the one-line when with no readable day, and never invents a tile', () => {
    const [row] = openHouseRows([openHouse({ eventDate: 'not a date' })])
    expect(row!.date).toBeUndefined()
    expect(row!.when).toBe('12pm')
  })

  it('names the open house when only the day is known', () => {
    const [row] = openHouseRows([openHouse({ startTime: null, endTime: null })])
    expect(row!.date).toEqual({ weekday: 'Thu', day: '10', month: 'Sep' })
    expect(row!.when).toBe('Open house')
  })
})
