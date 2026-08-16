import { describe, expect, it } from 'vitest'
import { publishPlatFigures } from './publish-plat-figures'

describe('publishPlatFigures', () => {
  it('publishes the plat inventory median and withholds parent-pulse days and sold', () => {
    expect(publishPlatFigures({ platMedianListPrice: 910_000 })).toEqual({
      medianListPrice: 910_000,
      medianDaysToPending: null,
      soldCount30d: null,
    })
  })

  it('does not pass through a city or community pending figure', () => {
    const published = publishPlatFigures({ platMedianListPrice: 910_000 })
    expect(published.medianDaysToPending).toBeNull()
    expect(published.soldCount30d).toBeNull()
    expect(published.medianListPrice).not.toBe(535_000)
  })

  it('withholds a missing or non-positive plat median', () => {
    expect(publishPlatFigures({ platMedianListPrice: null }).medianListPrice).toBeNull()
    expect(publishPlatFigures({ platMedianListPrice: 0 }).medianListPrice).toBeNull()
    expect(publishPlatFigures({ platMedianListPrice: Number.NaN }).medianListPrice).toBeNull()
  })
})
