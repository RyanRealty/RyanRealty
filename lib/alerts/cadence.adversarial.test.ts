import { describe, it, expect } from 'vitest'
import { isCadenceDue, normalizeScheduleDays, localDayOfWeek } from '@/lib/saved-search-cadence'

/**
 * ADVERSARIAL audit of the weekly schedule_days cadence shipped in deed9e4b.
 * The alert cron runs HOURLY ("0 * * * *", vercel.json), so every UTC hour of
 * every America/Los_Angeles day gets a tick — the day filter has to do all the
 * gating by itself.
 */

const LA = 'America/Los_Angeles'

/** Every hourly cron tick across a span, as UTC Dates. */
function hourlyTicks(fromIso: string, hours: number): Date[] {
  const start = Date.parse(fromIso)
  return Array.from({ length: hours }, (_, i) => new Date(start + i * 3600_000))
}

/**
 * Replay the engine against the hourly cron for `hours`, mutating
 * last_notified_at exactly as runListingAlerts does (EVERY due row advances the
 * cursor, whether it sends or skips). Returns the local days it fired on.
 */
function replay(alert: { notification_frequency: string; schedule_days?: unknown }, fromIso: string, hours: number) {
  let lastNotifiedAt: string | null = null
  const fired: string[] = []
  for (const now of hourlyTicks(fromIso, hours)) {
    if (isCadenceDue({ ...alert, last_notified_at: lastNotifiedAt }, now)) {
      fired.push(
        // hourCycle 'h23' pins midnight to '00'. `hour12: false` alone is
        // ICU-version-dependent for the midnight hour — older ICU renders it on
        // the h24 clock as '24', newer ICU (Node 22+) as '00' — so this
        // assertion passed or failed purely on the Node the suite happened to
        // run under, with no code change involved.
        `${new Intl.DateTimeFormat('en-CA', { timeZone: LA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)} ${new Intl.DateTimeFormat('en-US', { timeZone: LA, weekday: 'short' }).format(now)} ${new Intl.DateTimeFormat('en-US', { timeZone: LA, hour: '2-digit', hourCycle: 'h23' }).format(now)}`,
      )
      lastNotifiedAt = now.toISOString()
    }
  }
  return fired
}

describe('H5 weekly schedule_days', () => {
  it('a Monday-only weekly alert fires exactly once a week, on Monday', () => {
    // 2026-08-01 is a Saturday. 21 days of hourly ticks = 3 Mondays.
    const fired = replay(
      { notification_frequency: 'weekly', schedule_days: [1] },
      '2026-08-01T07:00:00Z',
      21 * 24,
    )
    expect(fired).toHaveLength(3)
    expect(fired.every((f) => f.includes('Mon'))).toBe(true)
    // Fires on the FIRST tick of the local Monday (00:00 PDT = 07:00 UTC).
    expect(fired[0].slice(15)).toBe('00')
    expect(fired.map((f) => f.slice(0, 10))).toEqual(['2026-08-03', '2026-08-10', '2026-08-17'])
  })

  it('a Mon+Thu schedule fires twice a week — the 7-day interval does NOT also apply', () => {
    const fired = replay(
      { notification_frequency: 'weekly', schedule_days: [1, 4] },
      '2026-08-01T07:00:00Z',
      14 * 24,
    )
    expect(fired.map((f) => f.slice(11, 14))).toEqual(['Mon', 'Thu', 'Mon', 'Thu'])
  })

  it('FOOT-GUN: schedule_days with all 7 days turns a WEEKLY alert into a DAILY one', () => {
    const fired = replay(
      { notification_frequency: 'weekly', schedule_days: [0, 1, 2, 3, 4, 5, 6] },
      '2026-08-01T07:00:00Z',
      14 * 24,
    )
    // 14 sends in 14 days from a subscription labeled "Once a week".
    expect(fired).toHaveLength(14)
  })

  it('schedule_days is IGNORED for every non-weekly cadence', () => {
    for (const cadence of ['daily', 'instant', 'monthly']) {
      const fired = replay({ notification_frequency: cadence, schedule_days: [1] }, '2026-08-01T07:00:00Z', 7 * 24)
      expect(fired.every((f) => f.includes('Mon'))).toBe(false)
    }
  })

  it('never double-fires across the UTC midnight that sits mid-Pacific-day', () => {
    // 2026-08-03 17:00 PDT = 2026-08-04 00:00 UTC. A UTC-day-based comparison
    // would treat the following hour as a new day and re-fire.
    const fired = replay(
      { notification_frequency: 'weekly', schedule_days: [1] },
      '2026-08-03T07:00:00Z',
      36,
    )
    expect(fired).toHaveLength(1)
  })

  it('honors the Pacific day across the DST fall-back weekend', () => {
    // DST ends 2026-11-01 (Sunday). Sun+Mon schedule over that weekend.
    const fired = replay(
      { notification_frequency: 'weekly', schedule_days: [0, 1] },
      '2026-10-30T07:00:00Z',
      6 * 24,
    )
    expect(fired.map((f) => f.slice(0, 14))).toEqual(['2026-11-01 Sun', '2026-11-02 Mon'])
  })

  it('localDayOfWeek reads Pacific, not UTC', () => {
    // 2026-08-03T05:00Z is Monday in UTC but still Sunday 22:00 in Bend.
    expect(localDayOfWeek(new Date('2026-08-03T05:00:00Z'), LA)).toBe(0)
    expect(new Date('2026-08-03T05:00:00Z').getUTCDay()).toBe(1)
  })
})

describe('H5 normalizeScheduleDays hostile inputs', () => {
  it('null / empty / garbage all mean "no restriction"', () => {
    for (const raw of [null, undefined, [], 'mon', 3, {}, [null, 'x', 9, -1, 1.5]]) {
      expect(normalizeScheduleDays(raw)).toBe(null)
    }
  })

  it('dedupes and sorts valid days', () => {
    expect(normalizeScheduleDays([4, 1, 1, 0])).toEqual([0, 1, 4])
  })

  it('a garbage schedule_days value falls back to the plain 7-day interval, never to silence', () => {
    const fired = replay({ notification_frequency: 'weekly', schedule_days: 'nope' }, '2026-08-01T07:00:00Z', 21 * 24)
    expect(fired.length).toBeGreaterThanOrEqual(3)
  })
})

describe('H5 base cadence regressions', () => {
  it('an unknown stored frequency falls back to daily, never to instant', () => {
    const fired = replay({ notification_frequency: 'hourly' }, '2026-08-01T07:00:00Z', 7 * 24)
    expect(fired).toHaveLength(7)
  })

  it('a corrupt last_notified_at makes the row due rather than permanently silent', () => {
    expect(isCadenceDue({ notification_frequency: 'weekly', last_notified_at: 'not-a-date' }, new Date())).toBe(true)
    expect(
      isCadenceDue(
        { notification_frequency: 'weekly', last_notified_at: 'not-a-date', schedule_days: [1] },
        new Date('2026-08-03T18:00:00Z'),
      ),
    ).toBe(true)
  })

  it('instant honors the 55-minute floor against an hourly cron', () => {
    const fired = replay({ notification_frequency: 'instant' }, '2026-08-01T07:00:00Z', 24)
    expect(fired).toHaveLength(24)
  })

  it('monthly is 30 days, not a calendar month', () => {
    const fired = replay({ notification_frequency: 'monthly' }, '2026-08-01T07:00:00Z', 62 * 24)
    expect(fired).toHaveLength(3)
  })
})
