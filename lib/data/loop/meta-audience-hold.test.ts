import { describe, expect, it } from 'vitest'
import {
  computeAudienceHold,
  META_AUDIENCE_HOLD_DAYS,
  META_AUDIENCE_HOLD_END,
  utcDay,
} from './meta-audience-hold'

const NOW = new Date('2026-08-16T10:20:00Z')

function days(start: string, n: number, hour = '09:00:00Z') {
  const t0 = Date.parse(`${start}T${hour}`)
  return Array.from({ length: n }, (_, i) => ({
    ran_at: new Date(t0 + i * 86_400_000).toISOString(),
    audience_id: '120246504502300698',
    dry_run: false,
  }))
}

describe('utcDay', () => {
  it('uses the UTC calendar day', () => {
    expect(utcDay('2026-08-16T09:01:26.588079+00:00')).toBe('2026-08-16')
    expect(utcDay('2026-08-16T00:00:00-07:00')).toBe('2026-08-16')
  })
})

describe('computeAudienceHold', () => {
  it('counts consecutive UTC days from the newest day backward', () => {
    const hold = computeAudienceHold(days('2026-08-10', 7), NOW)
    expect(hold.status).toBe('ok')
    expect(hold.consecutiveDays).toBe(7)
    expect(hold.lastDay).toBe('2026-08-16')
    expect(hold.current).toBe(true)
    expect(hold.holdMet).toBe(false)
  })

  it('breaks the streak on a missing day', () => {
    const rows = [...days('2026-08-10', 3), ...days('2026-08-14', 3)]
    const hold = computeAudienceHold(rows, NOW)
    expect(hold.consecutiveDays).toBe(3)
    expect(hold.lastDay).toBe('2026-08-16')
    expect(hold.holdMet).toBe(false)
  })

  it('meets the hold only when 7 consecutive days end on or after 2026-08-22', () => {
    const early = computeAudienceHold(days('2026-08-10', 7), NOW)
    expect(early.consecutiveDays).toBe(META_AUDIENCE_HOLD_DAYS)
    expect(early.holdMet).toBe(false)
    const onEnd = computeAudienceHold(days('2026-08-16', 7), new Date('2026-08-22T15:00:00Z'))
    expect(onEnd.lastDay).toBe(META_AUDIENCE_HOLD_END)
    expect(onEnd.consecutiveDays).toBe(7)
    expect(onEnd.holdMet).toBe(true)
  })

  it('is not current when the newest run is older than 36h', () => {
    const hold = computeAudienceHold(days('2026-08-10', 1), NOW)
    expect(hold.lastDay).toBe('2026-08-10')
    expect(hold.current).toBe(false)
  })

  it('empty ledger is unread-ok with zero days', () => {
    const hold = computeAudienceHold([], NOW)
    expect(hold.consecutiveDays).toBe(0)
    expect(hold.holdMet).toBe(false)
    expect(hold.current).toBe(false)
    expect(hold.lastRanAt).toBeNull()
  })
})
