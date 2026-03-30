import { describe, it, expect } from 'vitest'
import {
  monthlyPrincipalAndInterest,
  estimatedMonthlyPayment,
  formatMonthlyPayment,
  DEFAULT_DISPLAY_RATE,
  DEFAULT_DISPLAY_DOWN_PCT,
  DEFAULT_DISPLAY_TERM_YEARS,
} from './mortgage'

describe('mortgage', () => {
  describe('monthlyPrincipalAndInterest', () => {
    it('returns 0 for zero loan amount', () => {
      expect(monthlyPrincipalAndInterest(0, 7, 30)).toBe(0)
    })

    it('returns 0 for negative loan amount', () => {
      expect(monthlyPrincipalAndInterest(-100000, 7, 30)).toBe(0)
    })

    it('returns 0 for zero term years', () => {
      expect(monthlyPrincipalAndInterest(300000, 7, 0)).toBe(0)
    })

    it('divides evenly when rate is 0', () => {
      const monthly = monthlyPrincipalAndInterest(120000, 0, 10)
      expect(monthly).toBe(1000) // 120000 / 120 months
    })

    it('calculates correctly for typical 30yr fixed at 7%', () => {
      const monthly = monthlyPrincipalAndInterest(400000, 7, 30)
      // Known value: ~$2,661.21
      expect(monthly).toBeCloseTo(2661.21, 0)
    })

    it('calculates correctly for 15yr fixed at 6.5%', () => {
      const monthly = monthlyPrincipalAndInterest(300000, 6.5, 15)
      // Known value: ~$2,613.32
      expect(monthly).toBeCloseTo(2613.32, 0)
    })

    it('handles very small loan amounts', () => {
      const monthly = monthlyPrincipalAndInterest(1000, 5, 30)
      expect(monthly).toBeGreaterThan(0)
      expect(monthly).toBeLessThan(10)
    })
  })

  describe('estimatedMonthlyPayment', () => {
    it('returns 0 for zero list price', () => {
      expect(estimatedMonthlyPayment(0, 20, 7, 30)).toBe(0)
    })

    it('returns 0 for negative list price', () => {
      expect(estimatedMonthlyPayment(-500000, 20, 7, 30)).toBe(0)
    })

    it('calculates with 20% down payment', () => {
      const monthly = estimatedMonthlyPayment(500000, 20, 7, 30)
      // 500K - 20% down = 400K loan
      const expectedLoan = 400000
      const directCalc = monthlyPrincipalAndInterest(expectedLoan, 7, 30)
      expect(monthly).toBeCloseTo(directCalc, 2)
    })

    it('calculates with 0% down payment', () => {
      const monthly = estimatedMonthlyPayment(500000, 0, 7, 30)
      const directCalc = monthlyPrincipalAndInterest(500000, 7, 30)
      expect(monthly).toBeCloseTo(directCalc, 2)
    })

    it('calculates with 100% down payment (zero loan)', () => {
      expect(estimatedMonthlyPayment(500000, 100, 7, 30)).toBe(0)
    })
  })

  describe('formatMonthlyPayment', () => {
    it('formats as USD with no decimals', () => {
      expect(formatMonthlyPayment(2661)).toBe('$2,661')
    })

    it('rounds to nearest dollar', () => {
      const result = formatMonthlyPayment(2661.49)
      expect(result).toBe('$2,661')
    })

    it('formats zero', () => {
      expect(formatMonthlyPayment(0)).toBe('$0')
    })

    it('formats large amounts', () => {
      expect(formatMonthlyPayment(15000)).toBe('$15,000')
    })
  })

  describe('default constants', () => {
    it('has sensible defaults', () => {
      expect(DEFAULT_DISPLAY_RATE).toBeGreaterThan(0)
      expect(DEFAULT_DISPLAY_DOWN_PCT).toBe(20)
      expect(DEFAULT_DISPLAY_TERM_YEARS).toBe(30)
    })
  })
})
