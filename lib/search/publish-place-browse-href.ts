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
 *
 * SECOND CASE — THE DOOR THAT 301s BACK TO THE PAGE IT SITS ON (SITE-03,
 * 2026-09-08). `getPlaceLinks({ type: 'community', slug: 'tetherow' })` returns
 * `/homes-for-sale/bend/tetherow`, and that exact path is a key in
 * data/legacy-redirects.json mapping to `/communities/tetherow`. middleware.ts
 * applies the legacy map as a 301 before any route resolves, so a browse door
 * built from it takes a visitor on /communities/tetherow straight back to
 * /communities/tetherow. It is the only `/homes-for-sale/*` key among the 841
 * legacy entries, and deleting it is an SEO decision the owner makes, not a
 * repair this publisher may perform. So the publisher refuses the href instead:
 * a door that would bounce is not published, exactly as a door that would land
 * on the unfiltered regional index is not published. Callers already treat null
 * as "render no door".
 */
import legacyRedirects from '@/data/legacy-redirects.json'

const LEGACY_REDIRECTS: Record<string, string> = legacyRedirects as Record<string, string>

/**
 * True when middleware.ts would 301 this path somewhere else. Normalisation
 * matches `resolveLegacyRedirect()` exactly — lowercase, no trailing slash —
 * including its self-map guard, because a key whose destination is itself is
 * served natively and never redirected.
 */
export function redirectsAwayFromSearch(path: string): boolean {
  let p = path
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1)
  p = p.toLowerCase()
  const dest = LEGACY_REDIRECTS[p]
  return Boolean(dest) && dest !== p
}

export function isPlaceFilteredSearchHref(href: string | null | undefined): boolean {
  if (!href?.trim()) return false
  const path = href.trim().split('?')[0] ?? ''
  if (path === '/homes-for-sale' || path === '/homes-for-sale/') return false
  return path.startsWith('/homes-for-sale/')
}

/** Visitor Browse homes href, or null when the candidate is regional / on-page / redirected. */
export function publishPlaceBrowseHref(href: string | null | undefined): string | null {
  if (!isPlaceFilteredSearchHref(href)) return null
  const [path] = href!.trim().split('?')
  if (!path) return null
  if (redirectsAwayFromSearch(path)) return null
  return path
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
