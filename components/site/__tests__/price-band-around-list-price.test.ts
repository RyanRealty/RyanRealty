import { describe, expect, it } from 'vitest'
import { priceBandAroundListPrice } from '@/lib/search/price-band'

describe('priceBandAroundListPrice', () => {
  it('returns empty for missing price', () => {
    expect(priceBandAroundListPrice(null)).toEqual({})
    expect(priceBandAroundListPrice(0)).toEqual({})
  })

  it('bands around a typical list price', () => {
    const band = priceBandAroundListPrice(600_000)
    expect(band.minPrice).toBeDefined()
    expect(band.maxPrice).toBeDefined()
    const min = Number(band.minPrice)
    const max = Number(band.maxPrice)
    expect(min).toBeLessThan(600_000)
    expect(max).toBeGreaterThan(600_000)
    expect(min % 25_000).toBe(0)
    expect(max % 25_000).toBe(0)
  })
})
