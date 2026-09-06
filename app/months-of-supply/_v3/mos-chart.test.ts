import { describe, expect, it } from 'vitest'
import { buildMosSupplyChart } from './mos-chart'

describe('buildMosSupplyChart', () => {
  it('draws two bars from leftover active and the rearranged monthly pace', () => {
    const chart = buildMosSupplyChart({
      homesForSale: 1200,
      monthOfSales: 307.7,
      mosText: '3.9',
    })
    expect(chart).toBeDefined()
    expect(chart?.kind).toBe('bars')
    expect(chart?.caption).toBe('Homes for sale vs a month of sales')
    expect(chart?.claim).toBe(
      '1,200 homes for sale vs 307.7 sales a month. 3.9 months of homes on the market.',
    )
    const points = chart?.series?.[0]?.points ?? []
    expect(points).toHaveLength(2)
    expect(points.map((p) => String(p.tick))).toEqual(['Homes for sale', 'A month of sales'])
    expect(points.map((p) => p.value)).toEqual([1200, 307.7])
    expect(chart?.series).toHaveLength(1)
  })

  it('omits the chart when a count is missing, never a fabricated bar', () => {
    expect(buildMosSupplyChart({ homesForSale: 0, monthOfSales: 10, mosText: '3.9' })).toBeUndefined()
    expect(buildMosSupplyChart({ homesForSale: 10, monthOfSales: 0, mosText: '3.9' })).toBeUndefined()
    expect(buildMosSupplyChart({ homesForSale: 10, monthOfSales: 2, mosText: '' })).toBeUndefined()
  })
})
