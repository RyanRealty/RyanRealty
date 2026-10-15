import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { SarahListingFacts } from '@/lib/data/sarah/listing-facts'
import { WEB_HELP_EN } from './scripts'
import {
  answerPublicRecordsQuestion,
  classifyPublicRecordsQuestion,
  clearPublicRecordsCache,
  parseDialPermitsHtml,
  pickShopPermit,
} from './public-records'

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/public-records')

const ZENITH: SarahListingFacts = {
  listNumber: '220222095',
  listingKey: '20260517054808892082000000',
  streetNumber: '4722',
  streetName: 'Zenith',
  city: 'Redmond',
  subdivision: 'Josie Meadows',
  status: 'Closed',
  yearBuilt: 2020,
  bedrooms: 3,
  bathrooms: 3,
  livingSqft: 2028,
  garageSpaces: 2,
  garageYn: true,
  lotAcres: 0.22,
  lotFeatures: null,
  hoaMonthly: 34.33,
  associationYn: true,
  associationFee: 34.33,
  associationFeeFrequency: 'Monthly',
  propertySubType: 'Single Family Residence',
  publicRemarks:
    'Desirable Josie Meadows in Redmond, Oregon. Spacious 2,028 sq ft two-story home on a private corner lot with Cascade Mountain views (2nd bedroom), fenced backyard, gated RV parking, and a 20x30 powered shop with loft, epoxy floors, and partial insulation/sheetrock. The main level features a primary suite with patio access.',
  otherStructures: 'Storage, Workshop, Second Garage, RV/Boat Storage',
  interiorFeatures: 'Pantry, Kitchen Island, Walk-In Closet(s)',
  exteriorFeatures: null,
  county: 'Deschutes',
  parcelNumber: '280444',
  latitude: 44.241837,
  longitude: -121.224638,
}

function fixture(name: string): string {
  return readFileSync(join(FIXTURES, name), 'utf8')
}

describe('classifyPublicRecordsQuestion', () => {
  it('routes permit, ADU, and zoning questions, and leaves listing shop-year alone', () => {
    expect(classifyPublicRecordsQuestion('is there a permit for the shop?')).toBe('permit')
    expect(classifyPublicRecordsQuestion('can I build an ADU here?')).toBe('adu')
    expect(classifyPublicRecordsQuestion('what is the zoning on this lot?')).toBe('zoning')
    expect(classifyPublicRecordsQuestion('when was the shop built')).toBeNull()
  })
})

describe('parseDialPermitsHtml', () => {
  it('reads a shop permit and drops owner names from the Zenith page', () => {
    const shop = parseDialPermitsHtml(
      fixture('dial-permits-shop.html'),
      'https://dial.deschutes.org/Real/Permits/123456',
    )
    expect(shop.account).toBe('123456')
    expect(pickShopPermit(shop.permits)?.name).toMatch(/20x30 shop/i)
    expect(pickShopPermit(shop.permits)?.year).toBe(2021)

    const zenith = parseDialPermitsHtml(
      fixture('dial-permits-zenith.html'),
      'https://dial.deschutes.org/Real/Permits/280444',
    )
    expect(zenith.account).toBe('280444')
    expect(zenith.permits.some((p) => p.id === '711-20-002104-STR')).toBe(true)
    const blob = JSON.stringify(zenith)
    expect(blob).not.toMatch(/LINSTAD/i)
    expect(zenith.permits.every((p) => !p.name || !/LLC/i.test(p.name))).toBe(true)
  })
})

describe('answerPublicRecordsQuestion', () => {
  it('returns a sourced shop permit fact, an ADU code citation, and a plain not-found', async () => {
    clearPublicRecordsCache()
    const shopHtml = fixture('dial-permits-shop.html')
    const emptyHtml = fixture('dial-permits-empty.html')

    const permit = await answerPublicRecordsQuestion({
      question: 'is there a permit for the shop?',
      facts: { ...ZENITH, parcelNumber: '123456' },
      brokerFirstName: 'Matt',
      deps: {
        fetchText: async () => shopHtml,
        lookupZone: async () => ({ zone: 'R2', zoneType: '3' }),
      },
    })
    expect(permit).toMatch(/Let me try and find out/i)
    expect(permit).toMatch(/permit for a 20x30 shop in 2021/i)
    expect(permit).toMatch(/dial\.deschutes\.org\/Real\/Permits\/123456/)
    expect(permit).toMatch(/public records and should be verified/i)
    expect(permit).toMatch(/connect you with Matt/)
    expect(permit).not.toMatch(/LINSTAD/i)
    expect(permit).not.toBe(WEB_HELP_EN)

    clearPublicRecordsCache()
    const adu = await answerPublicRecordsQuestion({
      question: 'can I build an ADU here?',
      facts: ZENITH,
      brokerFirstName: 'Rebecca',
      deps: {
        fetchText: async () => shopHtml,
        lookupZone: async () => ({ zone: 'R2', zoneType: '3' }),
      },
    })
    expect(adu).toMatch(/Let me try and find out/i)
    expect(adu).toMatch(/R-2/)
    expect(adu).toMatch(/Redmond Development Code|library\.municode\.com\/or\/redmond/i)
    expect(adu).toMatch(/based on the code/i)
    expect(adu).toMatch(/broker or the city can confirm/i)
    expect(adu).toMatch(/connect you with Rebecca/)
    expect(adu).not.toBe(permit)

    clearPublicRecordsCache()
    const missing = await answerPublicRecordsQuestion({
      question: 'is there a permit for the shop?',
      facts: {
        ...ZENITH,
        parcelNumber: '000000',
        publicRemarks: 'A quiet street.',
        latitude: null,
        longitude: null,
      },
      brokerFirstName: 'Paul',
      deps: {
        fetchText: async () => emptyHtml,
        lookupZone: async () => ({ zone: null, zoneType: null }),
      },
    })
    expect(missing).toMatch(/did not find that in the public records/i)
    expect(missing).toMatch(/connect you with Paul/)
    expect(missing).not.toMatch(/20x30/)
    expect(missing).not.toBe(WEB_HELP_EN)

    clearPublicRecordsCache()
    const zenithHtml = fixture('dial-permits-zenith.html')
    const zenithPermit = await answerPublicRecordsQuestion({
      question: 'is there a permit for the shop?',
      facts: ZENITH,
      brokerFirstName: 'Matt',
      deps: {
        fetchText: async () => zenithHtml,
        lookupZone: async () => ({ zone: 'R2', zoneType: '3' }),
      },
    })
    expect(zenithPermit).toMatch(/711-20-002104-STR/)
    expect(zenithPermit).toMatch(/20x30 powered shop/)
    expect(zenithPermit).toMatch(/does not name the shop specifically/)
    expect(zenithPermit).toMatch(/dial\.deschutes\.org\/Real\/Permits\/280444/)
    expect(zenithPermit).not.toMatch(/LINSTAD|KAYLA VILLAGE/i)
  })
})
