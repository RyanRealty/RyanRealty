import { describe, it, expect } from 'vitest'
import {
  getAvailableYears,
  buildYtdComparisonRows,
  summarizeInterpretation,
} from './report-year-compare'

// Powers the YoY market-report comparison grid + the published "up/down N%"
// interpretation sentence. A regression here publishes a wrong YoY number, which
// is a data-accuracy/compliance issue (CLAUDE.md S0). Audit p3.2.
const series = [
  { period_start: '2026-01-15', sold_count: 10, median_price: 500000 },
  { period_start: '2026-02-15', sold_count: 12, median_price: 520000 },
  { period_start: '2025-01-15', sold_count: 8, median_price: 480000 },
  { period_start: 'not-a-date', sold_count: 99, median_price: 1 },
]

describe('getAvailableYears', () => {
  it('returns distinct years sorted descending, ignoring invalid dates', () => {
    expect(getAvailableYears(series)).toEqual([2026, 2025])
  })
  it('returns [] for empty / all-invalid input', () => {
    expect(getAvailableYears([])).toEqual([])
    expect(getAvailableYears([{ period_start: 'x', sold_count: 1, median_price: null }])).toEqual([])
  })
})

describe('buildYtdComparisonRows', () => {
  it('builds monthCap rows with per-year sales/price keys, null when a year-month is missing', () => {
    const rows = buildYtdComparisonRows(series, [2026, 2025], 2)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      month: 1,
      monthLabel: 'Jan',
      sales_2026: 10,
      price_2026: 500000,
      sales_2025: 8,
      price_2025: 480000,
    })
    // Feb 2025 has no data point -> null (not zero)
    expect(rows[1]).toMatchObject({
      month: 2,
      monthLabel: 'Feb',
      sales_2026: 12,
      price_2026: 520000,
      sales_2025: null,
      price_2025: null,
    })
  })
})

describe('summarizeInterpretation', () => {
  it('with no comparison years, reports YTD sales total + average median', () => {
    const rows = buildYtdComparisonRows(series, [2026], 2)
    const text = summarizeInterpretation(rows, 2026, [])
    expect(text).toContain('Year to date 2026')
    expect(text).toContain('22 closed sales') // 10 + 12
    expect(text).toContain('510,000') // (500000 + 520000) / 2
  })
  it('with comparison years, reports up/down deltas versus peers', () => {
    const rows = buildYtdComparisonRows(series, [2026, 2025], 2)
    const text = summarizeInterpretation(rows, 2026, [2025])
    // current sales 22 vs 2025 sales 8 -> up
    expect(text).toMatch(/up \d+% in closed sales/)
    // current median 510k vs 2025 median 480k -> up in median pricing
    expect(text).toMatch(/up \d+% in median pricing/)
    expect(text).toContain('comparison years')
  })
})
