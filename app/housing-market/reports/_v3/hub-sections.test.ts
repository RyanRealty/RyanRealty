import { describe, expect, it } from 'vitest'
import type { CityRangeReport } from '@/lib/market/range-periods'
import type { CityReportSnapshot } from '@/lib/data/market/getCityReportSnapshot'
import { buildCityLedgerRows, buildRangeDataset, parseReportsParams } from './hub-sections'

function rangeReport(overrides: Partial<CityRangeReport> = {}): CityRangeReport {
  return {
    period: 'rolling_30d',
    periodLabel: 'Last 30 days',
    periodStart: '2026-07-25',
    periodEnd: '2026-08-24',
    rows: [
      {
        city: 'Bend',
        urlSlug: 'bend',
        soldCount: 137,
        medianSalePrice: 730_000,
        medianDom: 33,
        medianPricePerSqft: 385,
        activeCount: 772,
        sales12mo: 2095,
        monthsOfSupply: 4.5,
        periodStart: '2026-07-25',
        periodEnd: '2026-08-24',
      },
    ],
    ...overrides,
  }
}

describe('parseReportsParams', () => {
  it('defaults to 30 days — leftover must not map onto that Sold column', () => {
    expect(parseReportsParams(null).period).toBe('rolling_30d')
    expect(parseReportsParams({}).period).toBe('rolling_30d')
    expect(parseReportsParams({ range: 'rolling_365d' }).period).toBe('rolling_365d')
  })
})

describe('buildRangeDataset', () => {
  it('emits leftover 12-month closed sales beside the selected-window Sold column', () => {
    const dataset = buildRangeDataset(rangeReport())
    expect(dataset?.type).toBe('dataset')
    if (dataset?.type !== 'dataset') throw new Error('expected dataset')
    const vars = dataset.variableMeasured
    expect(vars).toContainEqual({ name: 'Bend closed sales', value: 137 })
    expect(vars).toContainEqual({ name: 'Bend 12-month closed sales', value: 2095 })
    expect(vars).toContainEqual({ name: 'Bend median sale price', value: 730000, unitText: 'USD' })
    expect(vars.some((v) => v.name === 'Bend closed sales' && v.value === 2095)).toBe(false)
  })

  it('rolling_365d Sold/Median in the dataset are the leftover 12-month figures', () => {
    const dataset = buildRangeDataset(
      rangeReport({
        period: 'rolling_365d',
        periodLabel: 'Last 12 months',
        periodStart: '2025-08-24',
        periodEnd: '2026-08-24',
        rows: [
          {
            city: 'Bend',
            urlSlug: 'bend',
            soldCount: 2095,
            medianSalePrice: 760_000,
            medianDom: 25,
            medianPricePerSqft: 385,
            activeCount: 772,
            sales12mo: 2095,
            monthsOfSupply: 4.5,
            periodStart: '2025-08-24',
            periodEnd: '2026-08-24',
          },
        ],
      }),
    )
    if (dataset?.type !== 'dataset') throw new Error('expected dataset')
    const vars = dataset.variableMeasured
    expect(vars).toContainEqual({ name: 'Bend closed sales', value: 2095 })
    expect(vars).toContainEqual({ name: 'Bend 12-month closed sales', value: 2095 })
    expect(vars).toContainEqual({ name: 'Bend median sale price', value: 760000, unitText: 'USD' })
    expect(vars.some((v) => v.value === 1641 || v.value === 719000)).toBe(false)
  })
})

describe('buildCityLedgerRows', () => {
  it('uses leftover-overlaid trailing median when live list price is missing', () => {
    const snap: CityReportSnapshot = {
      cityLabel: 'Bend',
      geoSlug: 'bend',
      urlSlug: 'bend',
      live: {
        activeCount: 772,
        medianListPrice: null,
        monthsOfSupply: 4.5,
        closedLast30Days: 137,
        medianDaysToPending: 18,
        refreshedAt: '2026-08-24T00:00:00Z',
      },
      trailing12mo: {
        medianSalePrice: 760_000,
        soldCount: 2095,
        medianDom: 25,
        yoyMedianPriceDeltaPct: null,
        periodStart: '2025-08-24',
        periodEnd: '2026-08-24',
        updatedAt: null,
      },
    }
    const rows = buildCityLedgerRows([snap])
    expect(String(rows[0]!.value)).toContain('760')
    expect(String(rows[0]!.value)).not.toContain('719')
  })
})
