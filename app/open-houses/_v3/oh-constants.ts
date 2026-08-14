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

export function ohTrace(place: string): string {
  return `live MLS through Oregon Data Share, open houses on active listings in ${place}, today through six days out, Pacific`
}

/** Calendar-day arithmetic on a YYYY-MM-DD key. Noon UTC keeps the date stable. */
export function addIsoDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0))
  return dt.toISOString().slice(0, 10)
}

export function pacificTodayIso(): string {
  return zonedDateKey(new Date())
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
