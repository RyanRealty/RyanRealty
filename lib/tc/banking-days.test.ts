import { describe, it, expect } from 'vitest'
import {
  isBankingDay,
  addBankingDays,
  bankingDaysBetween,
  reviewDeadline,
} from './banking-days'

// H4: the OAR 863-015-0140 "7 banking days" principal-review deadline math is
// legally load-bearing and was untested. A wrong holiday/observance rule silently
// mis-computes a compliance deadline. Dates below are hand-verified against the
// 2026 calendar (Jan 1 2026 = Thursday; 2026 is not a leap year).
const utc = (iso: string) => new Date(`${iso}T12:00:00Z`)

describe('isBankingDay', () => {
  it('counts ordinary weekdays', () => {
    expect(isBankingDay(utc('2026-07-02'))).toBe(true) // Thursday
    expect(isBankingDay(utc('2026-03-02'))).toBe(true) // Monday
  })
  it('excludes weekends', () => {
    expect(isBankingDay(utc('2026-07-04'))).toBe(false) // Saturday
    expect(isBankingDay(utc('2026-07-05'))).toBe(false) // Sunday
  })
  it('excludes federal holidays', () => {
    expect(isBankingDay(utc('2026-01-01'))).toBe(false) // New Year's (Thu)
    expect(isBankingDay(utc('2026-01-19'))).toBe(false) // MLK — 3rd Mon Jan
    expect(isBankingDay(utc('2026-05-25'))).toBe(false) // Memorial — last Mon May
    expect(isBankingDay(utc('2026-06-19'))).toBe(false) // Juneteenth (Fri)
    expect(isBankingDay(utc('2026-09-07'))).toBe(false) // Labor — 1st Mon Sep
    expect(isBankingDay(utc('2026-10-12'))).toBe(false) // Columbus — 2nd Mon Oct
    expect(isBankingDay(utc('2026-11-26'))).toBe(false) // Thanksgiving — 4th Thu Nov
    expect(isBankingDay(utc('2026-12-25'))).toBe(false) // Christmas (Fri)
  })
  it('applies federal observance: Sat holiday -> Fri, Sun holiday -> Mon', () => {
    // Independence Day 2026 falls on Saturday Jul 4 -> observed Friday Jul 3.
    expect(isBankingDay(utc('2026-07-03'))).toBe(false) // observed holiday
    expect(isBankingDay(utc('2026-07-02'))).toBe(true) // the day before is normal
    // New Year's Day 2023 fell on Sunday Jan 1 -> observed Monday Jan 2.
    expect(isBankingDay(utc('2023-01-02'))).toBe(false) // observed holiday (Mon)
  })
})

describe('addBankingDays', () => {
  it('skips weekends', () => {
    // Fri Jan 2 2026 (banking day) + 1 banking day -> Mon Jan 5 (Jan 3/4 weekend).
    expect(addBankingDays(utc('2026-01-02'), 1).toISOString().slice(0, 10)).toBe('2026-01-05')
  })
  it('skips holidays within the window (Juneteenth)', () => {
    // Mon Jun 15 2026 + 7 banking days. Jun 19 (Fri) is Juneteenth -> skipped.
    // Tue16,Wed17,Thu18,(skip Fri19 hol + weekend),Mon22,Tue23,Wed24,Thu25 = 7.
    expect(addBankingDays(utc('2026-06-15'), 7).toISOString().slice(0, 10)).toBe('2026-06-25')
  })
  it('a clean week with no holidays advances 7 banking days = 9 calendar days', () => {
    // Mon Mar 2 2026 + 7 banking days -> Wed Mar 11 (one weekend, no holidays).
    expect(addBankingDays(utc('2026-03-02'), 7).toISOString().slice(0, 10)).toBe('2026-03-11')
  })
})

describe('bankingDaysBetween', () => {
  it('counts forward, excluding the weekend + Juneteenth', () => {
    expect(bankingDaysBetween(utc('2026-06-15'), utc('2026-06-25'))).toBe(7)
  })
  it('is signed (negative when to < from) and zero for same day', () => {
    expect(bankingDaysBetween(utc('2026-06-25'), utc('2026-06-15'))).toBe(-7)
    expect(bankingDaysBetween(utc('2026-06-15'), utc('2026-06-15'))).toBe(0)
  })
})

describe('reviewDeadline (OAR 863-015-0140)', () => {
  it('is 7 banking days after the clock-start, holiday-aware', () => {
    const d = reviewDeadline('2026-06-15', utc('2026-06-16'))
    expect(d?.dueIso).toBe('2026-06-25')
    expect(d?.overdue).toBe(false)
    expect(d?.bankingDaysRemaining).toBeGreaterThan(0)
  })
  it('reports overdue with a negative remaining once now is past due', () => {
    const d = reviewDeadline('2026-06-15', utc('2026-06-30'))
    expect(d?.overdue).toBe(true)
    expect(d?.bankingDaysRemaining).toBeLessThan(0)
  })
  it('returns null for a missing or unparseable clock-start', () => {
    expect(reviewDeadline(null, utc('2026-06-16'))).toBeNull()
    expect(reviewDeadline('not-a-date', utc('2026-06-16'))).toBeNull()
  })
  it('honors a custom window length', () => {
    // 3 banking days after Mon Mar 2 -> Thu Mar 5 (no weekend/holiday in range).
    expect(reviewDeadline('2026-03-02', utc('2026-03-02'), 3)?.dueIso).toBe('2026-03-05')
  })
})
