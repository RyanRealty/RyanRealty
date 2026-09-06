import { describe, expect, it } from 'vitest'
import { seasonalityChartSvg } from '@/lib/cma/seasonality-chart'
import type { CmaSeasonality } from '@/lib/cma/extras'

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

describe('seasonalityChartSvg', () => {
  it('keeps full 3-letter month ticks, including Aug', () => {
    const x: CmaSeasonality = {
      byMonth: MONTHS.map((monthName, i) => ({
        month: i + 1,
        monthName,
        closedCount: 20,
        medianDaysToPending: 10 + i,
      })),
      fastestMonths: ['April'],
      slowestMonths: ['December'],
      yearsCovered: 3,
      totalClosed: 400,
      source: "Supabase listings, City='Redmond', PropertyType='A'",
    }
    const svg = seasonalityChartSvg(x)
    expect(svg).toContain('month-ledger')
    expect(svg).toContain('Aug')
    expect(svg).toContain('Apr')
    expect(svg).toContain('Days')
    expect(svg).toContain('is-fast')
    expect(svg).toContain('>10<')
    expect(svg).toContain('>21<')
    expect(svg).not.toMatch(/>ug</)
    expect(svg).not.toContain('Supabase')
    expect(svg).not.toContain('PropertyType=')
    expect(svg).not.toContain('<circle')
    expect(svg).not.toContain('DAYS TO PENDING')
    expect(svg).not.toContain('<path')
  })
})
