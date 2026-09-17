import { describe, expect, it } from 'vitest'
import { isVerifiedRegistryChild } from './registry'

describe('isVerifiedRegistryChild', () => {
  it('is true only for a named registry child, not a sibling resort', () => {
    expect(
      isVerifiedRegistryChild(
        { slug: 'widgi-creek', label: 'Widgi Creek' },
        { slug: 'elkai-woods', label: 'Elkai Woods' },
      ),
    ).toBe(true)
    expect(
      isVerifiedRegistryChild(
        { slug: 'vandevert-ranch', label: 'Vandevert Ranch' },
        { slug: 'caldera-springs', label: 'Caldera Springs' },
      ),
    ).toBe(false)
    expect(
      isVerifiedRegistryChild(
        { slug: 'awbrey-butte', label: 'Awbrey Butte' },
        { slug: 'awbrey-glen', label: 'Awbrey Glen' },
      ),
    ).toBe(false)
  })
})
