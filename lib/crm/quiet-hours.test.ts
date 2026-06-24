import { describe, it, expect } from 'vitest'
import { hourInTimeZone, inSmsQuietHours } from './quiet-hours'

// TCPA quiet hours: no SMS before 8am or at/after 9pm in the recipient's local
// time (default America/Los_Angeles). June dates → PDT (UTC-7).
describe('quiet-hours (America/Los_Angeles, PDT UTC-7)', () => {
  it('hourInTimeZone converts UTC to LA wall-clock hour', () => {
    expect(hourInTimeZone(new Date('2026-06-24T15:00:00Z'))).toBe(8) // 8am PDT
    expect(hourInTimeZone(new Date('2026-06-25T04:00:00Z'))).toBe(21) // 9pm PDT
  })

  it('blocks before 8am', () => {
    expect(inSmsQuietHours(new Date('2026-06-24T14:00:00Z'))).toBe(true) // 7am PDT
    expect(inSmsQuietHours(new Date('2026-06-24T11:30:00Z'))).toBe(true) // 4:30am PDT
  })

  it('allows the 8am to 9pm window', () => {
    expect(inSmsQuietHours(new Date('2026-06-24T15:00:00Z'))).toBe(false) // 8am PDT
    expect(inSmsQuietHours(new Date('2026-06-24T19:00:00Z'))).toBe(false) // noon PDT
    expect(inSmsQuietHours(new Date('2026-06-25T03:00:00Z'))).toBe(false) // 8pm PDT
  })

  it('blocks at/after 9pm', () => {
    expect(inSmsQuietHours(new Date('2026-06-25T04:00:00Z'))).toBe(true) // 9pm PDT
    expect(inSmsQuietHours(new Date('2026-06-25T07:00:00Z'))).toBe(true) // midnight PDT
  })

  it('honors an explicit recipient timezone (Eastern)', () => {
    // 9:30pm ET = 01:30 UTC next day → quiet in ET, but only 6:30pm PT
    const d = new Date('2026-06-25T01:30:00Z')
    expect(inSmsQuietHours(d, 'America/New_York')).toBe(true)
    expect(inSmsQuietHours(d, 'America/Los_Angeles')).toBe(false)
  })
})
