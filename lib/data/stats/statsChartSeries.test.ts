import { describe, expect, it } from 'vitest'
import { annualAverages, spreadNorm } from './statsChartSeries'
import type { StatPoint, StatSpreadPoint } from './statsReads'

function point(observationDate: string, value: number): StatPoint {
  return { observationDate, value, realtimeStart: observationDate }
}

function spread(observationDate: string, s: number): StatSpreadPoint {
  return {
    observationDate,
    anchorValue: s + 4,
    otherValue: 4,
    otherObservationDate: observationDate,
    spread: s,
  }
}

describe('spreadNorm', () => {
  it('is the mean over every pair with the covered window', () => {
    const norm = spreadNorm([spread('1971-04-02', 1.5), spread('1971-04-09', 2.5)])
    expect(norm).not.toBeNull()
    expect(norm!.mean).toBeCloseTo(2.0)
    expect(norm!.from).toBe('1971-04-02')
    expect(norm!.to).toBe('1971-04-09')
    expect(norm!.n).toBe(2)
  })

  it('is null with no pairs — a norm over nothing is not published', () => {
    expect(spreadNorm([])).toBeNull()
  })
})

describe('annualAverages', () => {
  const year = (y: number, monthly: number[]) =>
    monthly.map((v, i) => point(`${y}-${String(i + 1).padStart(2, '0')}-01`, v))

  it('averages complete calendar years', () => {
    const points = [...year(1998, Array(12).fill(90)), ...year(1999, Array(12).fill(96))]
    const out = annualAverages(points)
    expect(out.get(1998)).toBeCloseTo(90)
    expect(out.get(1999)).toBeCloseTo(96)
  })

  it('refuses a partial year — its average is not that year\'s average', () => {
    const points = [...year(2025, Array(12).fill(100)), ...year(2026, Array(5).fill(110)).slice(0, 5)]
    const out = annualAverages(points)
    expect(out.has(2025)).toBe(true)
    expect(out.has(2026)).toBe(false)
  })
})
