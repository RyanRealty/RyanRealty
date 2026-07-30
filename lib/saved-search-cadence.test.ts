import { describe, it, expect } from 'vitest'
import {
  SAVED_SEARCH_CADENCES,
  DEFAULT_SAVED_SEARCH_CADENCE,
  CADENCE_INTERVAL_MS,
  isSavedSearchCadence,
  validateCadence,
  normalizeStoredCadence,
  cadenceLabel,
  isCadenceDue,
  localDayOfWeek,
  normalizeScheduleDays,
} from './saved-search-cadence'

describe('SAVED_SEARCH_CADENCES', () => {
  it('offers exactly the four cron-honored values, in display order', () => {
    expect(SAVED_SEARCH_CADENCES.map((c) => c.value)).toEqual([
      'instant',
      'daily',
      'weekly',
      'monthly',
    ])
  })

  it('every option carries a non-empty sentence-case label and hint', () => {
    for (const option of SAVED_SEARCH_CADENCES) {
      expect(option.label.length).toBeGreaterThan(0)
      expect(option.hint.length).toBeGreaterThan(0)
      // sentence case: first char is uppercase, no ALL CAPS shouting
      expect(option.label[0]).toBe(option.label[0].toUpperCase())
    }
  })
})

describe('DEFAULT_SAVED_SEARCH_CADENCE', () => {
  it('matches the DB default and the cron fallback (daily)', () => {
    expect(DEFAULT_SAVED_SEARCH_CADENCE).toBe('daily')
  })
})

describe('isSavedSearchCadence', () => {
  it('accepts the four honored values', () => {
    expect(isSavedSearchCadence('instant')).toBe(true)
    expect(isSavedSearchCadence('daily')).toBe(true)
    expect(isSavedSearchCadence('weekly')).toBe(true)
    expect(isSavedSearchCadence('monthly')).toBe(true)
  })

  it('rejects anything the cron does not honor', () => {
    expect(isSavedSearchCadence('yearly')).toBe(false)
    expect(isSavedSearchCadence('hourly')).toBe(false)
    expect(isSavedSearchCadence('Daily')).toBe(false) // exact value, no coercion here
    expect(isSavedSearchCadence('')).toBe(false)
    expect(isSavedSearchCadence(null)).toBe(false)
    expect(isSavedSearchCadence(undefined)).toBe(false)
    expect(isSavedSearchCadence(7)).toBe(false)
  })
})

describe('validateCadence', () => {
  it('returns the matched cadence for valid input', () => {
    expect(validateCadence('weekly')).toBe('weekly')
    expect(validateCadence('monthly')).toBe('monthly')
  })

  it('trims and lowercases before matching', () => {
    expect(validateCadence('  Weekly  ')).toBe('weekly')
    expect(validateCadence('DAILY')).toBe('daily')
    expect(validateCadence(' Monthly ')).toBe('monthly')
  })

  it('returns null for an unhonored or non-string value', () => {
    expect(validateCadence('yearly')).toBeNull()
    expect(validateCadence('hourly')).toBeNull()
    expect(validateCadence('')).toBeNull()
    expect(validateCadence(null)).toBeNull()
    expect(validateCadence(undefined)).toBeNull()
    expect(validateCadence(42)).toBeNull()
    expect(validateCadence({})).toBeNull()
  })
})

describe('normalizeStoredCadence', () => {
  it('passes through valid stored values', () => {
    expect(normalizeStoredCadence('instant')).toBe('instant')
    expect(normalizeStoredCadence('weekly')).toBe('weekly')
    expect(normalizeStoredCadence('monthly')).toBe('monthly')
  })

  it('falls back to daily for missing or unrecognized values', () => {
    expect(normalizeStoredCadence(null)).toBe('daily')
    expect(normalizeStoredCadence(undefined)).toBe('daily')
    expect(normalizeStoredCadence('yearly')).toBe('daily')
    expect(normalizeStoredCadence('')).toBe('daily')
  })
})

describe('cadenceLabel', () => {
  it('returns the matching option label', () => {
    expect(cadenceLabel('instant')).toBe('As they hit the market')
    expect(cadenceLabel('daily')).toBe('Once a day')
    expect(cadenceLabel('weekly')).toBe('Once a week')
    expect(cadenceLabel('monthly')).toBe('Once a month')
  })

  it('returns the daily label for an unknown value', () => {
    expect(cadenceLabel('yearly')).toBe('Once a day')
    expect(cadenceLabel(null)).toBe('Once a day')
  })
})

describe('isCadenceDue', () => {
  const now = new Date('2026-07-21T12:00:00.000Z')
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000).toISOString()
  const daysAgo = (d: number) => hoursAgo(d * 24)

  it('a never-notified row is always due, whatever the cadence', () => {
    for (const { value } of SAVED_SEARCH_CADENCES) {
      expect(isCadenceDue({ notification_frequency: value, last_notified_at: null }, now)).toBe(true)
    }
  })

  it('instant is due after the 55-minute floor, not before', () => {
    const fiftyFourMinAgo = new Date(now.getTime() - 54 * 60 * 1000).toISOString()
    const fiftySixMinAgo = new Date(now.getTime() - 56 * 60 * 1000).toISOString()
    expect(isCadenceDue({ notification_frequency: 'instant', last_notified_at: fiftyFourMinAgo }, now)).toBe(false)
    expect(isCadenceDue({ notification_frequency: 'instant', last_notified_at: fiftySixMinAgo }, now)).toBe(true)
  })

  it('daily is due after 24 hours, not before', () => {
    expect(isCadenceDue({ notification_frequency: 'daily', last_notified_at: hoursAgo(23) }, now)).toBe(false)
    expect(isCadenceDue({ notification_frequency: 'daily', last_notified_at: hoursAgo(25) }, now)).toBe(true)
  })

  it('weekly is due after 7 days, not before', () => {
    expect(isCadenceDue({ notification_frequency: 'weekly', last_notified_at: daysAgo(6) }, now)).toBe(false)
    expect(isCadenceDue({ notification_frequency: 'weekly', last_notified_at: daysAgo(8) }, now)).toBe(true)
  })

  it('monthly is due after 30 days, not before', () => {
    expect(isCadenceDue({ notification_frequency: 'monthly', last_notified_at: daysAgo(29) }, now)).toBe(false)
    expect(isCadenceDue({ notification_frequency: 'monthly', last_notified_at: daysAgo(30) }, now)).toBe(true)
    expect(isCadenceDue({ notification_frequency: 'monthly', last_notified_at: daysAgo(45) }, now)).toBe(true)
  })

  it('an unknown stored frequency falls back to the daily interval', () => {
    expect(isCadenceDue({ notification_frequency: 'yearly', last_notified_at: hoursAgo(23) }, now)).toBe(false)
    expect(isCadenceDue({ notification_frequency: 'yearly', last_notified_at: hoursAgo(25) }, now)).toBe(true)
  })

  it('an unparseable timestamp is treated as never-notified (due)', () => {
    expect(isCadenceDue({ notification_frequency: 'weekly', last_notified_at: 'not-a-date' }, now)).toBe(true)
  })

  it('the interval table covers every cadence', () => {
    for (const { value } of SAVED_SEARCH_CADENCES) {
      expect(CADENCE_INTERVAL_MS[value]).toBeGreaterThan(0)
    }
    // Ordering sanity: instant < daily < weekly < monthly.
    expect(CADENCE_INTERVAL_MS.instant).toBeLessThan(CADENCE_INTERVAL_MS.daily)
    expect(CADENCE_INTERVAL_MS.daily).toBeLessThan(CADENCE_INTERVAL_MS.weekly)
    expect(CADENCE_INTERVAL_MS.weekly).toBeLessThan(CADENCE_INTERVAL_MS.monthly)
  })
})

describe('normalizeScheduleDays', () => {
  it('accepts valid day lists, deduped and sorted', () => {
    expect(normalizeScheduleDays([3, 1, 3, 5])).toEqual([1, 3, 5])
  })

  it('drops invalid entries and treats an empty result as null', () => {
    expect(normalizeScheduleDays([7, -1, 2.5])).toBeNull()
    expect(normalizeScheduleDays([])).toBeNull()
    expect(normalizeScheduleDays(null)).toBeNull()
    expect(normalizeScheduleDays('mon')).toBeNull()
  })
})

describe('localDayOfWeek (America/Los_Angeles)', () => {
  it('maps a UTC instant to the Pacific weekday', () => {
    // 2026-07-30T04:00:00Z is still Wednesday July 29, 9 PM PDT.
    expect(localDayOfWeek(new Date('2026-07-30T04:00:00.000Z'))).toBe(3)
    // 2026-07-29T05:00:00Z is Tuesday July 28, 10 PM PDT.
    expect(localDayOfWeek(new Date('2026-07-29T05:00:00.000Z'))).toBe(2)
  })
})

describe('isCadenceDue — weekly schedule_days (0=Sunday..6=Saturday, Pacific)', () => {
  // Wednesday July 29 2026, noon PDT.
  const wedNoon = new Date('2026-07-29T19:00:00.000Z')

  it('not due on a day outside the schedule', () => {
    expect(
      isCadenceDue(
        { notification_frequency: 'weekly', last_notified_at: null, schedule_days: [1] },
        wedNoon,
      ),
    ).toBe(false)
  })

  it('due on a scheduled day when never notified', () => {
    expect(
      isCadenceDue(
        { notification_frequency: 'weekly', last_notified_at: null, schedule_days: [3] },
        wedNoon,
      ),
    ).toBe(true)
  })

  it('at most one send per scheduled local day', () => {
    // Already sent this Wednesday morning (6 AM PDT) → not due again today.
    expect(
      isCadenceDue(
        {
          notification_frequency: 'weekly',
          last_notified_at: '2026-07-29T13:00:00.000Z',
          schedule_days: [3],
        },
        wedNoon,
      ),
    ).toBe(false)
    // Last send was the PREVIOUS Wednesday → due.
    expect(
      isCadenceDue(
        {
          notification_frequency: 'weekly',
          last_notified_at: '2026-07-22T19:00:00.000Z',
          schedule_days: [3],
        },
        wedNoon,
      ),
    ).toBe(true)
  })

  it('two scheduled days send twice a week (the 7-day interval does not apply)', () => {
    // Sent Tuesday noon PDT; now Wednesday noon PDT with a Tue+Wed schedule.
    expect(
      isCadenceDue(
        {
          notification_frequency: 'weekly',
          last_notified_at: '2026-07-28T19:00:00.000Z',
          schedule_days: [2, 3],
        },
        wedNoon,
      ),
    ).toBe(true)
  })

  it('uses the PACIFIC calendar day, not the UTC day', () => {
    // now: Wed Jul 29, 9 PM PDT (already Thursday in UTC).
    const wedLateEvening = new Date('2026-07-30T04:00:00.000Z')
    // last send: Tue Jul 28, 10 PM PDT (Wednesday in UTC!) → different local
    // day, Wednesday is scheduled → due.
    expect(
      isCadenceDue(
        {
          notification_frequency: 'weekly',
          last_notified_at: '2026-07-29T05:00:00.000Z',
          schedule_days: [3],
        },
        wedLateEvening,
      ),
    ).toBe(true)
  })

  it('invalid or empty schedule_days falls back to the plain weekly interval', () => {
    const sixDaysAgo = new Date(wedNoon.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString()
    const eightDaysAgo = new Date(wedNoon.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString()
    for (const schedule of [[], [9, -2], null, undefined, 'bogus']) {
      expect(
        isCadenceDue(
          { notification_frequency: 'weekly', last_notified_at: sixDaysAgo, schedule_days: schedule },
          wedNoon,
        ),
      ).toBe(false)
      expect(
        isCadenceDue(
          { notification_frequency: 'weekly', last_notified_at: eightDaysAgo, schedule_days: schedule },
          wedNoon,
        ),
      ).toBe(true)
    }
  })

  it('schedule_days is ignored for non-weekly cadences', () => {
    // Daily row carrying schedule_days [1] (Monday): still due after 25 hours
    // on a Wednesday — the day filter only applies to weekly.
    const twentyFiveHoursAgo = new Date(wedNoon.getTime() - 25 * 60 * 60 * 1000).toISOString()
    expect(
      isCadenceDue(
        { notification_frequency: 'daily', last_notified_at: twentyFiveHoursAgo, schedule_days: [1] },
        wedNoon,
      ),
    ).toBe(true)
  })
})
