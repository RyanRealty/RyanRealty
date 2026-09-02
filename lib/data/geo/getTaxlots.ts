/**
 * getTaxlots — the parcel (tax lot) polygons a page draws, from public.taxlots
 * through the `taxlots_near_point` and `taxlots_in_boundary` RPCs.
 *
 * WHAT THIS IS, AND WHAT IT IS NOT. The source is the county assessor's own
 * cadastral layer: Deschutes describes it as "all parcels in Deschutes County,
 * as found on the county Assessor's Maps". It is an assessor's record, not a
 * survey. Every surface that draws one of these lines carries
 * `TAXLOT_DISCLAIMER` beside the map, not in a footer — a drawn boundary
 * invites a reader to rely on it for where a fence goes, and this data cannot
 * carry that weight (CLAUDE.md §0).
 *
 * WHY AN RPC AND NOT A TABLE READ. Simplification happens server-side, to the
 * resolution the frame can actually draw. A parcel is stored at survey
 * precision; a listing map renders about 2m per unit, so shipping the raw
 * geometry would send vertices no screen can resolve. The RPC clips by radius
 * or boundary, simplifies to a caller-supplied tolerance, and returns GeoJSON.
 *
 * A read that fails THROWS rather than returning empty: this function is
 * unstable_cache-wrapped, and caching a failure would blank the parcel layer
 * for everyone for the full TTL. Empty is reserved for a genuine no-parcel.
 */
import { unstable_cache } from 'next/cache'
import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS } from '@/lib/data/cache/unstable-cache'

/** What a page must print beside any drawn parcel line. */
export const TAXLOT_DISCLAIMER =
  'Lot lines come from the county assessor’s tax maps. They show the recorded shape of a parcel, not a survey, and they are not a legal boundary. Order a survey before you rely on a line.'

export type Taxlot = {
  /** The county's own tax lot identifier, e.g. "171219DB02100". */
  taxlot: string
  /** The assessor map sheet it sits on. */
  mapNumber: string | null
  /** The county's property record for this lot, when it publishes one. */
  dialUrl: string | null
  /** Acres from the polygon on the spheroid, computed at ingest. */
  acres: number | null
  /** True for the lot the point falls inside — the home the page is about. */
  isSubject: boolean
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon
}

type NearRow = {
  taxlot: string | null
  map_number: string | null
  dial_url: string | null
  acres: number | string | null
  is_subject: boolean | null
  geojson: string | null
}

type BoundaryRow = Omit<NearRow, 'is_subject'>

function toTaxlot(row: NearRow | BoundaryRow, isSubject: boolean): Taxlot | null {
  const id = (row.taxlot ?? '').trim()
  if (!id || !row.geojson) return null
  let geometry: unknown
  try {
    geometry = JSON.parse(row.geojson)
  } catch {
    return null
  }
  if (
    !geometry ||
    typeof geometry !== 'object' ||
    !('type' in geometry) ||
    ((geometry as { type: string }).type !== 'Polygon' && (geometry as { type: string }).type !== 'MultiPolygon')
  ) {
    return null
  }
  const acres = row.acres == null ? null : Number(row.acres)
  return {
    taxlot: id,
    mapNumber: row.map_number?.trim() || null,
    dialUrl: row.dial_url?.trim() || null,
    acres: Number.isFinite(acres) && acres != null && acres > 0 ? acres : null,
    isSubject,
    geometry: geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon,
  }
}

export type TaxlotsNearInput = {
  lat: number
  lng: number
  /** Metres around the point. The subject lot plus what touches it. */
  radiusMeters?: number
  maxLots?: number
  /** Degrees of simplification. Default ≈1.7m, one unit of a 2km frame. */
  toleranceDegrees?: number
}

async function fetchTaxlotsNear(input: Required<TaxlotsNearInput>): Promise<Taxlot[]> {
  const supabase = supabaseAnon()
  if (!supabase) return []

  const { data, error } = await supabase.rpc('taxlots_near_point', {
    p_lon: input.lng,
    p_lat: input.lat,
    p_radius_m: input.radiusMeters,
    p_limit: input.maxLots,
    p_tolerance: input.toleranceDegrees,
  })

  if (error) {
    console.error('[getTaxlots] taxlots_near_point failed:', { input, error })
    throw new Error(`taxlots_near_point failed at ${input.lat},${input.lng}: ${error.message}`)
  }
  const rows = (data ?? []) as NearRow[]
  return rows.flatMap((r) => {
    const lot = toTaxlot(r, r.is_subject === true)
    return lot ? [lot] : []
  })
}

/**
 * The lot under a coordinate and the lots around it. The subject comes first;
 * a page that finds no subject draws nothing rather than outlining a
 * neighbour as if it were the home.
 */
export function getTaxlotsNear(input: TaxlotsNearInput): Promise<Taxlot[]> {
  const filled = {
    lat: input.lat,
    lng: input.lng,
    radiusMeters: input.radiusMeters ?? 150,
    maxLots: input.maxLots ?? 24,
    toleranceDegrees: input.toleranceDegrees ?? 0.000015,
  }
  if (!Number.isFinite(filled.lat) || !Number.isFinite(filled.lng)) return Promise.resolve([])
  // Rounded into the cache key: two homes on the same block share a read, and
  // the key does not carry a coordinate at survey precision.
  const key = `${filled.lat.toFixed(5)},${filled.lng.toFixed(5)}`
  return unstable_cache(
    () => fetchTaxlotsNear(filled),
    ['taxlots-near-v2', key, String(filled.radiusMeters), String(filled.maxLots), String(filled.toleranceDegrees)],
    { revalidate: CACHE_WINDOWS.taxlots, tags: ['taxlots'] },
  )()
}

export type TaxlotsInBoundaryInput = {
  /**
   * Null means "whichever row carries this slug". A plat page does not know
   * which type its own boundary is filed under — Awbrey Glen and Tetherow are
   * /subdivisions/ pages whose polygons live under 'neighborhood', because
   * they are registry communities — and asking for the wrong one silently
   * drew no lots.
   */
  geoType: 'city' | 'neighborhood' | 'subdivision' | null
  geoSlug: string
  maxLots?: number
  toleranceDegrees?: number
}

async function fetchTaxlotsInBoundary(input: Required<TaxlotsInBoundaryInput>): Promise<Taxlot[]> {
  const supabase = supabaseAnon()
  if (!supabase) return []

  const { data, error } = await supabase.rpc('taxlots_in_boundary', {
    p_geo_type: input.geoType,
    p_geo_slug: input.geoSlug,
    p_limit: input.maxLots,
    p_tolerance: input.toleranceDegrees,
  })

  if (error) {
    console.error('[getTaxlots] taxlots_in_boundary failed:', { input, error })
    throw new Error(`taxlots_in_boundary failed for ${input.geoType}/${input.geoSlug}: ${error.message}`)
  }
  const rows = (data ?? []) as BoundaryRow[]
  return rows.flatMap((r) => {
    const lot = toTaxlot(r, false)
    return lot ? [lot] : []
  })
}

/** Every lot inside a recorded boundary: what a plat page draws. */
export function getTaxlotsInBoundary(input: TaxlotsInBoundaryInput): Promise<Taxlot[]> {
  const filled = {
    geoType: input.geoType,
    geoSlug: input.geoSlug,
    maxLots: input.maxLots ?? 400,
    toleranceDegrees: input.toleranceDegrees ?? 0.00002,
  }
  if (!filled.geoSlug.trim()) return Promise.resolve([])
  return unstable_cache(
    () => fetchTaxlotsInBoundary(filled),
    [
      'taxlots-in-boundary-v2',
      filled.geoType ?? 'any',
      filled.geoSlug,
      String(filled.maxLots),
      String(filled.toleranceDegrees),
    ],
    { revalidate: CACHE_WINDOWS.taxlots, tags: ['taxlots', `${filled.geoType ?? 'any'}:${filled.geoSlug}`] },
  )()
}
