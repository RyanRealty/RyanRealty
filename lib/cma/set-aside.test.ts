/**
 * "Set aside" means one thing, the clamp prints where the number is, and the
 * chapter states one n (tasteReview round three, §2 items 1 and 2, §3).
 *
 * Asserted against chapter 3's rendered HTML — the defect was that the prose
 * said one thing and the grid beside it did another, which only the rendered
 * chapter shows.
 */
import { describe, expect, it } from 'vitest'
import { pricingPage, salesThatSetItPage } from '@/lib/cma/render-pricing-page'
import { keptCompCount, setAsideRows, clampSentence } from '@/lib/cma/set-aside'
import type { CmaAdjustedComp, CmaPricing, CmaSubject } from '@/lib/cma/types'

const subject = {
  listingKey: 'S1',
  mlsNumber: '220000850',
  streetAddress: '65365 Concorde',
  city: 'Bend',
  state: 'OR',
  postalCode: '97703',
  subdivision: null,
  beds: 3,
  baths: 2,
  sqft: 2400,
  lotAcres: 5,
  propertySubType: 'Single Family Residence',
  yearBuilt: 2000,
  photoUrl: null,
  standardStatus: 'Expired',
  lastListPrice: 1500000,
  lastListDate: '2026-01-05',
  listingHistoryLine: null,
} as unknown as CmaSubject

function comp(i: number, adjusted: number, close: number): CmaAdjustedComp {
  return {
    listingKey: `C${i}`,
    mlsNumber: String(220000000 + i),
    address: `${i}00 Swalley`,
    city: 'Bend',
    subdivision: null,
    beds: 3,
    baths: 2,
    sqft: 2400,
    lotAcres: 5,
    propertySubType: 'Single Family Residence',
    yearBuilt: 2000,
    photoUrl: null,
    listPrice: close,
    closePrice: close,
    closeDate: '2026-04-24',
    daysToOffer: 12,
    monthsSinceClose: 4,
    timeAdjustment: 0,
    timeAdjustedPrice: close,
    sizeAdjustment: adjusted - close,
    adjustedPrice: adjusted,
    weight: 1,
  } as unknown as CmaAdjustedComp
}

/** Six sales, $1.07M to $2.95M adjusted — the shape Concorde ships. */
const comps: CmaAdjustedComp[] = [
  comp(1, 1_070_000, 1_050_000),
  comp(2, 1_390_000, 1_380_000),
  comp(3, 1_460_000, 1_450_000),
  comp(4, 1_600_000, 1_590_000),
  comp(5, 1_930_000, 1_900_000),
  comp(6, 2_950_000, 2_900_000),
]

function pricing(over: Record<string, unknown> = {}): CmaPricing {
  return {
    method1Low: 1_390_000,
    method1Mid: 1_600_000,
    method1High: 1_930_000,
    method2: null,
    method3: 1_600_000,
    conservative: 1_390_000,
    recommended: 1_473_000,
    highEnd: 1_930_000,
    valueLow: 1_390_000,
    valueHigh: 1_930_000,
    confidence: 'Moderate',
    confidenceReason: '',
    needsReview: false,
    reviewReason: null,
    rangeRule: {
      rule: 'trimmed-one-each-end',
      sentence:
        'The range is the spread of the six sale prices adjusted for date and size, with the highest and the lowest set aside.',
    },
    reconciliation: {
      sentence: 'The sale at 400 Swalley carried the most weight.',
      mostWeighted: '400 Swalley',
      weights: comps.map((c) => ({
        listingKey: c.listingKey,
        address: c.address,
        weight: 0.166,
        grossAdjustmentPct: 4,
      })),
    },
    ...over,
  } as unknown as CmaPricing
}

/**
 * Delta 3 split chapter 3: the number and the method stay in `pricingPage`,
 * the sales that prove it (and everything read off them — the set-aside list,
 * the reconciliation, the per-foot check) became matrix 1. Both bodies are
 * what a reader meets, so the assertions read both.
 */
function chapter(p: CmaPricing): string {
  const input = { subject, comps, market: null, pricing: p, tiersUsed: [] }
  return `${pricingPage(input).body}\n${salesThatSetItPage(input)?.body ?? ''}`
}

describe('set aside', () => {
  it('lists the set-aside sales with a reason', () => {
    const html = chapter(pricing())
    expect(html).toContain('Set aside')
    expect(html).toContain('These 2 sales are shown above and did not set the number.')
    expect(html).toContain('100 Swalley')
    expect(html).toContain('600 Swalley')
    expect(html).toContain('The highest of these sales once each is moved to today.')
    expect(html).toContain('The lowest of these sales once each is moved to today.')
  })

  it('never carries a set-aside sale in the weights row', () => {
    const html = chapter(pricing())
    const rows = [
      ...html.matchAll(/<tr data-adj="1"><th>Weight in this price<\/th>([\s\S]*?)<\/tr>/g),
    ].map((m) => m[1]!)
    expect(rows).toHaveLength(2)
    // Eight value cells across the two tables: the subject twice, six sales.
    // Four carry a weight; the two the prose disowned print a dash, and so
    // does the seller's own column.
    const cells = rows.join('').match(/<td class="v n">([^<]*)<\/td>/g) ?? []
    expect(cells).toHaveLength(8)
    expect(cells.filter((c) => c.includes('%'))).toHaveLength(4)
    // 100 Swalley and 600 Swalley are the highest and the lowest.
    expect(rows[0]).toMatch(/^<td class="v n">-<\/td><td class="v n">-<\/td>/)
    expect(rows[1]).toMatch(/<td class="v n">-<\/td>$/)
  })

  it('reads a supplied reason as written', () => {
    const html = chapter(
      pricing({
        setAside: [
          { listingKey: 'C6', address: '600 Swalley', reason: 'A 40-acre parcel, eight times your lot.' },
          { listingKey: 'C1', address: '100 Swalley', reason: 'Sold to a family member.' },
        ],
      }),
    )
    expect(html).toContain('A 40-acre parcel, eight times your lot.')
    expect(html).toContain('Sold to a family member.')
  })

  it('states one n across the strip caption and the lead', () => {
    const html = chapter(pricing())
    expect(keptCompCount(pricing(), comps)).toBe(4)
    expect(html).toContain('One scale: sale price today. 4 sales.')
    expect(html).toContain('The four closed sales below set this number')
    expect(html).toContain('Two more are shown below and set aside.')
  })

  it('prints the clamp sentence under the number, and nothing when it does not bind', () => {
    const bound =
      'We would list under what the sales alone support: the last ask of $1,500,000 did not find a buyer, so the recommendation is held under it.'
    const html = chapter(pricing({ clamp: { sentence: bound } }))
    expect(html).toContain('worth-lead-note')
    expect(html).toContain(bound)
    // The sentence sits under the number, before the strip.
    expect(html.indexOf(bound)).toBeLessThan(html.indexOf('worth-strip'))
    expect(chapter(pricing())).not.toContain('worth-lead-note')
    expect(clampSentence(pricing({ clamp: { sentence: bound, bound: false } }))).toBe('')
  })

  it('falls back to the published rule when no set-aside field is on the row', () => {
    expect(setAsideRows(pricing({ rangeRule: { rule: 'min-max' } }), comps)).toEqual([])
    expect(keptCompCount(pricing({ rangeRule: { rule: 'min-max' } }), comps)).toBe(6)
  })
})
