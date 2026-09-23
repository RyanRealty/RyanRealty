/**
 * Sitemap runtime guard — the OUTPUT-based backstop for the 2026-07-21 drift
 * class (a rogue /cities/{city}/{subdivision} family shipped to Google, 404ing).
 *
 * Static text gates (ci:sitemap-resolvable) can pin the KNOWN emission syntax,
 * but they cannot enumerate every way a URL string can be built — a rogue
 * 2-segment /cities URL constructed via string concatenation, Array.join('/'),
 * or an aliased baseUrl evades any source-text regex. This guard inspects the
 * FINAL emitted URL STRINGS instead, so it is immune to construction syntax:
 * however a /cities/{a}/{b} URL was built, if {b} is not a sanctioned
 * neighborhood slug it is dropped before the sitemap is served.
 *
 * The /cities/[slug]/[neighborhoodSlug] route resolves ONLY neighborhoods-table
 * slugs; any other second segment 404s. One-segment /cities/{city} hubs and
 * deeper paths are untouched. Dropping (not throwing) keeps sitemap generation
 * resilient — a drift bug degrades to "URL silently omitted", never a 500 or a
 * submitted 404.
 */

import legacyRedirects from '@/data/legacy-redirects.json'

/** Exactly two path segments under /cities (trailing slash already stripped). */
const TWO_SEGMENT_CITIES = /^\/cities\/[^/]+\/[^/]+$/

/** Exactly two path segments under /homes-for-sale: the subdivision browse family. */
const TWO_SEGMENT_BROWSE = /^\/homes-for-sale\/([^/]+)\/([^/]+)$/

/**
 * Every path next.config.ts permanently redirects (built from
 * data/legacy-redirects.json). A sitemap must never submit a redirect source:
 * Google reports it as "Page with redirect", the URL earns nothing, and on
 * 2026-09-22 core.xml carried /luxury-homes-bend (308 to a query URL the site
 * noindexes) while content.xml still listed a blog slug that had been 301'd
 * onto /communities/tetherow the same morning (visibility audit, EXP-10 /
 * COMP-1).
 */
const REDIRECT_SOURCES: ReadonlySet<string> = new Set(
  Object.entries(legacyRedirects as Record<string, string>)
    // The map also carries identity rows ("/contact": "/contact") that the
    // redirect builder skips; a path that maps to itself is a live page.
    .filter(([source, destination]) => source.replace(/\/$/, '') !== String(destination).replace(/\/$/, ''))
    .map(([source]) => source.replace(/\/$/, '')),
)

function pathOf(url: string): string | null {
  try {
    return new URL(String(url ?? ''), NORMALIZE_BASE).pathname.replace(/\/$/, '')
  } catch {
    return null
  }
}

/**
 * The final pass over every entry the sitemap emits (visibility audit
 * 2026-09-22). In order:
 *   1. filterRogueCityUrls — the 2026-07-21 drift class (rogue /cities/{a}/{b}).
 *   2. Drop the browse twin of every sanctioned neighborhood:
 *      /homes-for-sale/{city}/{slug} 301s to /cities/{city}/{slug} when the
 *      slug is a neighborhood (next.config), so submitting it is a redirect.
 *   3. Drop every path that next.config permanently redirects (legacy map).
 *   4. Emit each URL once. The static seed and the city loop both pushed
 *      /cities/{c}, /homes-for-sale/{c} and /open-houses/{c} for the ten site
 *      cities (30 duplicates live on 2026-09-22); first occurrence wins.
 * Dropping, never throwing: a defect degrades to an omitted URL, not a 500.
 */
export function finalizeSitemapEntries<T extends { url: string }>(
  entries: T[],
  allowedNeighborhoodPaths: Set<string>,
): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const entry of filterRogueCityUrls(entries, allowedNeighborhoodPaths)) {
    const path = pathOf(entry.url)
    if (path === null) {
      out.push(entry)
      continue
    }
    const browse = TWO_SEGMENT_BROWSE.exec(path)
    if (browse && allowedNeighborhoodPaths.has(`/cities/${browse[1]}/${browse[2]}`)) {
      console.error(`[sitemap] dropped neighborhood browse twin (301s to the neighborhood page): ${entry.url}`)
      continue
    }
    if (REDIRECT_SOURCES.has(path)) {
      console.error(`[sitemap] dropped redirect source (next.config permanent redirect): ${entry.url}`)
      continue
    }
    if (seen.has(path)) continue
    seen.add(path)
    out.push(entry)
  }
  return out
}

// Fixed base for URL normalization. Resolving every entry against it with the
// WHATWG URL parser applies the SAME algorithm a browser/crawler uses, so every
// string shape — absolute, root-relative, protocol-relative (//host/..),
// no-leading-slash, and ./ ../ dot-segments — collapses to the canonical
// pathname a crawler would actually fetch. The shape test then sees what
// production serves, not the raw literal, closing every construction variant.
const NORMALIZE_BASE = 'https://sitemap-guard.invalid/'

/**
 * Drop any 2-segment /cities/{a}/{b} entry whose PATH is not in the sanctioned
 * neighborhood set. `allowedNeighborhoodPaths` holds paths like `/cities/bend/larkspur`
 * (no origin, no trailing slash) — build it from the same neighborhoods-table
 * rows the sitemap emits. Returns the safe list; console.errors each drop so a
 * regression is visible in logs.
 */
export function filterRogueCityUrls<T extends { url: string }>(
  entries: T[],
  allowedNeighborhoodPaths: Set<string>,
): T[] {
  return entries.filter((entry) => {
    let path: string
    try {
      // Resolve against a fixed base so EVERY shape (absolute, root-relative,
      // protocol-relative //host/.., no-leading-slash, ./ ../) normalizes to the
      // pathname a crawler would fetch — not the raw literal. Absolute URLs
      // ignore the base; only origin-less strings resolve against it.
      path = new URL(String(entry.url ?? ''), NORMALIZE_BASE).pathname
    } catch {
      return true // unparseable even against a base — no crawler resolves it to a page
    }
    path = path.replace(/\/$/, '')
    if (TWO_SEGMENT_CITIES.test(path) && !allowedNeighborhoodPaths.has(path)) {
      // eslint-disable-next-line no-console
      console.error(`[sitemap] dropped rogue 2-segment /cities URL (not a sanctioned neighborhood): ${entry.url}`)
      return false
    }
    return true
  })
}
