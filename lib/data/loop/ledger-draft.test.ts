import { describe, it, expect } from 'vitest'
import { assertLedgerDraft, isExpiredUnlearned, windowEndsAt } from './ledger-draft'

describe('assertLedgerDraft', () => {
  const ok = {
    domain: 'recruit-retain',
    changeClass: 'day-one-own-book',
    surface: '/join',
    description: 'New broker sees only their book on Today',
    metric: 'time_to_first_useful_day',
  }

  it('accepts a non-SEO domain so the ledger can score company work', () => {
    expect(() => assertLedgerDraft(ok)).not.toThrow()
  })

  it('refuses a Growth-era domain alias that is not in the closed set', () => {
    expect(() => assertLedgerDraft({ ...ok, domain: 'growth' })).toThrow(/unknown company domain/i)
  })

  it('refuses a blank change class — confidence is learned per class', () => {
    expect(() => assertLedgerDraft({ ...ok, changeClass: '  ' })).toThrow(/changeClass/i)
  })
})

describe('measurement windows (the Learn deadline)', () => {
  it('computes the window end from shipped_at + window_days', () => {
    const end = windowEndsAt('2026-08-01T00:00:00Z', 14)
    expect(end.toISOString()).toBe('2026-08-15T00:00:00.000Z')
  })

  it('an open row inside its window is NOT stranded — measurement takes time', () => {
    const row = { shippedAt: '2026-08-10T00:00:00Z', windowDays: 14, actualDelta: null }
    expect(isExpiredUnlearned(row, new Date('2026-08-15T00:00:00Z'))).toBe(false)
  })

  it('an open row past its window IS stranded — Learn was skipped', () => {
    const row = { shippedAt: '2026-07-01T00:00:00Z', windowDays: 14, actualDelta: null }
    expect(isExpiredUnlearned(row, new Date('2026-08-15T00:00:00Z'))).toBe(true)
  })

  it('a closed row is never stranded, even long past its window', () => {
    const row = { shippedAt: '2026-07-01T00:00:00Z', windowDays: 14, actualDelta: 0 }
    expect(isExpiredUnlearned(row, new Date('2026-08-15T00:00:00Z'))).toBe(false)
  })

  it('actual_delta of zero counts as learned (flat is a verdict, not a gap)', () => {
    const row = { shippedAt: '2026-07-01T00:00:00Z', windowDays: 14, actualDelta: 0 }
    expect(isExpiredUnlearned(row, new Date('2026-09-01T00:00:00Z'))).toBe(false)
  })
})
