/**
 * resolveAreaRedirect — soft-404 rescue for /subdivisions/[slug].
 *
 * The /subdivisions/[slug] route serves PLAT-level boundary slugs ONLY
 * (geo_type='subdivision' in `boundaries`, e.g. 'tetherow-phase-1',
 * 'awbrey-butte-homesites-phase-eight' — ~3,213 county plats). A
 * MARKETING-level area name ('awbrey-butte', 'tetherow') has no subdivision
 * boundary, so the page used to call notFound() — which, under streaming,
 * surfaces as a hollow HTTP 200 (a soft-404): bad UX, and an SEO sink if
 * anything ever links there.
 *
 * Those marketing names DO have a canonical home elsewhere:
 *   - Resort / area communities (data/resort-communities.json) live at
 *     /communities/<slug>            e.g. /communities/tetherow
 *   - Plain Bend neighborhoods live at /cities/bend/<slug>
 *                                      e.g. /cities/bend/awbrey-butte
 *     backed by a geo_type='neighborhood' boundary row keyed 'bend-<slug>'.
 *
 * This resolver maps such a slug to its canonical path so the page can issue a
 * PERMANENT redirect (308) instead of a soft-404. Returns null when the slug is
 * neither a registry community nor a known neighborhood boundary — a genuine
 * 404 the caller should notFound().
 *
 * Resolution order (matters):
 *   1. Resort / area registry — synchronous, no DB. Registry membership
 *      GUARANTEES /communities/<slug> resolves (getCommunityBySlug treats a
 *      registry/resort slug as a real community via its isResort signal), so a
 *      registry hit can never redirect into another 404.
 *   2. Bend-neighborhood boundary — one cached, indexed read of `boundaries`.
 *      Only reached on a registry miss.
 *
 * Data access: the registry is pure JSON; the neighborhood check is the single
 * permitted raw `boundaries` read (lives behind the DAL boundary, gate G1) and
 * is cached on the 'boundaries' tag. This whole resolver runs ONLY on the
 * soft-404 path — the ~3,213 valid plats short-circuit on a non-null polygon
 * upstream and never reach it.
 */

import { getBoundaryGeoJSON } from '@/lib/data/geo/getBoundaryGeoJSON'
import { getAllResortCommunities, getResortCommunityBySlug } from '@/lib/data/communities/registry'

export type AreaRedirect = {
  /** Canonical destination path, e.g. '/communities/tetherow'. */
  path: string
  /** Which branch matched — useful for logging and the contract test. */
  reason: 'resort-community' | 'city-neighborhood'
}

// ---------------------------------------------------------------------------
// City prefixes — sourced from the registry so they can't drift from the
// canonical city set. Used to recover the bare resort slug from a
// city-prefixed form ('bend-tetherow' → 'tetherow'). Longest-first so a
// multi-word city ('powell-butte') wins over any shorter prefix.
// ---------------------------------------------------------------------------

const CITY_PREFIXES = Array.from(
  new Set(getAllResortCommunities().map((c) => c.city_slug)),
).sort((a, b) => b.length - a.length)

function stripCityPrefix(slug: string): string | null {
  for (const city of CITY_PREFIXES) {
    if (slug.startsWith(`${city}-`)) return slug.slice(city.length + 1)
  }
  return null
}

/**
 * Resort / area community branch (synchronous). Accepts the bare registry slug
 * ('tetherow') or a city-prefixed form ('bend-tetherow') and returns the
 * canonical bare-slug /communities path, or null on a miss.
 */
function resortCommunityPath(slug: string): string | null {
  if (getResortCommunityBySlug(slug)) return `/communities/${slug}`
  const bare = stripCityPrefix(slug)
  if (bare && getResortCommunityBySlug(bare)) return `/communities/${bare}`
  return null
}

/**
 * Map a slug to the Bend-neighborhood boundary slug + the bare name slug.
 * Bend neighborhood boundaries are keyed 'bend-<name>'. Accept either the bare
 * marketing name ('awbrey-butte') or an already-prefixed slug
 * ('bend-awbrey-butte') — both resolve to the same boundary + canonical path.
 */
function bendNeighborhood(slug: string): { boundarySlug: string; nameSlug: string } {
  const nameSlug = slug.startsWith('bend-') ? slug.slice('bend-'.length) : slug
  return { boundarySlug: `bend-${nameSlug}`, nameSlug }
}

// ---------------------------------------------------------------------------
// Boundary existence check (the only impure part).
//
// MUST go through getBoundaryGeoJSON (the `boundary_geojson` SECURITY DEFINER
// RPC), NOT a raw `.from('boundaries')` select: anon has NO RLS policy on
// `boundaries`, so a direct anon read returns ZERO rows silently (no error) and
// every redirect would wrongly fall through to a soft-404. The RPC bypasses RLS
// the same way the city/neighborhood/community map data does. It is already
// unstable_cache-wrapped (cached on the 'boundaries' tag) and THROWS on a
// transient RPC error — which resolveAreaRedirect() catches → null → notFound()
// for that one request, never a cached false.
// ---------------------------------------------------------------------------

async function neighborhoodBoundaryExists(geoSlug: string): Promise<boolean> {
  const polygon = await getBoundaryGeoJSON({ geoType: 'neighborhood', geoSlug })
  return polygon !== null
}

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

/**
 * Dependency-injected core. Pure except for the injected
 * `neighborhoodExists` probe — lets the contract test exercise every branch
 * without a Supabase mock. Production callers use {@link resolveAreaRedirect}.
 */
export async function resolveAreaRedirectWith(
  rawSlug: string,
  neighborhoodExists: (geoSlug: string) => Promise<boolean>,
): Promise<AreaRedirect | null> {
  const slug = rawSlug.trim().toLowerCase()
  if (!slug) return null

  // 1. Resort / area community (registry) → /communities/<slug>. No DB.
  const communityPath = resortCommunityPath(slug)
  if (communityPath) return { path: communityPath, reason: 'resort-community' }

  // 2. Plain Bend neighborhood → /cities/bend/<slug>. One boundaries read.
  const { boundarySlug, nameSlug } = bendNeighborhood(slug)
  if (await neighborhoodExists(boundarySlug)) {
    return { path: `/cities/bend/${nameSlug}`, reason: 'city-neighborhood' }
  }

  return null
}

/**
 * Production entry point. Returns the canonical redirect target for a
 * marketing-level slug that missed the /subdivisions plat lookup, or null for a
 * genuine 404. Swallows a transient boundary-read error (returns null → the
 * caller falls through to notFound() for that one request).
 */
export function resolveAreaRedirect(rawSlug: string): Promise<AreaRedirect | null> {
  return resolveAreaRedirectWith(rawSlug, neighborhoodBoundaryExists).catch((err) => {
    console.error('[resolveAreaRedirect] resolution error:', { rawSlug, err })
    return null
  })
}
