import { describe, it, expect } from 'vitest'
import { monthsOfSupply, marketVerdict, MOS_METHODOLOGY_CLAUSE } from './classify'

describe('monthsOfSupply (canonical §0 formula)', () => {
  it('computes active / (closed6mo / 6)', () => {
    // 120 active, 60 closed in 6mo -> avg 10/mo -> 12 months supply
    expect(monthsOfSupply(120, 60)).toBe(12)
    // 40 active, 60 closed in 6mo -> avg 10/mo -> 4.0
    expect(monthsOfSupply(40, 60)).toBe(4)
  })
  it('returns null on zero/negative closings or non-finite inputs', () => {
    expect(monthsOfSupply(50, 0)).toBeNull()
    expect(monthsOfSupply(50, -5)).toBeNull()
    expect(monthsOfSupply(NaN, 60)).toBeNull()
  })
})

describe('marketVerdict (single source of <=4 / <6 / >=6)', () => {
  it('classifies by months of supply', () => {
    expect(marketVerdict(3).kind).toBe('sellers')
    expect(marketVerdict(4).kind).toBe('sellers') // boundary: 4 is seller's
    expect(marketVerdict(5).kind).toBe('balanced')
    expect(marketVerdict(6).kind).toBe('buyers') // boundary: 6 is buyer's
    expect(marketVerdict(9).kind).toBe('buyers')
  })
  it('returns labels and handles unknown', () => {
    expect(marketVerdict(3).label).toBe("seller's market")
    expect(marketVerdict(5).label).toBe('balanced market')
    expect(marketVerdict(7).label).toBe("buyer's market")
    expect(marketVerdict(null).kind).toBe('unknown')
    expect(marketVerdict(undefined).kind).toBe('unknown')
  })
})

describe('MOS_METHODOLOGY_CLAUSE (no false "times 2" / "30 days")', () => {
  it('describes the canonical 6-month formula', () => {
    expect(MOS_METHODOLOGY_CLAUSE).toContain('last 6 months')
    expect(MOS_METHODOLOGY_CLAUSE).not.toMatch(/30 days|times 2/i)
  })
})
