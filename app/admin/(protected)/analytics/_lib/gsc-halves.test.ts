import { describe, expect, it } from 'vitest'
import { comparableGscHalves } from './gsc-halves'

describe('comparableGscHalves', () => {
  it('cuts the range back to the latest stored day, then splits it evenly', () => {
    // 30d range ending 2026-10-14; Google has reported through 2026-10-11.
    expect(comparableGscHalves('2026-09-15', '2026-10-14', '2026-10-11')).toEqual({
      first: { from: '2026-09-15', to: '2026-09-27' },
      second: { from: '2026-09-29', to: '2026-10-11' },
      through: '2026-10-11',
    })
  })

  it('halves hold the same number of days and never share one', () => {
    const r = comparableGscHalves('2026-09-15', '2026-10-14', '2026-10-11')!
    const len = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86_400_000 + 1
    expect(len(r.first.from, r.first.to)).toBe(len(r.second.from, r.second.to))
    expect(r.first.to < r.second.from).toBe(true)
  })

  it('an even day count splits with no gap', () => {
    expect(comparableGscHalves('2026-10-01', '2026-10-04', null)).toEqual({
      first: { from: '2026-10-01', to: '2026-10-02' },
      second: { from: '2026-10-03', to: '2026-10-04' },
      through: '2026-10-04',
    })
  })

  it('keeps the range end when the snapshot is ahead of it or the latest date is unknown', () => {
    expect(comparableGscHalves('2026-09-01', '2026-09-30', '2026-10-11')?.through).toBe('2026-09-30')
    expect(comparableGscHalves('2026-09-01', '2026-09-30', null)?.through).toBe('2026-09-30')
  })

  it('is null when fewer than two reported days remain', () => {
    expect(comparableGscHalves('2026-10-11', '2026-10-14', '2026-10-11')).toBeNull()
    expect(comparableGscHalves('2026-10-12', '2026-10-14', '2026-10-11')).toBeNull()
  })
})
