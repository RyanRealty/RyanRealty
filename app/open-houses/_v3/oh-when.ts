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
