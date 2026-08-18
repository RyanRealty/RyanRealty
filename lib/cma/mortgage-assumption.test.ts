import { describe, expect, it } from 'vitest'
import {
  monthsBetweenIso,
  mortgageFromPurchase,
  parsePmmsRateOnOrBefore,
  remainingPrincipal,
} from '@/lib/cma/mortgage-assumption'

describe('remainingPrincipal', () => {
  it('equals the original when no months have been paid', () => {
    expect(
      remainingPrincipal({ originalAmount: 360000, annualRatePct: 3, termMonths: 360, monthsPaid: 0 }),
    ).toBe(360000)
  })

  it('is zero when the term is finished', () => {
    expect(
      remainingPrincipal({ originalAmount: 360000, annualRatePct: 3, termMonths: 360, monthsPaid: 360 }),
    ).toBe(0)
  })

  it('drops after five years on a 30-year 3 percent loan', () => {
    const left = remainingPrincipal({
      originalAmount: 356000,
      annualRatePct: 2.87,
      termMonths: 360,
      monthsPaid: 61,
    })
    expect(left).toBeGreaterThan(280000)
    expect(left).toBeLessThan(356000)
  })
})

describe('parsePmmsRateOnOrBefore', () => {
  const csv = `date,pmms30
7/1/2021,2.98
7/8/2021,2.87
7/15/2021,2.88
8/5/2021,2.77`

  it('takes the last week on or before the purchase', () => {
    expect(parsePmmsRateOnOrBefore(csv, '2021-07-29')).toEqual({ value: 2.88, date: '2021-07-15' })
  })

  it('returns null when every week is after the purchase', () => {
    expect(parsePmmsRateOnOrBefore(csv, '2020-01-01')).toBeNull()
  })
})

describe('mortgageFromPurchase', () => {
  it('does not invent remaining principal without a rate', () => {
    const out = mortgageFromPurchase({
      purchasePrice: 445000,
      purchaseDate: '2021-07-29',
      asOf: new Date('2026-08-17T00:00:00Z'),
      ratePct: null,
      rateDate: null,
      rateSource: null,
    })
    expect(out?.assumedOriginal).toBe(356000)
    expect(out?.remainingEstimate).toBeNull()
    expect(out?.source).toMatch(/not a public record/)
  })

  it('amortizes when the weekly rate is known', () => {
    const out = mortgageFromPurchase({
      purchasePrice: 445000,
      purchaseDate: '2021-07-29',
      asOf: new Date('2026-08-17T00:00:00Z'),
      ratePct: 2.87,
      rateDate: '2021-07-08',
      rateSource: 'Freddie Mac PMMS history CSV, 30-year fixed',
    })
    expect(out?.remainingEstimate).toBeGreaterThan(280000)
    expect(out?.remainingEstimate).toBeLessThan(356000)
    expect(monthsBetweenIso('2021-07-29', '2026-08-17')).toBe(60)
  })
})
