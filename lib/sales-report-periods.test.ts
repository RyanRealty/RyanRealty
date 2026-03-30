import { describe, it, expect } from 'vitest'
import {
  getDateRangeForPeriod,
  getPeriodLabel,
  SALES_PERIODS,
} from './sales-report-periods'

describe('sales-report-periods', () => {
  describe('getDateRangeForPeriod', () => {
    it('returns valid date range for this-week', () => {
      const { start, end } = getDateRangeForPeriod('this-week')
      expect(start).toBeInstanceOf(Date)
      expect(end).toBeInstanceOf(Date)
      expect(start.getTime()).toBeLessThanOrEqual(end.getTime())
      // Start should be a Sunday (day 0)
      expect(start.getUTCDay()).toBe(0)
    })

    it('returns valid date range for last-week', () => {
      const { start, end } = getDateRangeForPeriod('last-week')
      expect(start).toBeInstanceOf(Date)
      expect(end).toBeInstanceOf(Date)
      expect(start.getTime()).toBeLessThanOrEqual(end.getTime())
      // Start should be Sunday, end should be Saturday
      expect(start.getUTCDay()).toBe(0)
      expect(end.getUTCDay()).toBe(6)
    })

    it('returns full previous month for last-month', () => {
      const { start, end } = getDateRangeForPeriod('last-month')
      expect(start).toBeInstanceOf(Date)
      expect(end).toBeInstanceOf(Date)
      // Start should be 1st of previous month
      expect(start.getUTCDate()).toBe(1)
      // End should be the last day of previous month
      expect(start.getTime()).toBeLessThanOrEqual(end.getTime())
    })

    it('returns full previous year for last-year', () => {
      const { start, end } = getDateRangeForPeriod('last-year')
      const expectedYear = new Date().getUTCFullYear() - 1
      expect(start.getUTCFullYear()).toBe(expectedYear)
      expect(end.getUTCFullYear()).toBe(expectedYear)
      expect(start.getUTCMonth()).toBe(0) // January
      expect(start.getUTCDate()).toBe(1)
      expect(end.getUTCMonth()).toBe(11) // December
      expect(end.getUTCDate()).toBe(31)
    })

    it('start is always <= end for all periods', () => {
      for (const period of SALES_PERIODS) {
        const { start, end } = getDateRangeForPeriod(period)
        expect(start.getTime()).toBeLessThanOrEqual(end.getTime())
      }
    })
  })

  describe('getPeriodLabel', () => {
    it('returns correct label for this-week', () => {
      expect(getPeriodLabel('this-week')).toBe("This Week's Sales")
    })

    it('returns correct label for last-week', () => {
      expect(getPeriodLabel('last-week')).toBe("Last Week's Sales")
    })

    it('returns correct label for last-month', () => {
      expect(getPeriodLabel('last-month')).toBe("Last Month's Sales")
    })

    it('returns correct label for last-year', () => {
      expect(getPeriodLabel('last-year')).toBe("Last Year's Sales")
    })

    it('returns fallback for unknown period', () => {
      expect(getPeriodLabel('unknown' as 'this-week')).toBe('Sales')
    })
  })

  describe('SALES_PERIODS', () => {
    it('has 4 periods', () => {
      expect(SALES_PERIODS).toHaveLength(4)
    })

    it('contains expected period slugs', () => {
      expect(SALES_PERIODS).toContain('this-week')
      expect(SALES_PERIODS).toContain('last-week')
      expect(SALES_PERIODS).toContain('last-month')
      expect(SALES_PERIODS).toContain('last-year')
    })
  })
})
