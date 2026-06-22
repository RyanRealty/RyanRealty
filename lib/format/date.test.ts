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

describe('migration byte-identity guard (components/ListingTile + admin leads)', () => {
  // The exact inline expression both migrated call sites used. formatDate must
  // equal it byte-for-byte for valid inputs, else the migration changed output.
  const inline = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles' })

  const samples = [
    '2026-06-22T20:00:00.000Z',
    '2026-06-22T05:00:00.000Z', // crosses to prior day in LA
    '2026-01-01T00:00:00.000Z',
    '2025-12-31T23:59:00.000Z',
    '2026-07-04T12:00:00.000Z',
  ]

  it('formatDate(Date) equals the prior inline toLocaleDateString call (ListingTile path)', () => {
    for (const iso of samples) {
      const d = new Date(iso)
      expect(formatDate(d)).toBe(inline(d))
    }
  })

  it('formatDate(isoString) equals new Date(iso).toLocaleDateString(...) (admin leads path)', () => {
    for (const iso of samples) {
      expect(formatDate(iso)).toBe(inline(new Date(iso)))
    }
  })
})
