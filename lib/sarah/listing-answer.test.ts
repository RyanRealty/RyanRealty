import { describe, expect, it } from 'vitest'
import type { SarahListingFacts } from '@/lib/data/sarah/listing-facts'
import { WEB_HELP_EN } from './scripts'
import {
  LISTING_UNKNOWN_FACT_EN,
  answerListingQuestion,
  answerPlaceQuestion,
  assertDistinctListingReplies,
  extractShopYear,
  parseSarahPage,
  shouldAnswerFromListing,
  shouldAnswerFromPage,
} from './listing-answer'

/** 4722 Zenith, Josie Meadows / MLS 220222095. Queried live 2026-10-15. */
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

const PATH = '/homes-for-sale/redmond/josie-meadows/4722-zenith-ave-220222095'

describe('listing-page factual answers', () => {
  it('answers when was the shop built from remarks, not WEB_HELP_EN, and does not invent a shop year', () => {
    const reply = answerListingQuestion('when was the shop built', ZENITH, 'Matt')
    expect(reply).not.toBe(WEB_HELP_EN)
    expect(reply).not.toBe(LISTING_UNKNOWN_FACT_EN)
    expect(reply).toMatch(/does not give the shop's build year/i)
    expect(reply).toMatch(/home was built in 2020/)
    expect(reply).toMatch(/20x30 powered shop/i)
    expect(reply).toMatch(/Matt find out/)
    expect(reply).not.toMatch(/shop was built in 2020/i)
    expect(extractShopYear(ZENITH.publicRemarks)).toBeNull()
  })

  it('uses listing data for HOA and size, and the same reply twice in a row fails', () => {
    const shop = answerListingQuestion('when was the shop built', ZENITH, 'Matt')
    const hoa = answerListingQuestion('is there an HOA', ZENITH, 'Matt')
    const beds = answerListingQuestion('how many bedrooms', ZENITH, 'Matt')
    expect(shop).not.toBe(WEB_HELP_EN)
    expect(hoa).toMatch(/\$34\.33/)
    expect(beds).toMatch(/3 bedrooms/)
    expect(beds).toMatch(/2,028/)
    expect(() => assertDistinctListingReplies([shop, shop])).toThrow(/twice in a row/)
    expect(() => assertDistinctListingReplies([shop, hoa])).not.toThrow()
    expect(() => assertDistinctListingReplies([hoa, beds])).not.toThrow()
  })

  it('says so when a fact is missing and offers the broker', () => {
    const thin: SarahListingFacts = {
      ...ZENITH,
      yearBuilt: null,
      publicRemarks: 'Nice home in Redmond.',
      otherStructures: null,
      hoaMonthly: null,
      associationYn: null,
    }
    const reply = answerListingQuestion('when was the shop built', thin, 'Paul')
    expect(reply).toMatch(/does not give the shop's build year/i)
    expect(reply).toMatch(/Paul find out/)
    expect(reply).not.toBe(WEB_HELP_EN)
    expect(answerListingQuestion('is there an HOA', thin, 'Paul')).toMatch(/Paul find out/)
  })

  it('routes listing-page questions, not buyer chips, to the listing answerer', () => {
    expect(
      shouldAnswerFromListing({
        pathname: PATH,
        visitorText: 'when was the shop built',
        flowStep: 'intent',
      }),
    ).toBe(true)
    expect(
      shouldAnswerFromListing({
        pathname: PATH,
        visitorText: 'Hi I would like to look at homes here',
        flowStep: 'intent',
      }),
    ).toBe(false)
    expect(
      shouldAnswerFromListing({
        pathname: '/about',
        visitorText: 'when was the shop built',
        flowStep: 'intent',
      }),
    ).toBe(false)
  })
})

describe('area-page answers', () => {
  const tetherow = {
    kind: 'community' as const,
    name: 'Tetherow',
    city: 'Bend',
    description: 'A west-side Bend resort community.',
    character: null,
    hoaAnnual: 2100,
  }

  it('parses city and community paths and answers from page facts', () => {
    expect(parseSarahPage('/communities/tetherow').kind).toBe('community')
    expect(parseSarahPage('/cities/bend').kind).toBe('city')
    expect(parseSarahPage('/cities/bend/awbrey-butte').kind).toBe('neighborhood')
    expect(
      shouldAnswerFromPage({
        pathname: '/communities/tetherow',
        visitorText: 'is there an HOA',
        flowStep: 'intent',
      }),
    ).toBe(true)
    const hoa = answerPlaceQuestion('is there an HOA', tetherow, 'Matt')
    const about = answerPlaceQuestion('tell me about this area', tetherow, 'Matt')
    expect(hoa).toMatch(/Tetherow/)
    expect(hoa).toMatch(/\$2,100/)
    expect(about).toMatch(/Tetherow/)
    expect(about).not.toBe(hoa)
    expect(hoa).not.toBe(WEB_HELP_EN)
    expect(() => assertDistinctListingReplies([hoa, about])).not.toThrow()
  })

  it('says a missing area fact is not listed and offers the broker', () => {
    const reply = answerPlaceQuestion('when was the shop built', tetherow, 'Matt')
    expect(reply).toMatch(/isn't listed on this community page/)
    expect(reply).toMatch(/Matt find out/)
    expect(reply).not.toBe(WEB_HELP_EN)
  })
})
