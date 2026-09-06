import { describe, expect, it } from 'vitest'
import { buildMosSupplyChart } from './mos-chart'

describe('buildMosSupplyChart', () => {
  it('draws two named rows from leftover active and the rearranged monthly pace', () => {
    const chart = buildMosSupplyChart({
      homesForSale: 1200,
      monthOfSales: 307.7,
      mosText: '3.9',
    })
    expect(chart).toBeDefined()
    expect(chart?.kind).toBe('range')
    expect(chart?.caption).toBe('Homes for sale vs a month of sales')
    expect(chart?.claim).toBe(
      '1,200 homes for sale vs 307.7 sales a month. 3.9 months of homes on the market.',
    )
    const rows = chart?.rows ?? []
    expect(rows).toHaveLength(2)
    expect(rows.map((r) => String(r.tick))).toEqual(['Homes for sale', 'A month of sales'])
    expect(rows.map((r) => r.value)).toEqual([1200, 307.7])
  })

  it('omits the chart when a count is missing, never a fabricated bar', () => {
    expect(buildMosSupplyChart({ homesForSale: 0, monthOfSales: 10, mosText: '3.9' })).toBeUndefined()
    expect(buildMosSupplyChart({ homesForSale: 10, monthOfSales: 0, mosText: '3.9' })).toBeUndefined()
    expect(buildMosSupplyChart({ homesForSale: 10, monthOfSales: 2, mosText: '' })).toBeUndefined()
  })
})
