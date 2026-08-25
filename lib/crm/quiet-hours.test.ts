import { describe, it, expect } from 'vitest'
import { hourInTimeZone, inSmsQuietHours } from './quiet-hours'

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
