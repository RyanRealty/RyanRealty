import { describe, expect, it } from 'vitest'
import {
  lookupRegistryResortFigures,
  publishResortIndexFigures,
  registryResortOverlayKeys,
} from './publish-resort-index-figures'

describe('publishResortIndexFigures', () => {
  it('publishes the alias-aware count and median together', () => {
    expect(publishResortIndexFigures({ aliasAwareCount: 35, aliasAwareMedian: 1_499_000 })).toEqual({
      activeCount: 35,
      medianListPrice: 1_499_000,
    })
  })

  it('withholds the median when the alias-aware count is 0', () => {
    expect(publishResortIndexFigures({ aliasAwareCount: 0, aliasAwareMedian: 2_250_000 })).toEqual({
      activeCount: 0,
      medianListPrice: null,
    })
  })

  it('withholds both when the alias-aware count is missing', () => {
    expect(publishResortIndexFigures({ aliasAwareCount: null, aliasAwareMedian: 1_499_000 })).toEqual({
      activeCount: null,
      medianListPrice: null,
    })
  })
})

describe('lookupRegistryResortFigures', () => {
  const overlay = new Map([
    ['eagle-crest', { activeCount: 73, medianListPrice: 549_000 }],
    ['redmond-eagle-crest', { activeCount: 73, medianListPrice: 549_000 }],
  ])

  it('resolves the A-Z -resort slug (Eagle Crest founding)', () => {
    expect(
      lookupRegistryResortFigures(overlay, {
        slug: 'redmond-eagle-crest-resort',
        citySlug: 'redmond',
        name: 'Eagle Crest Resort',
        entityKey: 'redmond:eagle-crest-resort',
      }),
    ).toEqual({ activeCount: 73, medianListPrice: 549_000 })
  })

  it('stamps -resort overlay keys', () => {
    expect(registryResortOverlayKeys({ slug: 'eagle-crest', citySlug: 'redmond', label: 'Eagle Crest' })).toEqual(
      expect.arrayContaining(['eagle-crest', 'redmond-eagle-crest', 'redmond-eagle-crest-resort']),
    )
  })
})
