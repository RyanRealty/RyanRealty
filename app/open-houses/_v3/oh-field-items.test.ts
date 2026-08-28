import { describe, it, expect } from 'vitest'
import { openHouseFieldItems } from './oh-field-items'
import type { OpenHouseListing } from './oh-listings'

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
    photoUrl: '/hero.jpg',
    lat: 44.06,
    lng: -121.31,
    href: '/homes-for-sale/bend/123-pine-st-220000001',
    ...over,
  }
}

describe('openHouseFieldItems when-on-photo', () => {
  it('puts the live when on the item, not in the spec line', () => {
    const items = openHouseFieldItems([house()])
    expect(items).toHaveLength(1)
    expect(items[0].when).toContain('2pm-4pm')
    expect(items[0].badge).toBe(items[0].when)
    expect(items[0].listingKey).toBe('L1')
    expect(items[0].meta).not.toContain('2pm-4pm')
    expect(items[0].photoSrc).toBe('/hero.jpg')
  })
})
