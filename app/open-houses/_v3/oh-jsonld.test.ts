import { describe, expect, it } from 'vitest'
import { openHouseEventSchemas, openHouseItemListSchema } from './oh-jsonld'
import type { OpenHouseListing } from './oh-listings'
import type { OpenHouseFieldItem } from './oh-field-items'

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

describe('openHouseEventSchemas', () => {
  it('uses the live window and does not invent 9am or noon', () => {
    const [event] = openHouseEventSchemas([house()], 'https://ryan-realty.com')
    expect(event).toMatchObject({
      type: 'event',
      startDate: '2026-08-15T14:00:00',
      endDate: '2026-08-15T16:00:00',
    })
    expect(JSON.stringify(event)).not.toContain('09:00')
    expect(JSON.stringify(event)).not.toContain('12:00')
    if (event?.type === 'event') {
      expect(event.name).toMatch(/2pm-4pm/)
      expect(event.name).toMatch(/123 Pine St/)
    }
  })

  it('emits a date-only start when the pull has no clock', () => {
    const [event] = openHouseEventSchemas([house({ startTime: null, endTime: null })], 'https://ryan-realty.com')
    expect(event).toMatchObject({ type: 'event', startDate: '2026-08-15' })
    expect(event && 'endDate' in event ? event.endDate : undefined).toBeUndefined()
    expect(JSON.stringify(event)).not.toContain('T09:00')
  })
})

describe('openHouseItemListSchema', () => {
  it('names the window on each crawlable row', () => {
    const item: OpenHouseFieldItem = {
      id: 'oh-1',
      href: '/homes-for-sale/bend/123-pine-st-220000001',
      priceLabel: '$625,000',
      title: '123 Pine St, Bend',
      eventDate: '2026-08-15',
      weekend: true,
      when: 'Sat, Aug 15, 2026 · 2pm-4pm',
    }
    const list = openHouseItemListSchema([item], 'https://ryan-realty.com')
    expect(list).toMatchObject({ type: 'itemList' })
    if (list?.type === 'itemList') {
      expect(list.items[0]?.name).toContain('2pm-4pm')
      expect(list.items[0]?.name).toContain('$625,000')
      expect(list.items[0]?.url).toBe(
        'https://ryan-realty.com/homes-for-sale/bend/123-pine-st-220000001',
      )
    }
  })
})
