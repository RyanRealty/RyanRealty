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
  it('draws a line, labels the short months, and does not stamp a number on every stem', () => {
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
    expect(svg).toContain('<path')
    expect(svg).toContain('>Aug</text>')
    expect(svg).toContain('>Apr</text>')
    expect(svg).toContain('>13<')
    expect(svg).not.toMatch(/>ug</)
    expect(svg).not.toContain('Supabase')
    expect(svg).not.toContain('PropertyType=')
    expect(svg).not.toContain('month-ledger')
    expect(svg).not.toContain('DAYS TO PENDING')
    expect(svg).not.toContain('rx="2"')
    // April is 13 (10+3). January 10 and December 21 sit on the axis, not as stem labels.
    const labeled = [...svg.matchAll(/font-size="9"[^>]*>\d+</g)].length
    expect(labeled).toBeLessThan(4)
  })
})
