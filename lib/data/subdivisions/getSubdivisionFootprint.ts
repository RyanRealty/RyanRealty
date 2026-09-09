/**
 * getSubdivisionFootprint — the recorded polygons a plat page can actually draw.
 *
 * THE MISMATCH THIS EXISTS FOR. The MLS records a COARSER subdivision name than
 * the county records a plat under, so resolving a page's polygon by exact slug
 * finds nothing for a fifth of the class while the polygons sit in
 * public.boundaries under longer names. Measured 2026-09-09 across the 1,087
 * distinct SubdivisionName values on the 3,572 active single-family listings:
 * 175 match a recorded plat slug exactly; 208 more have no exact match while
 * recorded plats START WITH the name — the county's phases and additions; 74
 * more have no name match at all while their own homes already carry
 * `boundary_subdivision`, written by the point-in-polygon classifier. Diamond
 * Bar Ranch is the founding case: four recorded plats (Phase 1 through 4), one
 * active listing already stamped 'Diamond Bar Ranch Phase 1', and a page that
 * opened on cream over a collapsed map frame because 'diamond-bar-ranch' is not
 * a slug the county filed. Same coarse-name-against-fine-plat mismatch SITE-24
 * found in the closed-sale join and SITE-28 found in the display name.
 *
 * THE GEOMETRY WORK HAPPENS IN POSTGIS, not here: `public.subdivision_footprint`
 * (supabase/migrations/20260909190000_subdivision_footprint_rpc.sql) tries the
 * exact slug, then the phase/addition prefix, then the member plats the caller
 * names, and ST_Unions the parts so the shared edges between adjacent phases
 * dissolve into the development's own footprint. It refuses any union whose
 * envelope spans more than 0.15 degrees — a name prefix is a name match, and a
 * footprint the page cannot stand behind is worse than no footprint (§0).
 *
 * WHAT THE CALLER OWES THE READER. `footprintProvenance` writes the sentence
 * that says exactly what the outline is and who recorded it. A drawn boundary
 * is a claim about the world in the same way a printed number is, so a page
 * that draws one of these prints that sentence beside it.
 *
 * A failed read THROWS rather than returning null: this function is
 * unstable_cache-wrapped, and caching a transient failure would blank the
 * outline for everyone for the full TTL. `null` is reserved for a plat the
 * county genuinely never filed — the fallback path.
 */

import { unstable_cache } from 'next/cache'
import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { slugify } from '@/lib/slug'
import type { BoundaryGeometry } from '@/lib/data/geo/getBoundaryGeoJSON'

/** How the footprint was found. Ordered by how directly it names the place. */
export type PlatFootprintSource = 'exact' | 'phases' | 'members'

export type PlatFootprint = {
  /** The page's slug, the one that was asked for. */
  slug: string
  source: PlatFootprintSource
  /** The recorded plat slugs the footprint is made of, in slug order. */
  partSlugs: string[]
  /** Their recorded labels — "Diamond Bar Ranch Phase 1" — in the same order. */
  partLabels: string[]
  geometry: BoundaryGeometry
}

/** The authority behind every polygon in public.boundaries at geo_type 'subdivision'. */
export const PLAT_POLYGON_SOURCE = 'Deschutes County GIS recorded subdivisions'

type FootprintRow = {
  source?: string | null
  part_slugs?: string[] | null
  part_labels?: string[] | null
  geojson?: string | null
}

/**
 * The recorded plats the page's own homes were classified into, as slugs.
 * Deduped and sorted so the cache key is stable for one set of homes however
 * the rows came back ordered.
 */
export function platMemberSlugs(names: readonly (string | null | undefined)[]): string[] {
  const out = new Set<string>()
  for (const raw of names) {
    const name = (raw ?? '').trim()
    if (name.length === 0) continue
    const slug = slugify(name)
    if (slug && slug !== 'unknown') out.add(slug)
  }
  return [...out].sort()
}

/** Parse one RPC row, or null when it is not a footprint this page can draw. */
export function parseFootprintRow(slug: string, row: FootprintRow | null | undefined): PlatFootprint | null {
  if (!row) return null
  const source = row.source
  if (source !== 'exact' && source !== 'phases' && source !== 'members') return null
  const partSlugs = (row.part_slugs ?? []).filter((s): s is string => typeof s === 'string' && s.length > 0)
  const partLabels = (row.part_labels ?? []).filter((s): s is string => typeof s === 'string' && s.length > 0)
  if (partSlugs.length === 0) return null
  let geometry: unknown
  try {
    geometry = JSON.parse(row.geojson ?? '')
  } catch {
    return null
  }
  if (!geometry || typeof geometry !== 'object') return null
  const type = (geometry as { type?: unknown }).type
  if (type !== 'Polygon' && type !== 'MultiPolygon') return null
  return { slug, source, partSlugs, partLabels, geometry: geometry as BoundaryGeometry }
}

/**
 * The sentence a page prints beside an outline it drew from this footprint.
 * One clause for what the shape is, one for who recorded it.
 */
export function footprintProvenance(footprint: PlatFootprint, displayName: string): string {
  const n = footprint.partLabels.length
  const name = displayName.trim() || footprint.slug
  if (footprint.source === 'exact') {
    return `The outline is the recorded plat of ${name}, from ${PLAT_POLYGON_SOURCE}.`
  }
  const labels =
    n <= 4
      ? footprint.partLabels.join(', ')
      : `${footprint.partLabels.slice(0, 3).join(', ')} and ${n - 3} more`
  if (footprint.source === 'phases') {
    return n === 1
      ? `The outline is the recorded plat ${labels}, from ${PLAT_POLYGON_SOURCE}.`
      : `The outline is the ${n} recorded plats of ${name} joined into one shape — ${labels} — from ${PLAT_POLYGON_SOURCE}.`
  }
  return n === 1
    ? `The outline is the recorded plat ${labels}, the plat these homes were found inside, from ${PLAT_POLYGON_SOURCE}.`
    : `The outline is the ${n} recorded plats these homes were found inside — ${labels} — joined into one shape, from ${PLAT_POLYGON_SOURCE}.`
}

async function fetchSubdivisionFootprint(
  slug: string,
  memberSlugs: readonly string[],
): Promise<PlatFootprint | null> {
  const supabase = supabaseAnon()
  if (!supabase) return null

  const { data, error } = await supabase.rpc('subdivision_footprint', {
    p_slug: slug,
    p_member_slugs: memberSlugs.length > 0 ? [...memberSlugs] : null,
  })

  if (error) {
    console.error('[getSubdivisionFootprint] RPC error:', { slug, memberSlugs, error })
    throw new Error(`subdivision_footprint RPC failed for ${slug}: ${error.message}`)
  }
  const rows = (data ?? []) as FootprintRow[]
  return parseFootprintRow(slug, rows[0])
}

export type SubdivisionFootprintInput = {
  slug: string
  /**
   * The `boundary_subdivision` values the page's own listings carry. Optional:
   * without them the resolver still answers for every plat whose own name, or
   * whose phases, are on record.
   */
  memberNames?: readonly (string | null | undefined)[]
}

/** The recorded footprint for a plat page, or null when the county filed none. */
export function getSubdivisionFootprint(
  input: SubdivisionFootprintInput,
): Promise<PlatFootprint | null> {
  const slug = input.slug.trim()
  if (slug.length === 0) return Promise.resolve(null)
  const memberSlugs = platMemberSlugs(input.memberNames ?? [])
  return unstable_cache(
    () => fetchSubdivisionFootprint(slug, memberSlugs),
    ['subdivision-footprint-v1', slug, memberSlugs.join('|')],
    { revalidate: CACHE_WINDOWS.geoCommunity, tags: [cacheTag.community(slug), 'boundaries'] },
  )()
}
