/**
 * getPlatBoundaryCity — the city a recorded plat sits in, read from the
 * boundary tree itself (SITE-25 follow-up, 2026-09-09).
 *
 * WHY. /subdivisions/<slug> names its city from three sources in order: the
 * registry alias, the indexable set's modal closed-sale city, and the modal
 * city of the plat's own in-boundary listings. All three are LISTING-derived,
 * so a plat with no listing on record — courtyard-garages-at-broken-top, a
 * 0.0003 sq mi garage tract with zero sales inside it — titled itself
 * "| Central Oregon" while its polygon sits inside the Century West
 * neighborhood polygon, which sits inside the Bend city polygon. The county
 * plat tree already knows the city; this walks it.
 *
 * SOURCE. public.boundaries: the plat row (geo_type='subdivision', geo_slug)
 * → parent_id → ... until a row with geo_type='city'. 2,491 of 3,223 plat
 * rows carry a parent (broad count 2026-09-09). Walk is capped at four hops;
 * a plat with no parent chain, or a chain that never reaches a city, answers
 * null and the page says nothing about the city (§0: unknown is not a guess).
 *
 * Read cost: at most five single-row reads per plat, cached for the plat
 * polygon window (county plats effectively never move). Fallback null so a
 * transient failure is "unknown", never a wrong city.
 */

import { createServiceClient } from '@/lib/supabase/service'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'

export type PlatBoundaryCity = {
  city: string
  citySlug: string
  /**
   * The NEIGHBORHOOD the walk passed through on its way to the city, when the
   * chain has one (SITE-47). The walk already visited this row and threw it
   * away; keeping it is what lets the opening say "Park Addition sits inside
   * Old Bend, in Bend" instead of naming the city alone. Null when the plat's
   * parent is the city itself, or when the intermediate row is some other
   * grain. Only the FIRST neighborhood on the chain is kept — the nearest
   * container is the one a reader wants, and a second one would be a guess
   * about which of two overlapping polygons the plat "really" belongs to.
   */
  neighborhood: { label: string; slug: string } | null
}

type BoundaryRow = {
  id?: string | null
  geo_type?: string | null
  geo_slug?: string | null
  geo_label?: string | null
  parent_id?: string | null
}

const MAX_HOPS = 4

/** Pure walk over a row reader, so the test can drive it without a client. */
export async function walkPlatBoundaryCity(
  slug: string,
  readPlat: (geoSlug: string) => Promise<BoundaryRow | null>,
  readById: (id: string) => Promise<BoundaryRow | null>,
): Promise<PlatBoundaryCity | null> {
  const start = await readPlat(slug)
  if (!start) return null
  let parentId = start.parent_id ?? null
  let neighborhood: { label: string; slug: string } | null = null
  for (let hop = 0; hop < MAX_HOPS && parentId; hop += 1) {
    const row = await readById(parentId)
    if (!row) return null
    if (row.geo_type === 'city' && row.geo_slug && row.geo_label) {
      return { city: row.geo_label, citySlug: row.geo_slug, neighborhood }
    }
    // The nearest neighborhood on the chain, kept for the opening's sentence.
    // A chain that never reaches a city still answers null below: a
    // neighborhood with no city above it is not a setting anyone can name.
    if (neighborhood == null && row.geo_type === 'neighborhood' && row.geo_slug && row.geo_label) {
      neighborhood = { label: row.geo_label, slug: row.geo_slug }
    }
    parentId = row.parent_id ?? null
  }
  return null
}

async function fetchPlatBoundaryCity(slug: string): Promise<PlatBoundaryCity | null> {
  const supabase = createServiceClient()
  const cols = 'id,geo_type,geo_slug,geo_label,parent_id'
  const readPlat = async (geoSlug: string) => {
    const { data, error } = await supabase
      .from('boundaries')
      .select(cols)
      .eq('geo_type', 'subdivision')
      .eq('geo_slug', geoSlug)
      .limit(1)
      .maybeSingle()
    if (error) throw new Error(`getPlatBoundaryCity: ${error.message}`)
    return (data as BoundaryRow | null) ?? null
  }
  const readById = async (id: string) => {
    const { data, error } = await supabase.from('boundaries').select(cols).eq('id', id).maybeSingle()
    if (error) throw new Error(`getPlatBoundaryCity: ${error.message}`)
    return (data as BoundaryRow | null) ?? null
  }
  return walkPlatBoundaryCity(slug, readPlat, readById)
}

/** Cached per plat slug (unstable_cache keys on the argument). */
export const getPlatBoundaryCity = makeResilientCached(
  fetchPlatBoundaryCity,
  ['plat-boundary-city-v1'],
  {
    revalidate: CACHE_WINDOWS.marketStats,
    tags: [cacheTag.market, 'boundaries'],
  },
  null,
)
