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

export function dropsTrace(place: string): string {
  return `live MLS through Oregon Data Share, asking-price cuts on active single-family homes in ${place} in the last 7 days`
}

/**
 * The alert sheet's filters: the single-family population these pages list
 * (property type A AND sub type Single Family Residence, MARKET_TRUTH D1), in
 * the saved-search grammar the alert matcher reads. Property type A alone is
 * every residential home, condos, townhomes and manufactured homes included.
 */
export const DROPS_ALERT_FILTERS: Readonly<Record<string, string>> = {
  propertyType: 'A',
  propertySubTypes: 'Single Family Residence',
}

/**
 * The window's answer when the price-cut read did not answer (§0: unknown is
 * not zero). The empty-window copy says no home cut its price; this says the
 * page could not look, so a failed read never passes for a quiet week.
 */
export function dropsUnavailable(place: string): { term: string; body: string } {
  return {
    term: "Couldn't load right now",
    body: `This week's price cuts in ${place} didn't load, so this page isn't showing a count. That's a missed read, not a quiet week.`,
  }
}

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
