/**
 * Where middleware.ts sends a path before anything renders, or null when the
 * path is served as itself. The same resolvers middleware runs, in the same
 * order:
 *   1. the legacy 301 map (data/legacy-redirects.json): lower-cased, trailing
 *      slash dropped, a self-map served natively (middleware resolveLegacyRedirect);
 *   2. the pre-render hops (lib/routing/pre-render-hops.ts);
 *   3. the Bend new-construction search twin (no facet query).
 * Pure, synchronous, committed JSON only, like everything it calls.
 *
 * Anything that must know "is this URL a redirect source?" without fetching it
 * (a sitemap, a link audit, the daily crawl probe) should ask this, so it
 * cannot disagree with what a crawler is actually served. Verified 2026-09-23:
 * all 11 sitemapped paths it flagged answered 301/308 to exactly the returned
 * destination.
 *
 * Deliberately NOT a rule here: "/homes-for-sale/{city}/{neighborhood} 301s to
 * /cities/{city}/{neighborhood}". On 2026-09-23, 12 of the 13 Bend neighborhood
 * browse twins answered 200, index,follow, self-canonical; only awbrey-butte
 * redirects, through the legacy map.
 *
 * Not covered: resolveGeoCityRedirect (out-of-area city slugs to /oregon/*),
 * which is private to middleware.ts, and the rules in next.config.ts
 * redirects(), which live inside the Next config and cannot be imported into
 * a route. Some of those are in the legacy map as well (/luxury-homes-bend,
 * the retired /lp/* pages, /fsbo); a sitemapped URL that only next.config
 * redirects (/guides, /sell/plan, /motivated-sellers, ...) is caught when the
 * crawl probe samples it, because page_fetch fails every 3xx.
 */
import legacyRedirects from '@/data/legacy-redirects.json'
import { resolvePreRenderHop } from '@/lib/routing/pre-render-hops'
import { resolveBendNewConstructionSearchTwinHop } from '@/lib/routing/bend-new-construction-search-twin'

const LEGACY_REDIRECTS = legacyRedirects as Record<string, string>

export function redirectDestination(path: string): string | null {
  let p = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path
  p = p.toLowerCase()
  const legacy = LEGACY_REDIRECTS[p]
  if (legacy && legacy !== p) return legacy
  return resolvePreRenderHop(path) ?? resolveBendNewConstructionSearchTwinHop(path, new URLSearchParams())
}
