import { describe, expect, it } from 'vitest'
import { buildNeighborhoodSupplyPages } from './neighborhood-mos-insight'

describe('buildNeighborhoodSupplyPages', () => {
  it('builds year sold pages plus the live supply face', () => {
    const pages = buildNeighborhoodSupplyPages({
      months: [
        { periodStart: '2023-01-01', soldCount: 10 },
        { periodStart: '2023-06-01', soldCount: 12 },
        { periodStart: '2024-03-01', soldCount: 20 },
        { periodStart: '2025-02-01', soldCount: 8 },
        { periodStart: '2025-08-01', soldCount: 9 },
      ],
      homesForSale: 48,
      monthOfSales: 10.3,
      mosText: '4.7',
    })
    expect(pages).toEqual([
      '2023 · 22 sold',
      '2024 · 20 sold',
      '2025 · 17 sold',
      'Now · 48 for sale / 10.3 a month (4.7 mo)',
    ])
  })

  it('omits empty years and still returns Now when months are thin', () => {
    const pages = buildNeighborhoodSupplyPages({
      months: [{ periodStart: '2025-01-01', soldCount: null }],
      homesForSale: 12,
      monthOfSales: 3,
      mosText: '4.0',
    })
    expect(pages).toEqual(['Now · 12 for sale / 3 a month (4.0 mo)'])
  })
})
