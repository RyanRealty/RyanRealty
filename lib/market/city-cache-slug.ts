/**
 * City URL slug → cache geo_slug.
 *
 * `market_pulse_live` and `market_stats_cache` key city rows on
 * lower("City") — space-separated (`la pine`). Public URLs use hyphens
 * (`/housing-market/la-pine`). Passing the URL slug to a city-tier cache
 * read 404s a published market (fleet 75370225805bb52d38b151ced2dab5c1).
 *
 * Space form first. The hyphen spelling is a retired convention that also
 * matched a TIGER polygon for La Pine — mixing the two geographies is a
 * worse §0 failure than a miss (see city-range-slug.test.ts).
 *
 * URL paths stay hyphenated (`cityUrlSlug`). Only cache reads use this.
 */

/** Candidate cache geo_slugs: space-separated first, hyphenated second. */
export function citySlugCandidates(cityLabel: string): string[] {
  const lower = cityLabel.trim().toLowerCase()
  const spaced = lower.replace(/[^a-z0-9]+/g, ' ').trim()
  const hyphen = lower.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return Array.from(new Set([spaced, hyphen].filter(Boolean)))
}

/** Hyphenated URL slug for /housing-market/<slug> and /cities/<slug>. */
export function cityUrlSlug(cityLabel: string): string {
  return cityLabel.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

/**
 * Canonical city cache geo_slug. Always the space form.
 * Accepts a display name (`La Pine`) or a URL slug (`la-pine`).
 */
export function canonicalCityCacheSlug(urlOrLabel: string): string {
  return citySlugCandidates(urlOrLabel)[0] ?? ''
}
