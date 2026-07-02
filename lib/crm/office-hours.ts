/**
 * Office-hours evaluation for inbound call routing (spec §15 / §1.5).
 *
 * Company office hours live on crm_company_settings.office_hours as
 * OfficeHoursBlock[] ({ days, start_time, end_time }). Per the FUB spec they
 * affect INBOUND calling only: when blocks are configured and the call arrives
 * outside every block, the inbound voice webhook routes to voicemail instead of
 * ringing a broker's cell. An EMPTY block list means "always open" — the
 * pre-office-hours behavior is unchanged until Matt configures hours.
 *
 * Pure function: takes the blocks, the company IANA timezone, and the instant,
 * so it unit-tests without a database or a clock.
 */

import type { OfficeHoursBlock } from '@/lib/data/crm/getCrmCompanySettings'
import { zonedDayMinutes } from '@/lib/format/date'

/** Canonical day keys stored in office_hours blocks. */
export const OFFICE_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
export type OfficeDay = (typeof OFFICE_DAYS)[number]

/** "HH:MM" (24h) -> minutes since midnight; null when malformed. */
export function parseHm(value: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? '').trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h < 0 || h > 23 || min < 0 || min > 59) return null
  return h * 60 + min
}

/** Local weekday + minutes-since-midnight for an instant in an IANA zone. */
export function localDayMinutes(now: Date, timeZone: string): { day: OfficeDay; minutes: number } {
  const { day, minutes } = zonedDayMinutes(now, timeZone)
  return { day: (day as OfficeDay) || 'Mon', minutes }
}

/**
 * True when the instant falls inside at least one configured block.
 * Empty/absent blocks = always open (returns true).
 * Malformed blocks are skipped (fail open per-block, so one bad row can't
 * silently send every call to voicemail).
 */
export function isWithinOfficeHours(
  blocks: OfficeHoursBlock[] | null | undefined,
  timeZone: string,
  now: Date,
): boolean {
  const list = Array.isArray(blocks) ? blocks : []
  if (list.length === 0) return true
  const { day, minutes } = localDayMinutes(now, timeZone || 'America/Los_Angeles')
  for (const block of list) {
    const start = parseHm(block?.start_time)
    const end = parseHm(block?.end_time)
    if (start == null || end == null || !Array.isArray(block?.days)) continue
    if (!block.days.includes(day)) continue
    if (start <= end) {
      if (minutes >= start && minutes < end) return true
    } else {
      // Overnight block (e.g. 20:00 -> 06:00) spills into the next local day.
      if (minutes >= start || minutes < end) return true
    }
  }
  return false
}
