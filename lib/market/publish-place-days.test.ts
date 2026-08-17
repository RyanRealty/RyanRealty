import { describe, expect, it } from 'vitest'
import {
  formatPlaceDays,
  formatPlaceDaysNumber,
  publishPlaceDays,
} from './publish-place-days'

describe('publishPlaceDays', () => {
  it('keeps the Black Butte half-day instead of inventing 40 (founding)', () => {
    expect(publishPlaceDays(39.5)).toBe(39.5)
    expect(formatPlaceDays(39.5)).toBe('39.5 days')
    expect(formatPlaceDaysNumber(39.5)).toBe('39.5')
  })

  it('keeps whole days whole', () => {
    expect(publishPlaceDays(19)).toBe(19)
    expect(formatPlaceDays(19)).toBe('19 days')
    expect(formatPlaceDays(1)).toBe('1 day')
  })

  it('snaps noisy floats to one decimal without walking to the next integer', () => {
    expect(publishPlaceDays(19.54)).toBe(19.5)
    expect(publishPlaceDays(19.46)).toBe(19.5)
    expect(formatPlaceDays(19.54)).toBe('19.5 days')
    expect(formatPlaceDays(19.54)).not.toBe('20 days')
  })

  it('withholds missing and non-positive values', () => {
    expect(publishPlaceDays(null)).toBeNull()
    expect(publishPlaceDays(0)).toBeNull()
    expect(publishPlaceDays(-3)).toBeNull()
    expect(publishPlaceDays(Number.NaN)).toBeNull()
    expect(formatPlaceDays(0)).toBe('')
  })
})
