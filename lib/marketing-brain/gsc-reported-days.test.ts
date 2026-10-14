import { describe, expect, it } from 'vitest'
import { isDayReported, latestReportedDate, splitReportedDays } from './gsc-reported-days'

describe('latestReportedDate', () => {
  it('returns the latest date key from a date-grouped response', () => {
    // Shape and boundary of the live read on 2026-10-14 (final data through 10-11).
    const rows = [
      { keys: ['2026-10-09'], impressions: 1081 },
      { keys: ['2026-10-11'], impressions: 823 },
      { keys: ['2026-10-10'], impressions: 855 },
    ]
    expect(latestReportedDate(rows)).toBe('2026-10-11')
  })

  it('is null when Google returned no rows, so nothing is stored', () => {
    expect(latestReportedDate([])).toBeNull()
    expect(latestReportedDate(undefined)).toBeNull()
    expect(latestReportedDate(null)).toBeNull()
  })

  it('ignores rows without a usable date key', () => {
    expect(latestReportedDate([{ keys: [] }, { keys: null }, { keys: ['not-a-date'] }, { keys: [undefined] }])).toBeNull()
    expect(latestReportedDate([{ keys: ['garbage'] }, { keys: ['2026-10-01'] }])).toBe('2026-10-01')
  })
})

describe('isDayReported', () => {
  it('a day after the latest reported date is not reported', () => {
    expect(isDayReported('2026-10-12', '2026-10-11')).toBe(false)
  })

  it('the latest reported date and earlier days are reported', () => {
    expect(isDayReported('2026-10-11', '2026-10-11')).toBe(true)
    expect(isDayReported('2026-10-05', '2026-10-11')).toBe(true)
  })

  it('nothing is reported when Google reported nothing', () => {
    expect(isDayReported('2026-10-05', null)).toBe(false)
  })

  it('compares across month and year boundaries', () => {
    expect(isDayReported('2026-09-30', '2026-10-01')).toBe(true)
    expect(isDayReported('2027-01-01', '2026-12-31')).toBe(false)
  })
})

describe('splitReportedDays', () => {
  it('the cron window on 2026-10-14 stores 10-05..10-11 and skips 10-12', () => {
    const window = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12']
    const { reported, pending } = splitReportedDays(window, '2026-10-11')
    expect(reported).toEqual(window.slice(0, 7))
    expect(pending).toEqual(['2026-10-12'])
  })

  it('stores nothing when the reported-through date is unknown', () => {
    expect(splitReportedDays(['2026-10-10', '2026-10-11'], null)).toEqual({ reported: [], pending: ['2026-10-10', '2026-10-11'] })
  })

  it('stores a whole backfill range that Google has finished', () => {
    expect(splitReportedDays(['2026-01-01', '2026-01-02'], '2026-10-11')).toEqual({
      reported: ['2026-01-01', '2026-01-02'],
      pending: [],
    })
  })
})
