import { describe, it, expect } from 'vitest'
import { formatPrice, formatPriceCompact } from './money'

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
  it('handles null', () => {
    expect(formatPriceCompact(null)).toBe('—')
  })
})
