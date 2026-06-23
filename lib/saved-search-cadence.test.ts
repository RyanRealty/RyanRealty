import { describe, it, expect } from 'vitest'
import {
  SAVED_SEARCH_CADENCES,
  DEFAULT_SAVED_SEARCH_CADENCE,
  isSavedSearchCadence,
  validateCadence,
  normalizeStoredCadence,
  cadenceLabel,
} from './saved-search-cadence'

describe('SAVED_SEARCH_CADENCES', () => {
  it('offers exactly the three cron-honored values, in display order', () => {
    expect(SAVED_SEARCH_CADENCES.map((c) => c.value)).toEqual(['instant', 'daily', 'weekly'])
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
  it('accepts the three honored values', () => {
    expect(isSavedSearchCadence('instant')).toBe(true)
    expect(isSavedSearchCadence('daily')).toBe(true)
    expect(isSavedSearchCadence('weekly')).toBe(true)
  })

  it('rejects anything the cron does not honor', () => {
    expect(isSavedSearchCadence('monthly')).toBe(false)
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
  })

  it('trims and lowercases before matching', () => {
    expect(validateCadence('  Weekly  ')).toBe('weekly')
    expect(validateCadence('DAILY')).toBe('daily')
  })

  it('returns null for an unhonored or non-string value', () => {
    expect(validateCadence('monthly')).toBeNull()
    expect(validateCadence('yearly')).toBeNull()
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
  })

  it('falls back to daily for missing or unrecognized values', () => {
    expect(normalizeStoredCadence(null)).toBe('daily')
    expect(normalizeStoredCadence(undefined)).toBe('daily')
    expect(normalizeStoredCadence('monthly')).toBe('daily')
    expect(normalizeStoredCadence('')).toBe('daily')
  })
})

describe('cadenceLabel', () => {
  it('returns the matching option label', () => {
    expect(cadenceLabel('instant')).toBe('As they hit the market')
    expect(cadenceLabel('daily')).toBe('Once a day')
    expect(cadenceLabel('weekly')).toBe('Once a week')
  })

  it('returns the daily label for an unknown value', () => {
    expect(cadenceLabel('monthly')).toBe('Once a day')
    expect(cadenceLabel(null)).toBe('Once a day')
  })
})
