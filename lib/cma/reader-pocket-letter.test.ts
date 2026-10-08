/**
 * Reader review of the 2382 Jackson draft (cma-2382-jackson, 2026-10-07),
 * priced on the exclusive-pocket path. The figures below are the stored
 * render_args rows for that draft, trimmed to the fields the letter reads.
 *
 *  1. The pocket's engine note printed to the homeowner in Basis and limits
 *     ("These sales are the exclusive pocket ... not used to pump prices.
 *     Size and story class do not adjust. That index is sold and last-ask
 *     prices in this exclusive pocket."). The letter gets one plain sentence.
 *  3. "before adjusting for date and size" sat on a letter with no size line.
 */

import { describe, expect, it } from 'vitest'
import { adjustedForPhrase, salesMethodSentences } from '@/lib/cma/sales-method-note'
import { cityMedianReconciliationHtml, type OpinionPageArgs } from '@/lib/cma/opinion-pages'
import type { CmaAdjustedComp, CmaPricing, CmaSubject } from '@/lib/cma/types'

const STORED_POCKET_SENTENCE =
  'These sales are the exclusive pocket. Date adjustment was applied to 5 sales. 2224 Indigo moved -1.4 percent, from $503,000 to $484,866; 2254 Indigo moved -1.4 percent, from $670,000 to $660,620; 2266 Jackson moved -8.1 percent, from $690,000 to $619,448; 2225 Indigo moved -1.2 percent, from $545,000 to $538,569; 2591 Purcell moved -6.1 percent, from $575,000 to $539,753. The Bend city index is not used to pump prices. Size and story class do not adjust.'

function comp(c: Partial<CmaAdjustedComp>): CmaAdjustedComp {
  return { subdivision: 'Holliday Park', city: 'Bend', storyAdjustment: 0, sizeAdjustment: 0, ...c } as CmaAdjustedComp
}

const comps: CmaAdjustedComp[] = [
  comp({ listingKey: '20251128163027974447000000', address: '2224 Indigo', sqft: 1676, closePrice: 503000, closeDate: '2026-02-10', concessions: 11250, timeAdjustment: -6884, timeAdjustedPrice: 484866, adjustedPrice: 484866, weight: 1.5715 }),
  comp({ listingKey: '20250714223341743203000000', address: '2254 Indigo', sqft: 2091, closePrice: 670000, closeDate: '2026-01-23', concessions: 0, timeAdjustment: -9380, timeAdjustedPrice: 660620, adjustedPrice: 660620, weight: 3.135 }),
  comp({ listingKey: '20250203205452082673000000', address: '2266 Jackson', sqft: 2002, closePrice: 690000, closeDate: '2025-04-07', concessions: 15000, timeAdjustment: -55552, timeAdjustedPrice: 619448, adjustedPrice: 619448, weight: 1.5076 }),
  comp({ listingKey: '20241219020351111756000000', address: '2225 Indigo', sqft: 1393, closePrice: 545000, closeDate: '2025-02-06', concessions: 0, timeAdjustment: -6431, timeAdjustedPrice: 538569, adjustedPrice: 538569, weight: 1.5024 }),
  comp({ listingKey: '20240918220027154082000000', address: '2591 Purcell', sqft: 1655, closePrice: 575000, closeDate: '2024-11-22', concessions: 0, timeAdjustment: -35247, timeAdjustedPrice: 539753, adjustedPrice: 539753, weight: 1.5014 }),
]

const pricing = {
  valueLow: 538569,
  valueHigh: 619448,
  recommended: 573000,
  timeAdjustment: {
    n: 2606,
    basis: 'exclusive-pocket-sold-list',
    measure: 'sold and last-ask prices in this exclusive pocket',
    sentence: STORED_POCKET_SENTENCE,
    windowMonths: 12,
    referenceMonths: ['2026-07-01', '2026-08-01', '2026-09-01'],
  },
  rangeRule: { n: 5, kept: 3, rule: 'trimmed-one-each-end', adjustedLow: 538569, adjustedHigh: 619448, saleToAskRatio: 0.95815, saleToAskSource: 'city-index' },
  setAside: [
    { end: 'low', address: '2224 Indigo', listingKey: '20251128163027974447000000', adjustedPrice: 484866, reason: 'lowest' },
    { end: 'high', address: '2254 Indigo', listingKey: '20250714223341743203000000', adjustedPrice: 660620, reason: 'highest' },
  ],
  notes: [],
} as unknown as CmaPricing

const subject = { subdivision: 'Holliday Park', city: 'Bend', sqft: 2016 } as CmaSubject

const ENGINE_NOTE = /exclusive pocket|pump|story class|do not adjust|That index is|Flex/i

describe('2382 Jackson: the pocket note stays internal', () => {
  it('prints one plain date sentence in Basis and limits, not the stored engine note', () => {
    const out = salesMethodSentences({ subject, comps, pricing })
    const text = out.join(' ')
    expect(text).not.toMatch(ENGINE_NOTE)
    expect(text).not.toContain('moved -8.1 percent')
    // The sentence names the city-wide figure, its months and its size
    // (reader review, 62475 Woodsman, 2026-10-08): the move is Bend's, not
    // the subdivision's own trend.
    expect(out[0]).toBe(
      "To bring each sale to today's market, we moved it down by how much Bend's median price per square foot fell between the month it sold and the last three full months, July to September 2026. That figure is built from 2,606 home sales across all of Bend over the last 12 months, not only the sales in Holliday Park, and a rise in it never moves a sale up.",
    )
    // The sale-to-ask share still follows it.
    expect(text).toContain('Homes in Bend are selling for 95.8 percent of the price they first asked.')
  })

  it('a row stored before the basis was stamped is caught by its own wording', () => {
    const legacy = {
      ...pricing,
      timeAdjustment: { sentence: STORED_POCKET_SENTENCE.replace('.', ' —') },
    } as unknown as CmaPricing
    const text = salesMethodSentences({ subject, comps, pricing: legacy }).join(' ')
    expect(text).not.toMatch(ENGINE_NOTE)
  })

  it('says nothing moved when nothing did, and counts a partial move off the grid', () => {
    const still = comps.map((c) => ({ ...c, timeAdjustment: 0 }))
    expect(salesMethodSentences({ subject, comps: still, pricing })[0]).toBe(
      'None of these sales is moved for the month it sold.',
    )
    const two = comps.map((c, i) => (i < 2 ? c : { ...c, timeAdjustment: 0 }))
    expect(salesMethodSentences({ subject, comps: two, pricing })[0]).toBe(
      "To bring the sales to today's market, we moved two of the five down by how much Bend's median price per square foot fell between the month each sold and the last three full months, July to September 2026. The other three are not moved. That figure is built from 2,606 home sales across all of Bend over the last 12 months, not only the sales in Holliday Park, and a rise in it never moves a sale up.",
    )
  })
})

describe('2382 Jackson: the raw-range sentence names the adjustments it was priced on', () => {
  it('reads "date and seller concessions" off the three sales behind the price, never "size"', () => {
    const kept = comps.slice(2)
    expect(adjustedForPhrase(kept)).toBe('date and seller concessions')
    const html = cityMedianReconciliationHtml({ pricing, comps, subject } as unknown as OpinionPageArgs)
    expect(html).toContain(
      'The three sales behind your price sold for $545,000 to $690,000 before adjusting for date and seller concessions; adjusted, they support',
    )
    expect(html).not.toContain('date and size')
  })

  it('names size where a size line moved a sale, and nothing where no line moved', () => {
    expect(adjustedForPhrase([comp({ timeAdjustment: -1000, sizeAdjustment: 4000, closePrice: 1 })])).toBe('date and size')
    expect(adjustedForPhrase([comp({ timeAdjustment: 0, sizeAdjustment: 0, closePrice: 1 })])).toBeNull()
  })
})
