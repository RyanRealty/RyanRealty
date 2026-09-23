/**
 * self-city-community — a resort community that IS its own city: either the
 * registry names the community as its city (Sunriver: slug `sunriver`,
 * city_slug `sunriver`) or the community slug is itself a Central Oregon city
 * slug because the MLS files its homes under the community as City (Black
 * Butte Ranch: City 'Black Butte Ranch' while the registry city is Sisters;
 * Crooked River Ranch under Terrebonne the same way).
 *
 * WHY (SITE-187 / SITE-186, GSC 2026-08-24..09-20). "sunriver homes for sale"
 * collected 126 impressions and 0 clicks, split /cities/sunriver 64%,
 * /communities/sunriver-river-view 26%, /homes-for-sale/sunriver 7%,
 * /communities/sunriver 2%. The place had three indexable URLs for one
 * inventory query, two of them sharing the exact <title> and <h1>, and the
 * page PAGE_OUTLINE names as the winner (/communities/<slug>) was the one
 * nothing linked to with that phrase: the city page sent every "Sunriver
 * homes for sale" door to the search slug, the chrome and footer never named
 * the community page, and the community page itself handed the phrase to
 * /homes-for-sale/sunriver in its closing doors.
 *
 * SITE-184 / SITE-191 (same window): queries containing "black butte ranch"
 * collected 596 impressions and 0 clicks, split /communities/black-butte-ranch
 * 63%, /homes-for-sale/black-butte-ranch (+ its condo query-string variant)
 * 16%, /housing-market/sisters/black-butte-ranch 7%, /cities/black-butte-ranch
 * 6%. Same three-URL shape, but `slug === city_slug` did not cover it because
 * the registry city is Sisters. The rule that does: a community whose slug is
 * a site city slug (lib/central-oregon.ts CENTRAL_OREGON_CITY_SLUGS) has its
 * own /homes-for-sale/<slug> city search and its own /cities/<slug> guide,
 * which is exactly the shape that splits the query.
 *
 * THE RULE, one place: for a self-city community
 *   - /communities/<slug> is the inventory winner ("{place} homes for sale").
 *   - /cities/<slug> keeps "{place} real estate" and routes its plain
 *     inventory doors to the community page (filtered searches stay on
 *     /homes-for-sale/<slug>, which is a tool, not a document).
 *   - /homes-for-sale/<slug> (the plain city search) canonicals to the
 *     community page and leaves the sitemap; it still renders for the
 *     search app's own city switcher, under a "Search {place} homes" heading
 *     so no second page carries the winner's exact h1.
 *   - /homes-for-sale/<slug>/<slug> and /homes-for-sale/<registry city>/<slug>
 *     (the area twins) 301 to the community page like every other
 *     area-search URL that IS a place (data/legacy-redirects.json,
 *     PAGE_OUTLINE "301 area search URLs to the place URL").
 *
 * Pure and edge-safe: registry JSON + a constants module + string ops, no
 * Supabase, no server-only, so search metadata, the sitemap and place pages
 * can all read it. Membership is derived, nothing is hand-listed.
 */

import resortRegistry from '@/data/resort-communities.json'
import { CENTRAL_OREGON_CITY_SLUGS } from '@/lib/central-oregon'
import { homesForSalePath } from '@/lib/slug'

type RegistryEntry = { slug: string; city_slug: string }

function registryEntries(): RegistryEntry[] {
  const raw = resortRegistry as unknown
  const list = Array.isArray(raw)
    ? raw
    : ((raw as { communities?: unknown[] }).communities ?? [])
  return (list as Array<Partial<RegistryEntry>>).filter(
    (e): e is RegistryEntry => typeof e?.slug === 'string' && typeof e?.city_slug === 'string',
  )
}

function norm(slug: string | null | undefined): string {
  return (slug ?? '').trim().toLowerCase()
}

/** True when a registry entry is its own city: the registry says so, or its slug is a site city slug. */
function isOwnCity(e: RegistryEntry): boolean {
  const slug = norm(e.slug)
  return slug === norm(e.city_slug) || CENTRAL_OREGON_CITY_SLUGS.has(slug)
}

/**
 * The self-city set, keyed by the community's OWN city slug, which is its
 * community slug (Sunriver → sunriver, Black Butte Ranch → black-butte-ranch).
 * The registry's parent city (Sisters for Black Butte Ranch) is deliberately
 * NOT a key: /cities/sisters and /homes-for-sale/sisters are Sisters' own.
 */
const SELF_CITY_SLUGS: ReadonlySet<string> = new Set(
  registryEntries().filter(isOwnCity).map((e) => norm(e.slug)),
)

/** The community slug when this city slug is a self-city community, else null. */
export function selfCityCommunitySlug(citySlug: string | null | undefined): string | null {
  const s = norm(citySlug)
  return SELF_CITY_SLUGS.has(s) ? s : null
}

/** True when this community slug is its own city. */
export function isSelfCityCommunity(communitySlug: string | null | undefined): boolean {
  return selfCityCommunitySlug(communitySlug) != null
}

/** `/communities/<slug>` for a self-city city slug, else null. */
export function selfCityCommunityPath(citySlug: string | null | undefined): string | null {
  const slug = selfCityCommunitySlug(citySlug)
  return slug ? `/communities/${slug}` : null
}

/**
 * The self-city community's OWN plain city search, `/homes-for-sale/<slug>`
 * (Black Butte Ranch homes carry MLS City 'Black Butte Ranch', so the search
 * is the community's slug, never the registry city's `/homes-for-sale/sisters`).
 * This is the community page's search door; its area twins 301 home.
 */
export function selfCitySearchPath(communitySlug: string | null | undefined): string | null {
  const slug = selfCityCommunitySlug(communitySlug)
  return slug ? `/homes-for-sale/${slug}` : null
}

/**
 * Where a place page's PLAIN "{city} homes for sale" door goes: the
 * community page for a self-city, the city search slug for every other
 * city. Filtered doors (a type, a max price, newest first) do not use this;
 * those are searches and stay on /homes-for-sale/<city>.
 */
export function placeInventoryHref(cityName: string): string {
  const searchPath = homesForSalePath(cityName)
  const citySlug = searchPath.replace(/^\/homes-for-sale\//, '')
  return selfCityCommunityPath(citySlug) ?? searchPath
}

/**
 * The canonical for a /homes-for-sale/<city> search page: the community
 * page when the city is a self-city AND the URL is the plain city page (no
 * area segment, no preset). Everything else keeps its own canonical.
 */
export function selfCitySearchCanonicalPath(input: {
  citySlug: string | null | undefined
  hasArea: boolean
  hasPreset: boolean
}): string | null {
  if (input.hasArea || input.hasPreset) return null
  return selfCityCommunityPath(input.citySlug)
}

/**
 * The heading for the plain self-city search page. The winner's h1 is
 * "{place} homes for sale" (PAGE_OUTLINE: never two pages with the same H1),
 * so the search tool that canonicals to it says what it is instead.
 */
export function selfCitySearchHeading(input: {
  citySlug: string | null | undefined
  placeName: string
  hasArea: boolean
  hasPreset: boolean
}): string | null {
  if (input.hasArea || input.hasPreset) return null
  if (!selfCityCommunitySlug(input.citySlug)) return null
  const place = input.placeName.trim()
  return place ? `Search ${place} homes` : null
}

/** Sitemap: the plain city search URL is omitted when it canonicals away. */
export function selfCitySearchUrlLeavesSitemap(citySlug: string | null | undefined): boolean {
  return selfCityCommunitySlug(citySlug) != null
}
