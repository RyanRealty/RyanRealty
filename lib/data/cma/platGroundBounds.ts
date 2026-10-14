/**
 * THE BOX AROUND A GROUND'S RECORDED PLATS, for pushing the ground INTO a
 * listings read (reader review 2026-10-08).
 *
 * The CMA reads that ask "which homes sit on the subject's ground" used to
 * prefilter on the typed MLS name (SubdivisionName = / IN / ILIKE), so a row
 * on the same plat under another spelling ("Northwest Townsite Co 2nd Addt"
 * for "Northwest Townsite") never reached the polygon test. Each of those
 * reads now also reads the rows inside this box and lets the one ground
 * decision (lib/pricing/plat-ground.ts) keep the rows the polygon puts on
 * the ground. The box is a superset, never the decision.
 *
 * SOURCES. The county's recorded plats (getRecordedPlatTree, public.boundaries,
 * cached 6h) say which plats relate to the ground; the PostGIS union of their
 * polygons (getPlatFamilyFootprint, the subdivision_footprint RPC, cached 6h)
 * gives the outline. Two outlines:
 *   - the ground's own plats, their phases and alias siblings, whole;
 *   - the family-only plats in the same town, cut to the box of the ground's
 *     neighborhood or community polygon, because a family member counts only
 *     inside it (Northwest Townsite First Addition sits in Larkspur, two
 *     miles from the Second Addition, and would only widen the read).
 *
 * Null when the ground has no recorded plat, or when no outline can be read:
 * the caller then reads by name alone, exactly as before. Never throws.
 */

import 'server-only'
import { geometryBounds, marketAreaBounds, type LatLngBounds } from '@/lib/cma/market-area'
import { getPlatFamilyFootprint } from '@/lib/data/subdivisions/getPlatFamilyFootprint'
import { getRecordedPlatTree } from '@/lib/data/subdivisions/getRecordedPlatTree'
import { citySlug } from '@/lib/pricing/classes'
import { relatedPlats, type PlatGround } from '@/lib/pricing/plat-ground'

/** The smallest box holding both, or whichever exists. */
export function unionBounds(a: LatLngBounds | null, b: LatLngBounds | null): LatLngBounds | null {
  if (!a) return b
  if (!b) return a
  return {
    latMin: Math.min(a.latMin, b.latMin),
    latMax: Math.max(a.latMax, b.latMax),
    lngMin: Math.min(a.lngMin, b.lngMin),
    lngMax: Math.max(a.lngMax, b.lngMax),
  }
}

/** The overlap of two boxes, or null when they do not overlap. */
export function intersectBounds(a: LatLngBounds, b: LatLngBounds): LatLngBounds | null {
  const out = {
    latMin: Math.max(a.latMin, b.latMin),
    latMax: Math.min(a.latMax, b.latMax),
    lngMin: Math.max(a.lngMin, b.lngMin),
    lngMax: Math.min(a.lngMax, b.lngMax),
  }
  return out.latMin <= out.latMax && out.lngMin <= out.lngMax ? out : null
}

async function outlineBox(label: string, members: readonly string[]): Promise<LatLngBounds | null> {
  if (members.length === 0) return null
  try {
    const footprint = await getPlatFamilyFootprint({ familySlug: label, memberSlugs: members })
    return geometryBounds(footprint?.geometry ?? null)
  } catch (err) {
    console.error('[getPlatGroundBounds] outline', label, err instanceof Error ? err.message : String(err))
    return null
  }
}

export async function getPlatGroundBounds(
  ground: PlatGround,
  opts: { city?: string | null } = {},
): Promise<LatLngBounds | null> {
  if (ground.platSlugs.length === 0) return null
  let county: string[] = []
  try {
    const tree = await getRecordedPlatTree()
    const town = opts.city?.trim() ? citySlug(opts.city) : null
    county = tree.plats
      .filter((p) => !town || !p.treeCitySlug || p.treeCitySlug === town)
      .map((p) => p.slug)
  } catch (err) {
    console.error('[getPlatGroundBounds] plat tree', err instanceof Error ? err.message : String(err))
  }
  const related = relatedPlats(ground, [...ground.platSlugs, ...county])
  const [own, family] = await Promise.all([
    outlineBox('cma-ground', related.plat),
    outlineBox('cma-ground-family', related.family),
  ])
  const parentBox = ground.parent ? marketAreaBounds(ground.parent) : null
  const familyBox = family && parentBox ? intersectBounds(family, parentBox) : ground.parent ? null : family
  return unionBounds(own, familyBox)
}
