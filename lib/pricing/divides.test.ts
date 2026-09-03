import { describe, expect, it } from 'vitest'
import { crossesMajorDivide, unmappedCrossesKnownBank } from '@/lib/pricing/divides'

describe('crossesMajorDivide', () => {
  it('excludes Larkspur from an Awbrey Butte subject (Parkway / US-97)', () => {
    expect(crossesMajorDivide('bend-awbrey-butte', 'bend-larkspur')).toBe(true)
  })

  it('excludes Old Bend from a River West subject (Deschutes)', () => {
    expect(crossesMajorDivide('bend-river-west', 'bend-old-bend')).toBe(true)
  })

  it('allows same-side Awbrey Butte and River West', () => {
    expect(crossesMajorDivide('bend-awbrey-butte', 'bend-river-west')).toBe(false)
  })

  it('fails open when either area is missing', () => {
    expect(crossesMajorDivide('bend-awbrey-butte', null)).toBe(false)
    expect(crossesMajorDivide(null, 'bend-larkspur')).toBe(false)
    expect(crossesMajorDivide(null, null)).toBe(false)
    expect(crossesMajorDivide('', 'bend-larkspur')).toBe(false)
  })
})

describe('unmappedCrossesKnownBank', () => {
  it('blocks unmapped vs a known Parkway or Deschutes bank', () => {
    expect(unmappedCrossesKnownBank(null, 'bend-larkspur')).toBe(true)
    expect(unmappedCrossesKnownBank('bend-awbrey-butte', null)).toBe(true)
  })

  it('still fails open when both sides are unmapped', () => {
    expect(unmappedCrossesKnownBank(null, null)).toBe(false)
    expect(unmappedCrossesKnownBank('', '')).toBe(false)
  })

  it('does not invent a crossing when both sides are mapped', () => {
    expect(unmappedCrossesKnownBank('bend-awbrey-butte', 'bend-larkspur')).toBe(false)
  })
})
