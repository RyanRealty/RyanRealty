import { describe, expect, it } from 'vitest'
import { EMPTY_PUBLIC_PACE } from '@/lib/data/market-truth/public-pace'
import { leftoverHudKpis } from './publish-leftover-hud'
import { geoMarketLeftoverGrain, geoMarketPublishes } from './geo-market-publishes'

describe('geoMarketLeftoverGrain', () => {
  it('matches the market catch-all: city and neighborhood only', () => {
    expect(geoMarketLeftoverGrain('city')).toBe('city')
    expect(geoMarketLeftoverGrain('neighborhood')).toBe('neighborhood')
    expect(geoMarketLeftoverGrain('subdivision')).toBeNull()
  })
})

describe('geoMarketPublishes', () => {
  it('is false for a subdivision-shaped miss (empty HUD, no leftover monthly)', () => {
    const hud = leftoverHudKpis({
      grain: 'neighborhood',
      headlines: null,
      inventory: null,
      pace: EMPTY_PUBLIC_PACE,
    })
    expect(geoMarketPublishes(hud, [])).toBe(false)
  })

  it('is true when leftover HUD has a visitor cell', () => {
    const hud = leftoverHudKpis({
      grain: 'neighborhood',
      headlines: { activeCount: 12, monthsOfSupply: 3.2, medianListPrice: 1100000 },
      inventory: { activeCount: 12, medianListPrice: 1100000 },
      pace: EMPTY_PUBLIC_PACE,
    })
    expect(geoMarketPublishes(hud, [])).toBe(true)
  })
})
