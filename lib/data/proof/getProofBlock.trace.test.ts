/**
 * The proof block's disclosure, end to end through the real trace builder, with
 * the database, reviews, track record and metric reads stubbed to the live
 * 2026-10-08 figures (sell brief, L1 to L3b).
 *
 * Live /sell printed table names, SQL filters, function names, file paths and
 * raw ISO stamps inside "how we calculate this". Every entry now carries a
 * plain sentence, and the public disclosure prints only that. This file pins
 * the exact wording and holds every rendered trace to the banned-token list,
 * with the strips held (/sell) and with them drawn.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const { CLOSINGS } = vi.hoisted(() => ({ CLOSINGS: [
  { ListNumber: '1', City: 'Bend', property_sub_type: 'Single Family Residence', OriginalListPrice: 800000, ClosePrice: 780000, OnMarketDate: '2026-06-01', purchase_contract_date: '2026-06-20', CloseDate: '2026-07-20' },
  { ListNumber: '2', City: 'Redmond', property_sub_type: 'Single Family Residence', OriginalListPrice: 600000, ClosePrice: 600000, OnMarketDate: '2026-04-01', purchase_contract_date: '2026-04-05', CloseDate: '2026-05-10' },
  { ListNumber: '3', City: 'Bend', property_sub_type: 'Single Family Residence', OriginalListPrice: 900000, ClosePrice: 850000, OnMarketDate: '2026-01-10', purchase_contract_date: '2026-02-20', CloseDate: '2026-03-30' },
  { ListNumber: '4', City: 'Bend', property_sub_type: 'Single Family Residence', OriginalListPrice: 700000, ClosePrice: 690000, OnMarketDate: '2025-10-01', purchase_contract_date: '2025-09-20', CloseDate: '2025-11-15' },
  { ListNumber: '5', City: 'Bend', property_sub_type: 'Single Family Residence', OriginalListPrice: 750000, ClosePrice: 735000, OnMarketDate: '2025-09-01', purchase_contract_date: '2025-09-25', CloseDate: '2025-10-20' },
] }))

vi.mock('@/lib/data/cache/resilient', () => ({
  makeResilientCached: (fn: unknown) => fn,
}))

vi.mock('@/lib/data/client', () => {
  const result = { data: CLOSINGS, error: null }
  const chain: Record<string, unknown> = {}
  for (const m of ['from', 'select', 'gte', 'ilike', 'eq', 'not', 'order']) chain[m] = () => chain
  chain.limit = () => Promise.resolve(result)
  return { createServiceClient: () => chain }
})

vi.mock('@/lib/data/reviews/getReviews', () => ({
  getReviews: async () => ({
    count: 25,
    averageRating: 5,
    source: 'google',
    reviews: [{ text: 'Great to work with.', reviewerName: 'A reviewer', reviewDate: '2026-07-10', rating: 5 }],
  }),
}))

vi.mock('@/lib/data/track-record', () => ({
  getBrokerageTrackRecord: async () => ({ homesSold: 17, totalVolume: 13_384_034, avgSalePrice: 787_296 }),
}))

vi.mock('@/lib/data/market-truth/getMetric', () => {
  const cell = (value: number, sampleN: number) => ({
    value,
    isPublishable: true,
    provenance: { sampleN, definitionId: 'mt-v1', computedAt: '2026-10-08T00:21:24.953Z' },
  })
  return { getMetrics: async () => [cell(28, 1994), cell(0.97, 2081), cell(2206, 2206)] }
})

import { getProofBlock } from './getProofBlock'
import { PROOF_TRACE_BANNED, proofBlockView, traceText } from '@/components/site/v3/V3ProofBlock.view'
import type { ProofBlock } from './getProofBlock'

const ATTRIBUTION = { surface: 'sell', place: 'bend', source: 'proof_block' }

let block: ProofBlock

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-08T13:03:00.261Z'))
  block = await getProofBlock()
})

afterAll(() => {
  vi.useRealTimers()
})

function expectClean(text: string) {
  for (const token of PROOF_TRACE_BANNED) expect(text, `trace leaks "${token}"`).not.toContain(token)
  // No raw ISO stamp, and no em dash (ci:no-public-em-dash covers copy, not data).
  expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)
  expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}\.\.\d{4}/)
  expect(text).not.toContain('\u2014')
}

describe('proof block disclosure, plain English only', () => {
  it('prints the three /sell entries word for word, with the strips held', () => {
    const view = proofBlockView({ block, attribution: ATTRIBUTION })!
    expect(view.trace).toBe(
      [
        '5.0 average from 25 Google reviews: every review on our Google Business Profile, read live on Oct 8, 2026.',
        "17 homes closed, listed by Ryan Realty: every Ryan Realty listing that has closed in the Central Oregon MLS (Oregon Data Share). Homes where we represented the buyer aren't counted.",
        '5 Ryan Realty listings closed in Bend and Redmond in the last 12 months (Oct 8, 2025 to Oct 8, 2026), Central Oregon MLS.',
      ].join(' '),
    )
    expectClean(view.trace)
  })

  it('stays clean with the strips drawn, naming the measures in words', () => {
    const text = traceText(block, true)
    expect(text).toContain('Sale price as a share of the first asking price on 5 of them, and days from listing to an accepted offer on 4')
    expect(text).toContain('Bend median days from listing to an accepted offer, 28,')
    expect(text).toContain('Bend median sale price as a share of the first asking price, 97.0%,')
    expectClean(text)
  })

  it('keeps the internal fields on the object for reviewers, unprinted', () => {
    expect(block.trace.map((t) => t.table)).toContain('public.listings')
    expect(block.trace.every((t) => t.plain.length > 0)).toBe(true)
  })

  it('never prints the internal empty-state line, and only offers the quiet line where strips can draw', () => {
    const thin: ProofBlock = {
      ...block,
      outcomes: { ...block.outcomes, publishable: false, quietReason: 'We show every closing as a list rather than a chart.' },
    }
    expect(proofBlockView({ block: thin, attribution: ATTRIBUTION })!.quiet).toBeNull()
    expect(proofBlockView({ block: thin, attribution: ATTRIBUTION, showOutcomes: true })!.quiet).toBe(
      'We show every closing as a list rather than a chart.',
    )
  })
})
