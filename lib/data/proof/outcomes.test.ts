/**
 * The proof block's arithmetic, tested through the public interface.
 *
 * Fixtures are shaped like the real Ryan Realty MLS rows (verified live
 * 2026-09-08), including the three off-market records whose contract date
 * precedes their on-market date — the case that would otherwise publish a
 * flattering "0 days to pending".
 */
import { describe, expect, it } from 'vitest'
import {
  computeProofOutcomes,
  daysToContract,
  medianCont,
  PROOF_MIN_CLOSES,
  saleToOriginalList,
  type ProofClosingInput,
} from './outcomes'

function closing(over: Partial<ProofClosingInput> & { id: string }): ProofClosingInput {
  return {
    city: 'Bend',
    propertySubType: 'Single Family Residence',
    originalListPrice: 500_000,
    closePrice: 500_000,
    onMarketDate: '2026-01-01',
    contractDate: '2026-01-11',
    closeDate: '2026-02-01',
    ...over,
  }
}

describe('saleToOriginalList', () => {
  it('divides the close by the ORIGINAL asking price, not the final one', () => {
    // 220198987: original 829,000, final list 699,000, closed 661,000.
    // Against the original that is 79.7%; against the final it would be 94.6%.
    expect(saleToOriginalList(661_000, 829_000)).toBeCloseTo(0.797346, 6)
  })

  it('reads over asking above 1', () => {
    // 220225317: original 655,000, closed 665,000.
    expect(saleToOriginalList(665_000, 655_000)).toBeCloseTo(1.015267, 6)
  })

  it('drops a placeholder original list price below the $100 fact-table floor', () => {
    expect(saleToOriginalList(500_000, 1)).toBeNull()
    expect(saleToOriginalList(500_000, 0)).toBeNull()
  })

  it('drops a missing or non-positive close price', () => {
    expect(saleToOriginalList(null, 500_000)).toBeNull()
    expect(saleToOriginalList(0, 500_000)).toBeNull()
  })
})

describe('daysToContract', () => {
  it('counts whole days from on-market to contract', () => {
    // 220205364: on market 2025-07-07, under contract 2025-09-21.
    expect(daysToContract('2025-09-21', '2025-07-07')).toBe(76)
    // 220225317: 2026-07-19 to 2026-07-21.
    expect(daysToContract('2026-07-21', '2026-07-19')).toBe(2)
  })

  it('drops a record whose contract predates the day it reached the market', () => {
    // 220221770: on market 2026-05-20, contract dated 2026-05-15 — an
    // off-market sale entered into the MLS after the fact.
    expect(daysToContract('2026-05-15', '2026-05-20')).toBeNull()
  })

  it('keeps a genuine same-day contract at 0', () => {
    expect(daysToContract('2026-01-01', '2026-01-01')).toBe(0)
  })

  it('ignores the time of day on a timestamp', () => {
    expect(daysToContract('2026-01-11', '2026-01-01T23:59:59+00:00')).toBe(10)
  })

  it('drops a missing date on either side', () => {
    expect(daysToContract(null, '2026-01-01')).toBeNull()
    expect(daysToContract('2026-01-01', null)).toBeNull()
  })
})

describe('medianCont', () => {
  it('interpolates an even-n set the way percentile_cont does', () => {
    // The live days-to-contract set: 2, 12, 28, 76, 118, 160 -> (28+76)/2.
    expect(medianCont([160, 2, 118, 12, 76, 28])).toBe(52)
  })

  it('takes the middle value of an odd-n set', () => {
    expect(medianCont([1, 2, 3, 4, 5])).toBe(3)
  })

  it('is null on an empty set', () => {
    expect(medianCont([])).toBeNull()
  })
})

describe('computeProofOutcomes', () => {
  const windowStart = '2025-09-08'
  const windowEnd = '2026-09-08'

  it('keeps only closings inside the window, inclusive of both ends', () => {
    const out = computeProofOutcomes({
      closings: [
        closing({ id: 'before', closeDate: '2025-09-07' }),
        closing({ id: 'start', closeDate: '2025-09-08' }),
        closing({ id: 'end', closeDate: '2026-09-08' }),
        closing({ id: 'after', closeDate: '2026-09-09' }),
      ],
      windowStart,
      windowEnd,
    })
    expect(out.rows.map((r) => r.id)).toEqual(['end', 'start'])
    expect(out.closings).toBe(2)
  })

  it('computes both figures per closing and drops only the undefined one', () => {
    // The off-market record keeps its sale-to-list (the market's definition
    // has no quarrel with the price) and loses only its days figure.
    const out = computeProofOutcomes({
      closings: [
        closing({
          id: 'off-market',
          originalListPrice: 3_025_000,
          closePrice: 3_025_000,
          onMarketDate: '2026-05-20',
          contractDate: '2026-05-15',
          closeDate: '2026-05-15',
        }),
        ...Array.from({ length: 5 }, (_, i) =>
          closing({ id: `ordinary-${i}`, closeDate: `2026-0${i + 1}-15` }),
        ),
      ],
      windowStart,
      windowEnd,
    })
    const offMarket = out.rows.find((r) => r.id === 'off-market')
    expect(offMarket?.saleToOriginal).toBe(1)
    expect(offMarket?.daysToContract).toBeNull()
    expect(out.closings).toBe(6)
    expect(out.saleToOriginalN).toBe(6)
    expect(out.daysToContractN).toBe(5)
    expect(out.daysExcludedN).toBe(1)
  })

  it('reproduces the live 2026-09-08 record: 7 closings, 6 chartable days, medians 93.7% and 52', () => {
    const out = computeProofOutcomes({
      closings: [
        // 220225317 Redmond
        closing({ id: '220225317', city: 'Redmond', originalListPrice: 655_000, closePrice: 665_000, onMarketDate: '2026-07-19', contractDate: '2026-07-21', closeDate: '2026-09-01' }),
        // 220215040 Bend
        closing({ id: '220215040', originalListPrice: 539_000, closePrice: 519_000, onMarketDate: '2026-04-16', contractDate: '2026-05-14', closeDate: '2026-07-08' }),
        // 220221770 Bend — off-market entry, days dropped
        closing({ id: '220221770', originalListPrice: 3_025_000, closePrice: 3_025_000, onMarketDate: '2026-05-20', contractDate: '2026-05-15', closeDate: '2026-05-15' }),
        // 220205364 Bend
        closing({ id: '220205364', originalListPrice: 839_000, closePrice: 755_000, onMarketDate: '2025-07-07', contractDate: '2025-09-21', closeDate: '2025-10-29' }),
        // 220200647 Bend
        closing({ id: '220200647', originalListPrice: 1_890_000, closePrice: 1_715_000, onMarketDate: '2025-05-01', contractDate: '2025-08-27', closeDate: '2025-10-10' }),
        // 220198987 Bend
        closing({ id: '220198987', originalListPrice: 829_000, closePrice: 661_000, onMarketDate: '2025-04-07', contractDate: '2025-09-14', closeDate: '2025-09-29' }),
        // 220205567 Bend
        closing({ id: '220205567', originalListPrice: 1_099_000, closePrice: 1_030_000, onMarketDate: '2025-08-16', contractDate: '2025-08-28', closeDate: '2025-09-25' }),
        // Out of window, must not count
        closing({ id: '220203839', closeDate: '2025-07-25' }),
      ],
      windowStart,
      windowEnd,
    })

    expect(out.closings).toBe(7)
    expect(out.saleToOriginalN).toBe(7)
    expect(out.daysToContractN).toBe(6)
    expect(out.daysExcludedN).toBe(1)
    expect(out.rows.map((r) => r.daysToContract)).toEqual([2, 28, null, 76, 118, 160, 12])
    expect(out.medianDaysToContract).toBe(52)
    expect(out.medianSaleToOriginal).toBeCloseTo(0.937216, 6)
    expect(out.cities).toEqual(['Bend', 'Redmond'])
    expect(out.publishable).toBe(true)
    expect(out.quietReason).toBeNull()
  })

  it('goes quiet below the small-n floor instead of charting a thin set', () => {
    const out = computeProofOutcomes({
      closings: Array.from({ length: PROOF_MIN_CLOSES - 1 }, (_, i) =>
        closing({ id: `c${i}`, closeDate: `2026-0${i + 1}-15` }),
      ),
      windowStart,
      windowEnd,
    })
    expect(out.closings).toBe(PROOF_MIN_CLOSES - 1)
    expect(out.publishable).toBe(false)
    expect(out.quietReason).toBeTruthy()
  })

  it('publishes exactly at the floor', () => {
    const out = computeProofOutcomes({
      closings: Array.from({ length: PROOF_MIN_CLOSES }, (_, i) =>
        closing({ id: `c${i}`, closeDate: `2026-0${i + 1}-15` }),
      ),
      windowStart,
      windowEnd,
    })
    expect(out.publishable).toBe(true)
  })

  it('names every city in the set so one market is never implied', () => {
    const out = computeProofOutcomes({
      closings: [
        closing({ id: 'a', city: 'Redmond', closeDate: '2026-01-01' }),
        closing({ id: 'b', city: 'Bend', closeDate: '2026-02-01' }),
        closing({ id: 'c', city: 'Bend', closeDate: '2026-03-01' }),
      ],
      windowStart,
      windowEnd,
    })
    expect(out.cities).toEqual(['Bend', 'Redmond'])
  })

  it('survives a row with no dates and no prices without throwing', () => {
    const out = computeProofOutcomes({
      closings: [
        closing({ id: 'blank', originalListPrice: null, closePrice: null, onMarketDate: null, contractDate: null, closeDate: '2026-01-01' }),
      ],
      windowStart,
      windowEnd,
    })
    expect(out.rows[0]?.saleToOriginal).toBeNull()
    expect(out.rows[0]?.daysToContract).toBeNull()
    expect(out.medianSaleToOriginal).toBeNull()
  })
})
