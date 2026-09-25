import { describe, it, expect } from 'vitest'
import { hourInTimeZone, inSmsQuietHours, nextSmsWindow } from './quiet-hours'

// Quiet hours: no SMS before 8am or at/after 8PM in the recipient's local time
// (default America/Los_Angeles). Federal TCPA/TSR would allow until 9pm; Oregon
// does not, and Oregon is the only market we text — ORS 646.563(1)(b) as
// amended by HB 3865 (Oregon Laws 2025 ch. 580, effective 2026-01-01) makes a
// solicitation outside 8am-8pm an unlawful practice, and the same act put text
// messages inside the definition of "telephone solicitation".
// June dates → PDT (UTC-7).
describe('quiet-hours (America/Los_Angeles, PDT UTC-7)', () => {
  it('hourInTimeZone converts UTC to LA wall-clock hour', () => {
    expect(hourInTimeZone(new Date('2026-06-24T15:00:00Z'))).toBe(8) // 8am PDT
    expect(hourInTimeZone(new Date('2026-06-25T04:00:00Z'))).toBe(21) // 9pm PDT
  })

  it('blocks before 8am', () => {
    expect(inSmsQuietHours(new Date('2026-06-24T14:00:00Z'))).toBe(true) // 7am PDT
    expect(inSmsQuietHours(new Date('2026-06-24T11:30:00Z'))).toBe(true) // 4:30am PDT
  })

  it('allows the 8am to 8pm window', () => {
    expect(inSmsQuietHours(new Date('2026-06-24T15:00:00Z'))).toBe(false) // 8am PDT
    expect(inSmsQuietHours(new Date('2026-06-24T19:00:00Z'))).toBe(false) // noon PDT
    expect(inSmsQuietHours(new Date('2026-06-25T02:59:00Z'))).toBe(false) // 7:59pm PDT
  })

  it('blocks at/after 8pm — the Oregon window, not the federal 9pm', () => {
    // This hour is the whole point: 8-9pm PT is legal federally and unlawful
    // in Oregon. If this assertion ever flips, we are texting Oregon numbers
    // inside a prohibited hour again.
    expect(inSmsQuietHours(new Date('2026-06-25T03:00:00Z'))).toBe(true) // 8pm PDT
    expect(inSmsQuietHours(new Date('2026-06-25T04:00:00Z'))).toBe(true) // 9pm PDT
    expect(inSmsQuietHours(new Date('2026-06-25T07:00:00Z'))).toBe(true) // midnight PDT
  })

  it('honors an explicit recipient timezone (Eastern)', () => {
    // 9:30pm ET = 01:30 UTC next day → quiet in ET, but only 6:30pm PT
    const d = new Date('2026-06-25T00:30:00Z')
    expect(inSmsQuietHours(d, 'America/New_York')).toBe(true) // 8:30pm ET
    expect(inSmsQuietHours(d, 'America/Los_Angeles')).toBe(false) // 5:30pm PT
  })
})

// nextSmsWindow: a text held for quiet hours goes out the NEXT morning. From
// 8pm to midnight Pacific the UTC date has already rolled over (9pm PDT is
// 04:00Z tomorrow), so 16:05Z on that UTC date is the next morning.
describe('nextSmsWindow — the next morning, never the one after', () => {
  it('9pm PDT defers to 16:05Z the same UTC day (9:05am PDT next morning)', () => {
    // 2026-09-24 21:00 PDT
    expect(nextSmsWindow(new Date('2026-09-25T04:00:00Z')).toISOString()).toBe('2026-09-25T16:05:00.000Z')
  })

  it('11:30pm PDT defers to the next morning', () => {
    // 2026-09-24 23:30 PDT
    expect(nextSmsWindow(new Date('2026-09-25T06:30:00Z')).toISOString()).toBe('2026-09-25T16:05:00.000Z')
  })

  it('8pm PST in winter defers to 8:05am PST the next morning', () => {
    // 2026-12-10 20:00 PST
    expect(nextSmsWindow(new Date('2026-12-11T04:00:00Z')).toISOString()).toBe('2026-12-11T16:05:00.000Z')
  })

  it('pre-dawn keeps the same morning (same UTC day)', () => {
    // 2026-09-25 02:00 PDT → 9:05am PDT the same day
    expect(nextSmsWindow(new Date('2026-09-25T09:00:00Z')).toISOString()).toBe('2026-09-25T16:05:00.000Z')
    // 2026-12-10 07:30 PST → 8:05am PST the same day
    expect(nextSmsWindow(new Date('2026-12-10T15:30:00Z')).toISOString()).toBe('2026-12-10T16:05:00.000Z')
  })

  it('the fall-back eve lands on 8:05am PST the next morning', () => {
    // 2026-10-31 22:00 PDT; clocks fall back at 2am, 16:05Z is 8:05am PST
    expect(nextSmsWindow(new Date('2026-11-01T05:00:00Z')).toISOString()).toBe('2026-11-01T16:05:00.000Z')
  })

  it('every quiet quarter-hour resolves inside the window, within one night', () => {
    // A summer night, a winter night, and both DST changeover nights. The
    // longest honest wait is 8pm PDT to 8:05am PST across the fall-back night
    // (13h05m); the day-late bug waited 37h05m.
    const nights = ['2026-06-24T20:00:00-07:00', '2026-12-10T20:00:00-08:00', '2026-03-07T20:00:00-08:00', '2026-10-31T20:00:00-07:00']
    for (const start of nights) {
      for (let t = Date.parse(start); ; t += 15 * 60_000) {
        const now = new Date(t)
        if (!inSmsQuietHours(now)) break
        const next = nextSmsWindow(now)
        expect(next.getTime(), now.toISOString()).toBeGreaterThan(now.getTime())
        expect(next.getTime() - now.getTime(), now.toISOString()).toBeLessThanOrEqual((13 * 60 + 5) * 60_000)
        expect(inSmsQuietHours(next), now.toISOString()).toBe(false)
      }
    }
  })
})
