/**
 * Homepage (and any control that names the regional inventory) must open
 * the regional set. Split/map `/homes-for-sale` injects city=Bend when the
 * URL has no city (map start viewport). List view does not.
 *
 * Fleet finding 2026-08-17: hero "See homes" next to 1,836 homes across six
 * cities landed on Showing Bend only.
 */

export const REGIONAL_SEARCH_HREF = '/homes-for-sale?view=list' as const

export function publishRegionalSearchHref(): string {
  return REGIONAL_SEARCH_HREF
}

export function isRegionalSearchHref(href: string | null | undefined): boolean {
  if (!href) return false
  try {
    const url = new URL(href, 'https://ryan-realty.com')
    if (url.pathname !== '/homes-for-sale') return false
    if (url.searchParams.get('view') !== 'list') return false
    const city = url.searchParams.get('city')
    return city == null || city.trim() === ''
  } catch {
    return false
  }
}
