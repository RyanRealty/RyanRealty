import { describe, expect, it } from 'vitest'
import type { StatPoint, StatSpreadPoint } from '@/lib/data/stats/statsReads'
import type { CoMarketAnnualRow } from '@/lib/data/analytics/getCoMarketAnnual'
import type { ConcessionsQuarter } from '@/lib/data/pricing/getConcessionsQuarterly'
import {
  buildConcessionsCard,
  buildLongViewSection,
  buildNationIndexCard,
  buildPriceVolumeCard,
  buildRateClockCard,
  buildRateFigures,
  buildRealNominalCard,
  buildSpreadCard,
  rateClockTitle,
} from './region-charts'

function week(observationDate: string, value: number): StatPoint {
  return { observationDate, value, realtimeStart: observationDate }
}

/** Four weekly points per year, medians controlled per year. */
function yearOfWeeks(year: number, value: number): StatPoint[] {
  return ['01-08', '04-09', '07-09', '10-08'].map((md) => week(`${year}-${md}`, value))
}

const m30InSixes = [
  ...yearOfWeeks(2023, 6.72),
  ...yearOfWeeks(2024, 6.78),
  ...yearOfWeeks(2025, 6.65),
  ...yearOfWeeks(2026, 6.37),
]

function martYear(
  year: number,
  medianClose: number | null,
  soldCount: number,
): CoMarketAnnualRow {
  return {
    geoType: 'region',
    geoSlug: 'central-oregon',
    year,
    typeScope: 'sfr',
    soldCount,
    totalVolume: soldCount * (medianClose ?? 0),
    medianClose,
    meanClose: medianClose,
    propertyTypeBreakdown: {},
    methodology: 'test',
    source: 'mart',
    computedAt: '2026-08-19T00:00:00Z',
  }
}

const coAnnual = [martYear(1998, 123000, 3525), martYear(2010, 200000, 3000), martYear(2025, 615000, 5021)]

describe('rateClockTitle', () => {
  it('names the streak of calendar years sharing one integer band', () => {
    expect(rateClockTitle(m30InSixes)).toBe('Fourth year in the 6s')
  })

  it('falls back to the latest rate when the last year broke the band', () => {
    const broke = [...yearOfWeeks(2025, 6.5), ...yearOfWeeks(2026, 5.4)]
    expect(rateClockTitle(broke)).toBe('30-year rate at 5.40%')
  })
})

describe('buildRateClockCard', () => {
  it('builds the segmented ranges with the YoY overlay as the default view', () => {
    const card = buildRateClockCard(m30InSixes)
    expect(card).toBeDefined()
    expect(card!.switcher).toBeDefined()
    expect(card!.switcher!.defaultKey).toBe('yoy')
    const keys = card!.switcher!.items.map((it) => it.key)
    expect(keys).toContain('yoy')
    expect(keys).toContain('all')
    const yoyIndex = keys.indexOf('yoy')
    const yoyPanel = card!.switcher!.panels[yoyIndex]!
    expect(yoyPanel.overlay).toBe('yoy')
    // One series per calendar year, at most five.
    expect(yoyPanel.series!.length).toBe(4)
  })

  it('is not built from an empty series', () => {
    expect(buildRateClockCard([])).toBeUndefined()
  })
})

describe('buildRateFigures', () => {
  it('publishes latest, year-ago, year low, and window peak', () => {
    const figures = buildRateFigures(m30InSixes)
    expect(figures[0]!.value).toBe('6.37%')
    const labels = figures.map((f) => String(f.label))
    expect(labels.some((l) => l.includes('a year earlier'))).toBe(true)
    expect(labels.some((l) => l.includes('2026 low'))).toBe(true)
    expect(labels.some((l) => l.startsWith('peak since'))).toBe(true)
  })
})

describe('buildSpreadCard', () => {
  const spreadPoints: StatSpreadPoint[] = [
    { observationDate: '2015-01-08', anchorValue: 3.73, otherValue: 2.0, otherObservationDate: '2015-01-07', spread: 1.73 },
    { observationDate: '2026-08-13', anchorValue: 6.67, otherValue: 4.63, otherObservationDate: '2026-08-12', spread: 2.04 },
  ]
  const norm = { mean: 1.76, from: '1971-04-02', to: '2026-08-13', n: 2890 }

  it('computes the finding against the norm and draws the norm as a flat second series', () => {
    const card = buildSpreadCard(spreadPoints, norm)
    expect(card).toBeDefined()
    expect(card!.title).toBe('Spread 0.28pp above norm')
    const series = card!.chart!.series!
    expect(series).toHaveLength(2)
    expect(series[1]!.points.every((p) => p.value === 1.76)).toBe(true)
  })

  it('says below when the spread sits under the norm', () => {
    const under = [{ ...spreadPoints[0]! }, { ...spreadPoints[1]!, spread: 1.5 }]
    expect(buildSpreadCard(under, norm)!.title).toBe('Spread 0.26pp below norm')
  })
})

describe('buildNationIndexCard', () => {
  const cs = new Map([
    [1998, 90.099],
    [2010, 140.0],
    [2025, 331.0],
  ])

  it('rebases both series to the base year and states the multiples', () => {
    const card = buildNationIndexCard(coAnnual, cs)
    expect(card).toBeDefined()
    expect(card!.title).toBe('5.0x here, 3.7x nationally')
    const [co, nation] = card!.chart!.series!
    expect(co!.points[0]!.value).toBeCloseTo(100)
    expect(nation!.points[0]!.value).toBeCloseTo(100)
  })

  it('is not built without the base year on both sides', () => {
    expect(buildNationIndexCard(coAnnual, new Map([[2025, 331]]))).toBeUndefined()
  })
})

describe('buildPriceVolumeCard', () => {
  it('states both multiples and switches between the two units', () => {
    const card = buildPriceVolumeCard(coAnnual)
    expect(card).toBeDefined()
    expect(card!.title).toBe('Prices 5.0x, sales up 42%')
    expect(card!.switcher!.panels[0]!.kind).toBeUndefined()
    expect(card!.switcher!.panels[1]!.kind).toBe('bars')
  })
})

describe('buildRealNominalCard', () => {
  const cpi = new Map([
    [1998, 163.0],
    [2010, 218.0],
    [2025, 320.0],
  ])

  it('deflates into the reference year dollars and converges at the end', () => {
    const card = buildRealNominalCard(coAnnual, cpi)
    expect(card).toBeDefined()
    const [nominal, real] = card!.chart!.series!
    const realFirst = 123000 * (320 / 163)
    expect(real!.points[0]!.value).toBeCloseTo(realFirst, 0)
    expect(real!.points[real!.points.length - 1]!.value).toBe(615000)
    expect(nominal!.points[0]!.value).toBe(123000)
    expect(card!.title).toBe(`Up ${(615000 / realFirst).toFixed(1)}x after inflation`)
  })
})

describe('buildConcessionsCard', () => {
  const quarters: ConcessionsQuarter[] = [
    { quarterStart: '2026-01-01', closings: 749, withConcessions: 332, share: 332 / 749, medianConcession: 10000 },
    { quarterStart: '2026-04-01', closings: 968, withConcessions: 437, share: 437 / 968, medianConcession: 10000 },
  ]

  it('states the latest complete quarter share', () => {
    const card = buildConcessionsCard(quarters)
    expect(card).toBeDefined()
    expect(card!.title).toBe('Concessions on 45% of sales')
    expect(card!.chart!.kind).toBe('bars')
    expect(String(card!.chart!.series![0]!.points[1]!.label)).toBe('45.1%')
  })

  it('is not built from a single quarter', () => {
    expect(buildConcessionsCard(quarters.slice(0, 1))).toBeUndefined()
  })
})

describe('buildLongViewSection', () => {
  it('is null when the rate series is absent — no borrowed figures', () => {
    const out = buildLongViewSection({
      m30: [],
      spread: [],
      norm: null,
      coAnnual,
      csAnnualAvg: new Map(),
      cpiAnnualAvg: new Map(),
      concessionQuarters: [],
    })
    expect(out).toBeNull()
  })

  it('assembles the cards that can be built and headlines the live rate', () => {
    const out = buildLongViewSection({
      m30: m30InSixes,
      spread: [],
      norm: null,
      coAnnual,
      csAnnualAvg: new Map(),
      cpiAnnualAvg: new Map(),
      concessionQuarters: [],
    })
    expect(out).not.toBeNull()
    expect(out!.headline).toBe('The 30-year rate is 6.37%')
    expect(out!.cards.map((c) => c.id)).toEqual(['lv-rate-clock', 'lv-price-volume'])
  })
})
