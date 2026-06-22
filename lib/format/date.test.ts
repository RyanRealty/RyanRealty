import { describe, it, expect } from 'vitest'
import { formatDate, formatDateTime } from './date'

describe('formatDate (brand timezone, audit p1.4)', () => {
  it('formats an ISO date in America/Los_Angeles', () => {
    // 2026-06-22T05:00:00Z is still Jun 21 in Los Angeles (UTC-7)
    expect(formatDate('2026-06-22T05:00:00.000Z')).toBe('Jun 21, 2026')
    expect(formatDate('2026-06-22T20:00:00.000Z')).toBe('Jun 22, 2026')
  })
  it('returns an em-dash for null/invalid', () => {
    expect(formatDate(null)).toBe('—')
    expect(formatDate(undefined)).toBe('—')
    expect(formatDate('not-a-date')).toBe('—')
  })
  it('honors override options', () => {
    expect(formatDate('2026-06-22T20:00:00.000Z', { month: 'long', day: 'numeric', year: 'numeric' })).toBe('June 22, 2026')
  })
  it('formatDateTime includes a time', () => {
    expect(formatDateTime('2026-06-22T20:30:00.000Z')).toMatch(/Jun 22, 2026.*\d/)
  })
})
