import { describe, expect, it } from 'vitest'
import {
  bustZestimate,
  mlsFactsFromPricedComps,
  type MlsCompFact,
  type ZillowSnapshot,
} from '@/lib/cma/zestimate-buster'

const douglas: ZillowSnapshot = {
  url: 'https://www.zillow.com/homedetails/648-SE-Douglas-St-Bend-OR-97702/60583914_zpid/',
  fetchedAt: '2026-08-17',
  zestimate: 474100,
  rangeLow: 450000,
  rangeHigh: 498000,
  publishedComps: [
    {
      address: '947 SE 6th St',
      soldPrice: 495000,
      beds: 3,
      baths: 1,
      sqft: 1036,
      mlsNumber: '220222218',
      zillowStatus: 'sold',
    },
    {
      address: '801 SE Polaris Ct',
      soldPrice: 495000,
      beds: 3,
      baths: 1,
      sqft: 1036,
      mlsNumber: '220204222',
      zillowStatus: 'sold',
    },
    {
      address: '1627 SE Bear Creek Rd',
      soldPrice: 477500,
      beds: 3,
      baths: 2,
      sqft: 1040,
      mlsNumber: '220222238',
      zillowStatus: 'sold',
    },
    {
      address: '1540 NE Bear Creek Rd',
      soldPrice: 469000,
      beds: 2,
      baths: 1,
      sqft: 1032,
      mlsNumber: '220215591',
      zillowStatus: 'sold',
    },
    {
      address: '504 NE Dekalb Ave',
      soldPrice: 425000,
      beds: 3,
      baths: 1,
      sqft: 960,
      mlsNumber: null,
      zillowStatus: 'sold',
    },
  ],
}

const mls: MlsCompFact[] = [
  {
    mlsNumber: '220222218',
    address: '947 6th',
    closePrice: 495000,
    closeDate: '2026-06-26',
    status: 'Closed',
    beds: 3,
    baths: 1,
    sqft: 1036,
    yearBuilt: 1978,
    subdivision: 'Clear Sky Estates',
  },
  {
    mlsNumber: '220204222',
    address: '801 Polaris',
    closePrice: 495000,
    closeDate: '2025-08-15',
    status: 'Closed',
    beds: 3,
    baths: 1,
    sqft: 1036,
    yearBuilt: 1979,
    subdivision: 'Clear Sky Estates',
  },
  {
    mlsNumber: '220222238',
    address: '1627 Bear Creek',
    closePrice: 477500,
    closeDate: '2026-06-23',
    status: 'Closed',
    beds: 3,
    baths: 2,
    sqft: 1040,
    yearBuilt: 1977,
    subdivision: 'Ramsey Estate',
  },
  {
    mlsNumber: '220215591',
    address: '1540 Bear Creek',
    closePrice: null,
    closeDate: null,
    status: 'Pending',
    beds: 2,
    baths: 1,
    sqft: 1032,
    yearBuilt: 1968,
    subdivision: 'Eastside',
  },
]

const subject = { beds: 3, baths: 1, sqft: 1056, yearBuilt: 1978 }

describe('bustZestimate', () => {
  it('marks the Douglas Zestimate high even when the value-band high end covers it', () => {
    const bust = bustZestimate({
      snapshot: douglas,
      mls,
      subject,
      recommended: 438000,
      conservative: 438000,
      highEnd: 485000,
      asOf: '2026-08-17',
      ownerNotes: [
        'Interior and exterior repainted',
        'New solid surface countertops',
        'Bathroom remodel',
      ],
    })
    expect(bust).not.toBeNull()
    expect(bust!.verdict).toBe('high')
    expect(bust!.gapToList).toBe(36100)
    expect(bust!.stickerMean).toBe(472300)
    expect(bust!.usableCount).toBe(2)
    expect(bust!.dirtyCount).toBe(3)
    const byAddr = Object.fromEntries(bust!.grades.map((g) => [g.address, g.grade]))
    expect(byAddr['947 SE 6th St']).toBe('usable')
    expect(byAddr['1627 SE Bear Creek Rd']).toBe('usable')
    expect(byAddr['801 SE Polaris Ct']).toBe('stale')
    expect(byAddr['1540 NE Bear Creek Rd']).toBe('pending-as-sold')
    expect(byAddr['504 NE Dekalb Ave']).toBe('unverified')
    expect(bust!.heading).toContain('$36,100')
    expect(bust!.reasons[0]).toMatch(/average of those stickers/i)
    expect(bust!.reasons.some((r) => /did not adjust/i.test(r))).toBe(true)
    expect(bust!.reasons.some((r) => /pending/i.test(r))).toBe(true)
    expect(bust!.reasons.some((r) => /repainted/i.test(r))).toBe(true)
    expect(bust!.source).not.toMatch(/supabase/i)
  })

  it('grades a priced sale even when the extra MLS lookup is empty', () => {
    const bust = bustZestimate({
      snapshot: douglas,
      mls: mlsFactsFromPricedComps([
        {
          mlsNumber: '220222218',
          address: '947 6th',
          closePrice: 495000,
          closeDate: '2026-06-26',
          beds: 3,
          baths: 1,
          sqft: 1036,
          yearBuilt: 1978,
          subdivision: 'Clear Sky Estates',
        },
      ]),
      subject,
      recommended: 438000,
      conservative: 438000,
      highEnd: 485000,
      asOf: '2026-08-17',
    })
    expect(bust!.grades.find((g) => g.address === '947 SE 6th St')?.grade).toBe('usable')
    expect(bust!.grades.find((g) => g.address === '504 NE Dekalb Ave')?.grade).toBe('unverified')
    expect(bust!.grades.find((g) => g.address === '504 NE Dekalb Ave')?.line).toMatch(
      /could not confirm a matching closed sale/i,
    )
  })

  it('supports a Zestimate that sits inside the list range', () => {
    const bust = bustZestimate({
      snapshot: { ...douglas, zestimate: 450000, publishedComps: [] },
      mls: [],
      subject,
      recommended: 438000,
      conservative: 438000,
      highEnd: 465000,
      asOf: '2026-08-17',
    })
    expect(bust!.verdict).toBe('supports')
    expect(bust!.heading).toMatch(/sits near this list/i)
  })

  it('returns null when Zillow did not print a number', () => {
    expect(
      bustZestimate({
        snapshot: { ...douglas, zestimate: 0 },
        mls: [],
        subject,
        recommended: 438000,
        conservative: 438000,
        highEnd: 465000,
        asOf: '2026-08-17',
      }),
    ).toBeNull()
  })
})
