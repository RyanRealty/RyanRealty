import { describe, it, expect } from 'vitest'
import { parseZillowItem, FSBO_SERVICE_AREA_CITIES, FSBO_MIN_LIST_PRICE } from './fsbo-detector'

type Item = Parameters<typeof parseZillowItem>[0]
const mk = (o: Record<string, unknown>): Item => o as unknown as Item

const validBend = {
  detailUrl: '/homedetails/123-main-st-bend-or-97701/12345_zpid/?utm=blob',
  address: '123 Main St, Bend, OR 97701',
  homeType: 'SINGLE_FAMILY',
  unformattedPrice: 600000,
  zpid: 12345,
  beds: 3,
  baths: 2,
}

describe('parseZillowItem (FSBO lead parser)', () => {
  it('Bend is in the service area + any list price is in', () => {
    expect(FSBO_SERVICE_AREA_CITIES).toContain('Bend')
    expect(FSBO_MIN_LIST_PRICE).toBe(0)
  })

  it('parses an in-service-area SFR above the price floor (and strips tracking query)', () => {
    const r = parseZillowItem(mk(validBend))
    expect(r).not.toBeNull()
    expect(r?.city).toBe('Bend')
    expect(r?.fsboSource).toBe('zillow')
    expect(r?.streetAddress).toBe('123 Main St')
    expect(r?.fsboUrl).toContain('zillow.com')
    expect(r?.fsboUrl).not.toContain('?')
  })

  it('keeps a $250k Bend listing (old $500k floor is retired)', () => {
    expect(parseZillowItem(mk({ ...validBend, unformattedPrice: 250_000 }))).not.toBeNull()
    expect(parseZillowItem(mk({ ...validBend, unformattedPrice: 500_000 }))).not.toBeNull()
  })

  it('still reads a numeric listingPrice from the pre-2026-09 shape', () => {
    const rest = { ...validBend }
    delete (rest as { unformattedPrice?: number }).unformattedPrice
    expect(parseZillowItem(mk({ ...rest, listingPrice: 400_000 }))?.listPrice).toBe(400_000)
  })

  it('rejects out-of-service-area cities', () => {
    expect(parseZillowItem(mk({ ...validBend, address: '123 Main St, Portland, OR 97201' }))).toBeNull()
  })

  it('rejects items with no URL or no address', () => {
    expect(parseZillowItem(mk({}))).toBeNull()
    expect(parseZillowItem(mk({ detailUrl: '/x' }))).toBeNull()
    expect(parseZillowItem(mk({ propertyUrl: 'https://www.zillow.com/homedetails/x/1_zpid' }))).toBeNull()
  })
})

const mappedBend = {
  propertyUrl: 'https://www.zillow.com/homedetails/456-pine-st-bend-or-97702/98765_zpid/?utm=blob',
  zpid: '98765',
  listingAddress: {
    street: '456 Pine St',
    city: 'Bend',
    state: 'OR',
    zipCode: '97702',
    full: '456 Pine St, Bend, OR 97702',
  },
  listingPrice: { amount: 625000 },
  coordinates: { latitude: 44.0582, longitude: -121.3153 },
  mainImage: 'https://photos.zillowstatic.com/fp/example.jpg',
  bedrooms: 4,
  bathrooms: 2.5,
  livingArea: 2100,
  lotArea: { value: 0.25, unit: 'acres' },
  daysOnZillow: 12,
  homeType: 'SINGLE_FAMILY',
  listingType: { isFSBO: true, isFSBA: false },
  broker: { name: 'Owner', phoneNumber: '(541) 555-0100' },
}

describe('parseZillowItem (mapped Apify output since 2026-09-01)', () => {
  it('parses propertyUrl, listingAddress, listingPrice.amount, coordinates, mainImage', () => {
    const r = parseZillowItem(mk(mappedBend))
    expect(r).not.toBeNull()
    expect(r?.city).toBe('Bend')
    expect(r?.streetAddress).toBe('456 Pine St')
    expect(r?.postalCode).toBe('97702')
    expect(r?.listPrice).toBe(625000)
    expect(r?.fsboUniqueId).toBe('98765')
    expect(r?.fsboUrl).toBe('https://www.zillow.com/homedetails/456-pine-st-bend-or-97702/98765_zpid')
    expect(r?.latitude).toBe(44.0582)
    expect(r?.longitude).toBe(-121.3153)
    expect(r?.photoUrl).toBe('https://photos.zillowstatic.com/fp/example.jpg')
    expect(r?.bedrooms).toBe(4)
    expect(r?.bathrooms).toBe(2.5)
    expect(r?.sqft).toBe(2100)
    expect(r?.daysListed).toBe(12)
    expect(r?.ownerName).toBe('Owner')
    expect(r?.contactPhone).toBe('5415550100')
  })

  it('converts lotArea acres to square feet', () => {
    const r = parseZillowItem(mk(mappedBend))
    expect(r?.lotSizeSqft).toBe(10890)
  })

  it('keeps lotArea already in sqft', () => {
    const r = parseZillowItem(mk({ ...mappedBend, lotArea: { value: 8712, unit: 'sqft' } }))
    expect(r?.lotSizeSqft).toBe(8712)
  })

  it('rejects listingType.isFSBO === false', () => {
    expect(parseZillowItem(mk({ ...mappedBend, listingType: { isFSBO: false, isFSBA: true } }))).toBeNull()
  })

  it('keeps a mapped row when listingType.isFSBO is missing (FSBO search already filtered)', () => {
    const rest = { ...mappedBend }
    delete (rest as { listingType?: unknown }).listingType
    expect(parseZillowItem(mk(rest))).not.toBeNull()
  })

  it('parses listingAddress.full when street/city are empty', () => {
    const r = parseZillowItem(mk({
      ...mappedBend,
      listingAddress: { full: '10 Cascade Ln, Sisters, OR 97759' },
    }))
    expect(r?.city).toBe('Sisters')
    expect(r?.streetAddress).toBe('10 Cascade Ln')
    expect(r?.postalCode).toBe('97759')
  })

  it('retags Bend + 97707 as Sunriver on the mapped shape', () => {
    const r = parseZillowItem(mk({
      ...mappedBend,
      listingAddress: {
        street: '1 Beaver Dr',
        city: 'Bend',
        state: 'OR',
        zipCode: '97707',
      },
    }))
    expect(r?.city).toBe('Sunriver')
  })
})
