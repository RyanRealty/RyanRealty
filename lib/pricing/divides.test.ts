import { describe, expect, it } from 'vitest'
import { crossesMajorDivide } from '@/lib/pricing/divides'

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
