import { describe, it, expect } from 'vitest'
import {
  normalizeSavedSearchFrequency,
  SAVED_SEARCH_FREQUENCIES,
  type SavedSearchFrequency,
} from './saved-search-frequency'

describe('normalizeSavedSearchFrequency', () => {
  it('passes through the three canonical values unchanged', () => {
    expect(normalizeSavedSearchFrequency('instant')).toBe('instant')
    expect(normalizeSavedSearchFrequency('daily')).toBe('daily')
    expect(normalizeSavedSearchFrequency('weekly')).toBe('weekly')
  })

  it('trims and lowercases before matching', () => {
    expect(normalizeSavedSearchFrequency('  Instant ')).toBe('instant')
    expect(normalizeSavedSearchFrequency('WEEKLY')).toBe('weekly')
    expect(normalizeSavedSearchFrequency('Daily')).toBe('daily')
  })

  it('defaults unknown strings to daily (the cron fallback)', () => {
    expect(normalizeSavedSearchFrequency('monthly')).toBe('daily')
    expect(normalizeSavedSearchFrequency('hourly')).toBe('daily')
    expect(normalizeSavedSearchFrequency('')).toBe('daily')
    expect(normalizeSavedSearchFrequency('   ')).toBe('daily')
  })

  it('defaults non-string input to daily', () => {
    expect(normalizeSavedSearchFrequency(null)).toBe('daily')
    expect(normalizeSavedSearchFrequency(undefined)).toBe('daily')
    expect(normalizeSavedSearchFrequency(7)).toBe('daily')
    expect(normalizeSavedSearchFrequency({})).toBe('daily')
  })

  it('only ever returns a value the cron honors', () => {
    const inputs: unknown[] = ['instant', 'daily', 'weekly', 'monthly', '', null, 42]
    for (const input of inputs) {
      const out: SavedSearchFrequency = normalizeSavedSearchFrequency(input)
      expect(SAVED_SEARCH_FREQUENCIES).toContain(out)
    }
  })
})
