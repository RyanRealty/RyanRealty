/**
 * Lead geocoding + neighborhood/subdivision lookup.
 *
 * One helper used by:
 *   - app/lp/seller-home-value/actions.ts (per-submission, live geocode)
 *   - .tmp_env/fub-setup/17-geocode-leads.mjs (batch backfill)
 *
 * Pipeline:
 *   address string → Google Geocoding API → lat/lng
 *                  → Supabase RPC lookup_address_geo → city/neighborhood/subdivision slugs
 *                  → public.fub_person_geo upsert
 *                  → returns { tags, geo } so the caller can push tags to FUB
 *
 * Cost: ~$0.005 per geocode call (Google's standard rate). Single LP submission
 * is roughly $0.005. Bulk-tagging 3K leads is ~$15.
 *
 * Spec: docs/FUB_GEO_TAGGING_2026-05-17.md
 */

import { createClient } from '@supabase/supabase-js'

export type GeocodeResult = {
  lat: number
  lng: number
  confidence: string  // ROOFTOP | RANGE_INTERPOLATED | GEOMETRIC_CENTER | APPROXIMATE
  formatted: string
}

export type SpatialMatch = {
  city_slug: string | null
  neighborhood_slug: string | null
  subdivision_slug: string | null
}

export type LeadGeoResult = {
  ok: true
  geocode: GeocodeResult
  spatial: SpatialMatch
  tags: string[]            // ['city:bend', 'neighborhood:northwest-crossing', 'subdivision:awbrey-glen', 'geo:local']
  geo_scope: 'local' | 'out-of-area' | 'out-of-state'
} | {
  ok: false
  error: string
}

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createClient(url, key)
}

/**
 * Geocode an address via Google Geocoding API, biased to Oregon.
 *
 * Returns null if the API fails, ZERO_RESULTS, or any non-OK status.
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim()
  if (!key) {
    console.warn('[lead-geocode] NEXT_PUBLIC_GOOGLE_MAPS_API_KEY missing')
    return null
  }
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}&region=us&components=country:US|administrative_area:OR`
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) {
      console.warn(`[lead-geocode] HTTP ${res.status} from Google`)
      return null
    }
    const j = (await res.json()) as {
      status: string
      results?: Array<{
        formatted_address: string
        geometry: { location: { lat: number; lng: number }; location_type: string }
      }>
    }
    if (j.status !== 'OK' || !j.results?.length) return null
    const top = j.results[0]
    return {
      lat: top.geometry.location.lat,
      lng: top.geometry.location.lng,
      confidence: top.geometry.location_type,
      formatted: top.formatted_address,
    }
  } catch (err) {
    console.warn('[lead-geocode] network error:', err)
    return null
  }
}

/**
 * PostGIS point-in-polygon lookup. Returns the city, neighborhood, subdivision
 * slugs for a given lat/lng (any may be null if no containing polygon exists).
 */
export async function lookupSpatialMatch(lat: number, lng: number): Promise<SpatialMatch | null> {
  const supabase = getServiceSupabase()
  if (!supabase) return null
  try {
    const { data, error } = await supabase.rpc('lookup_address_geo', { lat, lng })
    if (error) {
      console.warn('[lead-geocode] RPC error:', error.message)
      return null
    }
    if (!data) return { city_slug: null, neighborhood_slug: null, subdivision_slug: null }
    const row = Array.isArray(data) ? data[0] : data
    return {
      city_slug: row?.city_slug ?? null,
      neighborhood_slug: row?.neighborhood_slug ?? null,
      subdivision_slug: row?.subdivision_slug ?? null,
    }
  } catch (err) {
    console.warn('[lead-geocode] lookup error:', err)
    return null
  }
}

/**
 * Determine geo_scope from a mailing address.
 *  - local       : property is in our service area (Deschutes / Crook / Jefferson)
 *  - out-of-area : OR but outside our service area
 *  - out-of-state: not OR
 */
export function inferGeoScope(state: string | null | undefined, spatial: SpatialMatch | null): 'local' | 'out-of-area' | 'out-of-state' {
  const st = (state || '').toUpperCase()
  if (st && st !== 'OR') return 'out-of-state'
  if (spatial?.city_slug) return 'local'
  return 'out-of-area'
}

/**
 * Build the canonical-namespace tag set from a spatial match.
 *
 * Always emits geo:<scope>. Adds city:, neighborhood:, subdivision: when matched.
 */
export function buildGeoTags(spatial: SpatialMatch | null, geoScope: 'local' | 'out-of-area' | 'out-of-state'): string[] {
  const tags: string[] = [`geo:${geoScope}`]
  if (spatial?.city_slug) tags.push(`city:${spatial.city_slug}`)
  if (spatial?.neighborhood_slug) tags.push(`neighborhood:${spatial.neighborhood_slug}`)
  if (spatial?.subdivision_slug) tags.push(`subdivision:${spatial.subdivision_slug}`)
  return tags
}

/**
 * End-to-end: geocode an address, do spatial lookup, persist to fub_person_geo,
 * and return the canonical tag set the caller can push to FUB.
 *
 * Designed to be fire-and-forget from the LP form — never throws; returns
 * { ok: false, error } so the caller can log + continue.
 */
export async function geocodeAndTagLead(params: {
  fubPersonId: number
  address: string
  sourceType?: 'mailing' | 'property' | 'lp-form'
  state?: string  // mailing state; if omitted, parsed from address
}): Promise<LeadGeoResult> {
  const { fubPersonId, address, sourceType = 'lp-form', state } = params

  if (!address?.trim()) {
    return { ok: false, error: 'address required' }
  }

  const geocode = await geocodeAddress(address)
  if (!geocode) return { ok: false, error: 'geocode failed' }

  const spatial = await lookupSpatialMatch(geocode.lat, geocode.lng)
  const geo_scope = inferGeoScope(state ?? parseStateFromAddress(address), spatial)
  const tags = buildGeoTags(spatial, geo_scope)

  // Persist to Supabase (fire-and-forget — log on failure, don't block caller)
  const supabase = getServiceSupabase()
  if (supabase) {
    const { error } = await supabase.from('fub_person_geo').upsert({
      fub_person_id: fubPersonId,
      source_address: address,
      source_type: sourceType,
      latitude: geocode.lat,
      longitude: geocode.lng,
      geocode_confidence: geocode.confidence,
      formatted_address: geocode.formatted,
      city_slug: spatial?.city_slug ?? null,
      neighborhood_slug: spatial?.neighborhood_slug ?? null,
      subdivision_slug: spatial?.subdivision_slug ?? null,
      geo_scope,
      owner_type: sourceType === 'mailing' ? 'occupied' : null,
      geocoded_at: new Date().toISOString(),
    }, { onConflict: 'fub_person_id' })
    if (error) console.warn('[lead-geocode] fub_person_geo upsert failed:', error.message)
  }

  return {
    ok: true,
    geocode,
    spatial: spatial ?? { city_slug: null, neighborhood_slug: null, subdivision_slug: null },
    tags,
    geo_scope,
  }
}

function parseStateFromAddress(address: string): string | undefined {
  // Try to extract a 2-letter state from "..., XX 99999" or "..., XX"
  const m = address.match(/,\s*([A-Z]{2})\s*(\d{5})?/i)
  return m?.[1]?.toUpperCase()
}
