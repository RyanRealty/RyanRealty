/**
 * Canonical place / browse / market URLs for a geo entity.
 * Presentation-only — does not change cache slug dialects.
 */
import { homesForSalePath, slugify } from '@/lib/slug'
import { RESORT_SLUG_TO_CITY } from '@/lib/community-slug'
import { selfCitySearchPath } from '@/lib/communities/self-city-community'
import { cityHref, cityNeighborhoodHref } from '@/lib/site/place-href'
import {
  communityPublicPairForPlace,
  resolveDurableCommunitySlug,
  resolvePublicCommunitySlug,
} from '@/lib/communities/community-public-pair'

export type PlaceType = 'city' | 'neighborhood' | 'community'

export type PlaceLinks = {
  placeUrl: string
  browseUrl: string
  marketUrl: string
  label: string
}

function titleFromSlug(s: string): string {
  return s
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/**
 * The newest-listings door for a registry community's alerts strip ("See the
 * newest Broken Top listings"). The area twin 301s home (SITE-183 / SITE-182)
 * and a city-wide search under a community label would be a mislabeled door,
 * so a non-self-city community uses the area x preset search
 * /homes-for-sale/<city>/<slug>/new-listings-30 (lib/search-presets.ts: the
 * last 30 days, newest first, the same window the strip's own count measures;
 * three segments, so the two-segment twin rule never catches it). A self-city
 * community's own city search already IS the community. The alerts sheet adds
 * the newest-first sort itself (newestFirstHref), as on every place grain.
 * Null for a slug that is not in the registry.
 */
export function communityNewestListingsHref(slug: string): string | null {
  const durable = resolveDurableCommunitySlug(canonicalCommunitySlug(slug.trim().toLowerCase()))
  const cityName = RESORT_SLUG_TO_CITY[durable]
  if (!cityName) return null
  return selfCitySearchPath(durable) ?? `${homesForSalePath(cityName, durable)}/new-listings-30`
}

/** Prefer bare resort slug over city-prefixed compound (bend-tetherow → tetherow). */
export function canonicalCommunitySlug(slug: string): string {
  const normalised = slug.trim().toLowerCase()
  if (RESORT_SLUG_TO_CITY[normalised]) return normalised
  // compound: bend-tetherow / sunriver-crosswater
  const parts = normalised.split('-')
  for (let i = 1; i < parts.length; i++) {
    const rest = parts.slice(i).join('-')
    if (RESORT_SLUG_TO_CITY[rest]) return rest
  }
  return normalised
}

export function getPlaceLinks(input: {
  type: PlaceType
  slug: string
  citySlug?: string
}): PlaceLinks {
  const slug = input.slug.trim().toLowerCase()

  if (input.type === 'city') {
    return {
      // An out-of-area city's page is /oregon/<slug>; /cities/<slug> 308s there.
      placeUrl: cityHref(slug) ?? `/cities/${slug}`,
      browseUrl: homesForSalePath(titleFromSlug(slug)),
      marketUrl: `/housing-market/${slug}`,
      label: titleFromSlug(slug),
    }
  }

  if (input.type === 'neighborhood') {
    const citySlug = (input.citySlug ?? 'bend').toLowerCase()
    return {
      // A registry community used as a neighborhood slug (Northwest Crossing,
      // Eagle Crest) has its own /communities page; the two-segment path 308s.
      placeUrl: cityNeighborhoodHref(citySlug, slug) ?? `/cities/${citySlug}/${slug}`,
      browseUrl: `/homes-for-sale/${citySlug}/${slug}`,
      marketUrl: `/housing-market/${citySlug}/${slug}`,
      label: titleFromSlug(slug),
    }
  }

  // community
  const bare = canonicalCommunitySlug(slug)
  const durable = resolveDurableCommunitySlug(bare)
  const publicSlug = resolvePublicCommunitySlug(bare)
  const pair = communityPublicPairForPlace({ slug: durable })
  const cityName = RESORT_SLUG_TO_CITY[durable]
  const citySlug = cityName ? slugify(cityName) : (input.citySlug ?? 'bend')
  // Market stays on the durable MLS identity (bend:pronghorn cache). The
  // visitor door is the public pair.
  //
  // SITE-183 / SITE-182 (2026-09-23): EVERY registry community's area twin
  // /homes-for-sale/<city>/<slug> 301s onto the community page
  // (scripts/lib/registry-area-twins.mjs, PAGE_OUTLINE "301 area search URLs
  // to the place URL"). A browse door built from that path took a visitor on
  // /communities/broken-top straight back to /communities/broken-top, so the
  // search door for a registry community is a CITY search: the community's
  // own city for a self-city (SITE-187 / SITE-184: /homes-for-sale/
  // black-butte-ranch, never Sisters'), else its registry city
  // (/homes-for-sale/bend for Broken Top). The community's own inventory is
  // the page's Field (#homes); its newest listings door is
  // communityNewestListingsHref below. A compound slug that is NOT in the
  // registry keeps the area-filtered path: nothing 301s it.
  const browseUrl =
    selfCitySearchPath(durable) ??
    (cityName
      ? homesForSalePath(cityName)
      : homesForSalePath(titleFromSlug(citySlug), titleFromSlug(durable)))
  return {
    placeUrl: pair?.href ?? `/communities/${publicSlug}`,
    browseUrl,
    marketUrl: `/housing-market/${citySlug}/${durable}`,
    label: pair?.displayName ?? titleFromSlug(publicSlug),
  }
}
