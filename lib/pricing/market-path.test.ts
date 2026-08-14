import { describe, expect, it } from 'vitest'
import { marketPath, ppsfAt, timeAdjustAlongPath } from '@/lib/pricing/market-path'

function pts(
  rows: Array<{ month: string; ppsf: number; n?: number }>,
) {
  return rows.map((r) => ({ month: r.month, ppsf: r.ppsf, n: r.n ?? 20 }))
}

describe('marketPath — the actual month-to-month move, not a smeared YoY', () => {
  it('compounds +3% a month for four months', () => {
    const points = pts([
      { month: '2021-01-01', ppsf: 300 },
      { month: '2021-02-01', ppsf: 309 },
      { month: '2021-03-01', ppsf: 318.27 },
      { month: '2021-04-01', ppsf: 327.82 },
      { month: '2021-05-01', ppsf: 337.65 },
    ])
    const path = marketPath({ points, fromDate: '2021-01-15', toDate: '2021-05-15' })
    expect(path.regime).toBe('rising')
    expect(path.factor).toBeGreaterThan(1.11)
    expect(path.factor).toBeLessThan(1.14)
    expect(path.monthlyRate).toBeGreaterThan(0.025)
    expect(timeAdjustAlongPath(500_000, path)).toBeGreaterThan(555_000)
  })

  it('stays at 1.00 when the market is flat', () => {
    const points = pts([
      { month: '2023-01-01', ppsf: 350 },
      { month: '2023-04-01', ppsf: 350 },
      { month: '2023-07-01', ppsf: 351 },
      { month: '2023-10-01', ppsf: 349 },
    ])
    const path = marketPath({ points, fromDate: '2023-01-10', toDate: '2023-10-10' })
    expect(path.regime).toBe('flat')
    expect(path.factor).toBeGreaterThan(0.99)
    expect(path.factor).toBeLessThan(1.01)
    expect(timeAdjustAlongPath(600_000, path)).toBeGreaterThan(590_000)
    expect(timeAdjustAlongPath(600_000, path)).toBeLessThan(610_000)
  })

  it('follows a drop then a stall instead of averaging them into a mild decline', () => {
    const points = pts([
      { month: '2022-06-01', ppsf: 400 },
      { month: '2022-09-01', ppsf: 360 },
      { month: '2022-12-01', ppsf: 358 },
    ])
    const path = marketPath({ points, fromDate: '2022-06-15', toDate: '2022-12-15' })
    expect(path.regime).toBe('falling')
    expect(path.factor).toBeCloseTo(358 / 400, 2)
    expect(timeAdjustAlongPath(800_000, path)).toBe(Math.round(800_000 * path.factor))
  })

  it('ignores a thin month so eight sales cannot rewrite the path', () => {
    const points = pts([
      { month: '2024-01-01', ppsf: 300, n: 40 },
      { month: '2024-02-01', ppsf: 900, n: 3 },
      { month: '2024-03-01', ppsf: 303, n: 40 },
    ])
    expect(ppsfAt(points, '2024-02-15')).toBeGreaterThan(300)
    expect(ppsfAt(points, '2024-02-15')).toBeLessThan(310)
  })

  it('returns factor 1 when there is no index', () => {
    const path = marketPath({ points: [], fromDate: '2020-01-01', toDate: '2020-06-01' })
    expect(path.factor).toBe(1)
    expect(path.source).toBe('none')
    expect(timeAdjustAlongPath(400_000, path)).toBe(400_000)
  })

  it('caps a 40% spike at 25%', () => {
    const points = pts([
      { month: '2021-01-01', ppsf: 200 },
      { month: '2021-07-01', ppsf: 300 },
    ])
    const path = marketPath({ points, fromDate: '2021-01-01', toDate: '2021-07-01' })
    expect(path.factor).toBe(1.25)
    expect(path.capped).toBe(true)
  })
})
