import { describe, it, expect } from 'vitest'
import { classifyMarketCondition } from './market-condition'

describe('classifyMarketCondition', () => {
  it('classifies as sellers market when inventory < 3, DOM < 30, list-to-sold > 0.98', () => {
    const result = classifyMarketCondition({
      monthsOfInventory: 2,
      avgDom: 15,
      listToSoldRatio: 0.99,
    })
    expect(result.condition).toBe('sellers')
    expect(result.label).toBe("Seller's Market")
    expect(result.metrics.monthsOfInventory).toBe(2)
    expect(result.metrics.avgDom).toBe(15)
    expect(result.metrics.listToSoldRatio).toBe(0.99)
  })

  it('classifies as buyers market when inventory > 6, DOM > 60, list-to-sold < 0.95', () => {
    const result = classifyMarketCondition({
      monthsOfInventory: 8,
      avgDom: 90,
      listToSoldRatio: 0.90,
    })
    expect(result.condition).toBe('buyers')
    expect(result.label).toBe("Buyer's Market")
  })

  it('classifies as balanced when metrics are in middle range', () => {
    const result = classifyMarketCondition({
      monthsOfInventory: 4,
      avgDom: 45,
      listToSoldRatio: 0.97,
    })
    expect(result.condition).toBe('balanced')
    expect(result.label).toBe('Balanced Market')
  })

  it('classifies as balanced when all metrics are null', () => {
    const result = classifyMarketCondition({
      monthsOfInventory: null,
      avgDom: null,
      listToSoldRatio: null,
    })
    expect(result.condition).toBe('balanced')
  })

  it('classifies as balanced when metrics are undefined', () => {
    const result = classifyMarketCondition({})
    expect(result.condition).toBe('balanced')
  })

  it('classifies as balanced when only some metrics meet sellers criteria', () => {
    // inventory is sellers-like but DOM is not
    const result = classifyMarketCondition({
      monthsOfInventory: 1,
      avgDom: 45, // not < 30
      listToSoldRatio: 0.99,
    })
    expect(result.condition).toBe('balanced')
  })

  it('classifies as balanced when only some metrics meet buyers criteria', () => {
    // inventory is buyers-like but DOM is not
    const result = classifyMarketCondition({
      monthsOfInventory: 10,
      avgDom: 30, // not > 60
      listToSoldRatio: 0.90,
    })
    expect(result.condition).toBe('balanced')
  })

  it('returns the metrics in the result', () => {
    const result = classifyMarketCondition({
      monthsOfInventory: 5,
      avgDom: 40,
      listToSoldRatio: 0.96,
    })
    expect(result.metrics).toEqual({
      monthsOfInventory: 5,
      avgDom: 40,
      listToSoldRatio: 0.96,
    })
  })
})
