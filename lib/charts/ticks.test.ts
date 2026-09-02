import { describe, expect, it } from 'vitest'
import {
  MONTH_TICKS,
  countTicks,
  dayTicks,
  formatUnit,
  moneyTicks,
  monthTicks,
  niceStep,
  percentTicks,
  seriesClaim,
  spacedTicks,
  windowClaim,
  yearTicks,
  yoyClaim,
  type ClaimSeries,
} from './ticks'

/** A year-overlay series: one line per year, keyed by month number. */
function yearSeries(name: string, values: Record<number, number>, unit = 'money'): ClaimSeries {
  return {
    name,
    points: Object.entries(values).map(([m, value]) => ({
      value,
      at: Number(m),
      tick: MONTH_TICKS[Number(m) - 1],
      label:
        unit === 'money'
          ? `$${Math.round(value / 1000)}K`
          : value.toLocaleString('en-US'),
    })),
  }
}

describe('niceStep', () => {
  it('returns 1, 2, or 5 times a power of ten', () => {
    expect(niceStep(300_000)).toBe(100_000)
    expect(niceStep(30)).toBe(10)
    expect(niceStep(9)).toBe(2)
    expect(niceStep(2)).toBe(0.5)
  })

  it('never returns zero or a negative step for a degenerate span', () => {
    expect(niceStep(0)).toBe(1)
    expect(niceStep(-5)).toBe(1)
    expect(niceStep(Number.NaN)).toBe(1)
  })
})

describe('formatUnit', () => {
  it('writes each unit the way the public site writes it', () => {
    expect(formatUnit(666_000, 'money')).toBe('$666K')
    expect(formatUnit(1_200_000, 'money')).toBe('$1.2M')
    expect(formatUnit(1654, 'count')).toBe('1,654')
    expect(formatUnit(27, 'days')).toBe('27 days')
    expect(formatUnit(1, 'days')).toBe('1 day')
    expect(formatUnit(97, 'percent')).toBe('97%')
    expect(formatUnit(97.64, 'percent')).toBe('97.6%')
  })

  it('returns nothing for a value that cannot be written', () => {
    expect(formatUnit(Number.NaN, 'money')).toBe('')
    expect(formatUnit(Number.POSITIVE_INFINITY, 'count')).toBe('')
  })
})

describe('unit ticks', () => {
  const overlay = [
    yearSeries('2025', { 1: 600_000, 6: 640_000, 12: 700_000 }),
    yearSeries('2026', { 1: 660_000, 6: 690_000, 8: 666_000 }),
  ]

  it('puts every money tick inside the plotted domain', () => {
    const ticks = moneyTicks(overlay)
    expect(ticks.length).toBeGreaterThanOrEqual(2)
    for (const tick of ticks) {
      expect(tick.value).toBeGreaterThanOrEqual(600_000)
      expect(tick.value).toBeLessThanOrEqual(700_000)
    }
    expect(ticks.map((t) => t.label)).toEqual([
      '$600K',
      '$620K',
      '$640K',
      '$660K',
      '$680K',
      '$700K',
    ])
  })

  it('caps at six gridlines', () => {
    const wide = [yearSeries('2026', { 1: 100_000, 12: 100_000_000 })]
    expect(moneyTicks(wide).length).toBeLessThanOrEqual(6)
  })

  it('returns nothing when fewer than min ticks land in range', () => {
    const flat = [
      { name: '2026', points: [{ value: 512_345, tick: 'Jan', at: 1 }, { value: 512_400, tick: 'Feb', at: 2 }] },
    ]
    expect(moneyTicks(flat, 2)).toEqual([])
  })

  it('returns nothing for an empty series set', () => {
    expect(moneyTicks([])).toEqual([])
    expect(countTicks([{ name: 'x', points: [] }])).toEqual([])
  })

  it('keeps count ticks whole and never repeats a label', () => {
    const counts = [
      {
        name: 'Homes sold',
        points: [
          { value: 2, at: 2024, tick: '2024' },
          { value: 3, at: 2025, tick: '2025' },
          { value: 4, at: 2026, tick: '2026' },
        ],
      },
    ]
    const ticks = countTicks(counts)
    const labels = ticks.map((t) => t.label)
    expect(new Set(labels).size).toBe(labels.length)
    for (const tick of ticks) expect(Number.isInteger(tick.value)).toBe(true)
  })

  it('formats day and percent gridlines in their own unit', () => {
    const days = [
      {
        name: 'Days to pending',
        points: [
          { value: 12, at: 1, tick: 'Jan' },
          { value: 44, at: 6, tick: 'Jun' },
        ],
      },
    ]
    expect(dayTicks(days).every((t) => t.label.endsWith('days'))).toBe(true)
    const pct = [
      {
        name: 'Sale to list',
        points: [
          { value: 95, at: 1, tick: 'Jan' },
          { value: 101, at: 6, tick: 'Jun' },
        ],
      },
    ]
    expect(percentTicks(pct).every((t) => t.label.endsWith('%'))).toBe(true)
  })
})

describe('monthTicks', () => {
  it('labels the odd months by default', () => {
    expect(monthTicks()).toEqual([
      { at: 1, label: 'Jan' },
      { at: 3, label: 'Mar' },
      { at: 5, label: 'May' },
      { at: 7, label: 'Jul' },
      { at: 9, label: 'Sep' },
      { at: 11, label: 'Nov' },
    ])
  })

  it('takes an explicit stop list', () => {
    expect(monthTicks(MONTH_TICKS, [1, 12])).toEqual([
      { at: 1, label: 'Jan' },
      { at: 12, label: 'Dec' },
    ])
  })
})

describe('yearTicks', () => {
  const annual = (years: number[]): ClaimSeries[] => [
    { name: 'Homes sold', points: years.map((y) => ({ value: y * 10, at: y, tick: String(y) })) },
  ]

  it('labels every year for a short run', () => {
    expect(yearTicks(annual([2022, 2023, 2024, 2025])).map((t) => t.at)).toEqual([2022, 2023, 2024, 2025])
  })

  it('thins to every other year for a long run and always keeps the latest', () => {
    const ticks = yearTicks(annual([2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]))
    expect(ticks.at(-1)?.at).toBe(2025)
    expect(ticks.length).toBeLessThanOrEqual(6)
    const gaps = ticks.slice(1).map((t, i) => t.at - ticks[i]!.at)
    expect(new Set(gaps)).toEqual(new Set([2]))
  })

  it('returns nothing when the x key is not a year', () => {
    expect(yearTicks([yearSeries('2026', { 1: 10, 2: 20 })])).toEqual([])
  })
})

describe('spacedTicks', () => {
  const chronological: ClaimSeries[] = [
    {
      name: 'Median sale',
      points: Array.from({ length: 12 }, (_, i) => ({
        value: 500_000 + i * 1000,
        at: Date.UTC(2025, i, 1),
        tick: `${MONTH_TICKS[i]} 2025`,
      })),
    },
  ]

  it('picks ticks that exist on the chart, ends included', () => {
    const ticks = spacedTicks(chronological, 4)
    expect(ticks.length).toBe(4)
    expect(ticks[0]?.label).toBe('Jan 2025')
    expect(ticks.at(-1)?.label).toBe('Dec 2025')
    const xs = chronological[0]!.points.map((p) => p.at)
    for (const tick of ticks) expect(xs).toContain(tick.at)
  })

  it('falls back to point order when no point carries an x key', () => {
    const ordered: ClaimSeries[] = [
      { name: 'Share', points: [{ value: 1, tick: 'A' }, { value: 2, tick: 'B' }, { value: 3, tick: 'C' }] },
    ]
    expect(spacedTicks(ordered, 2)).toEqual([
      { at: 0, label: 'A' },
      { at: 2, label: 'C' },
    ])
  })

  it('returns nothing when there are fewer than two labelled points', () => {
    expect(spacedTicks([{ name: 'x', points: [{ value: 1, tick: 'A' }] }])).toEqual([])
    expect(spacedTicks(chronological, 1)).toEqual([])
  })
})

describe('yoyClaim', () => {
  it('reads down against the same month a year earlier', () => {
    const overlay = [
      { name: '2025', points: [{ value: 690_000, at: 8, tick: 'Aug', label: '$690K' }, { value: 680_000, at: 9, tick: 'Sep', label: '$680K' }] },
      { name: '2026', points: [{ value: 670_000, at: 7, tick: 'Jul', label: '$670K' }, { value: 666_000, at: 8, tick: 'Aug', label: '$666K' }] },
    ]
    expect(yoyClaim({ metric: 'Median sale price', unit: 'money', series: overlay })).toBe(
      'Median sale price $666K in Aug 2026, down 3.5% from Aug 2025.',
    )
  })

  it('reads up when the latest point is higher', () => {
    const overlay = [
      { name: '2025', points: [{ value: 600_000, at: 1, tick: 'Jan', label: '$600K' }, { value: 600_000, at: 2, tick: 'Feb', label: '$600K' }] },
      { name: '2026', points: [{ value: 600_000, at: 1, tick: 'Jan', label: '$600K' }, { value: 660_000, at: 2, tick: 'Feb', label: '$660K' }] },
    ]
    expect(yoyClaim({ metric: 'Median sale price', unit: 'money', series: overlay })).toBe(
      'Median sale price $660K in Feb 2026, up 10% from Feb 2025.',
    )
  })

  it('reads flat when the rounded change is zero', () => {
    const overlay = [
      { name: '2025', points: [{ value: 600_000, at: 1, tick: 'Jan', label: '$600K' }, { value: 600_000, at: 2, tick: 'Feb', label: '$600K' }] },
      { name: '2026', points: [{ value: 600_000, at: 1, tick: 'Jan', label: '$600K' }, { value: 600_100, at: 2, tick: 'Feb', label: '$600K' }] },
    ]
    expect(yoyClaim({ metric: 'Median sale price', unit: 'money', series: overlay })).toBe(
      'Median sale price $600K in Feb 2026, flat against Feb 2025.',
    )
  })

  it('drops the comparison when the prior year has no point at that x', () => {
    const overlay = [
      { name: '2025', points: [{ value: 600_000, at: 1, tick: 'Jan', label: '$600K' }, { value: 610_000, at: 2, tick: 'Feb', label: '$610K' }] },
      { name: '2026', points: [{ value: 620_000, at: 6, tick: 'Jun', label: '$620K' }, { value: 666_000, at: 8, tick: 'Aug', label: '$666K' }] },
    ]
    expect(yoyClaim({ metric: 'Median sale price', unit: 'money', series: overlay })).toBe(
      'Median sale price $666K in Aug 2026.',
    )
  })

  it('compares inside one chronological series by month and year', () => {
    const monthly: ClaimSeries[] = [
      {
        name: 'Median sale',
        points: [
          { value: 500_000, at: Date.UTC(2025, 7, 1), tick: 'Aug 2025', label: '$500K' },
          { value: 520_000, at: Date.UTC(2026, 7, 1), tick: 'Aug 2026', label: '$520K' },
        ],
      },
    ]
    expect(yoyClaim({ metric: 'Median sale price', unit: 'money', series: monthly })).toBe(
      'Median sale price $520K in Aug 2026, up 4% from Aug 2025.',
    )
  })

  it('compares inside one annual series by calendar year', () => {
    const annual: ClaimSeries[] = [
      {
        name: 'Homes sold',
        points: [
          { value: 1500, at: 2024, tick: '2024', label: '1,500' },
          { value: 1654, at: 2025, tick: '2025', label: '1,654' },
        ],
      },
    ]
    expect(yoyClaim({ metric: 'Homes sold', unit: 'count', series: annual })).toBe(
      'Homes sold 1,654 in 2025, up 10.3% from 2024.',
    )
  })

  it('formats from the unit when a point carries no label', () => {
    const annual: ClaimSeries[] = [
      { name: 'Days to pending', points: [{ value: 20, at: 2025, tick: '2025' }, { value: 27, at: 2026, tick: '2026' }] },
    ]
    expect(yoyClaim({ metric: 'Median days to pending', unit: 'days', series: annual })).toBe(
      'Median days to pending 27 days in 2026, up 35% from 2025.',
    )
  })

  it('takes explicit period labels', () => {
    const annual: ClaimSeries[] = [
      { name: 'Volume', points: [{ value: 10, at: 2025, tick: '2025', label: '$10M' }, { value: 12, at: 2026, tick: '2026', label: '$12M' }] },
    ]
    expect(
      yoyClaim({
        metric: 'Closed volume',
        unit: 'money',
        series: annual,
        latestLabel: 'the year to date',
        priorLabel: 'the same window last year',
      }),
    ).toBe('Closed volume $12M in the year to date, up 20% from the same window last year.')
  })

  it('returns undefined when there is nothing plottable to claim', () => {
    expect(yoyClaim({ metric: 'Median sale price', unit: 'money', series: [] })).toBeUndefined()
    expect(
      yoyClaim({ metric: 'Median sale price', unit: 'money', series: [{ name: '2026', points: [] }] }),
    ).toBeUndefined()
    expect(
      yoyClaim({
        metric: 'Median sale price',
        unit: 'money',
        series: [{ name: '2026', points: [{ value: Number.NaN, at: 1, tick: 'Jan' }] }],
      }),
    ).toBeUndefined()
  })

  it('states a percent series change in points, never as a percent of a percent', () => {
    const rates: ClaimSeries[] = [
      { name: '2025', points: [{ value: 6.77, at: 200, tick: 'Aug 7', label: '6.77%' }, { value: 6.8, at: 210, tick: 'Aug 17', label: '6.80%' }] },
      { name: '2026', points: [{ value: 6.1, at: 190, tick: 'Jul 28', label: '6.10%' }, { value: 6.35, at: 200, tick: 'Aug 7', label: '6.35%' }] },
    ]
    expect(yoyClaim({ metric: '30-year fixed rate', unit: 'percent', series: rates })).toBe(
      '30-year fixed rate 6.35% in Aug 7, 2026, down 0.4 points from Aug 7, 2025.',
    )
  })

  it('matches the nearest prior-year point inside matchWithin, and names that point', () => {
    const weekly: ClaimSeries[] = [
      { name: '2025', points: [{ value: 6.77, at: 217, tick: 'Aug 6', label: '6.77%' }, { value: 6.8, at: 224, tick: 'Aug 13', label: '6.80%' }] },
      { name: '2026', points: [{ value: 6.1, at: 213, tick: 'Aug 2', label: '6.10%' }, { value: 6.35, at: 220, tick: 'Aug 9', label: '6.35%' }] },
    ]
    // 220 is four days from 224 and three from 217, so the nearest is Aug 6.
    expect(yoyClaim({ metric: '30-year fixed rate', unit: 'percent', series: weekly, matchWithin: 10 })).toBe(
      '30-year fixed rate 6.35% in Aug 9, 2026, down 0.4 points from Aug 6, 2025.',
    )
  })

  it('carries no comparison when the nearest prior point is outside matchWithin', () => {
    const weekly: ClaimSeries[] = [
      { name: '2025', points: [{ value: 6.77, at: 100, tick: 'Apr 10', label: '6.77%' }, { value: 6.8, at: 107, tick: 'Apr 17', label: '6.80%' }] },
      { name: '2026', points: [{ value: 6.1, at: 213, tick: 'Aug 2', label: '6.10%' }, { value: 6.35, at: 220, tick: 'Aug 9', label: '6.35%' }] },
    ]
    expect(yoyClaim({ metric: '30-year fixed rate', unit: 'percent', series: weekly, matchWithin: 10 })).toBe(
      '30-year fixed rate 6.35% in Aug 9, 2026.',
    )
  })

  it('never writes a semicolon, an em-dash, or an exclamation', () => {
    const overlay = [
      { name: '2025', points: [{ value: 600_000, at: 1, tick: 'Jan', label: '$600K' }, { value: 610_000, at: 2, tick: 'Feb', label: '$610K' }] },
      { name: '2026', points: [{ value: 620_000, at: 1, tick: 'Jan', label: '$620K' }, { value: 666_000, at: 2, tick: 'Feb', label: '$666K' }] },
    ]
    const claim = yoyClaim({ metric: 'Median sale price', unit: 'money', series: overlay }) ?? ''
    expect(claim).not.toMatch(/[;—–!]/)
  })
})

describe('windowClaim', () => {
  const run: ClaimSeries[] = [
    {
      name: 'Median close',
      points: [
        { value: 140_000, at: 1998, tick: '1998', label: '$140K' },
        { value: 400_000, at: 2015, tick: '2015', label: '$400K' },
        { value: 712_000, at: 2025, tick: '2025', label: '$712K' },
      ],
    },
  ]

  it('compares the last plotted point to the window s first', () => {
    expect(windowClaim({ metric: 'Median close', unit: 'money', series: run })).toBe(
      'Median close $712K in 2025, up 408.6% from 1998.',
    )
  })

  it('states a percent window in points', () => {
    const rates: ClaimSeries[] = [
      {
        name: '30-year fixed',
        points: [
          { value: 6.97, at: 1, tick: 'Aug 2023', label: '6.97%' },
          { value: 6.35, at: 2, tick: 'Aug 2026', label: '6.35%' },
        ],
      },
    ]
    expect(windowClaim({ metric: '30-year fixed rate', unit: 'percent', series: rates })).toBe(
      '30-year fixed rate 6.35% in Aug 2026, down 0.6 points from Aug 2023.',
    )
  })

  it('carries no comparison when only one point plots', () => {
    const single: ClaimSeries[] = [{ name: 'Median close', points: [{ value: 712_000, at: 2025, tick: '2025', label: '$712K' }] }]
    expect(windowClaim({ metric: 'Median close', unit: 'money', series: single })).toBe('Median close $712K in 2025.')
  })

  it('returns undefined when nothing plots', () => {
    expect(windowClaim({ metric: 'Median close', unit: 'money', series: [] })).toBeUndefined()
  })
})

describe('seriesClaim', () => {
  it('takes the year-over-year comparison when the window holds one', () => {
    const twoYears: ClaimSeries[] = [
      {
        name: 'Median sale',
        points: [
          { value: 500_000, at: 1, tick: 'Aug 2025', label: '$500K' },
          { value: 510_000, at: 2, tick: 'Dec 2025', label: '$510K' },
          { value: 520_000, at: 3, tick: 'Aug 2026', label: '$520K' },
        ],
      },
    ]
    expect(seriesClaim({ metric: 'Median sale price', unit: 'money', series: twoYears })).toBe(
      'Median sale price $520K in Aug 2026, up 4% from Aug 2025.',
    )
  })

  it('falls back to the window span when the prior year is outside it', () => {
    const trailing: ClaimSeries[] = [
      {
        name: 'Median sale',
        points: [
          { value: 500_000, at: 1, tick: 'Sep 2025', label: '$500K' },
          { value: 520_000, at: 2, tick: 'Aug 2026', label: '$520K' },
        ],
      },
    ]
    expect(seriesClaim({ metric: 'Median sale price', unit: 'money', series: trailing })).toBe(
      'Median sale price $520K in Aug 2026, up 4% from Sep 2025.',
    )
  })
})
