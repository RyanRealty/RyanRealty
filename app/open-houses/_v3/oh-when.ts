import { publishCalendarDay } from '@/lib/listing/publish-calendar-day'

/** 24h "HH:MM:SS" or "HH:MM" to a short clock. Empty in, empty out. */
export function formatClock(raw: string | null | undefined): string {
  if (!raw) return ''
  const [hRaw, mRaw] = raw.split(':')
  const hr = Number(hRaw)
  if (!Number.isFinite(hr)) return ''
  const minutes = (mRaw ?? '00').slice(0, 2)
  const ap = hr >= 12 ? 'pm' : 'am'
  const h12 = hr % 12 === 0 ? 12 : hr % 12
  return minutes !== '00' ? `${h12}:${minutes}${ap}` : `${h12}${ap}`
}

/**
 * Sat/Sun on a stored civil day (YYYY-MM-DD). Noon UTC keeps the calendar
 * day stable; this is the weekday of the stored date, not a zoned instant.
 */
export function isWeekendIso(iso: string | null | undefined): boolean {
  const m = (iso ?? '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return false
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  const dt = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  if (Number.isNaN(dt.getTime())) return false
  if (dt.toISOString().slice(0, 10) !== `${m[1]}-${m[2]}-${m[3]}`) return false
  const dow = dt.getUTCDay()
  return dow === 0 || dow === 6
}

/**
 * Day + hours for one open house. Event dates are calendar days (YYYY-MM-DD).
 * Noon UTC keeps the Pacific calendar day the same as the stored date.
 * DATES RENDER IN PACIFIC: the KB page formatted the day with timeZone UTC.
 */
export function openHouseWhen(
  eventDate: string,
  start: string | null,
  end: string | null,
): string {
  const day = publishCalendarDay(eventDate, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  if (!/\d/.test(day)) return formatClock(start)
  const startLabel = formatClock(start)
  const endLabel = formatClock(end)
  const range =
    startLabel && endLabel ? `${startLabel}-${endLabel}` : startLabel
  return range ? `${day} · ${range}` : day
}
