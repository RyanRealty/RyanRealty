import { SITE_CITY_SLUGS } from '@/lib/central-oregon'
import { zonedDateKey } from '@/lib/format/date'

/** Cities this family links as doors. Same set the city routes pre-render. */
export const OH_CITY_SLUGS = SITE_CITY_SLUGS

export const OH_CITY_LABEL: Record<string, string> = {
  bend: 'Bend',
  redmond: 'Redmond',
  sisters: 'Sisters',
  sunriver: 'Sunriver',
  'la-pine': 'La Pine',
  madras: 'Madras',
  prineville: 'Prineville',
  culver: 'Culver',
  terrebonne: 'Terrebonne',
  'powell-butte': 'Powell Butte',
}

export const OH_TRACE =
  'live MLS through Oregon Data Share. OpenHouses on active listings in the Central Oregon service area. Window is today through six days out, Pacific. One soonest open house per listing.'

export const OH_FIELD_TRACE =
  'the same OpenHouses pull as the count above. Rows with no street or no list price stay off this list, because a Field row has to name a price and an address.'

/** Calendar-day arithmetic on a YYYY-MM-DD key. Noon UTC keeps the date stable. */
export function addIsoDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0))
  return dt.toISOString().slice(0, 10)
}

export function pacificTodayIso(): string {
  return zonedDateKey(new Date())
}

/** Saturday-Sunday of the current Pacific weekend, including a Sunday that is today. */
export function thisWeekendIso(todayIso: string): { dateFrom: string; dateTo: string } {
  const [year, month, day] = todayIso.split('-').map(Number)
  const dt = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  const dow = dt.getUTCDay()
  if (dow === 0) {
    return { dateFrom: addIsoDays(todayIso, -1), dateTo: todayIso }
  }
  if (dow === 6) {
    return { dateFrom: todayIso, dateTo: addIsoDays(todayIso, 1) }
  }
  const toSaturday = 6 - dow
  return {
    dateFrom: addIsoDays(todayIso, toSaturday),
    dateTo: addIsoDays(todayIso, toSaturday + 1),
  }
}

export function cityLabel(slug: string): string {
  return (
    OH_CITY_LABEL[slug] ??
    slug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  )
}
