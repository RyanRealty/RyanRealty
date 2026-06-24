import { describe, it, expect } from 'vitest'
import { computeCommissionNets } from './commission-math'

const base = { referralFee: 0, tcFee: 0, otherDeductions: 0, splitPercent: 100 }

describe('computeCommissionNets (H4 — the money path)', () => {
  it('returns null nets until the GCI is known', () => {
    expect(computeCommissionNets({ ...base, gci: null })).toEqual({
      net: null,
      agentNet: null,
      brokerageNet: null,
    })
  })

  it('100% split, no fees: agent takes the whole GCI', () => {
    expect(computeCommissionNets({ ...base, gci: 10000, splitPercent: 100 })).toEqual({
      net: 10000,
      agentNet: 10000,
      brokerageNet: 0,
    })
  })

  it('splits the post-fee net by the agent percentage', () => {
    expect(computeCommissionNets({ ...base, gci: 10000, splitPercent: 80 })).toEqual({
      net: 10000,
      agentNet: 8000,
      brokerageNet: 2000,
    })
  })

  it('subtracts referral + tc + other deductions before splitting', () => {
    const r = computeCommissionNets({
      gci: 10000,
      referralFee: 1000,
      tcFee: 500,
      otherDeductions: 0,
      splitPercent: 70,
    })
    expect(r.net).toBe(8500)
    expect(r.agentNet).toBe(5950) // 8500 * 0.70
    expect(r.brokerageNet).toBe(2550) // 8500 - 5950
  })

  it('rounds to cents and never leaks a penny (agentNet + brokerageNet === net)', () => {
    const cases = [
      { gci: 10000, splitPercent: 33.33 },
      { gci: 9875.5, splitPercent: 62.5 },
      { gci: 100, splitPercent: 33.333 },
      { gci: 12345.67, referralFee: 250, splitPercent: 71.5 },
    ]
    for (const c of cases) {
      const r = computeCommissionNets({ ...base, ...c })
      expect(r.agentNet! + r.brokerageNet!).toBeCloseTo(r.net!, 2)
      // both are 2-decimal money values
      expect(Math.round(r.agentNet! * 100)).toBe(r.agentNet! * 100)
      expect(Math.round(r.brokerageNet! * 100)).toBe(r.brokerageNet! * 100)
    }
  })

  it('handles a zero GCI (deal fell through) without NaN', () => {
    expect(computeCommissionNets({ ...base, gci: 0, splitPercent: 80 })).toEqual({
      net: 0,
      agentNet: 0,
      brokerageNet: 0,
    })
  })

  it('deductions can exceed the split base (negative net flows through, not clamped)', () => {
    // gci 1000, fees 1200 -> net -200; the math is honest about a loss.
    const r = computeCommissionNets({ gci: 1000, referralFee: 1200, tcFee: 0, otherDeductions: 0, splitPercent: 100 })
    expect(r.net).toBe(-200)
    expect(r.agentNet).toBe(-200)
    expect(r.brokerageNet).toBe(0)
  })
})
