/**
 * LETTER WORDING, ROUND THREE (independent reader reviews of the rebuilt
 * letters, 2026-10-08: 62475 Woodsman, 20676 Wild Rose, 3062 NW Kelly Hill,
 * 1355 Jacksonville, 2382 Jackson, 2745 Aldrich).
 *
 *  1. A cover the failed-ask ceiling moved, on a held letter (no clamp
 *     sentence, rule 26), is not the weights' number: the sales set the range.
 *  2. A set-aside pin says what the legend says ("did not set the range").
 *  3. "Sold N months ago" counts whole months by the day.
 *  4. A held letter's net page title names the price its column names.
 *  5. Basis and limits names the grid by its chapter's heading.
 *  6. The trim sentence says "the highest and the lowest sale".
 *  7. A tie at the printed weight names every sale that prints it.
 *  8. A gap measured on the last of several asks says "Your last ask".
 *  9. Rule 20: a lot under an acre that differs from the home's is disclosed.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  COVER_ROUNDING_STEP,
  WEIGHT_AMONG_SALES_ROW_LABEL,
  WEIGHT_IN_PRICE_ROW_LABEL,
  clampMovedCoverOffTheWeights,
  reconciliationSentenceFor,
  salesSetOnlyTheRange,
  weightMeaningSentence,
  weightRowLabel,
} from '@/lib/cma/sales-role'
import {
  HELD_SALES_HEADING,
  RANGE_SALES_HEADING,
  SALES_THAT_SET_IT_HEADING,
  pricingPage,
  salesThatSetItHeading,
  salesThatSetItPage,
  salesThatSetItPhrase,
} from '@/lib/cma/render-pricing-page'
import {
  CLOSED_SET_RANGE_LABEL,
  SET_ASIDE_PIN_NOTE,
  SET_ASIDE_PIN_NOTE_RANGE,
  compPinMap,
  pinReading,
  setAsidePinNote,
  type CmaPinFact,
} from '@/lib/cma/comp-pin-map'
import { reconcileAdjustedSales, wholeMonthsBetween, type ReconcilableSale } from '@/lib/pricing/reconciliation'
import { rangeSpreadCauseSentence } from '@/lib/cma/cover-value'
import { askAgainstRangeSentence, askStoryReading, measuresLastOfSeveralAsks } from '@/lib/cma/ask-story'
import { lotDifferenceSentence, subAcreLotDifferences } from '@/lib/cma/lot-disclosure'
import { lotsDiffer } from '@/lib/cma/judge-ground'
import { renderCmaHtml, type RenderCmaArgs } from '@/lib/cma/render'
import type { CmaAdjustedComp, CmaBroker, CmaPricing, CmaSubject } from '@/lib/cma/types'

const EM_DASH = '—'

/** What a homeowner reads. */
function visible(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
}

function sale(o: Record<string, unknown>): CmaAdjustedComp {
  return {
    city: 'Bend',
    subdivision: 'Woodside Ranch',
    sqft: 3_000,
    closeDate: '2026-06-01',
    concessions: 0,
    concessionsAmount: 0,
    storyAdjustment: 0,
    timeAdjustment: 0,
    ...o,
  } as unknown as CmaAdjustedComp
}

// ── 1. Woodsman ──────────────────────────────────────────────────────────────

/**
 * 62475 Woodsman as stored (cmas render_args, 2026-10-01): seven sales, three
 * set aside, four carrying 32.4 / 27.4 / 26.9 / 13.3 percent.
 */
const WOODSMAN_COMPS: CmaAdjustedComp[] = [
  sale({ listingKey: 'W1', address: '62531 Woodsman', sqft: 2824, closeDate: '2026-09-04', closePrice: 1_662_500, sizeAdjustment: -44_447, adjustedPrice: 1_618_053, weight: 3.9206 }),
  sale({ listingKey: 'W2', address: '62467 Woodsman', sqft: 2998, closeDate: '2026-06-25', closePrice: 1_708_800, concessions: 41_100, concessionsAmount: 41_100, sizeAdjustment: -90_394, adjustedPrice: 1_577_306, weight: 3.3134 }),
  sale({ listingKey: 'A1', address: '62637 Mt Hood', sqft: 2488, closeDate: '2026-05-06', closePrice: 1_455_000, concessions: 5_000, concessionsAmount: 5_000, sizeAdjustment: 53_909, adjustedPrice: 1_503_909, weight: 3.2568 }),
  sale({ listingKey: 'W3', address: '62552 Woodsman', sqft: 2693, closeDate: '2026-04-23', closePrice: 1_570_000, concessions: 10_000, concessionsAmount: 10_000, sizeAdjustment: -5_793, adjustedPrice: 1_554_207, weight: 3.2438 }),
  sale({ listingKey: 'W4', address: '62621 Mt Hood', sqft: 2845, closeDate: '2026-04-21', closePrice: 1_625_000, sizeAdjustment: -49_121, adjustedPrice: 1_575_879, weight: 1.6095 }),
  sale({ listingKey: 'A2', address: '62667 Ember', sqft: 2262, closeDate: '2026-02-20', closePrice: 1_380_000, concessions: 1_000, concessionsAmount: 1_000, sizeAdjustment: 125_281, adjustedPrice: 1_504_281, weight: 1.5676 }),
  sale({ listingKey: 'A3', address: '3369 Zayden', sqft: 2904, closeDate: '2025-12-11', closePrice: 1_807_500, sizeAdjustment: -71_889, adjustedPrice: 1_735_611, weight: 3.0785 }),
]

const WOODSMAN_ASIDE = [
  { end: 'low', reason: 'lowest of the adjusted sales, set aside so one sale cannot set the range', address: '62637 Mt Hood', listingKey: 'A1', adjustedPrice: 1_503_909 },
  { end: 'low', reason: 'below the sales that carry this price, and it barely moves the number, so it does not set the range', address: '62667 Ember', listingKey: 'A2', adjustedPrice: 1_504_281 },
  { end: 'high', reason: 'highest of the adjusted sales, set aside so one sale cannot set the range', address: '3369 Zayden', listingKey: 'A3', adjustedPrice: 1_735_611 },
]

function woodsmanPricing(over: Record<string, unknown> = {}): CmaPricing {
  return {
    recommended: 1_576_000,
    conservative: 1_576_000,
    highEnd: 1_576_000,
    valueLow: 1_554_207,
    valueHigh: 1_618_053,
    predictedClose: 1_584_134,
    failedAsk: 1_600_000,
    notes: [],
    needsReview: false,
    reviewReason: null,
    priceOverride: null,
    setAside: WOODSMAN_ASIDE,
    rangeRule: {
      n: 7,
      kept: 4,
      rule: 'trimmed-one-each-end',
      adjustedLow: 1_554_207,
      adjustedHigh: 1_618_053,
      saleLow: 1_554_207,
      saleHigh: 1_618_053,
      endpointPpsfAside: 0,
      endpointWeightAside: 0,
    },
    hold: { kind: 'ask-in-band', ask: 1_600_000, bandLow: 1_550_000, bandHigh: 1_620_000, reason: 'test' },
    clamp: {
      kind: 'failed-ask',
      appliedTo: 'recommended',
      before: 1_620_000,
      after: 1_576_000,
      basis: { ratio: 0.985, source: 'test' },
      applications: [
        { tier: 'conservative', before: 1_619_000, after: 1_576_000, ratio: 0.985 },
        { tier: 'recommended', before: 1_620_000, after: 1_576_000, ratio: 0.985 },
        { tier: 'highEnd', before: 1_620_000, after: 1_576_000, ratio: 0.985 },
      ],
      sentence:
        'The sales support a value of $1,620,000. Because $1,600,000 already failed to sell, we recommend the price on the cover, which stays under that ask.',
    },
    reconciliation: {
      sentence:
        '62531 Woodsman carries the most weight of the four sales behind this price, at 32.4 percent: it is 151 square feet larger than yours, it sold last month, and its price moved 2.7 percent when adjusted for size.',
      mostWeighted: 'W1',
      weightedPrice: 1_584_134,
      weights: [
        { listingKey: 'W1', address: '62531 Woodsman', weight: 32.4, weightRaw: 3.9206, adjustedPrice: 1_618_053, grossAdjustmentPct: 2.7, reason: '' },
        { listingKey: 'W2', address: '62467 Woodsman', weight: 27.4, weightRaw: 3.3134, adjustedPrice: 1_577_306, grossAdjustmentPct: 7.7, reason: '' },
        { listingKey: 'W3', address: '62552 Woodsman', weight: 26.9, weightRaw: 3.2438, adjustedPrice: 1_554_207, grossAdjustmentPct: 1, reason: '' },
        { listingKey: 'W4', address: '62621 Mt Hood', weight: 13.3, weightRaw: 1.6095, adjustedPrice: 1_575_879, grossAdjustmentPct: 3, reason: '' },
      ],
    },
    ...over,
  } as unknown as CmaPricing
}

const WOODSMAN = {
  streetAddress: '62475 Woodsman',
  city: 'Bend',
  postalCode: '97703',
  subdivision: 'Woodside Ranch',
  propertySubType: 'Single Family Residence',
  sqft: 2_673,
  beds: 4,
  baths: 3,
  standardStatus: 'Expired',
  lastListPrice: 1_600_000,
} as unknown as CmaSubject

describe('1. a cover the ceiling moved on a held letter: the sales set the range (62475 Woodsman)', () => {
  it('reads the cover off the weights: $1,576,000 against the $1,584,134 they blend to', () => {
    const p = woodsmanPricing()
    expect(Math.abs(p.recommended - 1_584_134)).toBeGreaterThanOrEqual(COVER_ROUNDING_STEP)
    expect(clampMovedCoverOffTheWeights(p)).toBe(true)
    expect(salesSetOnlyTheRange(p, WOODSMAN_COMPS)).toBe(true)
    expect(weightRowLabel(p, WOODSMAN_COMPS)).toBe(WEIGHT_AMONG_SALES_ROW_LABEL)
    expect(salesThatSetItHeading(p, WOODSMAN_COMPS)).toBe(RANGE_SALES_HEADING)
    expect(weightMeaningSentence(p, WOODSMAN_COMPS)).toBe(
      'Weight is how much each sale counts beside the others in this chapter. It does not set the price on the cover.',
    )
    expect(reconciliationSentenceFor(p.reconciliation!.sentence!, p, WOODSMAN_COMPS)).toMatch(
      /^62531 Woodsman carries the most weight of the four sales that set the range, at 32\.4 percent/,
    )
  })

  it('the sales chapter calls the weights what they are and says nothing about the clamp', () => {
    const input = { subject: WOODSMAN, comps: WOODSMAN_COMPS, market: null, pricing: woodsmanPricing(), tiersUsed: [] }
    const text = visible(salesThatSetItPage(input)!.body)
    expect(text).toContain('The sales that set the range.')
    expect(text).toContain(WEIGHT_AMONG_SALES_ROW_LABEL)
    expect(text).not.toContain(WEIGHT_IN_PRICE_ROW_LABEL)
    expect(text).toContain('the most weight of the four sales that set the range, at 32.4 percent')
    expect(text).toContain('It does not set the price on the cover.')
    expect(text).not.toMatch(/moved the number|sales behind this price|behind this number/)
    // Rule 26: a held letter prints no clamp sentence, and none is added here.
    const price = visible(pricingPage(input).body)
    expect(price).toContain('The four sales that set the range support $1,554,207 to $1,618,053.')
    for (const t of [text, price]) {
      expect(t).not.toMatch(/already failed to sell|support a value of|capped/)
      expect(t).not.toContain(EM_DASH)
    }
  })

  it('keeps "in this price" where the weights do reach the cover, or the letter says what moved it', () => {
    // A held letter the ceiling did not move.
    const noClamp = woodsmanPricing({ clamp: null })
    expect(salesSetOnlyTheRange(noClamp, WOODSMAN_COMPS)).toBe(false)
    expect(salesThatSetItHeading(noClamp, WOODSMAN_COMPS)).toBe(HELD_SALES_HEADING)
    // A cover the ceiling put inside one $1,000 step of the weighted price.
    const atWeights = woodsmanPricing({
      recommended: 1_584_000,
      clamp: { ...woodsmanPricing().clamp!, after: 1_584_000, applications: [{ tier: 'recommended', before: 1_620_000, after: 1_584_000, ratio: 0.99 }] },
    })
    expect(clampMovedCoverOffTheWeights(atWeights)).toBe(false)
    expect(weightRowLabel(atWeights, WOODSMAN_COMPS)).toBe(WEIGHT_IN_PRICE_ROW_LABEL)
    // An unheld letter prints the clamp sentence under the number.
    const unheld = woodsmanPricing({ hold: null })
    expect(salesSetOnlyTheRange(unheld, WOODSMAN_COMPS)).toBe(false)
    expect(salesThatSetItHeading(unheld, WOODSMAN_COMPS)).toBe(SALES_THAT_SET_IT_HEADING)
    // ...unless the row stored no sentence to print.
    const silent = woodsmanPricing({ hold: null, clamp: { ...woodsmanPricing().clamp!, sentence: '' } })
    expect(salesSetOnlyTheRange(silent, WOODSMAN_COMPS)).toBe(true)
  })

  it('a row with no stored weighted price is read off the clamp alone', () => {
    const p = woodsmanPricing()
    const bare = { ...p, reconciliation: { ...p.reconciliation!, weightedPrice: null } } as CmaPricing
    expect(salesSetOnlyTheRange(bare, WOODSMAN_COMPS)).toBe(true)
  })
})

// ── 2. the set-aside pin ─────────────────────────────────────────────────────

describe('2. a set-aside pin follows the legend (20676 Wild Rose)', () => {
  const facts: CmaPinFact[] = [
    { key: '1', family: 'closed', address: '20582 Goldenrod', outcome: 'sold $699K', domDays: null, priceChanges: null, latitude: 44.03, longitude: -121.3 },
    { key: '2', family: 'closed', address: '20825 Chloe', outcome: 'sold $710K', domDays: null, priceChanges: null, latitude: 44.031, longitude: -121.31, setAside: true },
  ]
  const subject = { streetAddress: '20676 Wild Rose', latitude: 44.032, longitude: -121.305 }

  it('says "did not set the range" on every set-aside pin when the legend says the sales set the range', () => {
    expect(setAsidePinNote(CLOSED_SET_RANGE_LABEL)).toBe(SET_ASIDE_PIN_NOTE_RANGE)
    expect(SET_ASIDE_PIN_NOTE_RANGE).toBe('Set aside: did not set the range')
    expect(pinReading(facts[1]!, { closedLabel: CLOSED_SET_RANGE_LABEL })).toContain('Set aside: did not set the range')
    const html = compPinMap({ subject, facts, closedLabel: CLOSED_SET_RANGE_LABEL }).html
    expect(html).toContain('Closed sales: these set the range')
    expect(html).toContain('did not set the range')
    expect(html).not.toContain('did not set the price')
  })

  it('keeps "did not set the price" where the legend says the sales set the price', () => {
    expect(setAsidePinNote(null)).toBe(SET_ASIDE_PIN_NOTE)
    const html = compPinMap({ subject, facts }).html
    expect(html).toContain('Closed sales: these set the price')
    expect(html).toContain('did not set the price')
    expect(html).not.toContain('did not set the range')
  })
})

// ── 3. recency ───────────────────────────────────────────────────────────────

function reconSale(over: Partial<ReconcilableSale>): ReconcilableSale {
  return {
    listingKey: 'A',
    address: '1 A',
    sqft: 1_750,
    closePrice: 780_000,
    closeDate: '2026-05-29',
    monthsSinceClose: 4.3,
    timeAdjustment: -40_000,
    sizeAdjustment: -10_000,
    storyAdjustment: 0,
    adjustedPrice: 730_000,
    weight: 1,
    ...over,
  }
}

describe('3. "sold N months ago" is whole months, by the day (3062 NW Kelly Hill)', () => {
  it('counts whole months elapsed', () => {
    expect(wholeMonthsBetween('2026-05-29', '2026-10-08')).toBe(4)
    expect(wholeMonthsBetween('2025-11-26', '2026-10-08')).toBe(10)
    expect(wholeMonthsBetween('2025-01-03', '2026-10-08')).toBe(21)
    expect(wholeMonthsBetween('2026-09-28', '2026-10-05')).toBe(0)
    // A close on the 31st is a month old on the last day of a shorter month.
    expect(wholeMonthsBetween('2026-01-31', '2026-02-28')).toBe(1)
    expect(wholeMonthsBetween('2026-05', '2026-10-08')).toBeNull()
  })

  it('2955 Bordeaux closed May 29 and the letter is dated Oct 8: it sold 4 months ago, not 5', () => {
    const out = reconcileAdjustedSales({
      sales: [
        reconSale({ listingKey: 'B', address: '2955 Bordeaux', weight: 2.3566, adjustedPrice: 733_116 }),
        reconSale({ listingKey: 'C', address: '2974 Chardonnay', sqft: 1_920, closeDate: '2025-11-26', monthsSinceClose: 10.4, weight: 1.0354, adjustedPrice: 674_070 }),
        reconSale({ listingKey: 'K', address: '3080 Kelly Hill', sqft: 1_960, closeDate: '2025-01-03', monthsSinceClose: 21.1, weight: 1.5035, adjustedPrice: 727_451 }),
      ],
      subjectSqft: 1_702,
      asOf: '2026-10-08',
    })
    expect(out.sentence).toContain('it sold 4 months ago')
    expect(out.sentence).not.toContain('5 months ago')
    const reasons = out.weights.map((w) => w.reason).join(' | ')
    expect(reasons).toContain('sold 10 months ago')
    expect(reasons).toContain('sold 21 months ago')
    expect(reasons).not.toContain('sold 11 months ago')
  })

  it('a close under a month old is this month or last month, never "0 months ago"', () => {
    const lastMonth = reconcileAdjustedSales({ sales: [reconSale({ closeDate: '2026-09-28' })], subjectSqft: 1_750, asOf: '2026-10-05' })
    expect(lastMonth.sentence).toContain('sold last month')
    const thisMonth = reconcileAdjustedSales({ sales: [reconSale({ closeDate: '2026-10-01' })], subjectSqft: 1_750, asOf: '2026-10-05' })
    expect(thisMonth.sentence).toContain('sold this month')
    const aMonth = reconcileAdjustedSales({ sales: [reconSale({ closeDate: '2026-08-30' })], subjectSqft: 1_750, asOf: '2026-10-05' })
    expect(aMonth.sentence).toContain('sold a month ago')
    // Without a letter date the stored months are floored: 4.6 is 4.
    const undated = reconcileAdjustedSales({ sales: [reconSale({ monthsSinceClose: 4.6 })], subjectSqft: 1_750 })
    expect(undated.sentence).toContain('sold 4 months ago')
  })
})

// ── 4, 5, 9: the held letter, rendered whole ────────────────────────────────

const broker = {
  id: 'id-matt',
  slug: 'matthew-ryan',
  displayName: 'Matt Ryan',
  title: 'Owner & Principal Broker',
  licenseNumber: '201206613',
  email: 'matt@ryan-realty.com',
  phone: '541.703.3095',
  photoUrl: '/images/brokers/ryan-matt.png',
} as CmaBroker

/** 2564 Purcell as stored 2026-09-28 (client scrubbed), the committed letter shape. */
function shape(): RenderCmaArgs {
  const raw = JSON.parse(
    readFileSync(join(process.cwd(), 'lib/cma/fixtures/letter-shapes', 'purcell.json'), 'utf8'),
  ) as RenderCmaArgs
  return {
    ...raw,
    broker,
    client: { name: null, email: null, phone: null, notes: null },
    mapDataUri: null,
    subjectMapDataUri: null,
    documentStatus: 'draft',
  } as RenderCmaArgs
}

/** The same letter held under rule 22, its $402,000 cover set by the failed-ask ceiling. */
function heldInBand(): RenderCmaArgs {
  const a = shape()
  const p = a.pricing as CmaPricing
  a.pricing = {
    ...p,
    failedAsk: 429_000,
    clamp: {
      kind: 'failed-ask',
      appliedTo: 'recommended',
      before: 415_000,
      after: p.recommended,
      basis: { ratio: p.recommended / 429_000, source: 'test' },
      applications: [{ tier: 'recommended', before: 415_000, after: p.recommended, ratio: p.recommended / 429_000 }],
      sentence: 'The sales support a value of $415,000. Because $429,000 already failed to sell, we recommend the price on the cover, which stays under that ask.',
    },
    hold: { kind: 'ask-in-band', ask: 429_000, bandLow: 388_000, bandHigh: 430_000, reason: 'test hold' },
  } as CmaPricing
  return a
}

describe('4. a held letter titles its net page by the price its column names', () => {
  it('held: "Net at the price on the cover" over "At the price on the cover"', () => {
    const text = visible(renderCmaHtml(heldInBand()).html)
    expect(text).toContain('Net at the price on the cover')
    expect(text).toContain('At the price on the cover')
    expect(text).not.toContain('Net at list')
  })

  it('unheld: "Net at list" stays', () => {
    const text = visible(renderCmaHtml(shape()).html)
    expect(text).toContain('Net at list')
    expect(text).not.toContain('Net at the price on the cover')
  })
})

describe('5. Basis and limits names the grid by its chapter heading', () => {
  it('names the heading in a sentence, for each of the three headings', () => {
    expect(salesThatSetItPhrase(woodsmanPricing(), WOODSMAN_COMPS)).toBe('the sales that set the range')
    expect(salesThatSetItPhrase(woodsmanPricing({ clamp: null }), WOODSMAN_COMPS)).toBe('the sales behind this price')
    expect(salesThatSetItPhrase(woodsmanPricing({ hold: null }), WOODSMAN_COMPS)).toBe('the sales that set this price')
  })

  it('a range-only letter says "the grid of the sales that set the range", never "the price chapter"', () => {
    const text = visible(renderCmaHtml(heldInBand()).html)
    expect(text).toContain('The sales that set the range.')
    expect(text).toContain('The grid of the sales that set the range moves each sale')
    expect(text).not.toContain('price chapter')
  })

  it('an unheld letter names its own heading the same way', () => {
    const text = visible(renderCmaHtml(shape()).html)
    expect(text).toContain('The sales that set this price.')
    expect(text).toContain('The grid of the sales that set this price moves each sale')
    expect(text).not.toContain('price chapter')
  })
})

describe('6. the trim sentence names the highest and the lowest sale', () => {
  it('says what was set aside in plain words, with the same count', () => {
    const sentence = rangeSpreadCauseSentence({
      recommended: 600_000,
      valueLow: 500_000,
      valueHigh: 700_000,
      rangeRule: { rule: 'trimmed-one-each-end', n: 5, kept: 3, endpointPpsfAside: 0, endpointWeightAside: 0 },
    } as unknown as CmaPricing)
    expect(sentence).toBe(
      'That range is wide because the three sales behind it still land $200,000 apart once each is moved to today, and that is after setting aside the highest and the lowest sale, so no single sale sets the range.',
    )
    expect(sentence).not.toContain(EM_DASH)
  })
})

// ── 7. a tie at the printed weight ───────────────────────────────────────────

describe('7. a tie at the printed weight names both sales (1355 Jacksonville)', () => {
  const jacksonville = [
    reconSale({ listingKey: 'J1', address: '1340 Cumberland', weight: 1.0122 }),
    reconSale({ listingKey: 'J2', address: '1613 Ithaca', weight: 1.0106 }),
    reconSale({ listingKey: 'J3', address: '1661 Hartford', weight: 1.0032 }),
  ]

  it('1340 Cumberland and 1613 Ithaca both print 33.4, so both carry the most weight', () => {
    const out = reconcileAdjustedSales({ sales: jacksonville, subjectSqft: 1_750, asOf: '2026-10-08' })
    expect(out.weights.map((w) => w.weight)).toEqual([33.4, 33.4, 33.2])
    expect(out.sentence).toBe(
      '1340 Cumberland and 1613 Ithaca carry the most weight of the three sales behind this price, at 33.4 percent each.',
    )
    expect(out.mostWeighted).toBe('J1')
  })

  it('reads as the range on a range-only letter', () => {
    const out = reconcileAdjustedSales({ sales: jacksonville, subjectSqft: 1_750, asOf: '2026-10-08' })
    expect(reconciliationSentenceFor(out.sentence!, woodsmanPricing(), WOODSMAN_COMPS)).toBe(
      '1340 Cumberland and 1613 Ithaca carry the most weight of the three sales that set the range, at 33.4 percent each.',
    )
  })

  it('a leader whose printed figure no other sale shares is still named alone', () => {
    const out = reconcileAdjustedSales({
      sales: [jacksonville[0]!, reconSale({ listingKey: 'J2', address: '1613 Ithaca', weight: 0.9 }), jacksonville[2]!],
      subjectSqft: 1_750,
      asOf: '2026-10-08',
    })
    expect(out.sentence).toMatch(/^1340 Cumberland carries the most weight of the three sales behind this price, at [\d.]+ percent: /)
  })
})

// ── 8. the last of several asks ──────────────────────────────────────────────

describe('8. a gap measured on the last ask says so (2382 Jackson, 2745 Aldrich)', () => {
  const jacksonSegments = [
    { ask: 699_000, days: 27 },
    { ask: 679_000, days: 78 },
    { ask: 659_000, days: 43 },
    { ask: 639_000, days: 79 },
  ]

  it('2382 Jackson: "Your last ask was 0.6 percent above", same number', () => {
    const reading = askStoryReading({
      ask: 639_000,
      rangeLow: 598_620,
      rangeHigh: 635_458,
      days: 227,
      city: 'Bend',
      marketMedianDom: 26,
      status: 'Canceled',
      segments: jacksonSegments,
    })
    expect(reading).toContain('Your last ask was 0.6 percent above the top of the range the sales support.')
    expect(reading).not.toContain('You were asking')
  })

  it('2745 Aldrich: "Your last ask was 3.3 percent above"', () => {
    const reading = askStoryReading({
      ask: 495_000,
      rangeLow: 430_000,
      rangeHigh: 479_160,
      days: 108,
      city: 'Bend',
      marketMedianDom: 26,
      status: 'Expired',
      segments: [
        { ask: 520_000, days: 77 },
        { ask: 515_000, days: 11 },
        { ask: 505_000, days: 14 },
        { ask: 495_000, days: 6 },
      ],
    })
    expect(reading).toContain('Your last ask was 3.3 percent above the top of the range the sales support.')
  })

  it('one price all along keeps "You were asking"', () => {
    expect(measuresLastOfSeveralAsks(639_000, [639_000])).toBe(false)
    expect(measuresLastOfSeveralAsks(639_000, [639_000, 639_000])).toBe(false)
    expect(measuresLastOfSeveralAsks(639_000, [])).toBe(false)
    expect(measuresLastOfSeveralAsks(639_000, [699_000, 639_000])).toBe(true)
    // Not the last ask: the sentence does not call it the last.
    expect(measuresLastOfSeveralAsks(699_000, [699_000, 639_000])).toBe(false)
    expect(askAgainstRangeSentence(639_000, 598_620, 635_458)).toBe(
      'You were asking 0.6 percent above the top of the range the sales support.',
    )
    expect(askAgainstRangeSentence(620_000, 598_620, 635_458, { lastOfSeveral: true })).toBe(
      'Your last ask was inside the range the sales support.',
    )
    expect(askAgainstRangeSentence(580_000, 598_620, 635_458, { lastOfSeveral: true })).toBe(
      'Your last ask was 3.1 percent below the bottom of the range the sales support.',
    )
  })
})

// ── 9. rule 20's lot disclosure ──────────────────────────────────────────────

describe('9. a lot under an acre that differs from the home is disclosed (rule 20, 20676 Wild Rose)', () => {
  const wildRose = { lotAcres: 0.13 } as CmaSubject
  const sales = [
    { address: '20825 Chloe', lotAcres: 0.46 },
    { address: '20582 Goldenrod', lotAcres: 0.14 },
    { address: '20606 Songbird', lotAcres: 0.16 },
    { address: '61197 Cottonwood', lotAcres: 0.47 },
    { address: '61131 Brown Trout', lotAcres: 0.12 },
  ] as CmaAdjustedComp[]

  it('names the sales whose lot the review would have called different, in grid order', () => {
    expect(lotsDiffer(0.13, 0.47)).toBe(true)
    expect(lotsDiffer(0.13, 0.16)).toBe(false)
    expect(subAcreLotDifferences(wildRose, sales).map((d) => d.address)).toEqual(['20825 Chloe', '61197 Cottonwood'])
    // 0.13 acre is the grid's 5,663 sqft; 0.47 is its 20,473 sqft.
    expect(lotDifferenceSentence(wildRose, sales)).toBe(
      'Your lot is 5,663 sqft. 20825 Chloe sits on 20,038 sqft and 61197 Cottonwood on 20,473 sqft. Every one of these lots is under an acre, so the sales stay in the comparison, and the grid does not move them for lot size. What the difference is worth sits inside each sale price and is not broken out.',
    )
  })

  it('one sale reads in the singular, and nothing prints when no lot differs or the home is acreage', () => {
    expect(lotDifferenceSentence(wildRose, [sales[3]!])).toBe(
      'Your lot is 5,663 sqft. 61197 Cottonwood sits on 20,473 sqft. Both are under an acre, so the sale stays in the comparison, and the grid does not move it for lot size. What the difference is worth sits inside its sale price and is not broken out.',
    )
    expect(lotDifferenceSentence(wildRose, [sales[1]!, sales[2]!])).toBe('')
    expect(lotDifferenceSentence({ lotAcres: 2.5 } as CmaSubject, sales)).toBe('')
    expect(lotDifferenceSentence({ lotAcres: null } as unknown as CmaSubject, sales)).toBe('')
    // A sale at an acre or more is the search's lot wall, not this rule.
    expect(lotDifferenceSentence(wildRose, [{ address: '1 Big', lotAcres: 1.2 } as CmaAdjustedComp])).toBe('')
  })

  it('prints in Basis and limits beside the condition paragraph, from the grid', () => {
    const a = shape()
    const comps = (a.comps as CmaAdjustedComp[]).map((c, i) => (i === 1 ? { ...c, lotAcres: 0.25 } : c))
    const text = visible(renderCmaHtml({ ...a, comps } as RenderCmaArgs).html)
    const name = comps[1]!.address
    expect(text).toContain(`Lot size was not adjusted for. Your lot is 2,178 sqft. ${name} sits on 10,890 sqft.`)
    const plain = visible(renderCmaHtml(shape()).html)
    expect(plain).not.toContain('Lot size was not adjusted for.')
  })
})
