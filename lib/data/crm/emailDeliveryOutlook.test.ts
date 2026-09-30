import { describe, expect, it } from 'vitest'
import { marketReportOutlook } from './emailDeliveryOutlook'

/**
 * "Due now" on the delivery panel (review 2026-09-30): it compared the next
 * cron run, which is never before now, with now, so it was never true. It is
 * whether the cadence window has elapsed, for a report that is on and approved.
 */

const NOW = new Date('2026-09-30T18:00:00.000Z')
const base = {
  frequency: 'monthly',
  is_active: true,
  last_sent_at: '2026-08-15T16:00:00.000Z',
  first_send_approved_at: '2026-08-01T00:00:00.000Z',
  stopped_at: null,
  stopped_via: null,
}

describe('marketReportOutlook', () => {
  it('an approved report past its window is due now, and goes at the next 8am to 8pm Pacific run', () => {
    const o = marketReportOutlook(base, NOW)
    expect(o.dueNow).toBe(true)
    expect(o.nextExpectedAtIso).toBe('2026-09-30T22:00:00.000Z')
  })

  it('an approved report that has never sent is due now', () => {
    expect(marketReportOutlook({ ...base, last_sent_at: null }, NOW).dueNow).toBe(true)
  })

  it('inside its window it is not due, and names the day it will be', () => {
    const o = marketReportOutlook({ ...base, last_sent_at: '2026-09-20T16:00:00.000Z' }, NOW)
    expect(o.dueNow).toBe(false)
    expect(o.nextExpectedAtIso).toBe('2026-10-20T16:00:00.000Z')
  })

  it('off, or waiting on the first-send approval, is never due and schedules nothing', () => {
    const off = marketReportOutlook({ ...base, is_active: false, stopped_at: '2026-09-01T00:00:00Z', stopped_via: 'one-click' }, NOW)
    expect(off).toEqual({ nextExpectedAtIso: null, dueNow: false, note: 'Stopped by the contact.' })
    const waiting = marketReportOutlook({ ...base, first_send_approved_at: null, last_sent_at: null }, NOW)
    expect(waiting.dueNow).toBe(false)
    expect(waiting.nextExpectedAtIso).toBeNull()
    expect(waiting.note).toContain('approve the first send')
  })
})
