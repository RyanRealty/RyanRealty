/**
 * Recipient time zones for SMS quiet hours (Matt 2026-10-04, "Both zones").
 *
 * A text goes out only while it is 8am to the 7:55pm pause in Pacific AND in
 * every zone the recipient's number sits in. Before this, every send was timed
 * on Pacific alone, so a lead with a 212 number could get a 7:43pm sequence
 * text at 10:43pm New York time.
 *
 * The zone comes from the number's NANP prefix (lib/crm/nanp-timezones.generated.ts,
 * libphonenumber's table, longest prefix wins: 541 is Pacific, but the
 * 541-372 exchange in Ontario, Oregon is Mountain). A ported number keeps its
 * area code wherever the person lives, which is why the rule checks BOTH
 * zones: a wrong guess can only narrow the window, never open a quiet hour in
 * either place. A number the table does not know, or one outside +1, falls
 * back to Pacific alone, the rule before 2026-10-04.
 *
 * Server only: the table is ~2,000 rows. A client composer gets a recipient's
 * zones from the server (recipientTimeZones) and runs the pure rule in
 * lib/crm/quiet-hours.ts on them.
 */

import 'server-only'
import { NANP_PREFIX_TIMEZONES } from './nanp-timezones.generated'
import {
  nextSmsWindow,
  quietSmsZone,
  smsSendZones,
  smsWindowCloseAt,
} from './quiet-hours'

/** Longest prefix in the table, so a lookup never walks past it. */
const MAX_PREFIX_LENGTH = Object.keys(NANP_PREFIX_TIMEZONES).reduce((n, k) => Math.max(n, k.length), 0)

/** '1' + ten digits for a NANP number in any common written form, else null. */
export function nanpDigits(phone: string | null | undefined): string | null {
  const digits = String(phone ?? '').replace(/\D/g, '')
  if (digits.length === 10) return `1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return digits
  return null
}

/**
 * The IANA zones the number's prefix sits in, longest prefix first; [] when
 * the table does not know it. An exchange that spans zones returns all of them.
 */
export function recipientTimeZones(phone: string | null | undefined): string[] {
  const digits = nanpDigits(phone)
  if (!digits) return []
  for (let len = Math.min(digits.length, MAX_PREFIX_LENGTH); len >= 2; len--) {
    const zones = NANP_PREFIX_TIMEZONES[digits.slice(0, len)]
    if (zones) return zones.split('&')
  }
  return []
}

/** The zone (Pacific first) that holds a text to `phone` right now, or null when every zone is open. */
export function smsQuietZoneFor(phone: string | null | undefined, date: Date = new Date()): string | null {
  return quietSmsZone(recipientTimeZones(phone), date)
}

/** True when a text to `phone` must wait: quiet in Pacific or in the number's own zone. */
export function inSmsQuietHoursFor(phone: string | null | undefined, date: Date = new Date()): boolean {
  return smsQuietZoneFor(phone, date) !== null
}

/**
 * The earliest 8pm across Pacific and the number's zones: the ValidityPeriod
 * bound for a text to `phone`, so Twilio drops it rather than deliver it
 * after 8pm anywhere it could land. Meaningful while every zone is open.
 */
export function smsWindowCloseAtFor(phone: string | null | undefined, date: Date = new Date()): Date {
  const closes = smsSendZones(recipientTimeZones(phone)).map((tz) => smsWindowCloseAt(date, tz).getTime())
  return new Date(Math.min(...closes))
}

const STEP_MS = 5 * 60_000
const HORIZON_MS = 48 * 3_600_000

/**
 * When a held text to `phone` may next go: the market's next-morning marker
 * (nextSmsWindow), moved later in 5-minute steps until the number's own zone
 * is open too. A Pacific number gets the marker unchanged. Every NANP zone
 * shares hours with Pacific, so the 48-hour scan always lands; if it ever did
 * not, the marker is returned and the send-time check holds the text again.
 */
export function nextSmsWindowFor(phone: string | null | undefined, now: Date = new Date()): Date {
  const marker = nextSmsWindow(now)
  const zones = recipientTimeZones(phone)
  if (smsSendZones(zones).length === 1) return marker
  const end = marker.getTime() + HORIZON_MS
  for (let t = marker.getTime(); t <= end; t += STEP_MS) {
    const at = new Date(t)
    if (quietSmsZone(zones, at) === null) return at
  }
  return marker
}
