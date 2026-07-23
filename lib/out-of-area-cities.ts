/**
 * Out-of-area city index — pure logic (W12 referral-capture tier).
 *
 * The MLS/Spark feed is statewide (~362 cities) while Ryan Realty's home market
 * is the Central Oregon tri-county set in `lib/central-oregon.ts`. Cities in the
 * feed but outside that set get a LIGHT city page at /oregon/[city] that says so
 * plainly, shows the live inventory, and captures a referral lead instead of
 * pretending we work that market.
 *
 * This module is PURE (no DB, no server imports) so the indexability policy is
 * unit-testable with fixtures. The DB read lives in
 * `lib/data/geo/getOutOfAreaCities.ts`, which feeds geo_snapshot_mv city rows
 * through these helpers.
 *
 * Indexability policy (sitemap + robots):
 *   - ONLY the top OUT_OF_AREA_INDEXABLE_TOP_N out-of-area cities by
 *     active-listing count, and only those with at least
 *     OUT_OF_AREA_INDEXABLE_MIN_ACTIVE active listings, are indexable and
 *     sitemap-emitted.
 *   - Every other out-of-area city page renders noindex (real page, thin-content
 *     protected).
 */

import { CENTRAL_OREGON_CITY_SLUGS, citySlugForScope } from '@/lib/central-oregon'

export type OutOfAreaCity = {
  /** Hyphenated route slug, e.g. 'klamath-falls'. */
  slug: string
  /** Display label from the MLS City field, e.g. 'Klamath Falls'. */
  name: string
  /** Active + Coming Soon + Active Under Contract, all property types. */
  activeAllCount: number
  /** Active SFR subset (PropertyType 'A', Single Family Residence). */
  activeSfrCount: number
  /** Median active list price (SFR) from geo_snapshot_mv; null when sparse. */
  medianListPrice: number | null
  /** geo_snapshot_mv refresh timestamp for the row. */
  refreshedAt: string
}

/** Minimum active listings for an out-of-area city page to be indexable. This
 *  is the real quality bar — a city with 5+ active SFR listings is a genuine
 *  market worth a referral-capture page. */
export const OUT_OF_AREA_INDEXABLE_MIN_ACTIVE = 5

/** Cap on how many out-of-area city pages enter the sitemap. WIDENED 25 -> 100
 *  (Matt directive 2026-07-22, W12.4): the ≥5-active threshold above is the true
 *  index criterion, so this cap now only guards against a data glitch producing
 *  an absurd count. At the 2026-07-22 §0 count (60 out-of-area cities with ≥5
 *  active) it indexes ALL of them, up from the arbitrary top-25 — capturing the
 *  smaller markets (Burns, Hines, …) the old cap excluded. */
export const OUT_OF_AREA_INDEXABLE_TOP_N = 100

/**
 * Feed noise the City field carries that is not a real city. Lowercase,
 * compared against the raw geo_key.
 */
const CITY_KEY_NOISE = new Set([
  'other',
  'unknown',
  'n/a',
  'none',
  'na',
  'tbd',
  'see remarks',
  'out of area',
  'rural',
])

/**
 * True when a geo_snapshot_mv city geo_key looks like a real city name:
 * letters first, then letters / spaces / periods / apostrophes / hyphens,
 * 2..40 chars, and not a known noise value.
 */
export function isPlausibleCityKey(geoKey: string | null | undefined): boolean {
  if (!geoKey) return false
  const key = geoKey.trim().toLowerCase()
  if (key.length < 2 || key.length > 40) return false
  if (CITY_KEY_NOISE.has(key)) return false
  return /^[a-z][a-z .'-]+$/.test(key)
}

/**
 * True when a city geo_key (space-separated lowercase, e.g. 'klamath falls')
 * falls OUTSIDE the Central Oregon service area.
 */
export function isOutOfAreaCityKey(geoKey: string | null | undefined): boolean {
  if (!geoKey) return false
  return !CENTRAL_OREGON_CITY_SLUGS.has(citySlugForScope(geoKey))
}

/** Route slug for a city geo_key/name: 'Klamath Falls' -> 'klamath-falls'. */
export function outOfAreaCitySlug(cityNameOrKey: string): string {
  return citySlugForScope(cityNameOrKey)
}

/**
 * The indexable subset: at least OUT_OF_AREA_INDEXABLE_MIN_ACTIVE active
 * listings, top OUT_OF_AREA_INDEXABLE_TOP_N by active count (ties broken by
 * name for a stable sitemap).
 */
export function pickIndexableOutOfAreaCities(cities: readonly OutOfAreaCity[]): OutOfAreaCity[] {
  return cities
    .filter((c) => c.activeAllCount >= OUT_OF_AREA_INDEXABLE_MIN_ACTIVE)
    .sort((a, b) => b.activeAllCount - a.activeAllCount || a.name.localeCompare(b.name))
    .slice(0, OUT_OF_AREA_INDEXABLE_TOP_N)
}

/**
 * The prod-verifiable count for W12: how many out-of-area cities carry at
 * least `minActive` active listings. Query shape (spot-check against live):
 *
 *   SELECT count(*) FROM public.geo_snapshot_mv
 *   WHERE geo_type = 'city' AND active_all_count >= 5
 *     AND geo_key NOT IN (<CENTRAL_OREGON_CITY_SLUGS, hyphens as spaces>)
 *   -- minus feed-noise keys (isPlausibleCityKey)
 */
export function countOutOfAreaCitiesWithActiveAtLeast(
  cities: readonly OutOfAreaCity[],
  minActive: number = OUT_OF_AREA_INDEXABLE_MIN_ACTIVE,
): number {
  return cities.filter((c) => c.activeAllCount >= minActive).length
}
