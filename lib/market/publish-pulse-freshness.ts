/**
 * One pulse freshness label for public desks, FAQ, and reporting.
 *
 * Clock-only "Updated 1:45 PM" names no calendar day. After midnight Pacific
 * that stamp can be yesterday. FAQ "as of August 2026" is a month vintage on
 * a 10-15 minute pulse row. Founding case: /cities/bend/summit-west
 * (fleet 4331f59fc7a1a74e84eacae8cceae11b).
 *
 * Calendar day is Pacific. Date-only YYYY-MM-DD stays that day (noon PT so
 * the day does not slip). Invalid/missing ISO returns null — callers omit
 * rather than invent a stamp.
 */
import { formatDate, formatDateTime, zonedDateKey } from '@/lib/format/date'

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

export function parsePulseInstant(iso: string | null | undefined): Date | null {
  if (!iso?.trim()) return null
  const trimmed = iso.trim()
  if (DATE_ONLY.test(trimmed)) {
    const noonPt = new Date(`${trimmed}T12:00:00-07:00`)
    return Number.isNaN(noonPt.getTime()) ? null : noonPt
  }
  const d = new Date(trimmed)
  return Number.isNaN(d.getTime()) ? null : d
}

/** "Aug 17, 2026, 10:20 PM" — desk + snapshot. */
export function publishPulseFreshnessLabel(iso: string | null | undefined): string | null {
  const d = parsePulseInstant(iso)
  if (!d) return null
  const label = formatDateTime(d)
  return !label || label === '—' ? null : label
}

/** "Updated Aug 17, 2026, 10:20 PM". */
export function publishPulseFreshnessStamp(iso: string | null | undefined): string | null {
  const label = publishPulseFreshnessLabel(iso)
  return label ? `Updated ${label}` : null
}

/** "August 17, 2026" — FAQ / Dataset as-of prose. */
export function publishPulseAsOfLabel(iso: string | null | undefined): string | null {
  const d = parsePulseInstant(iso)
  if (!d) return null
  const label = formatDate(d, { month: 'long', day: 'numeric', year: 'numeric' })
  return !label || label === '—' ? null : label
}

/** Pacific YYYY-MM-DD for JSON-LD dateModified. Date-only input is kept. */
export function publishPulseAsOfIso(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null
  const trimmed = iso.trim()
  if (DATE_ONLY.test(trimmed)) return trimmed
  const d = parsePulseInstant(trimmed)
  if (!d) return null
  return zonedDateKey(d) || null
}
