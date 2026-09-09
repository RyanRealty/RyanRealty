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
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE LISTING TIER — MATT'S RULING, 2026-09-08 (SITE-33). Asked and answered.
 *
 * The city tier above it has been honest since W12: /oregon/[city] says
 * "Outside our home market" in its own words and captures a referral instead.
 * The LISTING tier beneath it said nothing. Measured live 2026-09-08 against
 * https://ryan-realty.com/sitemaps/listings.xml: 4,190 of 7,506 listing URLs
 * (56%) were homes in cities outside this allowlist — Medford 730, Klamath
 * Falls 635, Grants Pass 541, Ashland 275, Chiloquin 184, Eagle Point 165,
 * Central Point 149 — each rendered identically to a Bend home, under a
 * "| Ryan Realty — Central Oregon" title, with index,follow and a sitemap row.
 *
 * THE RULING, in four parts:
 *
 *  1. The out-of-area listing page GETS THE HONESTY BLOCK — the same claim the
 *     city tier makes, in the same words, linking to that city's /oregon page.
 *  2. It is NOINDEX WITH FOLLOW PRESERVED. `pageMetadata({ noindex: true })`
 *     emits "noindex, follow" (SITE-25); the `nofollow` flag beside it is NOT
 *     wanted here. The canonical stays on the page.
 *  3. THE PAGE STILL SERVES, 200, in full. Refusing the row in a read would
 *     turn every inventory link on the Medford and Grants Pass referral pages
 *     into ListingUnavailable — the referral tier links straight at these
 *     detail pages (app/oregon/[city]/page.tsx). This is a POLICY at the page,
 *     never a filter in fetchByColumn.
 *  4. /oregon/[city] STAYS INDEXED, per W12.4 (Matt directive 2026-07-22).
 *     Confirmed, unchanged: 55 pages, 1,187 impressions, 1 click, position
 *     33.8 over the GSC window read 2026-09-08.
 *
 * A noindexed URL does not belong in a sitemap, so `getListingSitemapRows`
 * drops out-of-area rows through `isServiceAreaCity` — the SAME predicate this
 * function uses, so the sitemap, the robots directive and the visible block can
 * never disagree about which market a home is in.
 *
 * Owning doc: docs/plans/PUBLIC_PRODUCT/processes/refer-out-of-area.md §8.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { CENTRAL_OREGON_CITY_SLUGS } from '@/lib/central-oregon'
import { outOfAreaCitySlug } from '@/lib/out-of-area-cities'

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
 * What an out-of-area listing detail page needs to be honest about itself: the
 * city as the MLS row spells it, and the referral page the city tier already
 * publishes for it.
 */
export type OutOfAreaListingPolicy = {
  /** Display city name, exactly as `listings."City"` carries it. */
  cityName: string
  /** Route slug for /oregon/<slug>, from the city tier's OWN slugger. */
  citySlug: string
  /** The referral page this home's city already has. */
  referralHref: string
}

/**
 * THE LISTING-TIER BRANCH (Matt 2026-09-08, see the ruling in this file's
 * header). Returns the honesty policy for a listing OUTSIDE the Central Oregon
 * service area, or `null` for one inside it.
 *
 * `null` is the whole in-area behaviour: no block, index + follow, the sitemap
 * row kept. Non-null is the whole out-of-area behaviour: the block renders,
 * `pageMetadata({ noindex: true })` emits "noindex, follow", and
 * `getListingSitemapRows` drops the row.
 *
 * A row with no city makes NO claim about a market, so it stays in-area — the
 * honest failure mode is to say nothing, not to tell a reader a home is outside
 * a market when the feed did not say where it is.
 *
 * The slug comes from `outOfAreaCitySlug` (which is `citySlugForScope`, the
 * function /oregon/[city] resolves its own param with) rather than from the
 * listing row's `citySlug`, so the href this returns is the URL that route
 * answers on.
 */
export function outOfAreaListingPolicy(
  city: string | null | undefined,
): OutOfAreaListingPolicy | null {
  const cityName = (city ?? '').trim()
  if (!cityName) return null
  if (isServiceAreaCity(cityName)) return null
  const citySlug = outOfAreaCitySlug(cityName)
  if (!citySlug) return null
  return { cityName, citySlug, referralHref: `/oregon/${citySlug}` }
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
