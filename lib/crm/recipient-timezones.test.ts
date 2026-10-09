import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/crm/suppressions', () => ({ isSuppressed: vi.fn() }))
vi.mock('@/lib/data/crm/recordSendBlockEvent', () => ({ recordSendBlockEvent: vi.fn() }))

import {
  inSmsQuietHoursFor,
  nanpDigits,
  nextMorningSmsWindowFor,
  nextSmsWindowFor,
  recipientTimeZones,
  smsQuietZoneFor,
  smsWindowCloseAtFor,
} from './recipient-timezones'
import { NANP_PREFIX_TIMEZONES, NANP_TIMEZONE_SOURCE } from './nanp-timezones.generated'
import { nextSmsWindow, quietSmsZone, smsSendZones } from './quiet-hours'
import { QUIET_HOURS_ERROR, quietHoursRefusal } from '@/lib/comms/guards'

/**
 * Matt 2026-10-04, "Both zones": a text sends only while it is 8am to the
 * 7:55pm pause in Pacific AND in every zone the recipient's number sits in.
 * Instants are UTC; the comment beside each gives the clocks that matter.
 */

const BEND = '+1 (541) 555-0134'
const ONTARIO_OR = '541-372-0100' // Ontario, Oregon: Mountain time inside the 541 area code
const NEW_YORK = '212.555.0100'
const HONOLULU = '808 555 0100'
const GUAM = '+16715550100'
const UNKNOWN = '+1 555 555 0100' // 555 is no area code in the table

describe('the area-code table', () => {
  it('is libphonenumber, pinned, and leaves out the bare +1 row', () => {
    expect(NANP_TIMEZONE_SOURCE).toMatch(/^libphonenumber [0-9a-f]{12} /)
    expect(NANP_PREFIX_TIMEZONES['1']).toBeUndefined()
    expect(Object.keys(NANP_PREFIX_TIMEZONES).length).toBeGreaterThan(1500)
    for (const zones of Object.values(NANP_PREFIX_TIMEZONES)) {
      for (const tz of zones.split('&')) {
        // Every zone is a real IANA zone this runtime knows.
        expect(() => new Intl.DateTimeFormat('en-US', { timeZone: tz })).not.toThrow()
      }
    }
  })
})

describe('recipientTimeZones', () => {
  it('reads a number in any written form, longest prefix first', () => {
    expect(nanpDigits(BEND)).toBe('15415550134')
    expect(nanpDigits('5415550134')).toBe('15415550134')
    expect(recipientTimeZones(BEND)).toEqual(['America/Los_Angeles'])
    expect(recipientTimeZones(ONTARIO_OR)).toEqual(['America/Denver'])
    expect(recipientTimeZones(NEW_YORK)).toEqual(['America/New_York'])
    expect(recipientTimeZones(HONOLULU)).toEqual(['Pacific/Honolulu'])
  })

  it('returns every zone of an exchange that spans two', () => {
    expect(recipientTimeZones('+1 208 299 0100')).toEqual(['America/Boise', 'America/Los_Angeles'])
  })

  it('knows nothing about a number outside +1 or an area code it lacks', () => {
    expect(recipientTimeZones(UNKNOWN)).toEqual([])
    expect(recipientTimeZones('+44 20 7946 0958')).toEqual([])
    expect(recipientTimeZones('')).toEqual([])
    expect(recipientTimeZones(null)).toEqual([])
  })
})

describe('smsQuietZoneFor: Pacific first, then the number', () => {
  it('holds a New York number at 5:30pm Pacific (8:30pm there), not a Bend one', () => {
    const at = new Date('2026-06-25T00:30:00Z') // 5:30pm PDT, 8:30pm EDT
    expect(smsQuietZoneFor(NEW_YORK, at)).toBe('America/New_York')
    expect(smsQuietZoneFor(BEND, at)).toBeNull()
    expect(inSmsQuietHoursFor(UNKNOWN, at)).toBe(false)
  })

  it('holds a Honolulu number at 9:30am Pacific (6:30am there)', () => {
    const summer = new Date('2026-06-24T16:30:00Z') // 9:30am PDT, 6:30am HST
    expect(smsQuietZoneFor(HONOLULU, summer)).toBe('Pacific/Honolulu')
    expect(smsQuietZoneFor(HONOLULU, new Date('2026-06-24T18:00:00Z'))).toBeNull() // 11am PDT, 8am HST
    // Winter: Pacific moves an hour closer, Hawaii keeps no daylight time.
    expect(smsQuietZoneFor(HONOLULU, new Date('2026-01-15T17:00:00Z'))).toBe('Pacific/Honolulu') // 9am PST, 7am HST
    expect(smsQuietZoneFor(HONOLULU, new Date('2026-01-15T18:00:00Z'))).toBeNull() // 10am PST, 8am HST
  })

  it('holds the Ontario, Oregon exchange on Mountain time inside 541', () => {
    const at = new Date('2026-06-24T14:30:00Z') // 7:30am PDT (Pacific quiet anyway)
    expect(smsQuietZoneFor(ONTARIO_OR, at)).toBe('America/Los_Angeles')
    const evening = new Date('2026-06-25T02:00:00Z') // 7:00pm PDT, 8:00pm MDT
    expect(smsQuietZoneFor(ONTARIO_OR, evening)).toBe('America/Denver')
    expect(smsQuietZoneFor(BEND, evening)).toBeNull()
  })

  it('reports Pacific when Pacific is closed, whatever the number', () => {
    const at = new Date('2026-06-25T03:00:00Z') // 8:00pm PDT
    for (const phone of [BEND, NEW_YORK, HONOLULU, UNKNOWN]) {
      expect(smsQuietZoneFor(phone, at)).toBe('America/Los_Angeles')
    }
  })

  it('is the pure rule a client composer runs on server-supplied zones', () => {
    const at = new Date('2026-06-25T00:30:00Z')
    expect(quietSmsZone(recipientTimeZones(NEW_YORK), at)).toBe(smsQuietZoneFor(NEW_YORK, at))
    expect(smsSendZones(['America/Los_Angeles', 'America/New_York'])).toEqual(['America/Los_Angeles', 'America/New_York'])
  })
})

describe('smsWindowCloseAtFor: the earliest 8pm', () => {
  it('bounds a New York text at 8pm Eastern, a Bend text at 8pm Pacific', () => {
    const at = new Date('2026-06-24T16:30:00Z') // 9:30am PDT, 12:30pm EDT
    expect(smsWindowCloseAtFor(NEW_YORK, at).toISOString()).toBe('2026-06-25T00:00:00.000Z')
    expect(smsWindowCloseAtFor(BEND, at).toISOString()).toBe('2026-06-25T03:00:00.000Z')
    expect(smsWindowCloseAtFor(UNKNOWN, at).toISOString()).toBe('2026-06-25T03:00:00.000Z')
  })

  it('keeps Pacific 8pm for a Honolulu text, which closes later there', () => {
    const at = new Date('2026-06-24T19:00:00Z') // noon PDT, 9am HST
    expect(smsWindowCloseAtFor(HONOLULU, at).toISOString()).toBe('2026-06-25T03:00:00.000Z')
  })
})

describe('nextSmsWindowFor', () => {
  it('leaves a Pacific or unknown number on the market marker', () => {
    const at = new Date('2026-06-25T03:30:00Z') // 8:30pm PDT
    expect(nextSmsWindowFor(BEND, at)).toEqual(nextSmsWindow(at))
    expect(nextSmsWindowFor(UNKNOWN, at)).toEqual(nextSmsWindow(at))
    expect(nextSmsWindow(at).toISOString()).toBe('2026-06-25T16:05:00.000Z')
  })

  it('sends a New York text held in its evening at 8am Pacific, when both are open', () => {
    const at = new Date('2026-06-25T00:30:00Z') // 5:30pm PDT, 8:30pm EDT
    expect(nextSmsWindowFor(NEW_YORK, at).toISOString()).toBe('2026-06-25T15:00:00.000Z') // 8am PDT, 11am EDT
  })

  it('waits for the number to open, the same day when it opens later today', () => {
    const night = new Date('2026-06-25T03:30:00Z') // 8:30pm PDT
    expect(nextSmsWindowFor(HONOLULU, night).toISOString()).toBe('2026-06-25T18:00:00.000Z') // 8am HST, 11am PDT
    expect(nextSmsWindowFor(GUAM, night).toISOString()).toBe('2026-06-25T22:00:00.000Z') // 8am ChST, 3pm PDT
    // Held mid-morning Pacific, past the market marker: still today, not tomorrow
    // (code review 2026-10-04: this used to wait 25.8 hours).
    const morning = new Date('2026-06-25T16:10:00Z') // 9:10am PDT, 6:10am HST
    expect(nextSmsWindowFor(HONOLULU, morning).toISOString()).toBe('2026-06-25T18:00:00.000Z')
    for (const [phone, at] of [[HONOLULU, night], [GUAM, night], [HONOLULU, morning], [NEW_YORK, night]] as const) {
      const next = nextSmsWindowFor(phone, at)
      expect(inSmsQuietHoursFor(phone, next)).toBe(false)
      expect(next.getTime()).toBeGreaterThan(at.getTime())
    }
  })
})

describe('nextMorningSmsWindowFor (a daily-cap hold)', () => {
  it('is the next market morning, later if the number is still closed then', () => {
    const open = new Date('2026-06-25T17:00:00Z') // 10am PDT, 1pm EDT, 7am HST: cap hit, not quiet
    expect(nextMorningSmsWindowFor(BEND, open).toISOString()).toBe('2026-06-26T16:05:00.000Z')
    expect(nextMorningSmsWindowFor(NEW_YORK, open).toISOString()).toBe('2026-06-26T16:05:00.000Z')
    expect(nextMorningSmsWindowFor(HONOLULU, open).toISOString()).toBe('2026-06-26T18:00:00.000Z')
  })
})

describe('quietHoursRefusal: the copy a broker sees', () => {
  it('keeps the Pacific refusal word for word', () => {
    expect(quietHoursRefusal(NEW_YORK, new Date('2026-06-25T03:00:00Z'))).toBe(QUIET_HOURS_ERROR)
    expect(quietHoursRefusal(undefined, new Date('2026-06-25T03:00:00Z'))).toBe(QUIET_HOURS_ERROR)
  })

  it('names the number’s own clock when only its zone is closed', () => {
    const refusal = quietHoursRefusal(NEW_YORK, new Date('2026-06-25T00:30:00Z'))
    expect(refusal).toContain('it is 8:30pm EDT in its area code')
    expect(refusal).toContain('send anyway')
    expect(refusal).not.toMatch(/—/)
  })

  it('says when to try again where nobody can override (an intro, a template test)', () => {
    const pacific = quietHoursRefusal(BEND, new Date('2026-06-25T03:00:00Z'), { canOverride: false })
    expect(pacific).toContain('Try again after 8am')
    const zone = quietHoursRefusal(NEW_YORK, new Date('2026-06-25T00:30:00Z'), { canOverride: false })
    expect(zone).toContain('Try again once it is 8am there')
    expect(zone).not.toContain('send anyway')
  })

  it('returns null while every zone is open', () => {
    expect(quietHoursRefusal(NEW_YORK, new Date('2026-06-24T16:30:00Z'))).toBeNull()
    expect(quietHoursRefusal(BEND, new Date('2026-06-25T00:30:00Z'))).toBeNull()
  })
})
