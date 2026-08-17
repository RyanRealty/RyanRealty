import { describe, expect, it } from 'vitest'
import { publishResortIndexFigures } from './publish-resort-index-figures'

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
