import { describe, expect, it } from 'vitest'
import { BUYER_BROKER_ASSUMPTION_PCT, STANDARD_LISTING_FEE_PCT } from '@/lib/cma/expired-audit'
import {
  NET_BUYER_AGENT_FEE_PCT,
  NET_LISTING_FEE_PCT,
  SELLER_NET_UNKNOWNS,
  attachCompConcessions,
  attachSellerNet,
  buildSellerNet,
  reanchorSellerNet,
  resolveConcessions,
  sellerCostLines,
  sellerNetFromPrice,
  summarizeConcessions,
} from '@/lib/pricing/seller-net'

describe('resolveConcessions', () => {
  it('uses the typed dollar amount when present, including zero', () => {
    expect(resolveConcessions({ amount: 10_000, yn: 'Yes' })).toBe(10_000)
    expect(resolveConcessions({ amount: 0, yn: 'No' })).toBe(0)
  })

  it('treats Concessions YN No as zero when the amount is blank', () => {
    expect(resolveConcessions({ amount: null, yn: 'No' })).toBe(0)
  })

  it('does not invent dollars when YN is Yes and the amount is blank', () => {
    expect(resolveConcessions({ amount: null, yn: 'Yes' })).toBeNull()
  })

  it('infers zero on 2024+ closes with a blank amount (measured: those rows are YN No)', () => {
    expect(resolveConcessions({ amount: null, yn: null, closeDate: '2025-06-01' })).toBe(0)
    expect(resolveConcessions({ amount: null, yn: null, closeDate: '2023-06-01' })).toBeNull()
  })
})

describe('sellerNetFromPrice', () => {
  it('is close price minus seller concessions', () => {
    expect(sellerNetFromPrice(500_000, 15_000)).toBe(485_000)
    expect(sellerNetFromPrice(500_000, 0)).toBe(500_000)
  })

  it('is unknown when concessions were not resolved', () => {
    expect(sellerNetFromPrice(500_000, null)).toBeNull()
  })
})

describe('summarizeConcessions', () => {
  it('includes inferred zeros so a Yes-only median does not overstate the typical credit', () => {
    const summary = summarizeConcessions([
      { concessionsAmount: 10_000, concessionsYn: 'Yes', closeDate: '2025-05-01' },
      { concessionsAmount: null, concessionsYn: 'No', closeDate: '2025-04-01' },
      { concessionsAmount: null, concessionsYn: null, closeDate: '2025-03-01' },
      { concessionsAmount: 8_000, concessionsYn: 'Yes', closeDate: '2025-02-01' },
      { concessionsAmount: null, concessionsYn: 'No', closeDate: '2025-01-01' },
    ])
    expect(summary.knownCount).toBe(5)
    expect(summary.givenCount).toBe(2)
    expect(summary.medianWhenGiven).toBe(9_000)
    expect(summary.medianIncludingZero).toBe(0)
    expect(summary.rate).toBe(0.4)
  })
})

const GIVEN = summarizeConcessions([
  { concessionsAmount: 20_000, concessionsYn: 'Yes', closeDate: '2026-05-01' },
  { concessionsAmount: 30_000, concessionsYn: 'Yes', closeDate: '2026-04-01' },
  { concessionsAmount: 15_000, concessionsYn: 'Yes', closeDate: '2026-03-01' },
  { concessionsAmount: null, concessionsYn: 'No', closeDate: '2026-02-01' },
])
const NONE_GIVEN = summarizeConcessions([
  { concessionsAmount: null, concessionsYn: 'No', closeDate: '2026-05-01' },
  { concessionsAmount: null, concessionsYn: 'No', closeDate: '2026-04-01' },
])
const NOTHING_KNOWN = summarizeConcessions([
  { concessionsAmount: null, concessionsYn: null, closeDate: '2023-05-01' },
  { concessionsAmount: null, concessionsYn: null, closeDate: '2023-04-01' },
])

describe('buildSellerNet — fees and title come off the list, a credit does not', () => {
  it('uses the same fee rates as the published plan', () => {
    expect(NET_LISTING_FEE_PCT).toBe(STANDARD_LISTING_FEE_PCT)
    expect(NET_BUYER_AGENT_FEE_PCT).toBe(BUYER_BROKER_ASSUMPTION_PCT)
  })

  it('is anchored to the list, never to a close estimate', () => {
    const block = buildSellerNet({ list: 1_473_000, summary: GIVEN })!
    expect(block.basis).toBe('list')
    expect(block.list).toBe(1_473_000)
  })

  it('subtracts our fee, the buyer agent fee, and the owner policy, not a median credit', () => {
    const block = buildSellerNet({ list: 716_000, summary: GIVEN })!
    expect(block.lines.map((l) => l.label)).toEqual(['Our fee', "Buyer's agent", 'Title insurance'])
    expect(block.lines.map((l) => l.amount)).toEqual([21_480, 17_900, 1_674])
    expect(block.net).toBe(674_946)
    expect(block.lines.some((l) => /concession/i.test(l.label))).toBe(false)
    expect(block.sentence).not.toMatch(/does not include/i)
    // The trace of what the comps gave is still on the block. It is not the net.
    expect(block.expectedConcessions).toBe(GIVEN.medianIncludingZero)
  })

  it('is the same net whether or not the comps gave a credit', () => {
    const given = buildSellerNet({ list: 452_000, summary: GIVEN })!
    const none = buildSellerNet({ list: 452_000, summary: NONE_GIVEN })!
    const unknown = buildSellerNet({ list: 452_000, summary: NOTHING_KNOWN })!
    expect(given.net).toBe(none.net)
    expect(none.net).toBe(unknown.net)
    expect(given.lines).toHaveLength(3)
  })

  it('can never produce a net above the list', () => {
    for (const summary of [GIVEN, NONE_GIVEN, NOTHING_KNOWN]) {
      const block = buildSellerNet({ list: 816_000, summary })!
      expect(block.net).toBeLessThanOrEqual(block.list)
      expect(block.net).toBe(block.list - sellerCostLines(block.list).reduce((s, l) => s + l.amount, 0))
    }
  })

  it('is null-safe on a list that is not a usable price', () => {
    expect(buildSellerNet({ list: 0, summary: GIVEN })).toBeNull()
    expect(buildSellerNet({ list: Number.NaN, summary: GIVEN })).toBeNull()
  })
})

describe('attachSellerNet', () => {
  it('anchors on pricing.recommended and writes the itemised block', () => {
    const pricing: NonNullable<Parameters<typeof attachSellerNet>[0]> = {
      recommended: 700_000,
      notes: [],
    }
    attachSellerNet(pricing, [
      { concessionsAmount: 10_000, concessionsYn: 'Yes', closeDate: '2025-05-01' },
      { concessionsAmount: null, concessionsYn: 'No', closeDate: '2025-04-01' },
    ])
    expect(pricing.sellerNet?.list).toBe(700_000)
    expect(pricing.sellerNet?.expectedConcessions).toBe(5_000)
    expect(pricing.sellerNet?.net).toBe(659_850)
    expect(pricing.notes.some((n) => n.includes('does not include'))).toBe(false)
  })

  it('leaves no predictedSellerNet behind for a renderer to print', () => {
    const pricing: NonNullable<Parameters<typeof attachSellerNet>[0]> = { recommended: 700_000, notes: [] }
    attachSellerNet(pricing, [{ concessionsAmount: 0, concessionsYn: 'No', closeDate: '2025-04-01' }])
    expect(pricing.sellerNet).not.toHaveProperty('predictedSellerNet')
  })
})

describe('reanchorSellerNet — the list moved, so the net moves with it', () => {
  it('recomputes the whole block from the current recommended price', () => {
    const pricing: NonNullable<Parameters<typeof attachSellerNet>[0]> = { recommended: 1_930_000, notes: [] }
    attachSellerNet(pricing, [
      { concessionsAmount: 20_000, concessionsYn: 'Yes', closeDate: '2026-05-01' },
      { concessionsAmount: null, concessionsYn: 'No', closeDate: '2026-04-01' },
    ])
    expect(pricing.sellerNet?.lines[0]?.label).toBe('Our fee')

    // The failed-ask ceiling drops the list. The net must follow.
    pricing.recommended = 1_473_000
    reanchorSellerNet(pricing)
    expect(pricing.sellerNet?.list).toBe(1_473_000)
    expect(pricing.sellerNet?.net).toBe(1_389_175)
    expect(pricing.sellerNet!.net).toBeLessThanOrEqual(pricing.recommended)
  })

  it('replaces the stale sentence in notes rather than stacking a second one', () => {
    const pricing: NonNullable<Parameters<typeof attachSellerNet>[0]> = { recommended: 1_930_000, notes: [] }
    attachSellerNet(pricing, [{ concessionsAmount: 0, concessionsYn: 'No', closeDate: '2026-04-01' }])
    pricing.recommended = 1_473_000
    reanchorSellerNet(pricing)
    const netNotes = pricing.notes.filter((n) => n.startsWith(SELLER_NET_UNKNOWNS.notePrefix))
    expect(netNotes).toHaveLength(0)
  })

  it('does nothing when there is no block to re-anchor', () => {
    const pricing: NonNullable<Parameters<typeof attachSellerNet>[0]> = { recommended: 500_000, notes: [] }
    reanchorSellerNet(pricing)
    expect(pricing.sellerNet).toBeUndefined()
  })
})

describe('attachCompConcessions — the grid line and the caption read one row', () => {
  const rows = [
    { listingKey: 'A', concessionsAmount: 10_000, concessionsYn: 'Yes', closeDate: '2026-05-01' },
    { listingKey: 'B', concessionsAmount: null, concessionsYn: 'No', closeDate: '2026-04-01' },
    // 2024+ with nothing recorded: measured as YN No (300/300), so it is a zero.
    { listingKey: 'C', concessionsAmount: null, concessionsYn: null, closeDate: '2026-03-01' },
    // 2022-2023 with nothing recorded stays unknown, and prints as unknown.
    { listingKey: 'D', concessionsAmount: null, concessionsYn: null, closeDate: '2023-03-01' },
  ]

  it('resolves a printable value per sale, and null only when nothing was recorded', () => {
    const out = attachCompConcessions(rows)
    expect(out.map((r) => r.concessions)).toEqual([10_000, 0, 0, null])
  })

  it('agrees with the caption computed over the same rows', () => {
    const out = attachCompConcessions(rows)
    const summary = summarizeConcessions(rows)
    expect(summary.knownCount).toBe(out.filter((r) => r.concessions != null).length)
    expect(summary.givenCount).toBe(out.filter((r) => (r.concessions ?? 0) > 0).length)
    expect(summary.medianWhenGiven).toBe(10_000)
  })

  it('leaves every other field on the sale alone', () => {
    expect(attachCompConcessions(rows)[0].listingKey).toBe('A')
  })
})

describe('the four round-four exemplars — the defect this replaced', () => {
  const cases = [
    { slug: 'cma-65365-concorde', list: 1_473_000, wasPrinted: 1_707_603 },
    { slug: 'cma-1617-nw-8th', list: 816_000, wasPrinted: 616_000 },
    { slug: 'cma-2465-7th-redmond-97756', list: 435_000, wasPrinted: 426_575 },
    { slug: 'cma-19968', list: 461_000, wasPrinted: 436_008 },
  ]

  it.each(cases)('$slug — the net sits at or below the list it is printed beside', ({ list }) => {
    for (const summary of [GIVEN, NONE_GIVEN, NOTHING_KNOWN]) {
      const block = buildSellerNet({ list, summary })!
      expect(block.list).toBe(list)
      expect(block.net).toBeLessThanOrEqual(list)
      expect(block.net).toBeGreaterThan(0)
    }
  })

  it('cma-65365-concorde — the impossible figure cannot be produced from any concession set', () => {
    const block = buildSellerNet({ list: 1_473_000, summary: GIVEN })!
    expect(block.net).not.toBe(1_707_603)
    expect(block.net).toBeLessThan(1_707_603)
  })
})
