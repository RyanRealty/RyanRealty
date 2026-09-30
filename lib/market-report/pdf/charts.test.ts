import { describe, expect, it } from 'vitest'
import { fmtUnit, spreadLabels } from './charts'

describe('spreadLabels', () => {
  it('leaves labels that are already apart where they are', () => {
    expect(spreadLabels([10, 50, 90], 8)).toEqual([10, 50, 90])
  })

  it('pushes labels that crowd apart, keeping their order', () => {
    const out = spreadLabels([40, 42, 41], 8)
    const sorted = [...out].sort((a, b) => a - b)
    for (let i = 1; i < sorted.length; i++) expect(sorted[i]! - sorted[i - 1]!).toBeGreaterThanOrEqual(8 - 1e-9)
    expect(out[0]).toBeLessThan(out[2]!)
    expect(out[2]).toBeLessThan(out[1]!)
  })

  it('stays inside the plot when labels crowd the bottom', () => {
    const out = spreadLabels([97, 98, 99], 8)
    expect(Math.max(...out)).toBeLessThanOrEqual(100)
    expect(Math.min(...out)).toBeGreaterThanOrEqual(0)
  })
})

describe('fmtUnit percent', () => {
  it('prints whole percents by default and decimals when asked', () => {
    expect(fmtUnit(0.995, 'percent')).toBe('100%')
    expect(fmtUnit(0.995, 'percent', true, 1)).toBe('99.5%')
  })
})
