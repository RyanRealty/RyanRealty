import { describe, expect, it } from 'vitest'
import { ADU_VALUE_MIN_PAIRS, aduContributoryValue, aduSqftFromRemarks, applyAduAdjustments, mainSqftFromRemarks, milesBetween, quartiles, reconciledMainSqft, withMainSqft, type AduValueSale } from '@/lib/pricing/adu-value'

/**
 * WHAT AN ADU ADDS (Matt 2026-10-14, second call): paired sales near the
 * subject, the plain baseline for each, the lower-quartile rate times the
 * subject's ADU area, five pairs or nothing, the radius that widens once.
 */
const HOME = { latitude: 44.058659, longitude: -121.300125 }
/** One degree of latitude is 69 miles: 0.0145 degrees is a mile. */
const MILE = 1 / 69

const PLAIN_REMARKS = 'Light-filled Midtown home with a fenced yard and a two-car garage.'
const ADU_REMARKS = 'Midtown home PLUS a detached 500 sq ft ADU with its own entrance.'

function sale(over: Partial<AduValueSale> & { listingKey: string }): AduValueSale {
  const sqft = over.sqft ?? 1700
  const closePrice = over.closePrice ?? 400 * sqft
  return {
    address: `${over.listingKey} Example St`,
    subdivision: 'Center Addition',
    latitude: HOME.latitude,
    longitude: HOME.longitude,
    sqft,
    yearBuilt: 2005,
    closeDate: '2026-06-01',
    productClass: 'detached',
    publicRemarks: PLAIN_REMARKS,
    ...over,
    closePrice,
    closePpsf: closePrice / sqft,
  }
}

/** Eight plain sales a quarter mile north, 1,600 to 1,900 sq ft, all at $400 a foot. */
const plain = Array.from({ length: 8 }, (_, i) =>
  sale({ listingKey: `P${i}`, latitude: HOME.latitude + MILE * (0.15 + i * 0.02), sqft: 1600 + i * 40 }),
)

/** An ADU sale `miles` north of the subject whose price is the plain main home plus `extra`. */
function aduSale(key: string, miles: number, extra: number, over: Partial<AduValueSale> = {}): AduValueSale {
  return sale({ listingKey: key, latitude: HOME.latitude + MILE * miles, publicRemarks: ADU_REMARKS, aduSqft: 500, aduSqftSource: 'remarks', closePrice: 400 * 1700 + extra, ...over })
}

const subject = { ...HOME, aduSqft: 520 }

describe('aduContributoryValue', () => {
  it('six pairs within a mile give the lower-quartile rate times the subject ADU area, with negative pairs kept', () => {
    const adu = [100_000, 150_000, 200_000, 250_000, 300_000, -20_000].map((extra, i) => aduSale(`A${i}`, 0.35 + i * 0.09, extra))
    const v = aduContributoryValue({ subject, sales: [...plain, ...adu] })
    expect(v.radiusMiles).toBe(1)
    expect(v.aduSalesSeen).toBe(6)
    expect(v.pairs).toHaveLength(6)
    expect(v.pairs.map((p) => p.aduPerSqft).sort((a, b) => a - b)).toEqual([-40, 200, 300, 400, 500, 600])
    expect(v.pairs[0]).toMatchObject({ listingKey: 'A0', plainComps: 8, plainPpsf: 400, mainValue: 680_000, aduDollars: 100_000, aduSqft: 500, aduSqftSource: 'remarks' })
    expect(v.rate).toEqual({ lowerQuartile: 200, median: 350, upperQuartile: 500 })
    expect(v.dollars).toBe(104_000)
    expect(v.trace.some((t) => t.includes('The lower quartile, $200 a foot, times the subject\'s 520 sq ft ADU adds $104,000'))).toBe(true)
  })

  it('under five pairs within a mile the search widens to two miles once', () => {
    const near = [100_000, 150_000, 200_000, 250_000].map((extra, i) => aduSale(`A${i}`, 0.4 + i * 0.1, extra))
    const far = aduSale('F', 1.5, 300_000)
    const v = aduContributoryValue({ subject, sales: [...plain, ...near, far] })
    expect(v.radiusMiles).toBe(2)
    expect(v.pairs).toHaveLength(5)
    expect(v.pairs[4]).toMatchObject({ listingKey: 'F', plainBasis: '1.5 mi, 25 years either side, 30% of its size' })
    expect(v.rate?.lowerQuartile).toBe(300)
    expect(v.dollars).toBe(156_000)
  })

  it('a lower quartile at or below zero adds nothing, and the rate and the spread still print', () => {
    const adu = [-50_000, -20_000, 100_000, 150_000, 200_000, 250_000].map((extra, i) => aduSale(`A${i}`, 0.35 + i * 0.09, extra))
    const v = aduContributoryValue({ subject, sales: [...plain, ...adu] })
    expect(v.pairs).toHaveLength(6)
    expect(v.rate?.lowerQuartile).toBe(-40)
    expect(v.perSqftLow).toBe(-100)
    expect(v.perSqftHigh).toBe(500)
    expect(v.dollars).toBeNull()
    expect(v.trace.at(-1)).toContain('at or below zero, so the unit adds no dollars')
  })

  it('counts the homes it saw once each, and never a record whose field says no ADU', () => {
    const adu = [100_000, 150_000, 200_000].map((extra, i) => aduSale(`A${i}`, 0.4 + i * 0.1, extra))
    const twice = aduSale('T2', 0.3, 120_000, { address: '9 Twice St', closeDate: '2026-03-01' })
    const earlier = aduSale('T1', 0.3, 90_000, { address: '9 Twice St', closeDate: '2025-02-01' })
    const saysNo = aduSale('NO', 0.5, 200_000, { aduYn: false })
    const v = aduContributoryValue({ subject, sales: [...plain, ...adu, twice, earlier, saysNo] })
    expect(v.aduSalesSeen).toBe(4)
    expect(v.pairsCounted).toBe(4)
  })

  it('the subject\'s own earlier sale under another key is never a pair', () => {
    const adu = [100_000, 150_000, 200_000, 250_000, 300_000].map((extra, i) => aduSale(`A${i}`, 0.35 + i * 0.1, extra))
    const ownEarlier = aduSale('OLD-KEY', 0.0, 400_000, { address: '429 Irving' })
    const v = aduContributoryValue({ subject: { ...subject, listingKey: 'NEW-KEY', streetAddress: '429 Irving' }, sales: [...plain, ...adu, ownEarlier] })
    expect(v.pairs.map((p) => p.listingKey)).not.toContain('OLD-KEY')
    expect(v.pairsCounted).toBe(5)
  })

  it('fewer than five pairs anywhere add nothing and say so', () => {
    const adu = [100_000, 150_000, 200_000].map((extra, i) => aduSale(`A${i}`, 0.4 + i * 0.1, extra))
    const v = aduContributoryValue({ subject, sales: [...plain, ...adu] })
    expect(v.radiusMiles).toBe(2)
    expect(v.pairs).toHaveLength(3)
    expect(v.rate).toBeNull()
    expect(v.dollars).toBeNull()
    expect(v.minimumPairs).toBe(ADU_VALUE_MIN_PAIRS)
    expect(v.trace.at(-1)).toContain('under the 5 the rule needs, so the unit adds no dollars')
  })

  it('drops a sale whose field says no ADU, one with no ADU area, one whose unit is outside 150 to 1,200 sq ft, and counts one with no baseline as unpaired', () => {
    const good = [100_000, 150_000, 200_000, 250_000, 300_000].map((extra, i) => aduSale(`A${i}`, 0.35 + i * 0.1, extra))
    const saysNo = aduSale('NO', 0.5, 200_000, { aduYn: false })
    const noArea = aduSale('NA', 0.5, 200_000, { aduSqft: null, aduSqftSource: null })
    const house = aduSale('BIG', 0.5, 900_000, { aduSqft: 1545, aduSqftSource: 'mls' })
    const vintage = aduSale('OLD', 0.5, 200_000, { yearBuilt: 1920 })
    const v = aduContributoryValue({ subject, sales: [...plain, ...good, saysNo, noArea, house, vintage] })
    // Eight homes seen: the record whose field says no ADU is not one of them.
    expect(v.aduSalesSeen).toBe(8)
    expect(v.pairs.map((p) => p.listingKey).sort()).toEqual(['A0', 'A1', 'A2', 'A3', 'A4'])
    expect(v.unpaired).toBe(1)
    expect(v.trace.join(' ')).toContain('NO Example St: the MLS field says no ADU')
    expect(v.trace.join(' ')).toContain('BIG Example St: ADU area 1545 sq ft is outside 150-1200')
    expect(v.trace.join(' ')).toContain('OLD Example St: fewer than 5 plain sales near it in its era and size band')
  })

  it('the MLS field outranks the remarks and the subject\'s own sale is never a pair', () => {
    const adu = [100_000, 150_000, 200_000, 250_000, 300_000].map((extra, i) => aduSale(`A${i}`, 0.35 + i * 0.1, extra, { aduYn: true, aduSqft: 400, aduSqftSource: 'mls' }))
    const own = aduSale('SELF', 0.01, 500_000)
    const v = aduContributoryValue({ subject: { ...subject, listingKey: 'SELF' }, sales: [...plain, ...adu, own] })
    expect(v.pairs.map((p) => p.listingKey)).not.toContain('SELF')
    expect(v.pairs.every((p) => p.aduSqft === 400 && p.aduSqftSource === 'mls')).toBe(true)
    expect(v.pairs[0]?.aduPerSqft).toBe(250)
  })

  it('a condo or townhouse sale is neither a pair nor a baseline', () => {
    const adu = [100_000, 150_000, 200_000, 250_000, 300_000].map((extra, i) => aduSale(`A${i}`, 0.35 + i * 0.1, extra))
    const town = plain.map((p, i) => ({ ...p, listingKey: `T${i}`, productClass: 'townhouse' as const, closePrice: 200 * p.sqft, closePpsf: 200 }))
    const v = aduContributoryValue({ subject, sales: [...plain, ...town, ...adu] })
    expect(v.pairs[0]?.plainPpsf).toBe(400)
    expect(v.pairs[0]?.plainComps).toBe(8)
  })
})

describe('quartiles and distance', () => {
  it('nearest-rank quartiles: the lower rounds down, the upper rounds up', () => {
    expect(quartiles([100, 200, 300, 400, 500])).toEqual({ lowerQuartile: 200, median: 300, upperQuartile: 400 })
    expect(quartiles([-40, 200, 300, 400, 500, 600])).toEqual({ lowerQuartile: 200, median: 350, upperQuartile: 500 })
    expect(quartiles([7])).toBeNull()
  })

  it('milesBetween reads a degree of latitude as 69 miles', () => {
    expect(milesBetween(44, -121.3, 44 + 1 / 69, -121.3)).toBeCloseTo(1, 3)
    expect(milesBetween(44.058659, -121.300125, 44.058659, -121.300125)).toBe(0)
  })
})

describe('aduSqftFromRemarks', () => {
  it('reads the figure beside the unit, either side of it', () => {
    expect(aduSqftFromRemarks('Lovely home PLUS a detached 750 sq ft ADU over the garage.')).toBe(750)
    expect(aduSqftFromRemarks('The highlight is a 520 sq ft ADU—perfect for rental income.')).toBe(520)
    expect(aduSqftFromRemarks('Main home 1,915 sq ft, designed by Muddy River, with an ADU (484 sf) above the garage.')).toBe(484)
    expect(aduSqftFromRemarks('Charming cottage and a guest house of 600 square feet with full kitchen.')).toBe(600)
  })

  it('reads a figure the abbreviations\' periods sit in front of (513 Irving, Bend)', () => {
    const irving = "Mid town house and ADU with ''Grandfathered'' Transferrable Short Term Rental license. Main house is 2 bed, 1 bath. 1040 Sq Feet. ADU is 1 bed., 1 bath. 572 Sq. Feet. The property has one grandfathered Vacation Rental permit."
    expect(aduSqftFromRemarks(irving)).toBe(572)
    expect(mainSqftFromRemarks(irving)).toBe(1040)
    expect(mainSqftFromRemarks('The main home offers 1,900 sq ft of light-filled living, plus a 400 sq ft ADU.')).toBe(1900)
    expect(mainSqftFromRemarks('Detached ADU with its own entrance. Lot is 7,000 sq ft.')).toBeNull()
  })

  it('does not read the main home\'s area or a figure in another sentence as the unit', () => {
    expect(aduSqftFromRemarks('This 1,629 sq ft home has an ADU. The lot is 4,356 sq ft.')).toBeNull()
    expect(aduSqftFromRemarks('Two bedroom home near the river, no ADU.')).toBeNull()
    expect(aduSqftFromRemarks(null)).toBeNull()
  })

  it('takes the figure nearest the unit and never one that measures the home, a shop, a garage or the lot (review 2026-10-15)', () => {
    expect(aduSqftFromRemarks('1800 sq ft main home with a 500 sq ft ADU')).toBe(500)
    expect(aduSqftFromRemarks('Charming 1940s bungalow, 1250 sq ft, w/ a 400 sq ft ADU')).toBe(400)
    expect(aduSqftFromRemarks('Beautiful 1850 sq ft home plus a detached ADU')).toBeNull()
    expect(aduSqftFromRemarks('Includes a 1120 sq ft shop and a detached ADU')).toBeNull()
    expect(aduSqftFromRemarks('Detached ADU, plus a 1120 sq ft shop.')).toBeNull()
    expect(aduSqftFromRemarks('The ADU (built 2019) and the 980 sq ft garage/shop.')).toBeNull()
    expect(aduSqftFromRemarks('Single level 1180 sq ft, adult friendly layout. Detached ADU in back.')).toBeNull()
    expect(aduSqftFromRemarks('Sits on a 7000 sq ft lot with a permitted ADU.')).toBeNull()
    expect(aduSqftFromRemarks('Permitted ADU on this 7500 sq ft lot.')).toBeNull()
    expect(aduSqftFromRemarks('The property also features a separate 572 sq ft one-bedroom ADU that has recently undergone a complete makeover.')).toBe(572)
  })
})

describe('reconciledMainSqft (the record that counted both units)', () => {
  it('takes the remarks\' main area only when main plus unit adds up to the record', () => {
    expect(reconciledMainSqft({ recordedSqft: 1612, aduSqft: 572, mainSqft: 1040 })).toBe(1040)
    expect(reconciledMainSqft({ recordedSqft: 1650, aduSqft: 572, mainSqft: 1040 })).toBe(1040)
    expect(reconciledMainSqft({ recordedSqft: 1700, aduSqft: 572, mainSqft: 1040 })).toBeNull()
    expect(reconciledMainSqft({ recordedSqft: 1040, aduSqft: 572, mainSqft: 1040 })).toBeNull()
    expect(reconciledMainSqft({ recordedSqft: 1612, aduSqft: null, mainSqft: 1040 })).toBeNull()
    expect(reconciledMainSqft({ recordedSqft: 1612, aduSqft: 572, mainSqft: null })).toBeNull()
  })

  it('withMainSqft stamps the main area on the sales the facts carry it for and leaves the rest alone', () => {
    const facts = new Map([
      ['A', { isAdu: true, aduSqft: 572, source: 'remarks' as const, mainSqft: 1040 }],
      ['B', { isAdu: false, aduSqft: null, source: null, mainSqft: null }],
    ])
    const out = withMainSqft([{ listingKey: 'A', sqft: 1612 }, { listingKey: 'B', sqft: 1700 }, { listingKey: 'C', sqft: 1500 }], facts)
    expect(out).toEqual([{ listingKey: 'A', sqft: 1612, mainSqft: 1040 }, { listingKey: 'B', sqft: 1700 }, { listingKey: 'C', sqft: 1500 }])
    expect(withMainSqft([{ listingKey: 'A' }], null)).toEqual([{ listingKey: 'A' }])
  })

  it('a home that sold twice in the window is one pair, its latest sale', () => {
    const adu = [100_000, 150_000, 200_000, 250_000, 300_000].map((extra, i) => aduSale(`A${i}`, 0.35 + i * 0.1, extra))
    const earlier = aduSale('E1', 0.2, 50_000, { address: '513 Irving', closeDate: '2025-03-31' })
    const later = aduSale('E2', 0.2, 200_000, { address: '513 Irving', closeDate: '2026-05-21' })
    const v = aduContributoryValue({ subject, sales: [...plain, ...adu, earlier, later] })
    expect(v.pairs.map((p) => p.listingKey)).toContain('E2')
    expect(v.pairs.map((p) => p.listingKey)).not.toContain('E1')
    expect(v.pairsCounted).toBe(6)
    expect(v.trace.join(' ')).toContain('513 Irving: sold again 2026-05-21, so its 2025-03-31 sale is not a second pair')
  })

  it('a pair whose record counted both units is read over its main home', () => {
    const adu = [100_000, 150_000, 200_000, 250_000].map((extra, i) => aduSale(`A${i}`, 0.35 + i * 0.1, extra))
    // 1,612 on record, 1,040 main + 572 unit: the main home at $400 is $416,000, so a $520,000 sale's unit brought $104,000.
    const both = aduSale('BOTH', 0.5, 0, { sqft: 1612, aduSqft: 572, mainSqft: 1040, closePrice: 520_000 })
    // Its plain baseline is the band around the MAIN home, so six plain sales near 1,040 sq ft sit a quarter mile off.
    const small = Array.from({ length: 6 }, (_, i) => sale({ listingKey: `S${i}`, latitude: HOME.latitude + MILE * (0.2 + i * 0.02), sqft: 960 + i * 40 }))
    const v = aduContributoryValue({ subject, sales: [...plain, ...small, ...adu, both] })
    const p = v.pairs.find((x) => x.listingKey === 'BOTH')
    expect(p).toMatchObject({ mainSqft: 1040, mainValue: 416_000, aduDollars: 104_000, aduPerSqft: 182 })
  })
})

describe('applyAduAdjustments (the ADU line on every sale)', () => {
  const value = {
    subjectAduSqft: 520,
    radiusMiles: 1,
    aduSalesSeen: 7,
    unpaired: 0,
    pairs: [],
    pairsCounted: 7,
    minimumPairs: 5,
    rate: { lowerQuartile: 159, median: 213, upperQuartile: 390 },
    perSqftLow: -1406,
    perSqftHigh: 474,
    dollars: 82_700,
    trace: [],
  }
  const comps: Array<{ listingKey: string; adjustedPrice: number; aduAdjustment?: number; aduAdjustmentBasis?: string | null }> = [
    { listingKey: 'plain', adjustedPrice: 700_000 },
    { listingKey: 'same', adjustedPrice: 800_000 },
    { listingKey: 'bigger', adjustedPrice: 900_000 },
    { listingKey: 'unknown', adjustedPrice: 750_000 },
  ]
  const compAdu = new Map([
    ['plain', { isAdu: false, aduSqft: null, source: null, mainSqft: null }],
    ['same', { isAdu: true, aduSqft: 520, source: 'mls' as const, mainSqft: null }],
    ['bigger', { isAdu: true, aduSqft: 720, source: 'remarks' as const, mainSqft: null }],
    ['unknown', { isAdu: true, aduSqft: null, source: null, mainSqft: null }],
  ])

  it('moves a plain sale up by the subject ADU dollars, an ADU sale by the area difference, and leaves an unrecorded unit alone', () => {
    const out = applyAduAdjustments(comps, { value, subjectAduSqft: 520, compAdu })
    expect(out.map((c) => [c.listingKey, c.aduAdjustment, c.adjustedPrice])).toEqual([
      ['plain', 82_700, 782_700],
      ['same', 0, 800_000],
      ['bigger', -31_800, 868_200],
      ['unknown', 0, 750_000],
    ])
    expect(out[0]?.aduAdjustmentBasis).toBe('no ADU: moved up by what yours adds, 520 sq ft at $159 a foot')
    expect(out[1]?.aduAdjustmentBasis).toBe('states a 520 sq ft ADU, the same unit area as yours: not moved for the unit')
    expect(out[2]?.aduAdjustmentBasis).toBe('states a 720 sq ft ADU: moved for the 200 sq ft it has more than yours at $159 a foot')
    expect(out[3]?.aduAdjustmentBasis).toBe('states an ADU of unrecorded area: not moved for the unit')
  })

  it('names the main home the size line compared when the record counted both units', () => {
    const facts = new Map([['both', { isAdu: true, aduSqft: 572, source: 'remarks' as const, mainSqft: 1040 }]])
    const both: Array<{ listingKey: string; adjustedPrice: number; aduAdjustment?: number; aduAdjustmentBasis?: string | null }> = [{ listingKey: 'both', adjustedPrice: 700_000 }]
    const out = applyAduAdjustments(both, { value, subjectAduSqft: 520, compAdu: facts })
    expect(out[0]?.aduAdjustment).toBe(-8_300)
    expect(out[0]?.aduAdjustmentBasis).toBe('states a 572 sq ft ADU inside its living area on record, so the size line compares its 1,040 sq ft main home: moved for the 52 sq ft it has more than yours at $159 a foot')
  })

  it('without a rate (under five pairs) no sale moves', () => {
    const out = applyAduAdjustments(comps, { value: { ...value, rate: null, dollars: null }, subjectAduSqft: 520, compAdu })
    expect(out.every((c) => c.aduAdjustment === undefined)).toBe(true)
    expect(out.map((c) => c.adjustedPrice)).toEqual([700_000, 800_000, 900_000, 750_000])
  })
})
