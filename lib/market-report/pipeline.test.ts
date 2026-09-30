import { describe, expect, it, vi } from 'vitest'

// The pipeline module imports the data layer; these tests exercise only its pure helpers.
vi.mock('@/lib/data/market-report/compute', () => ({ REPORT_DEFINITION_ID: 'mr-v1' }))
vi.mock('@/lib/data/market-report/series', () => ({}))
vi.mock('@/lib/data/market-report/editions', () => ({}))
vi.mock('./reconcile', () => ({}))
vi.mock('./pdf/render', () => ({}))

import { lastCompleteMonth, monthRange } from './pipeline'

describe('lastCompleteMonth', () => {
  it('is the month before the current Pacific month', () => {
    expect(lastCompleteMonth(new Date('2026-09-25T01:30:00Z'))).toBe('2026-08')
  })

  it('reads the Pacific calendar, not UTC, across a month boundary', () => {
    // 2026-10-01 03:00 UTC is still September 30 in Bend.
    expect(lastCompleteMonth(new Date('2026-10-01T03:00:00Z'))).toBe('2026-08')
    expect(lastCompleteMonth(new Date('2026-10-01T09:00:00Z'))).toBe('2026-09')
  })

  it('wraps the year in January', () => {
    expect(lastCompleteMonth(new Date('2027-01-15T20:00:00Z'))).toBe('2026-12')
  })
})

describe('monthRange', () => {
  it('is inclusive and crosses years', () => {
    expect(monthRange('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
  })

  it('is empty when the range runs backward', () => {
    expect(monthRange('2026-03', '2026-02')).toEqual([])
  })
})
