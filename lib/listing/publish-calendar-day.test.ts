import { describe, expect, it } from 'vitest'
import { publishCalendarDay, publishHistoryDay, publishOpenHouseDay } from './publish-calendar-day'

describe('publishOpenHouseDay', () => {
  it('Kilimanjaro: 2026-08-18 is Tuesday, Aug 18, not Monday, Aug 17', () => {
    expect(publishOpenHouseDay('2026-08-18')).toBe('Tuesday, Aug 18')
    expect(publishOpenHouseDay('2026-08-19')).toBe('Wednesday, Aug 19')
    expect(publishOpenHouseDay('2026-08-20')).toBe('Thursday, Aug 20')
  })

  it('does not invent a day', () => {
    expect(publishOpenHouseDay(null)).toBe('')
    expect(publishOpenHouseDay('')).toBe('')
    expect(publishOpenHouseDay('not-a-date')).toBe('')
  })
})

describe('publishHistoryDay', () => {
  it('keeps the stored civil day', () => {
    expect(publishHistoryDay('2026-07-09')).toBe('Jul 9, 2026')
  })
})

describe('publishCalendarDay', () => {
  it('accepts weekday overrides without shifting the day', () => {
    expect(
      publishCalendarDay('2026-08-18', { weekday: 'short', month: 'short', day: 'numeric', year: undefined }),
    ).toBe('Tue, Aug 18')
  })

  it('can print only the weekday for a badge', () => {
    expect(
      publishCalendarDay('2026-08-18', { weekday: 'short', month: undefined, day: undefined, year: undefined }),
    ).toBe('Tue')
  })
})
