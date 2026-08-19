/**
 * sitemap classifier — buckets every sitemap URL into a class so each class
 * ships as its own child sitemap and GSC reports indexed counts per class.
 *
 * WHY (westside backlog #5, 2026-07-28): GSC showed 10,744 submitted / 60
 * indexed with zero visibility into WHICH class Google ignores. 88% of the
 * monolith is /homes-for-sale/* permutations; hub pages index fine while
 * /neighborhoods/* and subdivision pages were never crawled. Per-class
 * sitemaps make the starvation measurable, so pruning is data-driven.
 *
 * Pure function — no IO. Preset slugs are passed in (source:
 * lib/search-presets getIndexablePresetSlugs) so the classifier cannot
 * drift from the matrix definition.
 */

export type SitemapClass = 'core' | 'geo' | 'listings' | 'matrix' | 'content'

export const SITEMAP_CLASSES: SitemapClass[] = ['core', 'geo', 'listings', 'matrix', 'content']

/** Listing-detail URLs end in an MLS number: .../438-9th-220208193 */
const LISTING_TAIL = /-\d{6,}$/
/** Bare MLS when the address slug is empty: .../bend/220208193 */
const BARE_MLS = /^\d{6,}$/

export function classifySitemapUrl(url: string, presetSlugs: ReadonlySet<string>): SitemapClass {
  const path = url.replace(/^https?:\/\/[^/]+/, '').replace(/\/$/, '') || '/'
  const seg = path.split('/').filter(Boolean)

  if (seg[0] === 'blog') return 'content'

  if (seg[0] === 'homes-for-sale') {
    // Incomplete location falls back to /homes-for-sale/listing/{id}.
    // That last segment has no hyphen, so LISTING_TAIL alone missed it and
    // parked those locs in geo — listings.xml looked empty for that set.
    if (seg[1] === 'listing') return 'listings'
    const last = seg[seg.length - 1] ?? ''
    if (seg.length >= 2 && (LISTING_TAIL.test(last) || BARE_MLS.test(last))) return 'listings'
    if (seg.length === 1 || seg.length === 2) {
      // /homes-for-sale and /homes-for-sale/{city} are core inventory hubs;
      // /homes-for-sale/{city}/{preset} is a matrix permutation.
      return 'core'
    }
    if (seg.length === 3 && presetSlugs.has(seg[2])) return 'matrix'
    if (seg.length === 3) return 'geo' // {city}/{subdivision} browse page
    return 'matrix' // {city}/{area}/{preset} combos and deeper
  }

  // Evergreen geography surfaces.
  if (
    seg[0] === 'subdivisions' ||
    seg[0] === 'neighborhoods' ||
    seg[0] === 'zip' ||
    seg[0] === 'schools' ||
    seg[0] === 'parks' ||
    seg[0] === 'central-oregon' ||
    seg[0] === 'oregon'
  ) {
    return 'geo'
  }

  // Everything else — homepage, cities, communities, sell/buy funnels, team,
  // market reports, open houses, price drops — is the core set.
  return 'core'
}
