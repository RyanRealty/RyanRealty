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
