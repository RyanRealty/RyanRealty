/**
 * self-city-community — a resort community whose registry city IS the
 * community (Sunriver: slug `sunriver`, city_slug `sunriver`).
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
 * THE RULE, one place: for a self-city community
 *   - /communities/<slug> is the inventory winner ("{place} homes for sale").
 *   - /cities/<slug> keeps "{place} real estate" and routes its plain
 *     inventory doors to the community page (filtered searches stay on
 *     /homes-for-sale/<slug>, which is a tool, not a document).
 *   - /homes-for-sale/<slug> (the plain city search) canonicals to the
 *     community page and leaves the sitemap; it still renders for the
 *     search app's own city switcher.
 *   - /homes-for-sale/<slug>/<slug> (the area twin) 301s to the community
 *     page like every other area-search URL that IS a place
 *     (data/legacy-redirects.json, PAGE_OUTLINE "301 area search URLs to
 *     the place URL").
 *
 * Pure and edge-safe: registry JSON + string ops, no Supabase, no
 * server-only, so search metadata, the sitemap and place pages can all
 * read it. `city_slug === slug` is the whole test; nothing is hand-listed.
 */

import resortRegistry from '@/data/resort-communities.json'
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

/** city slug → community slug, for every registry entry whose city is itself. */
const SELF_CITY_BY_CITY_SLUG: ReadonlyMap<string, string> = new Map(
  registryEntries()
    .filter((e) => e.slug.trim().toLowerCase() === e.city_slug.trim().toLowerCase())
    .map((e) => [e.city_slug.trim().toLowerCase(), e.slug.trim().toLowerCase()] as const),
)

function norm(slug: string | null | undefined): string {
  return (slug ?? '').trim().toLowerCase()
}

/** The community slug when this city slug is a self-city community, else null. */
export function selfCityCommunitySlug(citySlug: string | null | undefined): string | null {
  return SELF_CITY_BY_CITY_SLUG.get(norm(citySlug)) ?? null
}

/** True when this community slug's registry city is the community itself. */
export function isSelfCityCommunity(communitySlug: string | null | undefined): boolean {
  const s = norm(communitySlug)
  return s.length > 0 && SELF_CITY_BY_CITY_SLUG.get(s) === s
}

/** `/communities/<slug>` for a self-city city slug, else null. */
export function selfCityCommunityPath(citySlug: string | null | undefined): string | null {
  const slug = selfCityCommunitySlug(citySlug)
  return slug ? `/communities/${slug}` : null
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

/** Sitemap: the plain city search URL is omitted when it canonicals away. */
export function selfCitySearchUrlLeavesSitemap(citySlug: string | null | undefined): boolean {
  return selfCityCommunitySlug(citySlug) != null
}
