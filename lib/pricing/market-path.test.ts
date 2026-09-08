import { describe, expect, it } from 'vitest'
import {
  checkDateAdjustments,
  indexLevels,
  indexLevelAt,
  marketIndexTrend,
  marketPath,
  ppsfAt,
  referenceLevel,
  timeAdjustAlongPath,
} from '@/lib/pricing/market-path'

function pts(
  rows: Array<{ month: string; ppsf: number; n?: number }>,
) {
  return rows.map((r) => ({ month: r.month, ppsf: r.ppsf, n: r.n ?? 20 }))
}

/**
 * The real `pricing_market_index` rows for Redmond, pulled 2026-09-08 with
 * `getPricingMarketIndex('redmond')`. This is the series the round-two
 * document at `cma-2465-7th-redmond-97756` was built on, and September's ten
 * sales at $294.44 are the partial month that produced the defect.
 */
const REDMOND = pts([
  { month: '2025-06-01', ppsf: 312.16, n: 81 },
  { month: '2025-07-01', ppsf: 300.15, n: 87 },
  { month: '2025-08-01', ppsf: 309.57, n: 100 },
  { month: '2025-09-01', ppsf: 310.75, n: 98 },
  { month: '2025-10-01', ppsf: 314.71, n: 81 },
  { month: '2025-11-01', ppsf: 320.66, n: 62 },
  { month: '2025-12-01', ppsf: 321.94, n: 77 },
  { month: '2026-01-01', ppsf: 316.99, n: 40 },
  { month: '2026-02-01', ppsf: 324.63, n: 57 },
  { month: '2026-03-01', ppsf: 320.4, n: 60 },
  { month: '2026-04-01', ppsf: 332.63, n: 51 },
  { month: '2026-05-01', ppsf: 327.59, n: 75 },
  { month: '2026-06-01', ppsf: 314.63, n: 99 },
  { month: '2026-07-01', ppsf: 322.08, n: 76 },
  { month: '2026-08-01', ppsf: 325.7, n: 78 },
  { month: '2026-09-01', ppsf: 294.44, n: 10 },
])

/** The five sales the round-two price grid printed, with their close prices. */
const REDMOND_SALES = [
  { label: '730 Quince', closeDate: '2026-07-06', closePrice: 457_000 },
  { label: '840 Quince', closeDate: '2026-04-24', closePrice: 410_000 },
  { label: '1737 7th', closeDate: '2026-04-24', closePrice: 460_000 },
  { label: '2485 7th', closeDate: '2026-02-06', closePrice: 410_500 },
  { label: '735 Oak', closeDate: '2025-12-15', closePrice: 450_000 },
]

const AS_OF = '2026-09-07'

describe('the index endpoint is never a partial month', () => {
  it('reads today as the median of the last three COMPLETE months', () => {
    const ref = referenceLevel(REDMOND, AS_OF)
    expect(ref?.months).toEqual(['2026-06-01', '2026-07-01', '2026-08-01'])
    // median(314.63, 322.08, 325.70)
    expect(ref?.ppsf).toBe(322.08)
  })

  it('leaves September 2026 and its ten sales out of every path', () => {
    for (const sale of REDMOND_SALES) {
      const path = marketPath({ points: REDMOND, fromDate: sale.closeDate, toDate: AS_OF })
      expect(path.toPpsf).toBe(322.08)
      expect(path.referenceMonths).not.toContain('2026-09-01')
    }
  })

  it('moves a two-month-old sale by what the index did in those two months', () => {
    // 730 Quince closed 2026-07-06. The round-two document moved it -8.58%
    // against the ten-sale September figure; the index between July and the
    // last three complete months did not move at all.
    const path = marketPath({ points: REDMOND, fromDate: '2026-07-06', toDate: AS_OF })
    expect(path.fromPpsf).toBe(322.08)
    expect(path.factor).toBe(1)
    expect(timeAdjustAlongPath(457_000, path)).toBe(457_000)
  })

  it('never moves a sale further than the whole year moved, on this index', () => {
    const year = marketIndexTrend({ points: REDMOND, asOf: AS_OF, windowMonths: 12 })
    expect(year.pctOverWindow).toBe(3.6)
    for (const sale of REDMOND_SALES) {
      const path = marketPath({ points: REDMOND, fromDate: sale.closeDate, toDate: AS_OF })
      expect(Math.abs((path.factor - 1) * 100)).toBeLessThan(Math.abs(year.pctOverWindow!) + 0.1)
    }
  })
})

describe('every month reads as a median of three', () => {
  it('leaves a monotone run exactly where it was', () => {
    const rising = pts([
      { month: '2024-01-01', ppsf: 300 },
      { month: '2024-02-01', ppsf: 310 },
      { month: '2024-03-01', ppsf: 320 },
      { month: '2024-04-01', ppsf: 330 },
      { month: '2024-05-01', ppsf: 340 },
    ])
    expect(indexLevels(rising).map((p) => p.ppsf)).toEqual([310, 310, 320, 330, 330])
  })

  it('will not let one month flip the direction of the level', () => {
    const spike = pts([
      { month: '2024-01-01', ppsf: 300 },
      { month: '2024-02-01', ppsf: 305 },
      { month: '2024-03-01', ppsf: 200 },
      { month: '2024-04-01', ppsf: 310 },
      { month: '2024-05-01', ppsf: 315 },
    ])
    // March's 200 is a month, not a market. The level at March stays with its
    // neighbours; the raw series would have said the city lost a third.
    expect(indexLevelAt(spike, '2024-03-15', '2024-06-01')).toBe(305)
    expect(indexLevelAt(spike, '2024-04-15', '2024-06-01')).toBe(310)
  })
})

describe('marketPath — the actual month-to-month move, not a smeared YoY', () => {
  it('follows a compounding run rather than averaging it flat', () => {
    const points = pts(
      ['2020-11-01', '2020-12-01', '2021-01-01', '2021-02-01', '2021-03-01', '2021-04-01', '2021-05-01', '2021-06-01'].map(
        (month, i) => ({ month, ppsf: +(300 * 1.03 ** i).toFixed(2) }),
      ),
    )
    const path = marketPath({ points, fromDate: '2021-01-15', toDate: '2021-05-15' })
    expect(path.regime).toBe('rising')
    // Jan level 318.27, endpoint the median of Feb/Mar/Apr = 337.65.
    expect(path.fromPpsf).toBe(318.27)
    expect(path.toPpsf).toBe(337.65)
    expect(path.factor).toBeGreaterThan(1.05)
    expect(path.monthlyRate).toBeGreaterThan(0.014)
    expect(timeAdjustAlongPath(500_000, path)).toBeGreaterThan(525_000)
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
      { month: '2022-04-01', ppsf: 400 },
      { month: '2022-05-01', ppsf: 400 },
      { month: '2022-06-01', ppsf: 400 },
      { month: '2022-07-01', ppsf: 380 },
      { month: '2022-08-01', ppsf: 365 },
      { month: '2022-09-01', ppsf: 360 },
      { month: '2022-10-01', ppsf: 359 },
      { month: '2022-11-01', ppsf: 358 },
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

  it('caps a 50% run at 25%', () => {
    const points = pts([
      { month: '2021-01-01', ppsf: 200 },
      { month: '2021-02-01', ppsf: 200 },
      { month: '2021-03-01', ppsf: 200 },
      { month: '2021-04-01', ppsf: 300 },
      { month: '2021-05-01', ppsf: 300 },
      { month: '2021-06-01', ppsf: 300 },
    ])
    const path = marketPath({ points, fromDate: '2021-01-01', toDate: '2021-07-01' })
    expect(path.factor).toBe(1.25)
    expect(path.capped).toBe(true)
  })
})

describe('checkDateAdjustments — the guard on the printed column', () => {
  const along = (sale: { label: string; closeDate: string; closePrice: number }) => {
    const path = marketPath({ points: REDMOND, fromDate: sale.closeDate, toDate: AS_OF })
    return { ...sale, timeAdjustment: timeAdjustAlongPath(sale.closePrice, path) - sale.closePrice }
  }

  it('passes the five sales the engine now produces for 2465 7th', () => {
    const out = checkDateAdjustments({
      points: REDMOND,
      asOf: AS_OF,
      sales: REDMOND_SALES.map(along),
    })
    expect(out.failures).toEqual([])
    expect(out.ok).toBe(true)
    expect(out.rows.map((r) => r.printedPct)).toEqual([0, -1.68, -1.68, 0.52, 0.44])
  })

  it('catches the round-two column: bigger than the move over its own span', () => {
    // The numbers the document actually printed, against the same index.
    const out = checkDateAdjustments({
      points: REDMOND,
      asOf: AS_OF,
      sales: [
        { label: '730 Quince', closeDate: '2026-07-06', closePrice: 457_000, timeAdjustment: -39_211 },
        { label: '840 Quince', closeDate: '2026-04-24', closePrice: 410_000, timeAdjustment: -47_068 },
        { label: '735 Oak', closeDate: '2025-12-15', closePrice: 450_000, timeAdjustment: -38_430 },
      ],
    })
    expect(out.ok).toBe(false)
    expect(out.failures[0]).toContain('730 Quince')
    expect(out.failures[0]).toContain('-8.58%')
    expect(out.failures).toHaveLength(3)
  })

  it('fails an older sale that moves less than a newer one on a one-way index', () => {
    // Falls every month, so nothing excuses a non-monotone column.
    const falling = pts(
      Array.from({ length: 14 }, (_, i) => ({
        month: `2025-${String(i + 1).padStart(2, '0')}-01`.replace(/2025-(1[3-9])/, (_m, k) => `2026-${String(Number(k) - 12).padStart(2, '0')}`),
        ppsf: +(400 - i * 4).toFixed(2),
      })),
    )
    const out = checkDateAdjustments({
      points: falling,
      asOf: '2026-03-01',
      sales: [
        { label: 'newer', closeDate: '2025-12-10', closePrice: 400_000, timeAdjustment: -12_000 },
        { label: 'older', closeDate: '2025-06-10', closePrice: 400_000, timeAdjustment: -4_000 },
      ],
    })
    expect(out.ok).toBe(false)
    expect(out.failures.join(' ')).toContain('an older sale cannot move less than a newer one')
  })

  it('allows the older sale to move less when the index turned around, and says why', () => {
    const out = checkDateAdjustments({
      points: REDMOND,
      asOf: AS_OF,
      sales: REDMOND_SALES.map(along),
    })
    const feb = out.rows.find((r) => r.label === '2485 7th')!
    expect(feb.reversedWithinSpan).toBe(true)
    expect(feb.reason).toContain('the index turned around between 2026-02')
    expect(feb.ok).toBe(true)
  })
})

describe('marketIndexTrend — the basis a document prints', () => {
  it('reads the move over the window off the same levels every sale walks', () => {
    // Two years at 1% a month, so the month a year back is interior to the
    // series and reads as itself.
    const points = Array.from({ length: 24 }, (_, i) => ({
      month: `${2025 + Math.floor((i + 1) / 12)}-${String(((i + 1) % 12) + 1).padStart(2, '0')}-01`,
      ppsf: +(300 * 1.01 ** i).toFixed(2),
      n: 30,
    }))
    const out = marketIndexTrend({ points, asOf: '2027-01-01', windowMonths: 12 })
    expect(out.months).toBe(12)
    expect(out.n).toBe(360)
    expect(out.referenceMonths).toEqual(['2026-10-01', '2026-11-01', '2026-12-01'])
    expect(out.pctOverWindow).toBe(10.5)
    expect(out.pctPerMonth).toBe(0.8)
    expect(out.capped).toBe(false)
  })

  it('reads Redmond as it stood on 2026-09-07, without the partial month', () => {
    const out = marketIndexTrend({ points: REDMOND, asOf: AS_OF, windowMonths: 12 })
    expect(out.fromPpsf).toBe(310.75)
    expect(out.toPpsf).toBe(322.08)
    expect(out.pctOverWindow).toBe(3.6)
    // 854 sales across the twelve complete months, not the 864 the round-two
    // document printed — the extra ten were September's partial month.
    expect(out.n).toBe(854)
  })

  it('says nothing rather than guessing when no month carries enough sales', () => {
    const thin = [{ month: '2026-01-01', ppsf: 300, n: 2 }]
    const out = marketIndexTrend({ points: thin, asOf: '2026-09-01', windowMonths: 12 })
    expect(out.pctPerMonth).toBeNull()
    expect(out.n).toBe(0)
  })
})

describe('describeIndexShape — the path, not the endpoint', () => {
  it('names the peak month and the direction since, off the smoothed series', async () => {
    const { describeIndexShape } = await import('@/lib/pricing/market-path')
    // Redmond, as of 2026-09-07: the smoothed series runs up to April 2026 and
    // comes back. Round two printed "rose 3.6 percent" and then moved an April
    // sale DOWN, with nothing on the page able to explain it.
    const shape = describeIndexShape({ points: REDMOND, asOf: AS_OF, windowMonths: 12 })
    expect(shape.turned).toBe(true)
    expect(shape.extreme).toBe('peak')
    expect(shape.extremeMonth).toBe('2026-04-01')
    expect(shape.sinceExtremePct).toBeLessThan(0)
    expect(shape.movesDown.length).toBeGreaterThan(0)
    expect(shape.movesUp.length).toBeGreaterThan(0)
    expect(shape.clause).toContain('rose to a peak in April 2026')
    expect(shape.clause).toContain('come back')
  })

  it('a monotone climb names no peak and says so', async () => {
    const { describeIndexShape } = await import('@/lib/pricing/market-path')
    const points = Array.from({ length: 24 }, (_, i) => ({
      month: `${2025 + Math.floor((i + 1) / 12)}-${String(((i + 1) % 12) + 1).padStart(2, '0')}-01`,
      ppsf: +(300 * 1.01 ** i).toFixed(2),
      n: 30,
    }))
    const shape = describeIndexShape({ points, asOf: '2027-01-01', windowMonths: 12 })
    expect(shape.turned).toBe(false)
    expect(shape.extremeMonth).toBeNull()
    expect(shape.clause).toContain('rose 10.5 percent with no reversal')
    // Every month in the window sits below the endpoint, so every sale moves up.
    expect(shape.movesDown).toEqual([])
    expect(shape.clause).toContain('every sale below moves up')
  })

  it('says nothing when the index cannot speak', async () => {
    const { describeIndexShape } = await import('@/lib/pricing/market-path')
    const shape = describeIndexShape({ points: [{ month: '2026-01-01', ppsf: 300, n: 2 }], asOf: '2026-09-01', windowMonths: 12 })
    expect(shape.clause).toBe('')
    expect(shape.turned).toBe(false)
  })
})
