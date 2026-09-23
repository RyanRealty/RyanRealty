/**
 * Homepage (and any control that names the regional inventory) must open
 * the regional set.
 *
 * Fleet finding 2026-08-17: hero "See homes" next to 1,836 homes across six
 * cities landed on Showing Bend only. The fix then was `?view=list`, because
 * the bare URL opened the split view on a Bend-bounded map.
 *
 * UXLIVE-4 (visibility audit 2026-09-22): `?view=list` serves
 * `noindex, follow` with a canonical to `/homes-for-sale`, so every regional
 * door on the site pointed at a URL Google is told not to index. The bare
 * `/homes-for-sale` now DEFAULTS to the regional list (app/search/page.tsx
 * DEFAULT_VIEW), so the regional door is the clean, indexable path and the
 * view stays client state. `?view=list` still means the same set and is still
 * accepted by isRegionalSearchHref; `?view=split` / `?view=map` are the
 * Bend-camera views and are not regional doors.
 */

export const REGIONAL_SEARCH_HREF = '/homes-for-sale' as const

export function publishRegionalSearchHref(): string {
  return REGIONAL_SEARCH_HREF
}

export function isRegionalSearchHref(href: string | null | undefined): boolean {
  if (!href) return false
  try {
    const url = new URL(href, 'https://ryan-realty.com')
    if (url.pathname.replace(/\/$/, '') !== '/homes-for-sale') return false
    const view = url.searchParams.get('view')
    if (view != null && view !== 'list') return false
    const city = url.searchParams.get('city')
    return city == null || city.trim() === ''
  } catch {
    return false
  }
}
