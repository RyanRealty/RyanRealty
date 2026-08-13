import { SITE_CITY_SLUGS } from '@/lib/central-oregon'

/** Cities this family links as doors. Same set the city routes pre-render. */
export const DROPS_CITY_SLUGS = SITE_CITY_SLUGS

export const DROPS_CITY_LABEL: Record<string, string> = {
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

export const DROPS_TRACE =
  'live MLS through Oregon Data Share. activity_events price_drop on active single-family listings in the Central Oregon service area. Window is the last 7 days. Drop is previous list price to current list price.'

export const DROPS_FIELD_TRACE =
  'the same 7-day price-drop pull as the count above. Rows with no street or no list price stay in the count and drop from this list, because a Field row has to name a price and an address. Sorted by drop percent, largest first.'

export function cityLabel(slug: string): string {
  return (
    DROPS_CITY_LABEL[slug] ??
    slug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  )
}

export function medianPositive(values: readonly (number | null | undefined)[]): number | null {
  const nums = values.filter((n): n is number => n != null && Number.isFinite(n) && n > 0).sort((a, b) => a - b)
  if (nums.length === 0) return null
  const mid = Math.floor(nums.length / 2)
  return nums.length % 2 === 0 ? (nums[mid - 1] + nums[mid]) / 2 : nums[mid]
}
