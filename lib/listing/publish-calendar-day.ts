import { formatCalendarDay } from '@/lib/format/date'

/**
 * One published calendar day for MLS date-only fields.
 *
 * `listings.OpenHouses[].Date` and `publishListingHistory` event_date are
 * civil days (YYYY-MM-DD), not instants. `new Date('2026-08-18')` is
 * 00:00Z, which is the prior evening in America/Los_Angeles. Listing
 * detail Open houses then printed Monday, Aug 17 for a Tuesday open
 * house.
 *
 * Founding case (fleet:e100e9e1a244369ec0d5b7aee1ce11a6):
 *   21357 Kilimanjaro (220222798) stored 08/18, 08/19, 08/20 and
 *   rendered Aug 17, Aug 18, Aug 19.
 *
 * Do not invent a day. Empty in, empty out.
 */

export function publishCalendarDay(
  eventDate: string | null | undefined,
  opts?: Intl.DateTimeFormatOptions,
): string {
  return formatCalendarDay(eventDate, opts)
}

export function publishOpenHouseDay(eventDate: string | null | undefined): string {
  return publishCalendarDay(eventDate, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: undefined,
  })
}

export function publishHistoryDay(eventDate: string | null | undefined): string {
  return publishCalendarDay(eventDate, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
