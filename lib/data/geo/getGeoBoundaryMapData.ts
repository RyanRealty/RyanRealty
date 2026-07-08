/**
 * getGeoBoundaryMapData — shared DAL for the boundary map block.
 *
 * Returns the authoritative polygon + active listing pins for ANY geo type:
 *   - City:      geoType='city',         geoSlug = city slug (e.g. 'bend')
 *   - Neighborhood: geoType='neighborhood', geoSlug = 'bend-awbrey-butte'
 *   - Resort/master-planned community:
 *                geoType='neighborhood', geoSlug = bare registry slug (e.g. 'tetherow')
 *
 * Both data fetches go through the PostGIS `boundary_geojson` and
 * `listings_in_boundary` RPCs (SECURITY DEFINER → anon readable). This is
 * THE function all three page types (city / neighborhood / community) use for
 * their map section — no per-page City/SubdivisionName string divergence.
 *
 * GIS rule (CLAUDE.md): polygons MUST come from the `boundaries` table
 * (City of Bend GIS / Deschutes County DIAL / Oregon GEO / Census TIGER).
 *
 * Gate G31 enforces that every page rendering <NeighborhoodMap> imports
 * this function (not a bespoke one-off query).
 */

import { unstable_cache } from 'next/cache'
import { supabaseAnon } from '@/lib/data/client'
import { getBoundaryGeoJSON } from '@/lib/data/geo/getBoundaryGeoJSON'
import type { BoundaryGeometry } from '@/lib/data/geo/getBoundaryGeoJSON'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'

export type GeoType = 'city' | 'neighborhood' | 'subdivision' | 'park' | 'school'

export type GeoBoundaryMapInput = {
  geoType: GeoType
  geoSlug: string
}

export type BoundaryMapPin = {
  listingKey: string
  lat: number
  lng: number
  price: number | null
  // Enriched from the listing tiles so the map info window can show a photo,
  // address, and beds/baths/sqft (the RPC itself only returns lat/lng/price).
  photoUrl: string | null
  streetNumber: string | null
  streetName: string | null
  streetSuffix: string | null
  city: string | null
  postalCode: string | null
  beds: number | null
  baths: number | null
  sqft: number | null
}

export type GeoBoundaryMapData = {
  polygon: BoundaryGeometry | null
  pins: BoundaryMapPin[]
}

async function fetchPins(
  geoType: GeoType,
  geoSlug: string,
  limit = 200,
): Promise<BoundaryMapPin[]> {
  const supabase = supabaseAnon()
  if (!supabase) return []

  const { data, error } = await supabase.rpc('listings_in_boundary', {
    p_geo_type: geoType,
    p_geo_slug: geoSlug,
    p_limit: limit,
  })

  if (error) {
    // THROW (do not return []) — see getBoundaryGeoJSON for the rationale. A
    // swallowed transient timeout here would cache empty pins for the full TTL,
    // showing a polygon with zero homes for minutes. Throwing keeps the failure
    // out of unstable_cache so the next request retries.
    console.error('[getGeoBoundaryMapData] listings_in_boundary error:', {
      geoType,
      geoSlug,
      error,
    })
    throw new Error(`listings_in_boundary RPC failed for ${geoType}/${geoSlug}: ${error.message}`)
  }

  return ((data ?? []) as Array<{
    listing_key: string
    lat: number
    lng: number
    list_price: number | null
  }>).map((row) => ({
    listingKey: row.listing_key,
    lat: row.lat,
    lng: row.lng,
    price: row.list_price ?? null,
    photoUrl: null,
    streetNumber: null,
    streetName: null,
    streetSuffix: null,
    city: null,
    postalCode: null,
    beds: null,
    baths: null,
    sqft: null,
  }))
}

/** Enrich the bare boundary pins (lat/lng/price) with the listing tile fields the
 *  map info window needs: photo, address, beds/baths/sqft. One batch query by
 *  listing key, inside the same cache window as the rest of the map data. */
async function enrichPins(pins: BoundaryMapPin[]): Promise<BoundaryMapPin[]> {
  const keys = pins.map((p) => p.listingKey).filter(Boolean)
  if (keys.length === 0) return pins
  try {
    const { getListingTiles } = await import('@/lib/data/listings/getListingTiles')
    const tiles = await getListingTiles({ listingKeys: keys, limit: keys.length })
    const byKey = new Map(tiles.map((t) => [t.listingKey, t]))
    return pins.map((p) => {
      const t = byKey.get(p.listingKey)
      if (!t) return p
      return {
        ...p,
        photoUrl: t.photoUrl ?? null,
        streetNumber: t.streetNumber ?? null,
        streetName: t.streetName ?? null,
        streetSuffix: t.streetSuffix ?? null,
        city: t.city ?? null,
        postalCode: t.postalCode ?? null,
        beds: t.beds ?? null,
        baths: t.baths ?? null,
        sqft: t.sqft ?? null,
      }
    })
  } catch {
    // Enrichment is best-effort: a failure here still leaves a working map with
    // price-only pins rather than throwing away the whole map.
    return pins
  }
}

function cacheTTL(geoType: GeoType): number {
  return geoType === 'city' ? CACHE_WINDOWS.geoCity : CACHE_WINDOWS.geoNeighborhood
}

function cacheTags(geoType: GeoType, geoSlug: string): string[] {
  if (geoType === 'city') return [cacheTag.city(geoSlug), 'boundaries', 'listing-tiles']
  return [cacheTag.neighborhood(geoSlug), 'boundaries', 'listing-tiles']
}

async function fetchGeoBoundaryMapData(
  geoType: GeoType,
  geoSlug: string,
): Promise<GeoBoundaryMapData> {
  // Fetch the polygon ONCE. getBoundaryGeoJSON throws on a transient RPC error
  // (so this function throws → unstable_cache skips caching → the caller
  // degrades gracefully for one request and the next retries) and returns null
  // only for a genuine no-boundary geo (a cacheable empty result).
  const polygon = await getBoundaryGeoJSON({ geoType, geoSlug })
  if (!polygon) {
    // No boundary row — nothing to map. Cacheable empty (not a failure).
    return { polygon: null, pins: [] }
  }

  // fetchPins throws on a transient RPC error for the same no-poison reason.
  const pins = await fetchPins(geoType, geoSlug)
  const enriched = await enrichPins(pins)
  return { polygon, pins: enriched }
}

/**
 * Cached entry point. Key includes geoType + geoSlug so every unique geo
 * gets its own cache slot. Revalidates on the same TTL as geoCity /
 * geoNeighborhood so the map stays fresh alongside the rest of the page.
 */
export function getGeoBoundaryMapData(
  input: GeoBoundaryMapInput,
): Promise<GeoBoundaryMapData> {
  const { geoType, geoSlug } = input
  return unstable_cache(
    () => fetchGeoBoundaryMapData(geoType, geoSlug),
    // v4: resort boundaries corrected from the crude "spatial discovery" hulls
    // to the authoritative county-GIS plat unions (Tetherow: 5,718ac→699ac,
    // 149→29 homes). v3 busted land/junk rows; v2 the pre-index timeout poison.
    ['geo-boundary-map-v4', geoType, geoSlug],
    {
      revalidate: cacheTTL(geoType),
      tags: cacheTags(geoType, geoSlug),
    },
  )()
}
