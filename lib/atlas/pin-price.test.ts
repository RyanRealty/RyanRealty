import { describe, expect, it } from 'vitest'
import {
  ATLAS_CLUSTER_PIN_LABEL,
  atlasClusterAskSpan,
  atlasClusterMedianAsk,
  atlasPinShouldPaint,
  formatAtlasClusterMedian,
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

describe('atlasClusterMedianAsk (UXLIVE-6)', () => {
  it('is the middle ask of an odd pile', () => {
    expect(atlasClusterMedianAsk([1_500_000, 735_000, 50_000])).toBe(735_000)
  })

  it('is the mean of the two middle asks of an even pile, to the dollar', () => {
    expect(atlasClusterMedianAsk([500_000, 700_001, 900_000, 50_000])).toBe(600_001)
    expect(atlasClusterMedianAsk([699_000, 700_000])).toBe(699_500)
  })

  it('does not let one cheap lot set the figure (the $50k+ over Bend)', () => {
    // One land lot at $50k among houses. The old face printed "$50k+".
    const pile = [50_000, 689_000, 715_000, 735_000, 749_900, 1_200_000]
    expect(atlasClusterMedianAsk(pile)).toBe(725_000)
    expect(formatAtlasClusterMedian(pile)).toBe('$725k')
  })

  it('skips token asks and missing asks, and is null when nothing real is left', () => {
    expect(atlasClusterMedianAsk([1.32, 3_000, null, undefined, 185_000, 5_285_000])).toBe(2_735_000)
    expect(atlasClusterMedianAsk([1.32, 3_000, null])).toBeNull()
    expect(atlasClusterMedianAsk([])).toBeNull()
  })
})

describe('formatAtlasClusterMedian', () => {
  it('prints the lone-pin face, never a + and never a bare count', () => {
    expect(formatAtlasClusterMedian([735_000, 735_400])).toBe('$735k')
    expect(formatAtlasClusterMedian([1_500_000, 1_500_000])).toBe('$1.5M')
    expect(formatAtlasClusterMedian([735_000, 1_500_000, 2_400_000])).toBe('$1.5M')
    expect(formatAtlasClusterMedian([185_000, 5_285_000])).not.toMatch(/\+/)
  })

  it('prints nothing when the pile has no real ask', () => {
    expect(formatAtlasClusterMedian([1.32, 3_000])).toBe('')
  })

  it('labels the figure plainly', () => {
    expect(ATLAS_CLUSTER_PIN_LABEL).toBe('median')
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
