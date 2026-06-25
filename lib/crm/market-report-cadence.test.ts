import { describe, it, expect } from 'vitest'
import { isDue, CADENCE_WINDOW_MS } from './market-report-cadence'

const NOW = new Date('2026-06-25T12:00:00.000Z')
const DAY = 24 * 60 * 60 * 1000

/** N days before NOW as an ISO string. */
function daysAgo(n: number): string {
  return new Date(NOW.getTime() - n * DAY).toISOString()
}

describe('CADENCE_WINDOW_MS', () => {
  it('encodes the three cadence windows (weekly 7d, monthly 30d, quarterly 89d)', () => {
    expect(CADENCE_WINDOW_MS.weekly).toBe(7 * DAY)
    expect(CADENCE_WINDOW_MS.monthly).toBe(30 * DAY)
    expect(CADENCE_WINDOW_MS.quarterly).toBe(89 * DAY)
  })
})

describe('isDue — never sent', () => {
  it('is due when lastSentAt is null', () => {
    expect(isDue({ frequency: 'weekly', lastSentAt: null, now: NOW })).toBe(true)
    expect(isDue({ frequency: 'monthly', lastSentAt: undefined, now: NOW })).toBe(true)
    expect(isDue({ frequency: 'quarterly', lastSentAt: null, now: NOW })).toBe(true)
  })

  it('treats an unparseable lastSentAt as never sent (due)', () => {
    expect(isDue({ frequency: 'monthly', lastSentAt: 'not-a-date', now: NOW })).toBe(true)
  })
})

describe('isDue — weekly', () => {
  it('not due 6 days after last send', () => {
    expect(isDue({ frequency: 'weekly', lastSentAt: daysAgo(6), now: NOW })).toBe(false)
  })
  it('due exactly 7 days after last send', () => {
    expect(isDue({ frequency: 'weekly', lastSentAt: daysAgo(7), now: NOW })).toBe(true)
  })
  it('due 10 days after last send', () => {
    expect(isDue({ frequency: 'weekly', lastSentAt: daysAgo(10), now: NOW })).toBe(true)
  })
})

describe('isDue — monthly', () => {
  it('not due 29 days after last send', () => {
    expect(isDue({ frequency: 'monthly', lastSentAt: daysAgo(29), now: NOW })).toBe(false)
  })
  it('due exactly 30 days after last send', () => {
    expect(isDue({ frequency: 'monthly', lastSentAt: daysAgo(30), now: NOW })).toBe(true)
  })
})

describe('isDue — quarterly', () => {
  it('not due 88 days after last send', () => {
    expect(isDue({ frequency: 'quarterly', lastSentAt: daysAgo(88), now: NOW })).toBe(false)
  })
  it('due exactly 89 days after last send', () => {
    expect(isDue({ frequency: 'quarterly', lastSentAt: daysAgo(89), now: NOW })).toBe(true)
  })
})

describe('isDue — accepts a Date and defends against clock skew', () => {
  it('accepts a Date lastSentAt', () => {
    expect(isDue({ frequency: 'weekly', lastSentAt: new Date(NOW.getTime() - 8 * DAY), now: NOW })).toBe(true)
  })
  it('a future lastSentAt is not due (fail-safe, no re-send)', () => {
    const future = new Date(NOW.getTime() + 5 * DAY).toISOString()
    expect(isDue({ frequency: 'weekly', lastSentAt: future, now: NOW })).toBe(false)
  })
})
