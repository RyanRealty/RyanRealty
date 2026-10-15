/**
 * What a listing alert sends for a place, derived once (Matt 2026-10-14: every
 * area page carries a quick "get new listings for this area" signup).
 *
 * The node pages (city, neighborhood, community, subdivision) feed their own
 * strips. The pages that mount the shared PlaceAlertsStrip
 * (app/_v3/place-alerts) have no strip of their own: a city or community's type
 * pages, its buyer-answer pages, its market page. They all need the same three
 * things, and they must match what the node page would send for the same place:
 *
 *   filters     the area key the capture writes. A city is `{ city }`. A
 *               community is `{ city, subdivision }` with the subdivision
 *               exactly as /communities/[slug] passes it to
 *               CommunityAlertsStrip (`community.subdivision`; empty means the
 *               whole city, and the strip then says so). A Bend district is
 *               `{ neighborhoodSlug: 'bend-<slug>' }` ONLY when that slug is in
 *               BEND_DISTRICTS (it has a boundary polygon the search matches by
 *               location, as /cities/bend/[district] does); any other
 *               neighborhood falls back to its city, never an invented
 *               narrowing (CLAUDE.md section 0).
 *   scopeName   the area the alert really sends, when it is wider than the
 *               place the visitor stands in.
 *   browseHref  the page's own newest-listings door; the strip adds the sort.
 *
 * Isomorphic: committed JSON and string building only. No reads.
 */

import { communityNewestListingsHref, getPlaceLinks } from '@/lib/place-links'
import { communityRegistryContext } from '@/lib/communities/community-registry-context'
import { BEND_DISTRICTS } from '@/lib/neighborhood-areas'
import { homesForSalePath, subdivisionListingsPath } from '@/lib/slug'

/** The area keys the shared strip may send (a structural twin of its PlaceAlertFilters). */
export type PlaceAlertScopeFilters =
  | { city: string; subdivision?: string }
  | { neighborhoodSlug: string }

export type PlaceAlertScope = {
  /** The place the visitor is standing in. Named in the strip's sentence. */
  placeName: string
  /** The area the alert really sends, when wider than the place. */
  scopeName?: string
  filters: PlaceAlertScopeFilters
  /** The newest-listings door for the area; the strip adds the newest sort. */
  browseHref: string
  geoType: 'city' | 'neighborhood'
  /** For the trace only. */
  geoSlug: string
}

/** A city: every listing with that city's address. */
export function cityAlertScope(input: { cityName: string; citySlug: string }): PlaceAlertScope | null {
  const cityName = input.cityName.trim()
  if (!cityName) return null
  return {
    placeName: cityName,
    filters: { city: cityName },
    browseHref: homesForSalePath(cityName),
    geoType: 'city',
    geoSlug: input.citySlug,
  }
}

/**
 * A Bend neighborhood. Scoped to the district only when the district has a
 * boundary the search can match (BEND_DISTRICTS); otherwise the alert is the
 * city's and the strip names the city as its scope.
 */
export function bendDistrictAlertScope(input: {
  hoodSlug: string
  hoodLabel: string
  cityName?: string
}): PlaceAlertScope {
  const cityName = input.cityName?.trim() || 'Bend'
  const areaSlug = `bend-${input.hoodSlug}`
  if (BEND_DISTRICTS.some((district) => district.slug === areaSlug)) {
    return {
      placeName: input.hoodLabel,
      filters: { neighborhoodSlug: areaSlug },
      browseHref: subdivisionListingsPath(cityName, input.hoodLabel),
      geoType: 'neighborhood',
      geoSlug: areaSlug,
    }
  }
  return {
    placeName: input.hoodLabel,
    scopeName: cityName,
    filters: { city: cityName },
    browseHref: homesForSalePath(cityName),
    geoType: 'neighborhood',
    geoSlug: areaSlug,
  }
}

/**
 * A community, with the values /communities/[slug] feeds its own strip:
 * `community.city`, `community.subdivision`, and the registry community's
 * newest-listings door. An empty subdivision is the whole city, and then the
 * scope is named as the city. Null when the record has no city to scope to.
 */
export function communityAlertScope(input: {
  community: { city: string; citySlug: string; subdivision: string; name: string }
  /** The page's own community slug, as the route received it. */
  slug: string
  /** The name the page calls the place. */
  placeName: string
}): PlaceAlertScope | null {
  const city = input.community.city?.trim()
  if (!city) return null
  const subdivision = input.community.subdivision?.trim() ?? ''
  const { resortSlug } = communityRegistryContext(input.community, input.slug)
  const browseHref =
    communityNewestListingsHref(resortSlug) ??
    getPlaceLinks({
      type: 'community',
      slug: resortSlug,
      citySlug: input.community.citySlug || undefined,
    }).browseUrl
  return {
    placeName: input.placeName,
    ...(subdivision ? {} : { scopeName: city }),
    filters: subdivision ? { city, subdivision } : { city },
    browseHref,
    geoType: 'neighborhood',
    geoSlug: resortSlug,
  }
}
