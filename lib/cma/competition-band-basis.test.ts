import { describe, expect, it } from 'vitest'
import { BAND_CENTER_DESCRIPTION, competitionBandBasisSentence } from '@/lib/cma/competition-band-basis'
import { competitionBodyMatrixHtml, type OpinionPageArgs } from '@/lib/cma/opinion-pages'
import type { CmaPricing, CmaSubject } from '@/lib/cma/types'

/** The phrase that gave a seller two ceilings (reader review 2026-10-08). */
const TWO_CEILINGS = 'the list price the closed sales supported'

/**
 * Reader review 2026-10-07: the competition range is read around the list
 * before the homes for sale are weighed, so it can sit off the recommended
 * list. Reader review 2026-10-08: that center is the pre-clamp list, so it can
 * sit ABOVE the top of the range the sales support, and the letter must not
 * call it a price the sales supported. The four stored letters rebuilt on
 * b3132caf5 (scratchpad reader-review-2, 2026-10-08) are pinned below:
 * bandBasis.center / halfWidth / baseHalfWidth, pricing.recommended and
 * pricing.valueLow / valueHigh as the render args hold them.
 */
describe('competitionBandBasisSentence', () => {
  it('3037 Purcell: center $556,000 above the $545,350 band top, recommended $545,000', () => {
    const s = competitionBandBasisSentence(
      { center: 556_000, halfWidth: 0.1, baseHalfWidth: 0.1 },
      545_000,
      { low: 538_797, high: 545_350 },
    )
    expect(s).toBe(
      'This range is 10% either side of $556,000, the list we started from before the homes for sale were weighed. That starting point is above $545,350, the top of the range the sales support, so the list price we recommend, set after that, sits under the center.',
    )
    expect(s).not.toContain(TWO_CEILINGS)
    expect(s).not.toContain('supported')
  })

  it('3177 Coho: center $556,000 above the $551,876 band top, recommended $551,000', () => {
    const s = competitionBandBasisSentence(
      { center: 556_000, halfWidth: 0.1, baseHalfWidth: 0.1 },
      551_000,
      { low: 531_576, high: 551_876 },
    )
    expect(s).toBe(
      'This range is 10% either side of $556,000, the list we started from before the homes for sale were weighed. That starting point is above $551,876, the top of the range the sales support, so the list price we recommend, set after that, sits under the center.',
    )
    expect(s).not.toContain(TWO_CEILINGS)
  })

  it('2745 Aldrich: center $480,000 above the $479,161 band top, range opened to 15%', () => {
    const s = competitionBandBasisSentence(
      { center: 480_000, halfWidth: 0.15, baseHalfWidth: 0.1 },
      479_000,
      { low: 473_949, high: 479_161 },
    )
    expect(s).toBe(
      'This range is 15% either side of $480,000, the list we started from before the homes for sale were weighed. That starting point is above $479,161, the top of the range the sales support, so the list price we recommend, set after that, sits under the center. It opened from 10% because fewer than five homes like yours were for sale or under contract inside 10%.',
    )
    expect(s).not.toContain(TWO_CEILINGS)
  })

  it('2382 Jackson: center $629,000 inside $598,620 to $648,772, range opened to 15%', () => {
    const s = competitionBandBasisSentence(
      { center: 629_000, halfWidth: 0.15, baseHalfWidth: 0.1 },
      624_000,
      { low: 598_620, high: 648_772 },
    )
    expect(s).toBe(
      'This range is 15% either side of $629,000, the list we started from before the homes for sale were weighed. The list price we recommend was set after that, so it can sit off center. It opened from 10% because fewer than five homes like yours were for sale or under contract inside 10%.',
    )
    expect(s).not.toContain(TWO_CEILINGS)
    // The band ends are the reader's figures from the opinion chapter; a
    // center inside the band names neither, and never the clamp's $649,000.
    expect(s).not.toContain('$648,772')
    expect(s).not.toContain('$649,000')
  })

  it('names the end it sits past, so every dollar printed is the center or a band end', () => {
    for (const [center, rec, band] of [
      [556_000, 545_000, { low: 538_797, high: 545_350 }],
      [556_000, 551_000, { low: 531_576, high: 551_876 }],
      [480_000, 479_000, { low: 473_949, high: 479_161 }],
      [629_000, 624_000, { low: 598_620, high: 648_772 }],
    ] as const) {
      const s = competitionBandBasisSentence({ center, halfWidth: 0.1, baseHalfWidth: 0.1 }, rec, band)
      const dollars = s.match(/\$\d[\d,]*\d/g) ?? []
      const allowed = new Set([center, band.low, band.high].map((n) => `$${n.toLocaleString('en-US')}`))
      for (const d of dollars) expect(allowed.has(d)).toBe(true)
    }
  })

  it('a center under the band bottom says so, and that the recommended list sits above it', () => {
    const s = competitionBandBasisSentence(
      { center: 500_000, halfWidth: 0.1, baseHalfWidth: 0.1 },
      520_000,
      { low: 515_000, high: 540_000 },
    )
    expect(s).toBe(
      'This range is 10% either side of $500,000, the list we started from before the homes for sale were weighed. That starting point is below $515,000, the bottom of the range the sales support, so the list price we recommend, set after that, sits above the center.',
    )
  })

  it('without the band it says what the center is and that the list can sit off center (old rows)', () => {
    const s = competitionBandBasisSentence({ center: 531_000, halfWidth: 0.1, baseHalfWidth: 0.1 }, 529_000)
    expect(s).toBe(
      `This range is 10% either side of $531,000, ${BAND_CENTER_DESCRIPTION}. The list price we recommend was set after that, so it can sit off center.`,
    )
  })

  it('does not reprint the recommended list when the range is centered on it', () => {
    const s = competitionBandBasisSentence({ center: 610_400, halfWidth: 0.1, baseHalfWidth: 0.1 }, 610_000, {
      low: 590_000,
      high: 605_000,
    })
    expect(s).toBe('This range is 10% either side of the list price we recommend.')
    expect(s).not.toMatch(/\$/)
  })

  it('says nothing without a recorded center (rows built before this field)', () => {
    expect(competitionBandBasisSentence(null, 500_000)).toBe('')
    expect(competitionBandBasisSentence({ center: 0, halfWidth: 0.1, baseHalfWidth: 0.1 }, 500_000)).toBe('')
  })

  it('never prints an em dash', () => {
    const s = competitionBandBasisSentence(
      { center: 556_000, halfWidth: 0.15, baseHalfWidth: 0.1 },
      545_000,
      { low: 538_797, high: 545_350 },
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

  it('passes the sales range through, so a center above its top is named as a starting point', () => {
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
    expect(html).toContain('This range is 10% either side of $556,000, the list we started from before the homes for sale were weighed.')
    expect(html).toContain('That starting point is above $545,350, the top of the range the sales support')
    expect(html).not.toContain(TWO_CEILINGS)
  })
})
