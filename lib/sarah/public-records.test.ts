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
  plainZoneLabel,
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

function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean)
}

describe('classifyPublicRecordsQuestion', () => {
  it('routes permit, ADU, and zoning questions, and leaves listing shop-year alone', () => {
    expect(classifyPublicRecordsQuestion('is there a permit for the shop?')).toBe('permit')
    expect(classifyPublicRecordsQuestion('can I build an ADU here?')).toBe('adu')
    expect(classifyPublicRecordsQuestion('what is the zoning on this lot?')).toBe('zoning')
    expect(classifyPublicRecordsQuestion('when was the shop built')).toBeNull()
  })
})

describe('plainZoneLabel', () => {
  it('writes the zone once in plain English', () => {
    expect(plainZoneLabel({ code: 'RS', name: 'Standard Density Residential District (RS)' })).toBe(
      'RS, standard density residential',
    )
    expect(plainZoneLabel({ code: 'R-2', name: 'R-2 Limited Residential Zone' })).toBe(
      'R-2, limited residential',
    )
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
  it('keeps web answers short, sourced once, and offers the broker', async () => {
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
    expect(permit).toBe(
      'It looks like there was a permit for a 20x30 shop in 2021. The city can confirm for this lot. Source: https://dial.deschutes.org/Real/Permits/123456. Want me to connect you with Matt?',
    )
    expect(sentences(permit).length).toBeLessThanOrEqual(5)
    expect(permit.match(/The city can confirm/g)?.length).toBe(1)
    expect(permit.match(/Source:/g)?.length).toBe(1)
    expect(permit).not.toMatch(/Let me try and find out/i)
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
    expect(adu).toMatch(/^This lot is zoned R-2, limited residential\./)
    expect(adu).toMatch(/Redmond allows ADUs there, 300 to 900 sq ft for a stand-alone unit\./)
    expect(adu).toMatch(/The city can confirm for this lot\./)
    expect(adu).toMatch(/Source: https:\/\/library\.municode\.com\/or\/redmond/)
    expect(adu).toMatch(/Want me to connect you with Rebecca\?$/)
    expect(adu.match(/R-2/g)?.length).toBe(1)
    expect(adu.match(/The city can confirm/g)?.length).toBe(1)
    expect(adu).not.toMatch(/based on the code/i)
    expect(adu).not.toMatch(/not a legal or zoning determination/i)
    expect(sentences(adu).length).toBeLessThanOrEqual(5)
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
    expect(missing).toBe(
      'I did not find that in the public records I can read. Want me to connect you with Paul?',
    )
    expect(missing).not.toMatch(/20x30/)
    expect(missing).not.toMatch(/Source:/)
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
    expect(zenithPermit).toBe(
      'County records show a finaled building permit from 2020. The listing mentions a 20x30 shop, but the permit does not name it. The city can confirm for this lot. Source: https://dial.deschutes.org/Real/Permits/280444. Want me to connect you with Matt?',
    )
    expect(zenithPermit).not.toMatch(/LINSTAD|KAYLA VILLAGE/i)
  })

  it('speaks a phone answer with no URL and an offer to text the link', async () => {
    clearPublicRecordsCache()
    const adu = await answerPublicRecordsQuestion({
      question: 'can I build an ADU here?',
      facts: ZENITH,
      brokerFirstName: 'Rebecca',
      channel: 'voice',
      deps: {
        fetchText: async () => fixture('dial-permits-shop.html'),
        lookupZone: async () => ({ zone: 'R2', zoneType: '3' }),
      },
    })
    expect(adu).not.toMatch(/https?:\/\//)
    expect(adu).toMatch(/This lot is zoned R-2, limited residential/)
    expect(adu).toMatch(/square feet/)
    expect(adu).toMatch(/Want me to text you the source, and connect you with Rebecca/)
    expect(adu.match(/The city can confirm/g)?.length).toBe(1)
    expect(sentences(adu).length).toBeLessThanOrEqual(4)

    clearPublicRecordsCache()
    const permit = await answerPublicRecordsQuestion({
      question: 'is there a permit for the shop?',
      facts: { ...ZENITH, parcelNumber: '123456' },
      brokerFirstName: 'Matt',
      channel: 'voice',
      deps: {
        fetchText: async () => fixture('dial-permits-shop.html'),
        lookupZone: async () => ({ zone: 'R2', zoneType: '3' }),
      },
    })
    expect(permit).toMatch(/20 by 30 shop in 2021/)
    expect(permit).not.toMatch(/https?:\/\//)
    expect(permit).toMatch(/Want me to text you the source, and connect you with Matt/)
  })
})
