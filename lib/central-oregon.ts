/**
 * Central Oregon service area — the single source of truth for "which cities does
 * Ryan Realty serve". The MLS/Spark feed carries listings + subdivisions statewide
 * (Medford, Ashland, Grants Pass, Klamath Falls, Portland, ...), so anything that
 * lists geographies (communities index, sitemap, geo links) MUST scope to this set
 * or the site fills with out-of-area pages that 404 — broken links, off-brand, and
 * thin-content SEO harm that suppresses indexing of the pages that matter.
 *
 * Scope: the tri-county core — Deschutes, Crook, Jefferson — plus the resort/CDP
 * areas the site has pages for.
 */

export const CENTRAL_OREGON_CITY_SLUGS: ReadonlySet<string> = new Set<string>([
  // Deschutes
  'bend', 'redmond', 'sisters', 'sunriver', 'la-pine', 'tumalo', 'terrebonne',
  'black-butte-ranch', 'camp-sherman', 'brothers', 'alfalfa',
  // Jefferson
  'madras', 'culver', 'metolius', 'warm-springs', 'gateway', 'ashwood',
  'crooked-river', 'crooked-river-ranch',
  // Crook
  'prineville', 'powell-butte', 'paulina', 'post', 'mitchell',
])

/** Cities with a real, working /cities/<slug> page (verified geo_snapshot_mv
 *  rows). Used to SEED the sitemap so every best-schema city page is submitted.
 *  Excludes tumalo (redirects to Bend) and community-only service-area slugs that
 *  have no standalone city page — seeding those would put 404s in the sitemap. */
export const SITE_CITY_SLUGS: readonly string[] = [
  'bend', 'redmond', 'sisters', 'sunriver', 'la-pine',
  'madras', 'prineville', 'culver', 'terrebonne', 'powell-butte',
]

/** Slugify a raw city name the same way route slugs are built (lowercase, spaces
 *  and separators → hyphens) so it can be tested against the service-area set. */
export function citySlugForScope(city: string): string {
  return city
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** True when a raw city name is inside Ryan Realty's Central Oregon service area. */
export function isCentralOregonCity(city: string | null | undefined): boolean {
  if (!city) return false
  return CENTRAL_OREGON_CITY_SLUGS.has(citySlugForScope(city))
}

/** True when a community slug (built as `<city-slug>-<subdivision-slug>`) belongs
 *  to a Central Oregon city — used to keep out-of-area community URLs out of the
 *  sitemap (they 404 and waste Google's crawl budget). */
export function isCentralOregonCommunitySlug(slug: string | null | undefined): boolean {
  if (!slug) return false
  const s = slug.toLowerCase()
  for (const city of CENTRAL_OREGON_CITY_SLUGS) {
    if (s === city || s.startsWith(`${city}-`)) return true
  }
  return false
}
