import { describe, expect, it } from 'vitest'
import { EMPTY_PUBLIC_PACE } from '@/lib/data/market-truth/public-pace'
import { buildUnder500kSnapshot } from './data'
import type { Under500kCityInventory } from '@/lib/data/listings/getUnder500kCityInventory'

const inventory: Under500kCityInventory = {
  asOfIso: '2026-10-13T19:16:00.000Z',
  headlineResidential: 602,
  headlineSfr: 288,
  towns: [
    {
      slug: 'redmond',
      name: 'Redmond',
      cityLower: 'redmond',
      footnote: false,
      residential: 180,
      sfr: 71,
      townhouse: 63,
      condo: 4,
      condoTownhome: 67,
      manufacturedOnLand: 5,
      sharedOrLeased: 37,
      otherResidential: 0,
      sfrMedianList: 599_700,
      sfrMedianN: 266,
    },
    {
      slug: 'bend',
      name: 'Bend',
      cityLower: 'bend',
      footnote: false,
      residential: 158,
      sfr: 33,
      townhouse: 26,
      condo: 50,
      condoTownhome: 76,
      manufacturedOnLand: 32,
      sharedOrLeased: 17,
      otherResidential: 0,
      sfrMedianList: 850_000,
      sfrMedianN: 711,
    },
    {
      slug: 'la-pine',
      name: 'La Pine',
      cityLower: 'la pine',
      footnote: false,
      residential: 144,
      sfr: 94,
      townhouse: 1,
      condo: 0,
      condoTownhome: 1,
      manufacturedOnLand: 49,
      sharedOrLeased: 0,
      otherResidential: 0,
      sfrMedianList: 489_500,
      sfrMedianN: 168,
    },
    {
      slug: 'prineville',
      name: 'Prineville',
      cityLower: 'prineville',
      footnote: false,
      residential: 120,
      sfr: 90,
      townhouse: 0,
      condo: 0,
      condoTownhome: 0,
      manufacturedOnLand: 27,
      sharedOrLeased: 3,
      otherResidential: 0,
      sfrMedianList: 519_700,
      sfrMedianN: 188,
    },
    {
      slug: 'sisters',
      name: 'Sisters',
      cityLower: 'sisters',
      footnote: true,
      residential: 16,
      sfr: 3,
      townhouse: 4,
      condo: 5,
      condoTownhome: 9,
      manufacturedOnLand: 4,
      sharedOrLeased: 0,
      otherResidential: 0,
      sfrMedianList: 895_000,
      sfrMedianN: 109,
    },
    {
      slug: 'sunriver',
      name: 'Sunriver',
      cityLower: 'sunriver',
      footnote: true,
      residential: 40,
      sfr: 1,
      townhouse: 0,
      condo: 10,
      condoTownhome: 10,
      manufacturedOnLand: 0,
      sharedOrLeased: 29,
      otherResidential: 0,
      sfrMedianList: 898_000,
      sfrMedianN: 54,
    },
  ],
}

describe('buildUnder500kSnapshot', () => {
  it('keeps Sisters and Sunriver in the footnote and does not take pulse medians', () => {
    const result = buildUnder500kSnapshot({
      inventory,
      overlays: new Map(),
      paces: new Map([
        ['city:prineville', { ...EMPTY_PUBLIC_PACE, daysToPending90d: 69, priceCutShare: 0.49 }],
        ['city:la-pine', { ...EMPTY_PUBLIC_PACE, daysToPending90d: 53, priceCutShare: 0.562 }],
      ]),
    })
    expect(result.published).toBe(true)
    expect(result.headlineResidential).toBe(602)
    expect(result.headlineSfr).toBe(288)
    expect(result.headlineTowns.map((t) => t.slug)).toEqual(['redmond', 'bend', 'la-pine', 'prineville'])
    expect(result.footnoteTowns.map((t) => t.slug)).toEqual(['sisters', 'sunriver'])
    expect(result.towns.find((t) => t.slug === 'bend')?.sfrMedianList).toBe(850_000)
    expect(result.towns.find((t) => t.slug === 'prineville')?.daysToOffer90).toBe(69)
  })

  it('marks a null inventory unpublished so copy cannot invent a zero market', () => {
    const result = buildUnder500kSnapshot({
      inventory: null,
      overlays: new Map(),
      paces: new Map(),
    })
    expect(result.published).toBe(false)
    expect(result.asOfLabel).toBeNull()
    expect(result.headlineTowns).toHaveLength(4)
    expect(result.footnoteTowns).toHaveLength(2)
  })
})
