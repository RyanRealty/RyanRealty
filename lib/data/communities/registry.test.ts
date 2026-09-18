import { describe, expect, it } from 'vitest'
import { getResortCommunityBySubdivisionName, isVerifiedRegistryChild } from './registry'

describe('getResortCommunityBySubdivisionName', () => {
  it('resolves Golf Homes At Tetherow to Tetherow without inventing an alias', () => {
    expect(getResortCommunityBySubdivisionName('Golf Homes At Tetherow')?.slug).toBe('tetherow')
    expect(getResortCommunityBySubdivisionName('golf-homes-at-tetherow')?.slug).toBe('tetherow')
    expect(getResortCommunityBySubdivisionName('Tetherow')?.slug).toBe('tetherow')
  })
})

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
