/**
 * Central Oregon service-area filter for listing DALs — ONE source of truth.
 *
 * THE PROBLEM (audit P0-3, 2026-06-10): the MLS/Spark feed is statewide
 * (Medford, Grants Pass, Ashland, Klamath Falls, Winston, Portland, ...), so
 * any tile/feed query with no geography predicate surfaces Southern Oregon
 * homes on surfaces that claim "Central Oregon" (homepage Featured mosaic,
 * /price-drops, /feed, communities index, marketing briefs).
 *
 * WHY A CITY ALLOWLIST AND NOT A COUNTY ALLOWLIST:
 *  1. `listing_tile_mv` (the canonical tile read path) does not project a
 *     county column — a county filter would require recreating the 589K-row
 *     MV, while `city_lower` is already projected and indexed.
 *  2. `listings.county` is incomplete. Verified live 2026-06-10 (audit query,
 *     active statuses): every major city carries a null-county cohort —
 *     bend 31 null rows, redmond 22, prineville 17, la pine 16, sisters 10.
 *     A county allowlist would silently DROP real service-area inventory.
 *  3. City allowlist is the established convention everywhere the site
 *     already scopes geography: `lib/central-oregon.ts` (sitemap, communities,
 *     geo links), `lib/data/open-houses/getUpcomingOpenHouses.ts`,
 *     `lib/expired-listing-processor.ts`, `lib/fsbo-detector.ts`.
 *
 * The slug set in `lib/central-oregon.ts` (CENTRAL_OREGON_CITY_SLUGS) is the
 * canonical tri-county definition (Deschutes, Crook, Jefferson + resort/CDP
 * areas). This module derives the DB-facing name lists from it so there is
 * exactly one place to add or remove a service-area city.
 *
 * Verified against live data 2026-06-10 (one targeted §0 audit query,
 * lower("City") × county × count over active statuses): the allowlist keeps
 * bend / redmond / sisters / sunriver / la pine / prineville / madras /
 * terrebonne / powell butte / culver / black butte ranch / camp sherman /
 * metolius / brothers and excludes medford (672 active) / grants pass (619) /
 * klamath falls (589) / ashland (246) / winston / chiloquin / eagle point /
 * central point and every other out-of-area city in the feed.
 */

import { CENTRAL_OREGON_CITY_SLUGS } from '@/lib/central-oregon'

/** slug -> the lowercase city name as stored in MLS `City` (e.g. 'la-pine' -> 'la pine'). */
function slugToLowerName(slug: string): string {
  return slug.replace(/-/g, ' ')
}

/** 'la pine' -> 'La Pine' (matches the proper-case convention of listings."City"). */
function lowerNameToProper(name: string): string {
  return name.replace(/\b[a-z]/g, (ch) => ch.toUpperCase())
}

/**
 * Lowercase service-area city names — matches `listing_tile_mv.city_lower`.
 * Use with `.in('city_lower', SERVICE_AREA_CITIES_LOWER)`.
 */
export const SERVICE_AREA_CITIES_LOWER: readonly string[] = [
  ...CENTRAL_OREGON_CITY_SLUGS,
].map(slugToLowerName)

/**
 * Proper-case service-area city names — matches `listings."City"` display
 * case (same convention the open-houses DAL has used in production). Use
 * with `.in('City', SERVICE_AREA_CITIES_PROPER)` on the raw listings table.
 */
export const SERVICE_AREA_CITIES_PROPER: readonly string[] =
  SERVICE_AREA_CITIES_LOWER.map(lowerNameToProper)

const SERVICE_AREA_LOWER_SET: ReadonlySet<string> = new Set(SERVICE_AREA_CITIES_LOWER)

/**
 * True when a raw city value (any case, e.g. a ListingTile.city) is inside
 * the Central Oregon service area. Null/undefined/empty -> false.
 */
export function isServiceAreaCity(city: string | null | undefined): boolean {
  if (!city) return false
  return SERVICE_AREA_LOWER_SET.has(city.toLowerCase().trim())
}

/**
 * Scope values accepted by tile-level DAL filters:
 *  - 'service-area' — force the Central Oregon city allowlist even when the
 *    caller passes listing keys / a search query (feed joins use this).
 *  - 'all'          — explicit opt-out: genuinely region-wide reads (admin
 *    listing browser, data-quality counts).
 *  - undefined      — default: the allowlist applies ONLY when the caller
 *    provides no geographic predicate of its own (no city/cities/subdivision/
 *    zip/neighborhood/bbox/keys/search). Scoped callers are untouched.
 */
export type ListingScope = 'service-area' | 'all'
