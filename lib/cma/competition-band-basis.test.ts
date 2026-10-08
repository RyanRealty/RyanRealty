import { describe, expect, it } from 'vitest'
import { BAND_CENTER_DESCRIPTION, competitionBandBasisSentence, windowSplit } from '@/lib/cma/competition-band-basis'
import { competitionBodyMatrixHtml, type OpinionPageArgs } from '@/lib/cma/opinion-pages'
import type { CmaPricing, CmaSubject } from '@/lib/cma/types'

/** The phrase that gave a seller two ceilings (reader review 2026-10-08). */
const TWO_CEILINGS = 'the list price the closed sales supported'

/**
 * Reader review 2026-10-07: the competition range is read around the list
 * before the homes for sale are weighed, so it can sit off the recommended
 * list. Reader review 2026-10-08: that starting list printed as a dollar
 * figure nobody could trace ("10% either side of $735,000" under a $713,000
 * cover on 3062 NW Kelly Hill; "$551,000 ... above $550,951" on 3037
 * Purcell), so the sentence now speaks only in the range's printed ends and
 * the cover price. The cases below are the stored rows' own
 * bandRivals.bandBasis, bandRivals.lo / hi and pricing.recommended.
 */
describe('competitionBandBasisSentence', () => {
  it('3062 NW Kelly Hill: $662,000 to $809,000 around a $713,000 cover says 7% under and 13% over, no $735,000', () => {
    const s = competitionBandBasisSentence(
      { center: 735_000, halfWidth: 0.1, baseHalfWidth: 0.1 },
      713_000,
      { lo: 662_000, hi: 809_000 },
    )
    expect(s).toBe(
      'This range was set 10% either side of the list we started from before the homes for sale were weighed. The list price we recommend was set after they were weighed, so the range runs from 7% under it to 13% over it.',
    )
    // (713,000 - 662,000) / 713,000 = 7.2%; (809,000 - 713,000) / 713,000 = 13.5%.
    expect(windowSplit({ lo: 662_000, hi: 809_000 }, 713_000)).toEqual({ under: 7, over: 13 })
    expect(s).not.toContain('$735,000')
    expect(s).not.toMatch(/\$/)
    expect(s).not.toContain('center')
  })

  it('3037 Purcell as rebuilt: $496,000 to $606,000 is 10% either side of the $550,000 cover, so it says so', () => {
    const s = competitionBandBasisSentence(
      { center: 551_000, halfWidth: 0.1, baseHalfWidth: 0.1 },
      550_000,
      { lo: 496_000, hi: 606_000 },
    )
    expect(s).toBe('This range is 10% either side of the list price we recommend.')
    expect(s).not.toContain('$551,000')
    expect(s).not.toContain('$550,951')
  })

  it('2382 Jackson (held): opened to 15%, $535,000 to $723,000 around $624,000', () => {
    const s = competitionBandBasisSentence(
      { center: 629_000, halfWidth: 0.15, baseHalfWidth: 0.1 },
      624_000,
      { lo: 535_000, hi: 723_000 },
      { held: true },
    )
    expect(s).toBe(
      'This range was set 15% either side of the list we started from before the homes for sale were weighed. The price on the cover was set after they were weighed, so the range runs from 14% under it to 16% over it. It opened from 10% because fewer than five homes like yours were for sale or under contract inside 10%.',
    )
    expect(s).not.toMatch(/recommend|\$/)
  })

  it('62475 Woodsman (held): centered on the cover, named as the price on the cover', () => {
    const s = competitionBandBasisSentence(
      { center: 1_576_000, halfWidth: 0.1, baseHalfWidth: 0.1 },
      1_576_000,
      { lo: 1_418_000, hi: 1_734_000 },
      { held: true },
    )
    expect(s).toBe('This range is 10% either side of the price on the cover.')
  })

  it('an earlier Purcell row (center $556,000, cover $545,000) reads 8% under and 12% over', () => {
    const s = competitionBandBasisSentence(
      { center: 556_000, halfWidth: 0.1, baseHalfWidth: 0.1 },
      545_000,
      { lo: 500_000, hi: 612_000 },
    )
    expect(s).toBe(
      'This range was set 10% either side of the list we started from before the homes for sale were weighed. The list price we recommend was set after they were weighed, so the range runs from 8% under it to 12% over it.',
    )
    expect(s).not.toContain(TWO_CEILINGS)
  })

  it('never prints a dollar figure of its own', () => {
    for (const [center, rec, lo, hi] of [
      [735_000, 713_000, 662_000, 809_000],
      [551_000, 550_000, 496_000, 606_000],
      [629_000, 624_000, 535_000, 723_000],
      [480_000, 479_000, 408_000, 552_000],
    ] as const) {
      expect(competitionBandBasisSentence({ center, halfWidth: 0.1, baseHalfWidth: 0.1 }, rec, { lo, hi })).not.toMatch(/\$/)
    }
  })

  it('without the printed ends it says what the center is and that the list can sit off center (old rows)', () => {
    const s = competitionBandBasisSentence({ center: 531_000, halfWidth: 0.1, baseHalfWidth: 0.1 }, 529_000)
    expect(s).toBe(
      `This range was set 10% either side of ${BAND_CENTER_DESCRIPTION}. The list price we recommend was set after they were weighed, so it can sit off center.`,
    )
  })

  it('without the printed ends, a center on the recommended list does not reprint it', () => {
    const s = competitionBandBasisSentence({ center: 610_400, halfWidth: 0.1, baseHalfWidth: 0.1 }, 610_000)
    expect(s).toBe('This range is 10% either side of the list price we recommend.')
    expect(s).not.toMatch(/\$/)
  })

  it('a cover outside the printed ends gets no split it cannot support', () => {
    expect(windowSplit({ lo: 820_000, hi: 1_002_000 }, 800_000)).toBeNull()
    const s = competitionBandBasisSentence(
      { center: 911_000, halfWidth: 0.1, baseHalfWidth: 0.1 },
      800_000,
      { lo: 820_000, hi: 1_002_000 },
      { held: true },
    )
    expect(s).toBe(
      'This range was set 10% either side of the list we started from before the homes for sale were weighed. The price on the cover was set after they were weighed, so it can sit off center.',
    )
  })

  it('says nothing without a recorded center (rows built before this field)', () => {
    expect(competitionBandBasisSentence(null, 500_000)).toBe('')
    expect(competitionBandBasisSentence({ center: 0, halfWidth: 0.1, baseHalfWidth: 0.1 }, 500_000)).toBe('')
  })

  it('never prints an em dash', () => {
    const s = competitionBandBasisSentence(
      { center: 556_000, halfWidth: 0.15, baseHalfWidth: 0.1 },
      545_000,
      { lo: 473_000, hi: 639_000 },
    )
    expect(s).not.toMatch(/[—–]/)
  })
})

describe('the competition chapter prints the basis beside the range', () => {
  const subject = {
    listingKey: 'S',
    mlsNumber: '1',
    streetAddress: '3037 Purcell',
    city: 'Bend',
    state: 'OR',
    postalCode: '97701',
    subdivision: 'Silver Sage',
    latitude: 44.05,
    longitude: -121.3,
    beds: 3,
    baths: 2,
    sqft: 1600,
    lotAcres: 0.2,
    propertySubType: 'Single Family Residence',
    yearBuilt: 2004,
    garageSpaces: 2,
    photoUrl: null,
    publicRemarks: null,
    viewDescription: null,
    taxAnnual: null,
    standardStatus: 'Expired',
    lastListPrice: 565_000,
    lastListDate: '2026-08-28',
    listingHistoryLine: null,
  } as CmaSubject
  // 3037 Purcell as stored 2026-10-08: recommended $545,000 under a
  // $538,797 to $545,350 sales range, competition band centered on $556,000.
  const pricing = {
    conservative: 545_000,
    recommended: 545_000,
    highEnd: 545_350,
    valueLow: 538_797,
    valueHigh: 545_350,
    notes: [],
  } as unknown as CmaPricing

  it('passes the printed range through, so the sentence speaks in its ends and the cover price', () => {
    const html = competitionBodyMatrixHtml({
      subject,
      comps: [],
      pricing,
      generatedAtIso: '2026-10-08T00:47:24.225Z',
      bandRivals: {
        lo: 500_000,
        hi: 612_000,
        activeCount: 0,
        pendingCount: 0,
        rivals: [],
        sentence: 'No home in Silver Sage or your street in Holliday Park is for sale between $500,000 and $612,000, and none is under contract.',
        source: 'test',
        bandBasis: { center: 556_000, halfWidth: 0.1, baseHalfWidth: 0.1 },
      },
    } as unknown as OpinionPageArgs)
    expect(html).toContain(
      'This range was set 10% either side of the list we started from before the homes for sale were weighed. The list price we recommend was set after they were weighed, so the range runs from 8% under it to 12% over it.',
    )
    expect(html).not.toContain('$556,000')
    expect(html).not.toContain(TWO_CEILINGS)
  })
})
