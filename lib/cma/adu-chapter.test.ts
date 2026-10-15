import { describe, expect, it } from 'vitest'
import {
  ADU_CHAPTER_HEADING,
  aduChapterBodyHtml,
  aduDollarsOnCover,
  aduMethodSentences,
  aduSaleLinesHtml,
  duplexCrossCheckSentence,
  radiusWords,
} from '@/lib/cma/adu-chapter'
import { readStoredAduValue, readMultiUnitCrossCheck } from '@/lib/cma/render-contract'
import { perSquareFootSentence } from '@/lib/cma/render-pricing-page'
import { salesMethodSentences } from '@/lib/cma/sales-method-note'
import type { CmaAdjustedComp, CmaPricing, CmaSubject } from '@/lib/cma/types'

/**
 * WHAT THE ADU ADDS (Matt 2026-10-14, second call): the chapter prints the
 * paired read as stored, the lower-quartile rate, the dollars it adds, the
 * pairs table, and the duplex cross-check as one line beside the price.
 * Under five pairs it says the unit adds nothing. Nothing here computes a
 * dollar, and a row whose figures do not add up prints no chapter.
 */

const subject = { streetAddress: '429 Irving', sqft: 1629 } as CmaSubject

const pair = (over: Partial<Record<string, unknown>> = {}) => ({
  listingKey: 'P1',
  address: '1234 Example St',
  subdivision: 'Center Addition',
  closeDate: '2026-04-10',
  closePrice: 900_000,
  mainSqft: 1700,
  yearBuilt: 2005,
  miles: 0.4,
  aduSqft: 500,
  aduSqftSource: 'remarks',
  plainComps: 8,
  plainPpsf: 450,
  plainBasis: '0.75 mi, 15 years either side, 25% of its size',
  mainValue: 765_000,
  aduDollars: 135_000,
  aduPerSqft: 270,
  ...over,
})

const rated = {
  subjectAduSqft: 520,
  radiusMiles: 1,
  aduSalesSeen: 9,
  unpaired: 2,
  pairs: [
    pair(),
    pair({ listingKey: 'P2', address: '55 Second Ave', aduDollars: 79_500, aduPerSqft: 159, closeDate: '2025-12-02' }),
    pair({ listingKey: 'P3', address: '7 Third Pl', aduDollars: 106_500, aduPerSqft: 213 }),
    pair({ listingKey: 'P4', address: '9 Fourth Ct', aduDollars: 195_000, aduPerSqft: 390 }),
    pair({ listingKey: 'P5', address: '11 Fifth Ln', aduDollars: 100_000, aduPerSqft: 200 }),
    pair({ listingKey: 'P6', address: '13 Sixth Dr', aduDollars: -10_000, aduPerSqft: -20 }),
    pair({ listingKey: 'P7', address: '15 Seventh Way', aduDollars: 150_000, aduPerSqft: 300 }),
  ],
  pairsCounted: 7,
  minimumPairs: 5,
  windowMonths: 24,
  rate: { lowerQuartile: 159, median: 213, upperQuartile: 390 },
  perSqftLow: -20,
  perSqftHigh: 390,
  dollars: 82_700,
  trace: [],
}

const crossCheck = {
  units: 2,
  propertySubType: 'Duplex',
  sqft: 2149,
  sqftBasis: "the current record's 1,629 sq ft main home plus its 520 sq ft ADU",
  compsHeld: 5,
  outcome: 'same-units',
  recommended: 637_000,
  valueLow: 600_000,
  valueHigh: 690_000,
  trace: [],
}

const pricing = (over: Partial<CmaPricing> = {}) => ({ recommended: 793_700, aduValue: rated, ...over }) as unknown as CmaPricing

describe('readStoredAduValue', () => {
  it('reads a stored rated read as stored', () => {
    const v = readStoredAduValue(pricing())
    expect(v?.dollars).toBe(82_700)
    expect(v?.rate).toEqual({ lowerQuartile: 159, median: 213, upperQuartile: 390 })
    expect(v?.pairs).toHaveLength(7)
    expect(v?.pairsCounted).toBe(7)
    expect(v?.windowMonths).toBe(24)
    expect(v?.pairs[1]).toMatchObject({ address: '55 Second Ave', aduDollars: 79_500, aduPerSqft: 159 })
  })

  it('rejects dollars that are not the lower quartile times the subject area, and a pair with no price', () => {
    expect(readStoredAduValue(pricing({ aduValue: { ...rated, dollars: 90_000 } } as Partial<CmaPricing>))).toBeNull()
    expect(readStoredAduValue(pricing({ aduValue: { ...rated, pairs: [pair({ closePrice: null })] } } as Partial<CmaPricing>))).toBeNull()
    expect(readStoredAduValue({ aduValue: null })).toBeNull()
    expect(readStoredAduValue(null)).toBeNull()
  })

  it('keeps a short read, with its counts and no rate', () => {
    const v = readStoredAduValue({ aduValue: { ...rated, pairs: rated.pairs.slice(0, 3), pairsCounted: 3, rate: null, dollars: null, radiusMiles: 2 } })
    expect(v?.dollars).toBeNull()
    expect(v?.rate).toBeNull()
    expect(v?.pairsCounted).toBe(3)
    expect(v?.radiusMiles).toBe(2)
  })
})

describe('readMultiUnitCrossCheck', () => {
  it('reads a priced check and one the ladder could not price', () => {
    expect(readMultiUnitCrossCheck({ multiUnitCrossCheck: crossCheck })).toMatchObject({ recommended: 637_000, valueLow: 600_000, valueHigh: 690_000, compsHeld: 5 })
    expect(readMultiUnitCrossCheck({ multiUnitCrossCheck: { ...crossCheck, recommended: null, valueLow: null, valueHigh: null, compsHeld: 2 } })).toMatchObject({
      recommended: null,
      compsHeld: 2,
    })
    expect(readMultiUnitCrossCheck({ multiUnitCrossCheck: { ...crossCheck, valueHigh: 500_000 } })).toBeNull()
    expect(readMultiUnitCrossCheck({ multiUnitCrossCheck: null })).toBeNull()
  })
})

describe('aduChapterBodyHtml', () => {
  it('prints the paired read, the lower-quartile rate, the dollars, the pairs table and the cross-check line', () => {
    const html = aduChapterBodyHtml({ subject, pricing: pricing({ multiUnitCrossCheck: crossCheck } as Partial<CmaPricing>) })
    expect(html).toContain('Your home carries a 520 square foot accessory dwelling unit.')
    expect(html).toContain('Seven homes within a mile of yours sold with an ADU in the last 24 months and could be read this way.')
    expect(html).toContain('−$20 to $390 a square foot of unit, $213 at the middle.')
    expect(html).toContain('The price uses the lower quartile, $159 a foot, not the middle, so the unit is never the reason the price is high. Times your 520 square feet, that adds $82,700.')
    expect(html).toContain('<table class="kv is-wide adu-pairs">')
    expect(html).toContain('<th scope="row">55 Second Ave</th>')
    expect(html).toContain('<td class="v n">+$79,500</td>')
    expect(html).toContain('<td class="v n">+$159</td>')
    expect(html).toContain('at least eight plain sales near it')
    expect(html).toContain(
      'A check beside the price: an earlier MLS record typed 429 Irving as a duplex. Read that way over 2,149 square feet (the current record&#39;s 1,629 sq ft main home plus its 520 sq ft ADU), five closed duplex sales put it at $637,000 ($600,000 to $690,000) before the comparability review.',
    )
    expect(html).toContain('the duplex read is printed so you can see both.')
    expect(html).not.toContain('—')
  })

  it('under five pairs says the unit adds nothing and why, with no table', () => {
    const html = aduChapterBodyHtml({
      subject,
      pricing: pricing({ aduValue: { ...rated, pairs: rated.pairs.slice(0, 3), pairsCounted: 3, rate: null, dollars: null, radiusMiles: 2, aduSalesSeen: 4 } } as Partial<CmaPricing>),
    })
    expect(html).toContain('Within two miles of your home, four homes sold with an ADU in the last 24 months, and three could be read against plain sales of their own era and size. Five are needed for a rate, so the unit adds no dollars here.')
    expect(html).not.toContain('<table')
  })

  it('with no ADU sale near says so, and prints nothing on a home with neither read', () => {
    const html = aduChapterBodyHtml({
      subject,
      pricing: pricing({ aduValue: { ...rated, pairs: [], pairsCounted: 0, rate: null, dollars: null, radiusMiles: 2, aduSalesSeen: 0 } } as Partial<CmaPricing>),
    })
    expect(html).toContain('No home within two miles of yours sold with an ADU in the last 24 months, so the unit cannot be priced on its own and adds no dollars here.')
    expect(aduChapterBodyHtml({ subject, pricing: { recommended: 500_000 } as CmaPricing })).toBe('')
  })

  it('lists how each printed sale was read on the ADU line, off the grid\'s own basis strings', () => {
    const comps = [
      { address: '636 Irving', aduAdjustment: 82_700, aduAdjustmentBasis: 'no ADU: moved up by what yours adds, 520 sq ft at $159 a foot' },
      { address: '513 Irving', aduAdjustment: -8_300, aduAdjustmentBasis: 'states a 572 sq ft ADU inside its living area on record, so the size line compares its 1040 sq ft main home: moved for the 52 sq ft it has more than yours at $159 a foot' },
      { address: '545 Irving', aduAdjustment: 0, aduAdjustmentBasis: 'states an ADU of unrecorded area: not moved for the unit' },
      { address: '1 Nowhere', aduAdjustment: undefined, aduAdjustmentBasis: null },
    ] as unknown as CmaAdjustedComp[]
    const html = aduSaleLinesHtml(comps)
    expect(html).toContain('<li>636 Irving: no ADU: moved up by what yours adds, 520 sq ft at $159 a foot, +$82,700.</li>')
    expect(html).toContain('<li>513 Irving: states a 572 sq ft ADU inside its living area on record, so the size line compares its 1040 sq ft main home: moved for the 52 sq ft it has more than yours at $159 a foot, −$8,300.</li>')
    expect(html).toContain('<li>545 Irving: states an ADU of unrecorded area: not moved for the unit, $0.</li>')
    expect(html).not.toContain('1 Nowhere')
    expect(aduSaleLinesHtml([])).toBe('')
    const body = aduChapterBodyHtml({ subject, pricing: pricing(), comps })
    expect(body).toContain('How each sale above was read on the ADU line:')
  })

  it('a cross-check the ladder could not price names no count it does not hold, and the class pass names two- to four-unit sales', () => {
    const s = duplexCrossCheckSentence({ ...crossCheck, outcome: 'same-units', recommended: null, valueLow: null, valueHigh: null, compsHeld: 2 }, subject)
    expect(s).toBe(
      "A check beside the price: an earlier MLS record typed 429 Irving as a duplex. Read that way over 2,149 square feet (the current record's 1,629 sq ft main home plus its 520 sq ft ADU), too few closed sales of that kind were found to price it, so no duplex figure is set beside the price.",
    )
    const c = duplexCrossCheckSentence({ ...crossCheck, outcome: 'class' }, subject)
    expect(c).toContain('five closed two- to four-unit sales put it at $637,000')
    expect(readMultiUnitCrossCheck({ multiUnitCrossCheck: { ...crossCheck, outcome: 'class' } })?.outcome).toBe('class')
  })

  it('five or more pairs whose lower quartile is at or below zero say the unit adds nothing, with the spread', () => {
    const html = aduChapterBodyHtml({
      subject,
      pricing: pricing({ aduValue: { ...rated, rate: { lowerQuartile: -20, median: 213, upperQuartile: 390 }, perSqftLow: -1406, perSqftHigh: 474, dollars: null } } as Partial<CmaPricing>),
    })
    expect(html).toContain('What their units brought runs from −$1,406 to $474 a square foot of unit, and the lower quartile, −$20 a foot, is at or below zero, so the unit adds no dollars here.')
    expect(html).not.toContain('<table')
    expect(aduDollarsOnCover(pricing({ aduValue: { ...rated, dollars: null } } as Partial<CmaPricing>))).toBeNull()
  })

  it('the range reads every pair and the caption says when the list is the nearest few', () => {
    const html = aduChapterBodyHtml({
      subject,
      pricing: pricing({ aduValue: { ...rated, pairsCounted: 20, perSqftLow: -1406, perSqftHigh: 474 } } as Partial<CmaPricing>),
    })
    expect(html).toContain('20 homes within a mile of yours sold with an ADU in the last 24 months and could be read this way.')
    expect(html).toContain('−$1,406 to $474 a square foot of unit, $213 at the middle.')
    expect(html).toContain('The nearest seven of the 20 pairs are listed.')
  })
})

describe('the cover and the basis', () => {
  it('splits the per-foot line into the main home and the unit when the price carries the ADU dollars', () => {
    expect(aduDollarsOnCover(pricing())).toEqual({ dollars: 82_700, sqft: 520 })
    expect(perSquareFootSentence(1629, 793_700, { adu: aduDollarsOnCover(pricing()) })).toBe(
      "The price on the cover comes to $436 per square foot across your home's 1,629 square feet, with $82,700 on top for the 520 square foot ADU.",
    )
    expect(perSquareFootSentence(1629, 793_700)).toBe("The price on the cover comes to $487 per square foot across your home's 1,629 square feet.")
    expect(aduDollarsOnCover({ recommended: 500_000 } as CmaPricing)).toBeNull()
  })

  it('names the ADU line in Basis only when a printed sale moved for it', () => {
    const moved = [{ listingKey: 'A', aduAdjustment: 82_700 }, { listingKey: 'B', aduAdjustment: 0 }] as unknown as CmaAdjustedComp[]
    expect(aduMethodSentences(pricing(), moved)).toEqual([
      'Each sale without an ADU is moved up by $82,700, what your 520 square foot unit adds at $159 a foot, the lower quartile of seven paired sales within a mile. A sale with its own unit is moved only for the difference in unit area.',
    ])
    expect(aduMethodSentences(pricing(), [{ listingKey: 'B', aduAdjustment: 0 }] as unknown as CmaAdjustedComp[])).toEqual([])
    expect(aduMethodSentences({ recommended: 1 } as CmaPricing, moved)).toEqual([])
    const all = salesMethodSentences({ subject: { subdivision: null, city: 'Bend' }, comps: moved, pricing: pricing() })
    expect(all.some((s) => s.startsWith('Each sale without an ADU is moved up by $82,700'))).toBe(true)
  })

  it('radius words', () => {
    expect(radiusWords(1)).toBe('a mile')
    expect(radiusWords(2)).toBe('two miles')
    expect(ADU_CHAPTER_HEADING).toBe('What the ADU adds')
  })
})
