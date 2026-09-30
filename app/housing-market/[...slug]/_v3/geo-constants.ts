/**
 * Route-local constants for /housing-market/[...slug].
 *
 * They live beside the route because ci:file-size-budget treats a NEW file over
 * 600 LOC as a hard fail and its own instruction is to split rather than
 * re-baseline. Nothing here fetches, formats, or classifies a market.
 *
 * NOT A GEO REGISTRY. lib/data/geo/report-cities.ts owns the canonical
 * report-city sets and ci:report-geo-registry bans re-typing one of them. The
 * generateStaticParams lists and the 8-city Ledger set are presentation
 * decisions for this catch-all. Their member sets are not the report core.
 */

import { RESORT_SLUG_TO_CITY } from '@/lib/community-slug'
import { canonicalCityCacheSlug } from '@/lib/market/city-cache-slug'

/**
 * Pre-heat these city reports at build time: the one-segment city grain.
 * Sunriver is its own registry city, so its community market page IS the
 * one-segment URL (lib/market/canonical-market-path.ts).
 */
export const CORE_CITY_SLUGS = [
  'bend',
  'redmond',
  'sisters',
  'sunriver',
  'la-pine',
  'tumalo',
  'prineville',
  'terrebonne',
] as const

/**
 * Registry communities with a published community-grain market page. Their
 * one market URL is /housing-market/<registry city>/<slug> (2026-09-24: the
 * one-segment /housing-market/black-butte-ranch twin 301s there). Crooked
 * River Ranch is not listed: neither of its market URLs publishes (both
 * served the noindex not-found shell on production 2026-09-24), and a
 * sitemap never submits a page that is not one.
 */
export const CORE_COMMUNITY_MARKET_PATHS: Readonly<Record<string, string>> = {
  'black-butte-ranch': '/housing-market/sisters/black-butte-ranch',
  'eagle-crest': '/housing-market/redmond/eagle-crest',
}

/**
 * Every pre-heated market page path, cities then communities, each its
 * canonical URL. Literal on purpose: this module reaches client bundles
 * (listing-ask), and the resolver's registry + redirect JSON must not. The
 * test pins every entry to lib/market/canonical-market-path.
 */
export const CORE_MARKET_PATHS: readonly string[] = [
  ...CORE_CITY_SLUGS.map((s) => `/housing-market/${s}`),
  ...Object.values(CORE_COMMUNITY_MARKET_PATHS),
]

/** Sibling / comparison Ledger row order for both branches. */
export const COMPARISON_CITY_LABELS = [
  'Bend',
  'Redmond',
  'Sisters',
  'Sunriver',
  'La Pine',
  'Tumalo',
  'Prineville',
  'Terrebonne',
] as const

export const COMPARISON_CITY_SLUG: Record<string, string> = {
  Bend: 'bend',
  Redmond: 'redmond',
  Sisters: 'sisters',
  Sunriver: 'sunriver',
  'La Pine': 'la-pine',
  Tumalo: 'tumalo',
  Prineville: 'prineville',
  Terrebonne: 'terrebonne',
}

export const HISTORY_PATH = '/housing-market/history'

export type GeoResolution = {
  geoType: 'city' | 'neighborhood' | 'subdivision'
  geoSlug: string
  citySlug: string
  communitySlug: string | null
  cityName: string
  communityName: string | null
  geoName: string
}

/** Convert a URL slug segment to a display name (title-case). */
export function unslug(value: string): string {
  return value
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

/**
 * Resolve the DAL geo_type for the catch-all slug.
 * - 1-segment: /housing-market/<city> -> city / bare city slug
 * - 2-segment: /housing-market/<city>/<community>
 *     resort/area community -> neighborhood / bare community slug
 *     other MLS subdivisions -> subdivision / bare community slug
 *
 * Never use "city:community". That shape has zero cache rows.
 */
export function resolveGeo(slug: string[]): GeoResolution {
  const citySlug = slug[0] ?? ''
  const communitySlug = slug[1] ?? null
  const cityName = unslug(citySlug)
  const communityName = communitySlug ? unslug(communitySlug) : null
  const geoName = communityName ?? cityName

  if (communitySlug) {
    const isResort = Boolean(RESORT_SLUG_TO_CITY[communitySlug])
    return {
      geoType: isResort ? 'neighborhood' : 'subdivision',
      geoSlug: communitySlug,
      citySlug,
      communitySlug,
      cityName,
      communityName,
      geoName,
    }
  }

  return {
    geoType: 'city',
    geoSlug: canonicalCityCacheSlug(citySlug),
    citySlug,
    communitySlug: null,
    cityName,
    communityName: null,
    geoName: cityName,
  }
}
