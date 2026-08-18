/**
 * Place/plat "Browse homes" href.
 *
 * A place page that names a city, neighborhood, community, plat, or ZIP must
 * keep that filter on the map Browse homes door. Regional
 * `publishRegionalSearchHref()` (`/homes-for-sale?view=list`) is the homepage
 * inventory door, not a place-page exit.
 *
 * Founding case: /subdivisions/ridge-at-eagle-crest (12 homes, Redmond)
 * Browse homes landed on /homes-for-sale with no plat chip
 * (fleet 70b9cdad41fa4d875ca6b5997a1bab5a).
 */

export function isPlaceFilteredSearchHref(href: string | null | undefined): boolean {
  if (!href?.trim()) return false
  const path = href.trim().split('?')[0] ?? ''
  if (path === '/homes-for-sale' || path === '/homes-for-sale/') return false
  return path.startsWith('/homes-for-sale/')
}

/** Visitor Browse homes href, or null when the candidate is regional / on-page. */
export function publishPlaceBrowseHref(href: string | null | undefined): string | null {
  if (!isPlaceFilteredSearchHref(href)) return null
  const [path] = href!.trim().split('?')
  return path ?? null
}

/** Place-page hero CTA. Null hides the button instead of falling back to regional inventory. */
export function publishPlaceHeroCta(
  href: string | null | undefined,
  label: string,
): { href: string; label: string } | null {
  const published = publishPlaceBrowseHref(href)
  if (!published) return null
  return { href: published, label }
}
