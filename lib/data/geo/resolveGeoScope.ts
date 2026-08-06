/**
 * resolveGeoScope — ONE resolver for "what does this geography contain?".
 *
 * Three geo types answer that question three different ways, and until this
 * existed every caller re-derived it inline. That is the shared root cause
 * behind C-01 (a map claiming single-family over an unfiltered query), C-02
 * (two counts for one place on one page), C-19 (sub-city surfaces served
 * city-wide data) and C-20 (a 19-entry registry rendered as 6).
 *
 *   neighborhood  SPATIAL ONLY. A Bend district has no MLS field — membership
 *                 comes from the GIS polygon via listings_in_boundary.
 *   community     REGISTRY. subdivision_aliases + sub_neighborhoods from
 *                 data/resort-communities.json, or spatially via the resort
 *                 boundary. ALIAS-AWARE is not optional: literal-name matching
 *                 undercounts every resort (Widgi 28 vs a true 48).
 *   subdivision   MLS SubdivisionName, with the plat polygon as fallback.
 *
 * GIS rule (CLAUDE.md §7 / C6): polygons come from the `boundaries` table only —
 * Deschutes County DIAL, City of Bend GIS, Oregon GEO, Census TIGER. A hull
 * drawn around listing points is never a boundary.
 *
 * Reads route through existing DAL functions. This adds no new query.
 */

import { unstable_cache } from 'next/cache'
import { getGeoBoundaryMapData } from '@/lib/data/geo/getGeoBoundaryMapData'
import type { BoundaryGeometry } from '@/lib/data/geo/getBoundaryGeoJSON'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { slugify } from '@/lib/slug'
import resortCommunitiesData from '@/data/resort-communities.json'

export type GeoScopeType = 'city' | 'neighborhood' | 'community' | 'subdivision'

/** How a listing is decided to be inside this geography. */
export type ListingPredicate =
  | { kind: 'city'; city: string }
  /** Spatial: the boundary RPC already returned the member listing keys. */
  | { kind: 'boundary'; listingKeys: string[] }
  /** Registry: match MLS SubdivisionName against any of these alias strings. */
  | { kind: 'subdivisionAliases'; aliases: string[]; city: string }

export type GeoScope = {
  type: GeoScopeType
  slug: string
  label: string
  city: string | null
  citySlug: string | null
  polygon: BoundaryGeometry | null
  listingPredicate: ListingPredicate
  /** Child plats of a community, as /subdivisions/<slug> resolves them. */
  childSubdivisionSlugs: string[]
  /** Registry aliases, verbatim, for callers that need the MLS strings. */
  subdivisionAliases: string[]
}

type ResortEntry = {
  slug: string
  label: string
  city: string
  city_slug: string
  subdivision_aliases?: string[]
}

const REGISTRY = (resortCommunitiesData as { communities: ResortEntry[] }).communities

/** Every registry community, unfiltered. 19 as of 2026-08-06. */
export function allCommunities(): ResortEntry[] {
  return REGISTRY
}

export function findCommunity(slug: string): ResortEntry | null {
  return REGISTRY.find((c) => c.slug === slug) ?? null
}

async function _resolve(input: { type: GeoScopeType; slug: string }): Promise<GeoScope | null> {
  const { type, slug } = input

  if (type === 'community') {
    const entry = findCommunity(slug)
    if (!entry) return null
    const aliases = entry.subdivision_aliases ?? []
    // The boundary RPC keys resort communities under geoType 'neighborhood'
    // (see getGeoBoundaryMapData's header) — not a typo, a storage convention.
    const boundary = await getGeoBoundaryMapData({ geoType: 'neighborhood', geoSlug: slug })
    const keys = boundary.pins.map((p) => p.listingKey)
    return {
      type,
      slug,
      label: entry.label,
      city: entry.city,
      citySlug: entry.city_slug,
      polygon: boundary.polygon,
      // Prefer the polygon when it returned members; fall back to alias
      // matching, which is what makes the count alias-aware.
      listingPredicate:
        keys.length > 0
          ? { kind: 'boundary', listingKeys: keys }
          : { kind: 'subdivisionAliases', aliases, city: entry.city },
      childSubdivisionSlugs: aliases
        .filter((a) => a.toLowerCase() !== entry.label.toLowerCase())
        .map((a) => slugify(a)),
      subdivisionAliases: aliases,
    }
  }

  if (type === 'neighborhood' || type === 'subdivision') {
    const boundary = await getGeoBoundaryMapData({ geoType: type, geoSlug: slug })
    const keys = boundary.pins.map((p) => p.listingKey)
    return {
      type,
      slug,
      label: slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      city: null,
      citySlug: null,
      polygon: boundary.polygon,
      listingPredicate: { kind: 'boundary', listingKeys: keys },
      childSubdivisionSlugs: [],
      subdivisionAliases: [],
    }
  }

  // city
  return {
    type: 'city',
    slug,
    label: slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    city: slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    citySlug: slug,
    polygon: null,
    listingPredicate: { kind: 'city', city: slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) },
    childSubdivisionSlugs: [],
    subdivisionAliases: [],
  }
}

export const resolveGeoScope = unstable_cache(
  _resolve,
  ['geo-scope-v1'],
  { revalidate: CACHE_WINDOWS.geoNeighborhood, tags: [cacheTag.listings] },
)
