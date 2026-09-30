import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import {
  isDue,
  CADENCE_WINDOW_MS,
  MARKET_REPORT_CRON_HOURS_UTC,
  dueAt,
  inReportSendWindow,
  nextCronRunInWindow,
  nextReportSendAt,
} from './market-report-cadence'

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

describe('the send window (8am to 8pm Pacific, same as the bulk path)', () => {
  it('is pinned to the cron vercel.json actually runs', () => {
    const vercel = JSON.parse(readFileSync(resolve('vercel.json'), 'utf8')) as { crons: Array<{ path: string; schedule: string }> }
    const cron = vercel.crons.find((c) => c.path === '/api/cron/crm-market-report-send')
    expect(cron).toBeDefined()
    const hours = cron!.schedule.split(' ')[1].split(',').map(Number)
    expect(hours).toEqual([...MARKET_REPORT_CRON_HOURS_UTC])
  })

  it('only the 16:00 and 22:00 UTC runs fall inside the window, summer and winter', () => {
    for (const day of ['2026-07-15', '2026-12-15']) {
      const inside = MARKET_REPORT_CRON_HOURS_UTC.filter((h) => inReportSendWindow(new Date(`${day}T${String(h).padStart(2, '0')}:00:00Z`)))
      expect(inside).toEqual([16, 22])
    }
  })

  it('the 2026-09-05 10:00 UTC send (3am Pacific) is outside it', () => {
    expect(inReportSendWindow(new Date('2026-09-05T10:00:16Z'))).toBe(false)
  })
})

describe('nextCronRunInWindow / nextReportSendAt (the named basis for "next send")', () => {
  it('finds the next in-window cron run', () => {
    expect(nextCronRunInWindow(new Date('2026-09-29T17:00:00Z'))?.toISOString()).toBe('2026-09-29T22:00:00.000Z')
    expect(nextCronRunInWindow(new Date('2026-09-29T22:30:00Z'))?.toISOString()).toBe('2026-09-30T16:00:00.000Z')
    expect(nextCronRunInWindow(new Date('2026-09-30T16:00:00Z'))?.toISOString()).toBe('2026-09-30T16:00:00.000Z')
  })

  it('is null while off or waiting on the first-send approval', () => {
    const now = new Date('2026-09-29T17:00:00Z')
    expect(nextReportSendAt({ isActive: false, approved: true, frequency: 'monthly', lastSentAt: null, now })).toBeNull()
    expect(nextReportSendAt({ isActive: true, approved: false, frequency: 'monthly', lastSentAt: null, now })).toBeNull()
  })

  it('an approved, never-sent subscription goes at the next in-window run', () => {
    const now = new Date('2026-09-29T17:00:00Z')
    expect(nextReportSendAt({ isActive: true, approved: true, frequency: 'monthly', lastSentAt: null, now })?.toISOString()).toBe(
      '2026-09-29T22:00:00.000Z',
    )
  })

  it('a sent subscription waits out its cadence window, then the next in-window run', () => {
    const now = new Date('2026-09-29T17:00:00Z')
    expect(dueAt('monthly', '2026-09-08T22:00:16.177Z')?.toISOString()).toBe('2026-10-08T22:00:16.177Z')
    expect(
      nextReportSendAt({ isActive: true, approved: true, frequency: 'monthly', lastSentAt: '2026-09-08T22:00:16.177Z', now })?.toISOString(),
    ).toBe('2026-10-09T16:00:00.000Z')
    // Quarterly is 89 days, the same window the engine enforces (defect r: the panel said 90).
    expect(dueAt('quarterly', '2026-07-01T16:00:00.000Z')?.toISOString()).toBe('2026-09-28T16:00:00.000Z')
  })
})
