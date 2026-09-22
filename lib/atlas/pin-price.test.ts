import { describe, expect, it } from 'vitest'
import {
  atlasClusterAskSpan,
  atlasPinShouldPaint,
  formatAtlasClusterPin,
  formatAtlasClusterRange,
  formatAtlasPinPrice,
} from './pin-price'

describe('formatAtlasPinPrice', () => {
  it('prints thousands with a dollar and lowercase k ($795k)', () => {
    expect(formatAtlasPinPrice(735_000)).toBe('$735k')
    expect(formatAtlasPinPrice(735_400)).toBe('$735k')
    expect(formatAtlasPinPrice(499_000)).toBe('$499k')
    expect(formatAtlasPinPrice(650_000)).toBe('$650k')
    expect(formatAtlasPinPrice(795_000)).toBe('$795k')
  })

  it('prints millions with a dollar ($1.2M / $1M)', () => {
    expect(formatAtlasPinPrice(1_200_000)).toBe('$1.2M')
    expect(formatAtlasPinPrice(1_500_000)).toBe('$1.5M')
    expect(formatAtlasPinPrice(1_000_000)).toBe('$1M')
    expect(formatAtlasPinPrice(12_000_000)).toBe('$12M')
  })

  it('never prints $1000k — 999,500 and up roll to a million', () => {
    expect(formatAtlasPinPrice(999_499)).toBe('$999k')
    expect(formatAtlasPinPrice(999_500)).toBe('$1M')
    expect(formatAtlasPinPrice(999_900)).toBe('$1M')
  })

  it('always uses $ and k/M case — never 735K or $650K', () => {
    expect(formatAtlasPinPrice(735_000)).not.toBe('735K')
    expect(formatAtlasPinPrice(650_000)).not.toBe('$650K')
    expect(formatAtlasPinPrice(650_000)).not.toBe('650K')
    expect(formatAtlasPinPrice(1_000_000)).not.toBe('$1.0M')
  })

  it('withholds a mark when the ask is missing', () => {
    expect(formatAtlasPinPrice(null)).toBe('')
    expect(formatAtlasPinPrice(0)).toBe('')
    expect(formatAtlasPinPrice(-1)).toBe('')
  })

  it('never prints $0k for MLS token / call-for-price asks', () => {
    expect(formatAtlasPinPrice(1.32)).toBe('')
    expect(formatAtlasPinPrice(1)).toBe('')
    expect(formatAtlasPinPrice(3_000)).toBe('')
    expect(formatAtlasPinPrice(9_999)).toBe('')
    expect(formatAtlasPinPrice(10_000)).toBe('$10k')
    expect(formatAtlasPinPrice(185_000)).toBe('$185k')
  })
})

describe('formatAtlasClusterRange', () => {
  it('names a span in the same pin language', () => {
    expect(formatAtlasClusterRange(499_000, 1_500_000)).toBe('$499k to $1.5M')
    expect(formatAtlasClusterRange(735_000, 735_000)).toBe('$735k')
  })
})

describe('formatAtlasClusterPin', () => {
  it('prints the same face as a lone pin when the pile is one ask', () => {
    expect(formatAtlasClusterPin(735_000, 735_400)).toBe('$735k')
    expect(formatAtlasClusterPin(1_500_000, 1_500_000)).toBe('$1.5M')
  })

  it('prints the low ask with + when the pile spans, never a bare count', () => {
    expect(formatAtlasClusterPin(735_000, 1_500_000)).toBe('$735k+')
    expect(formatAtlasClusterPin(1_000_000, 2_400_000)).toBe('$1M+')
    expect(formatAtlasClusterPin(185_000, 5_285_000)).toBe('$185k+')
  })

  it('does not paint 0K+ when the low ask is an MLS token', () => {
    expect(formatAtlasClusterPin(1.32, 5_285_000)).toBe('')
    expect(formatAtlasClusterPin(3_000, 5_285_000)).toBe('')
  })
})

describe('atlasClusterAskSpan', () => {
  it('skips token asks so a Bend NC pile faces 185K, not 0K+', () => {
    expect(atlasClusterAskSpan([1.32, 3_000, 185_000, 5_285_000])).toEqual({
      min: 185_000,
      max: 5_285_000,
    })
    expect(atlasClusterAskSpan([1.32, 3_000])).toBeNull()
  })
})

describe('atlasPinShouldPaint', () => {
  it('paints active and pending asks, not sold heat', () => {
    expect(atlasPinShouldPaint({ s: 'active', p: 735_000 })).toBe(true)
    expect(atlasPinShouldPaint({ s: 'pending', p: 1_500_000 })).toBe(true)
    expect(atlasPinShouldPaint({ s: 'sold', p: 735_000 })).toBe(false)
    expect(atlasPinShouldPaint({ s: 'closed', p: 735_000 })).toBe(false)
    expect(atlasPinShouldPaint({ s: 'active', p: null })).toBe(false)
    expect(atlasPinShouldPaint({ s: 'active', p: 1.32 })).toBe(false)
    expect(atlasPinShouldPaint({ s: 'active', p: 3_000 })).toBe(false)
  })
})
