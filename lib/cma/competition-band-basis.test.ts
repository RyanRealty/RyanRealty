import { describe, expect, it } from 'vitest'
import { competitionBandBasisSentence } from '@/lib/cma/competition-band-basis'
import { competitionBodyMatrixHtml, type OpinionPageArgs } from '@/lib/cma/opinion-pages'
import type { CmaPricing, CmaSubject } from '@/lib/cma/types'

/**
 * Reader review 2026-10-07: the competition range is read around the list
 * before the homes for sale are weighed, so it can sit off the recommended
 * list. Jackson printed $502K-$680K (±15% of $591,000) beside a $573,000
 * recommendation, Purcell $478K-$584K (±10% of $531,000) beside $529,000.
 */
describe('competitionBandBasisSentence', () => {
  it('names the off-center figure and why it is off center (Purcell)', () => {
    const s = competitionBandBasisSentence({ center: 531_000, halfWidth: 0.1, baseHalfWidth: 0.1 }, 529_000)
    expect(s).toBe(
      'This range is 10% either side of $531,000, the list price the closed sales supported before we weighed the homes for sale. The list price we recommend was set after that, so it can sit off center.',
    )
  })

  it('discloses a range opened past 10% (Jackson)', () => {
    const s = competitionBandBasisSentence({ center: 591_000, halfWidth: 0.15, baseHalfWidth: 0.1 }, 573_000)
    expect(s).toContain('This range is 15% either side of $591,000')
    expect(s).toContain(
      'It opened from 10% because fewer than five homes like yours were for sale or under contract inside 10%.',
    )
  })

  it('does not reprint the recommended list when the range is centered on it', () => {
    const s = competitionBandBasisSentence({ center: 610_400, halfWidth: 0.1, baseHalfWidth: 0.1 }, 610_000)
    expect(s).toBe('This range is 10% either side of the list price we recommend.')
    expect(s).not.toMatch(/\$/)
  })

  it('says nothing without a recorded center (rows built before this field)', () => {
    expect(competitionBandBasisSentence(null, 500_000)).toBe('')
    expect(competitionBandBasisSentence({ center: 0, halfWidth: 0.1, baseHalfWidth: 0.1 }, 500_000)).toBe('')
  })

  it('never prints an em dash', () => {
    const s = competitionBandBasisSentence({ center: 591_000, halfWidth: 0.15, baseHalfWidth: 0.1 }, 573_000)
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
    lastListPrice: 559_000,
    lastListDate: '2026-05-01',
    listingHistoryLine: null,
  } as CmaSubject
  const pricing = {
    conservative: 515_000,
    recommended: 529_000,
    highEnd: 540_000,
    valueLow: 515_000,
    valueHigh: 540_000,
    notes: [],
  } as unknown as CmaPricing

  it('adds the center sentence after the count sentence', () => {
    const html = competitionBodyMatrixHtml({
      subject,
      comps: [],
      pricing,
      generatedAtIso: '2026-10-07T00:00:00.000Z',
      bandRivals: {
        lo: 478_000,
        hi: 584_000,
        activeCount: 0,
        pendingCount: 0,
        rivals: [],
        sentence: 'No home is for sale between $478,000 and $584,000, and none is under contract.',
        source: 'test',
        bandBasis: { center: 531_000, halfWidth: 0.1, baseHalfWidth: 0.1 },
      },
    } as unknown as OpinionPageArgs)
    expect(html).toContain('This range is 10% either side of $531,000')
    expect(html).toContain('so it can sit off center.')
  })
})
