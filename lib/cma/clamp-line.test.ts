/**
 * NAME THE WEIGHTED FIGURE (Matt 2026-10-08).
 *
 * 615 Reed Market as stored (cmas render_args, built 2026-10-06; no client
 * fields): five sales whose weights blend to $510,945, a $499,000 ask that
 * was canceled, and a $484,000 cover the failed-ask ceiling set. Its price
 * chapter printed "The sales support a value of $533,000", the list tier
 * before the ceiling: a figure no weight on the page produces. The sentence
 * names what the weighted sales support, to the thousand as the letter says
 * "near", and then why the cover sits under it.
 */
import { describe, expect, it } from 'vitest'
import { clampLineFor } from '@/lib/cma/clamp-line'
import {
  applyFailedAskCap,
  failedAskClampHead,
  failedAskClampProse,
  rewriteFailedAskClampAfterRec,
  splitFailedAskClampHead,
} from '@/lib/cma/expired-audit'
import { pricingPage } from '@/lib/cma/render-pricing-page'
import type { CmaAdjustedComp, CmaPricing, CmaSubject } from '@/lib/cma/types'

const EM_DASH = '—'
const STORED_SENTENCE =
  'The sales support a value of $533,000. Because $499,000 already failed to sell, we recommend the price on the cover, which stays under that ask.'
const FIXED_SENTENCE =
  'The sales support a value near $511,000 once each is weighted by how closely it matches your home. Because $499,000 already failed to sell, we recommend the price on the cover, which stays under that ask.'
const TAIL = 'Because $499,000 already failed to sell, we recommend the price on the cover, which stays under that ask.'

function visible(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
}

function sale(o: Record<string, unknown>): CmaAdjustedComp {
  return {
    city: 'Bend',
    subdivision: 'Stone Creek',
    concessions: 0,
    concessionsAmount: 0,
    sizeAdjustment: 0,
    storyAdjustment: 0,
    timeAdjustment: 0,
    ...o,
  } as unknown as CmaAdjustedComp
}

/** The five sales as the stored grid prints them. */
const REED_COMPS: CmaAdjustedComp[] = [
  sale({ listingKey: 'R1', address: '20550 Cameron', sqft: 1497, closeDate: '2026-08-13', closePrice: 502_500, adjustedPrice: 502_500, weight: 1.659 }),
  sale({ listingKey: 'R2', address: '20557 Evian', sqft: 1492, closeDate: '2026-07-01', closePrice: 505_000, concessions: 10_000, concessionsAmount: 10_000, timeAdjustment: -11_979, adjustedPrice: 483_021, weight: 1.6334 }),
  sale({ listingKey: 'R3', address: '20545 Evian', sqft: 1571, closeDate: '2026-03-20', closePrice: 555_000, timeAdjustment: -8_658, adjustedPrice: 546_342, weight: 1.5368 }),
  sale({ listingKey: 'R4', address: '20539 Cameron', sqft: 1571, closeDate: '2026-03-04', closePrice: 539_000, concessions: 1_000, concessionsAmount: 1_000, timeAdjustment: -8_393, adjustedPrice: 529_607, weight: 1.5319 }),
  sale({ listingKey: 'R5', address: '20561 Evian', sqft: 1571, closeDate: '2025-10-20', closePrice: 520_000, concessions: 10_400, concessionsAmount: 10_400, timeAdjustment: -14_116, adjustedPrice: 495_484, weight: 1.5114 }),
]

function reedPricing(over: Record<string, unknown> = {}): CmaPricing {
  return {
    recommended: 484_000,
    conservative: 484_000,
    highEnd: 484_000,
    valueLow: 483_021,
    valueHigh: 546_342,
    predictedClose: 510_945,
    failedAsk: 499_000,
    failedAskBelowRange: false,
    notes: [],
    needsReview: true,
    reviewReason: null,
    priceOverride: null,
    setAside: [],
    hold: null,
    rangeRule: {
      n: 5,
      kept: 5,
      rule: 'min-max',
      saleLow: 483_021,
      saleHigh: 546_342,
      adjustedLow: 483_021,
      adjustedHigh: 546_342,
      evidenceLow: 483_000,
      endpointPpsfAside: 0,
      endpointWeightAside: 0,
    },
    clamp: {
      kind: 'failed-ask',
      appliedTo: 'recommended',
      before: 533_000,
      after: 484_000,
      basis: { ratio: 0.969939879759519, source: 'test' },
      applications: [
        { tier: 'conservative', before: 504_000, after: 498_000, ratio: 0.942 },
        { tier: 'recommended', before: 533_000, after: 484_000, ratio: 0.969939879759519 },
        { tier: 'highEnd', before: 547_000, after: 484_000, ratio: 0.969939879759519 },
      ],
      sentence: STORED_SENTENCE,
    },
    reconciliation: {
      sentence:
        '20550 Cameron carries the most weight of the five sales behind this price, at 21.1 percent: it is 39 square feet smaller than yours, it sold 2 months ago, and it needed the smallest adjustment of any of them.',
      mostWeighted: 'R1',
      weightedPrice: 510_945,
      weights: [
        { listingKey: 'R1', address: '20550 Cameron', weight: 21.1, weightRaw: 1.659, adjustedPrice: 502_500, grossAdjustmentPct: 0, reason: '' },
        { listingKey: 'R2', address: '20557 Evian', weight: 20.7, weightRaw: 1.6334, adjustedPrice: 483_021, grossAdjustmentPct: 4.4, reason: '' },
        { listingKey: 'R3', address: '20545 Evian', weight: 19.5, weightRaw: 1.5368, adjustedPrice: 546_342, grossAdjustmentPct: 1.6, reason: '' },
        { listingKey: 'R4', address: '20539 Cameron', weight: 19.5, weightRaw: 1.5319, adjustedPrice: 529_607, grossAdjustmentPct: 1.7, reason: '' },
        { listingKey: 'R5', address: '20561 Evian', weight: 19.2, weightRaw: 1.5114, adjustedPrice: 495_484, grossAdjustmentPct: 4.7, reason: '' },
      ],
    },
    ...over,
  } as unknown as CmaPricing
}

const REED = {
  streetAddress: '615 Reed Market',
  city: 'Bend',
  postalCode: '97702',
  propertySubType: 'Single Family Residence',
  sqft: 1_536,
  beds: 3,
  baths: 2,
  yearBuilt: 1961,
  standardStatus: 'Canceled',
  lastListPrice: 499_000,
} as unknown as CmaSubject

function pageText(pricing: CmaPricing, comps: CmaAdjustedComp[] = REED_COMPS, subject: CmaSubject = REED): string {
  return visible(pricingPage({ subject, comps, market: null, pricing, tiersUsed: [] } as never).body)
}

describe('the clamp sentence names what the weighted sales support (615 Reed Market)', () => {
  it('names $511,000, the $510,945 the weights blend to, never the $533,000 list tier', () => {
    expect(clampLineFor(reedPricing(), REED_COMPS)).toBe(FIXED_SENTENCE)
  })

  it('prints it under the number, once, with no figure the grid does not produce', () => {
    const text = pageText(reedPricing())
    expect(text).toContain(FIXED_SENTENCE)
    expect(text).not.toContain('$533,000')
    expect(text).not.toContain('support a value of')
    expect(text.split('$511,000').length - 1).toBe(1)
    // The cover's own dollars are not reprinted beside the ask.
    expect(text).not.toContain('$484,000')
    expect(text).not.toContain(EM_DASH)
  })

  it('names no figure when the printed grid cannot produce the stored weighted price', () => {
    // A grid whose sales moved after the build: the same weights now blend
    // thousands away from the stored $510,945.
    const moved = REED_COMPS.map((c, i) => (i === 0 ? { ...c, adjustedPrice: 470_000 } : c))
    expect(clampLineFor(reedPricing(), moved)).toBe(TAIL)
    expect(clampLineFor(reedPricing(), [])).toBe(TAIL)
  })

  it('says the weighted sale once when the lead already names it ("expect it to sell near")', () => {
    // A cover above the weighted sale: the chapter's lead prints "near
    // $511,000", so the clamp sentence keeps only the reason.
    const over = reedPricing({ recommended: 520_000, conservative: 520_000, highEnd: 520_000 })
    expect(clampLineFor(over, REED_COMPS)).toBe(TAIL)
    const text = pageText(over)
    expect(text).toContain('expect it to sell near $511,000')
    expect(text.split('$511,000').length - 1).toBe(1)
    expect(text).toContain(TAIL)
  })

  it('names the cover, not its dollars twice, when the weights land on the cover', () => {
    const at = reedPricing({ recommended: 511_000, conservative: 511_000, highEnd: 511_000 })
    expect(clampLineFor(at, REED_COMPS)).toBe(
      `The sales support the price on the cover once each is weighted by how closely it matches your home. ${TAIL}`,
    )
  })

  it('re-renders a row stored with the new head from the grid, the same way', () => {
    const stored = reedPricing({ clamp: { ...reedPricing().clamp!, sentence: FIXED_SENTENCE } })
    expect(clampLineFor(stored, REED_COMPS)).toBe(FIXED_SENTENCE)
  })
})

describe('what the ruling does not touch', () => {
  it('a held letter prints no clamp sentence at all (rule 26)', () => {
    const held = reedPricing({
      hold: { kind: 'ask-below-band', ask: 499_000, bandLow: 483_021, bandHigh: 546_342, reason: 'test hold' },
    })
    const text = pageText(held)
    expect(text).not.toMatch(/support a value|already failed to sell|stays under that ask/)
  })

  it('a home on the market keeps the sentence as stored (rule 27)', () => {
    expect(clampLineFor(reedPricing(), REED_COMPS, { onMarket: true })).toBe(STORED_SENTENCE)
  })

  it('a row with no weighted price keeps the sentence as stored', () => {
    const bare = reedPricing({ reconciliation: { ...reedPricing().reconciliation!, weightedPrice: null } })
    expect(clampLineFor(bare, REED_COMPS)).toBe(STORED_SENTENCE)
  })

  it('no clamp, no sentence', () => {
    expect(clampLineFor(reedPricing({ clamp: null }), REED_COMPS)).toBe('')
  })
})

describe('the build writes the weighted head', () => {
  it('failedAskClampHead: near the thousand, the cover by name, or the stored figure without weights', () => {
    expect(failedAskClampHead({ supported: 533_000, weighted: 510_945, rec: 484_000 })).toBe(
      'The sales support a value near $511,000 once each is weighted by how closely it matches your home.',
    )
    expect(failedAskClampHead({ supported: 533_000, weighted: 484_400, rec: 484_000 })).toBe(
      'The sales support the price on the cover once each is weighted by how closely it matches your home.',
    )
    expect(failedAskClampHead({ supported: 533_000, weighted: null, rec: 484_000 })).toBe(
      'The sales support a value of $533,000.',
    )
  })

  it('failedAskClampProse on the 615 Reed Market shape', () => {
    expect(
      failedAskClampProse({ supported: 533_000, ask: 499_000, ceiling: 484_000, rec: 484_000, percentile: false, weighted: 510_945 }),
    ).toBe(FIXED_SENTENCE)
  })

  it('splitFailedAskClampHead reads every head the build has written, and nothing else', () => {
    expect(splitFailedAskClampHead(STORED_SENTENCE)).toEqual({ head: 'The sales support a value of $533,000.', tail: TAIL })
    expect(splitFailedAskClampHead(FIXED_SENTENCE)?.tail).toBe(TAIL)
    expect(
      splitFailedAskClampHead(`The sales support the price on the cover once each is weighted by how closely it matches your home. ${TAIL}`)?.tail,
    ).toBe(TAIL)
    expect(splitFailedAskClampHead('Your last listing asked $499,000 and did not sell.')).toBeNull()
  })

  it('the last rewrite after the actives step names the weighted figure', () => {
    const p = reedPricing()
    const out = rewriteFailedAskClampAfterRec(p)
    expect(out.clamp!.sentence).toBe(FIXED_SENTENCE)
    // No price moves.
    expect(out.recommended).toBe(484_000)
    expect(out.clamp!.after).toBe(484_000)
    expect(out.clamp!.before).toBe(533_000)
  })

  it('the ceiling itself writes the weighted head when the row carries weights', () => {
    const x = {
      conservative: 520_000,
      recommended: 533_000,
      highEnd: 547_000,
      needsReview: false,
      reviewReason: null as string | null,
      notes: [] as string[],
      reconciliation: { weightedPrice: 510_945 },
    }
    const r = applyFailedAskCap(x, { lastFailedListPrice: 499_000, offMarketDate: null })
    expect(r.applied).toBe(true)
    expect(x.recommended).toBeLessThan(499_000)
    const s = (x as { clamp?: { sentence: string } }).clamp!.sentence
    expect(s.startsWith('The sales support a value near $511,000 once each is weighted by how closely it matches your home. ')).toBe(true)
    expect(s).toContain('Because $499,000 already failed to sell')
    expect(s).not.toContain('$533,000')
    expect(s).not.toContain(EM_DASH)
  })
})
