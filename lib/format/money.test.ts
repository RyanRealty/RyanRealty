import { describe, it, expect } from 'vitest'
import { formatPrice, formatPriceCompact, formatPriceExact } from './money'

describe('formatPrice (rounds to nearest $1,000 per brand voice)', () => {
  it('rounds and formats', () => {
    expect(formatPrice(894_750)).toBe('$895,000')
    expect(formatPrice(1_200_000)).toBe('$1,200,000')
  })
  it('returns an em-dash placeholder for null/non-finite', () => {
    expect(formatPrice(null)).toBe('—')
    expect(formatPrice(undefined)).toBe('—')
    expect(formatPrice(NaN)).toBe('—')
  })
})

describe('formatPriceCompact (one agreed rounding rule)', () => {
  it('compacts millions and thousands', () => {
    expect(formatPriceCompact(1_250_000)).toBe('$1.3M')
    expect(formatPriceCompact(12_000_000)).toBe('$12M')
    expect(formatPriceCompact(895_000)).toBe('$895K')
    expect(formatPriceCompact(950)).toBe('$950')
  })
  it('never prints $1000K when thousands-round crosses a million (Roosevelt $999,900)', () => {
    expect(formatPriceCompact(999_900)).toBe('$1.0M')
    expect(formatPriceCompact(999_500)).toBe('$1.0M')
    expect(formatPriceCompact(1_000_000)).toBe('$1.0M')
    expect(formatPriceCompact(999_900)).not.toBe('$1000K')
    expect(formatPriceCompact(999_499)).toBe('$999K')
  })
  it('handles null', () => {
    expect(formatPriceCompact(null)).toBe('—')
  })

  // SITE-139 (Matt 2026-09-21): "map chips use $795k / $1.2M while listing
  // cards still print $650K — one house publisher." formatPriceCompact IS
  // that one publisher; every hand-rolled `$${n/1000}k` copy across the
  // codebase was migrated to call it. These boundary cases are the contract
  // every caller (map pills, chart labels, CRM alert sentences, SEO meta
  // descriptions) now inherits — always uppercase K/M, always a leading $.
  describe('boundary cases (SITE-139)', () => {
    it('below $1,000: whole-dollar currency, no K suffix', () => {
      expect(formatPriceCompact(999)).toBe('$999')
    })
    it('exactly $1,000: the K branch begins', () => {
      expect(formatPriceCompact(1_000)).toBe('$1K')
    })
    it('$999,500: rounds to the nearest thousand within the K branch', () => {
      expect(formatPriceCompact(999_500)).toBe('$1.0M') // crosses into M per the Roosevelt rule above
    })
    it('exactly $1,000,000: enters the M branch, one decimal', () => {
      expect(formatPriceCompact(1_000_000)).toBe('$1.0M')
    })
    it('$1,050,000: one decimal, matches Matt-reported "$1.2M" style exactly', () => {
      expect(formatPriceCompact(1_050_000)).toBe('$1.1M')
      expect(formatPriceCompact(1_200_000)).toBe('$1.2M')
    })
    it('$10,000,000: crosses the toFixed(0) threshold — no decimal at 10M+', () => {
      expect(formatPriceCompact(10_000_000)).toBe('$10M')
      expect(formatPriceCompact(9_999_999)).toBe('$10.0M')
    })
    it('null / undefined / NaN: em-dash, never a crash or "$NaNK"', () => {
      expect(formatPriceCompact(null)).toBe('—')
      expect(formatPriceCompact(undefined)).toBe('—')
      expect(formatPriceCompact(Number.NaN)).toBe('—')
    })
    it('zero: whole-dollar currency, not a blank or a K', () => {
      expect(formatPriceCompact(0)).toBe('$0')
    })
    it('negative: still renders (whole-dollar currency below the K floor)', () => {
      expect(formatPriceCompact(-500)).toBe('-$500')
    })
    it('never regresses to a lowercase k/m suffix at any magnitude', () => {
      for (const n of [999, 1_000, 250_000, 795_000, 999_500, 1_000_000, 1_200_000, 10_000_000]) {
        expect(formatPriceCompact(n)).not.toMatch(/[km]$/)
      }
    })
  })
})

describe('formatPriceExact (whole-dollar, no thousand-rounding)', () => {
  it('boundary cases', () => {
    expect(formatPriceExact(999)).toBe('$999')
    expect(formatPriceExact(1_000)).toBe('$1,000')
    expect(formatPriceExact(999_500)).toBe('$999,500')
    expect(formatPriceExact(1_000_000)).toBe('$1,000,000')
    expect(formatPriceExact(1_050_000)).toBe('$1,050,000')
    expect(formatPriceExact(10_000_000)).toBe('$10,000,000')
    expect(formatPriceExact(0)).toBe('$0')
    expect(formatPriceExact(-500)).toBe('-$500')
  })
  it('returns an em-dash placeholder for null/undefined/NaN', () => {
    expect(formatPriceExact(null)).toBe('—')
    expect(formatPriceExact(undefined)).toBe('—')
    expect(formatPriceExact(Number.NaN)).toBe('—')
  })
})
