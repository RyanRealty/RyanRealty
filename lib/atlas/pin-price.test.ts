import { describe, expect, it } from 'vitest'
import { atlasPinShouldPaint, formatAtlasPinPrice } from './pin-price'

describe('formatAtlasPinPrice', () => {
  it('prints Redfin-style thousands without a dollar (735K)', () => {
    expect(formatAtlasPinPrice(735_000)).toBe('735K')
    expect(formatAtlasPinPrice(735_400)).toBe('735K')
    expect(formatAtlasPinPrice(499_000)).toBe('499K')
  })

  it('prints millions with a dollar ($1.5M / $1M)', () => {
    expect(formatAtlasPinPrice(1_500_000)).toBe('$1.5M')
    expect(formatAtlasPinPrice(1_000_000)).toBe('$1M')
    expect(formatAtlasPinPrice(12_000_000)).toBe('$12M')
  })

  it('never prints $1000K — 999,500 and up roll to a million', () => {
    expect(formatAtlasPinPrice(999_499)).toBe('999K')
    expect(formatAtlasPinPrice(999_500)).toBe('$1M')
    expect(formatAtlasPinPrice(999_900)).toBe('$1M')
  })

  it('withholds a mark when the ask is missing', () => {
    expect(formatAtlasPinPrice(null)).toBe('')
    expect(formatAtlasPinPrice(0)).toBe('')
    expect(formatAtlasPinPrice(-1)).toBe('')
  })
})

describe('atlasPinShouldPaint', () => {
  it('paints active and pending asks, not sold heat', () => {
    expect(atlasPinShouldPaint({ s: 'active', p: 735_000 })).toBe(true)
    expect(atlasPinShouldPaint({ s: 'pending', p: 1_500_000 })).toBe(true)
    expect(atlasPinShouldPaint({ s: 'sold', p: 735_000 })).toBe(false)
    expect(atlasPinShouldPaint({ s: 'closed', p: 735_000 })).toBe(false)
    expect(atlasPinShouldPaint({ s: 'active', p: null })).toBe(false)
  })
})
