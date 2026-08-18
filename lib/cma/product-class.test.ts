import { describe, expect, it } from 'vitest'
import { matchesProductClass, similarProductClass, widenProductClass } from '@/lib/cma/product-class'

describe('product class', () => {
  it('keeps a 3-bed 1-bath in 1-bath stock, not 2-to-4 bedroom', () => {
    const cls = similarProductClass(3, 1)
    expect(cls).toEqual({
      bedsLo: 3,
      bedsHi: 3,
      bathsLo: 1,
      bathsHi: 1.5,
      label: '3-bedroom, 1-bath',
      tight: true,
    })
    expect(matchesProductClass(cls!, 3, 1)).toBe(true)
    expect(matchesProductClass(cls!, 3, 1.5)).toBe(true)
    expect(matchesProductClass(cls!, 3, 2)).toBe(false)
    expect(matchesProductClass(cls!, 4, 2)).toBe(false)
    expect(matchesProductClass(cls!, 2, 1)).toBe(false)
  })

  it('widens beds only and keeps the bath limiter', () => {
    const wide = widenProductClass(similarProductClass(3, 1)!)
    expect(wide.bedsLo).toBe(2)
    expect(wide.bedsHi).toBe(4)
    expect(wide.bathsLo).toBe(1)
    expect(wide.bathsHi).toBe(1.5)
    expect(wide.label).toBe('2 to 4 bedroom, 1-bath')
    expect(matchesProductClass(wide, 2, 1)).toBe(true)
    expect(matchesProductClass(wide, 4, 1)).toBe(true)
    expect(matchesProductClass(wide, 4, 2)).toBe(false)
  })
})
