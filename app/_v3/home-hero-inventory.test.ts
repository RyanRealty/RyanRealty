import { describe, expect, it } from 'vitest'
import { homeHeroInventory, homeHeroLive } from './home-hero-inventory'

describe('homeHeroInventory', () => {
  it('publishes at least two live counts with doors', () => {
    const strip = homeHeroInventory(
      { forSale: 3281, pending: 912, sold: 464 },
      'Sep 9, 2026, 8:00 AM',
    )
    expect(strip?.figures).toHaveLength(3)
    expect(strip?.figures[0]?.value).toBe('3,281')
    expect(strip?.figures[0]?.label).toBe('you can tour today')
    expect(strip?.figures[0]?.href).toBeTruthy()
    expect(strip?.source.length).toBeGreaterThan(10)
  })

  it('withholds the strip when fewer than two figures survive', () => {
    expect(homeHeroInventory({ forSale: 10, pending: 0, sold: 0 })).toBeUndefined()
    expect(homeHeroInventory(null)).toBeUndefined()
  })
})

describe('homeHeroLive', () => {
  it('exposes the for-sale count for V3Number', () => {
    expect(homeHeroLive({ forSale: 3281, pending: 1, sold: 1 })).toEqual({
      forSale: 3281,
      forSaleLabel: '3,281',
    })
    expect(homeHeroLive({ forSale: 0, pending: 1, sold: 1 })).toBeUndefined()
  })
})
