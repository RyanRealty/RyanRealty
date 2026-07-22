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

/** Exactly two path segments under /cities (trailing slash already stripped). */
const TWO_SEGMENT_CITIES = /^\/cities\/[^/]+\/[^/]+$/

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
