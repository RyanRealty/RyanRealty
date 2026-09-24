/**
 * Homepage (and any control that names the regional inventory) must open
 * the regional set.
 *
 * Fleet finding 2026-08-17: hero "See homes" next to 1,836 homes across six
 * cities landed on Showing Bend only. The fix then was `?view=list`, because
 * the bare URL opened the split view on a Bend-bounded map.
 *
 * UXLIVE-4 (visibility audit 2026-09-22): `?view=list` carried a canonical to
 * `/homes-for-sale`, so every regional door pointed at a URL Google is told to
 * fold into another. The regional door became the clean, indexable path.
 *
 * Matt 2026-09-23: the bare `/homes-for-sale` opens as the split view on desktop
 * and the list on phones, framed on ALL of Central Oregon
 * (lib/search/search-opening.ts): the camera is CENTRAL_OREGON_BOUNDS and the
 * split view's population is the regional set, not a Bend viewport. So the
 * clean path is still the regional door, and so is any `?view=` of it with no
 * place, because no view of the bare path is Bend-bounded any more. Doors keep
 * linking the clean path; the view is client state, not a crawlable URL.
 */

export const REGIONAL_SEARCH_HREF = '/homes-for-sale' as const

export function publishRegionalSearchHref(): string {
  return REGIONAL_SEARCH_HREF
}

const REGIONAL_VIEWS: ReadonlySet<string> = new Set(['list', 'split', 'map'])

export function isRegionalSearchHref(href: string | null | undefined): boolean {
  if (!href) return false
  try {
    const url = new URL(href, 'https://ryan-realty.com')
    if (url.pathname.replace(/\/$/, '') !== '/homes-for-sale') return false
    const view = url.searchParams.get('view')
    if (view != null && !REGIONAL_VIEWS.has(view)) return false
    const city = url.searchParams.get('city')
    return city == null || city.trim() === ''
  } catch {
    return false
  }
}
