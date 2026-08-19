import { describe, expect, it } from 'vitest'
import {
  aggregateConcessionQuarters,
  dropInProgressQuarter,
  quarterStartOf,
  type ConcessionCloseRow,
} from './getConcessionsQuarterly'

function row(
  close_date: string | null,
  concessions_yn: string | null = null,
  concessions_amount: number | string | null = null,
): ConcessionCloseRow {
  return { close_date, concessions_yn, concessions_amount }
}

describe('quarterStartOf', () => {
  it('maps any day to its quarter start', () => {
    expect(quarterStartOf('2026-08-13')).toBe('2026-07-01')
    expect(quarterStartOf('2026-01-01')).toBe('2026-01-01')
    expect(quarterStartOf('2024-12-31')).toBe('2024-10-01')
  })

  it('refuses malformed dates', () => {
    expect(quarterStartOf('not-a-date')).toBeNull()
    expect(quarterStartOf('2026-13-01')).toBeNull()
  })
})

describe('aggregateConcessionQuarters', () => {
  it('counts closings and concessions per quarter, ascending', () => {
    const out = aggregateConcessionQuarters([
      row('2026-04-02', 'Yes', 10000),
      row('2026-05-10', 'No', null),
      row('2026-06-30', 'Yes', 5000),
      row('2026-01-15', 'No', null),
    ])
    expect(out.map((q) => q.quarterStart)).toEqual(['2026-01-01', '2026-04-01'])
    const q2 = out[1]!
    expect(q2.closings).toBe(3)
    expect(q2.withConcessions).toBe(2)
    expect(q2.share).toBeCloseTo(2 / 3)
  })

  it('takes the continuous median (mean of the two middles on an even count)', () => {
    const out = aggregateConcessionQuarters([
      row('2025-10-05', 'Yes', 10000),
      row('2025-11-05', 'Yes', 10621),
      row('2025-12-05', 'No', null),
    ])
    expect(out[0]!.medianConcession).toBe(10310.5)
  })

  it('excludes zero and missing amounts from the median but not the count', () => {
    const out = aggregateConcessionQuarters([
      row('2026-04-02', 'Yes', 0),
      row('2026-04-03', 'Yes', null),
      row('2026-04-04', 'Yes', 8000),
    ])
    expect(out[0]!.withConcessions).toBe(3)
    expect(out[0]!.medianConcession).toBe(8000)
  })

  it('drops rows with no close date and reports null median when no amounts', () => {
    const out = aggregateConcessionQuarters([row(null, 'Yes', 5000), row('2026-04-02', 'No')])
    expect(out).toHaveLength(1)
    expect(out[0]!.medianConcession).toBeNull()
  })
})

describe('dropInProgressQuarter', () => {
  const quarters = aggregateConcessionQuarters([
    row('2026-01-15'),
    row('2026-04-15'),
    row('2026-07-15'),
  ])

  it('drops the quarter the day key sits inside', () => {
    const out = dropInProgressQuarter(quarters, '2026-08-19')
    expect(out.map((q) => q.quarterStart)).toEqual(['2026-01-01', '2026-04-01'])
  })

  it('keeps everything when the day key opens a later quarter', () => {
    const out = dropInProgressQuarter(quarters, '2026-10-01')
    expect(out).toHaveLength(3)
  })

  it('keeps everything on a malformed day key', () => {
    expect(dropInProgressQuarter(quarters, '')).toHaveLength(3)
  })
})
