/**
 * getPlatFootprintTaxlots — the lot lines inside a plat whose footprint is a
 * UNION of recorded plats (SITE-56).
 *
 * `taxlots_in_boundary` clips to ONE row of public.boundaries, found by slug.
 * A page resolved through getSubdivisionFootprint's phase or member path has no
 * row of its own — 'diamond-bar-ranch' is not a slug the county filed, its four
 * phases are — so asking for its slug returns nothing and the plat draws no
 * lots. This asks for each part instead and concatenates, keeping the same
 * total cap the single-boundary call uses so a fifteen-phase resort cannot ship
 * fifteen times the geometry.
 *
 * Every part is a real recorded boundary row, so every lot returned was clipped
 * by PostGIS to a polygon the county filed — the same provenance a
 * single-boundary read has, and the caller prints TAXLOT_DISCLAIMER beside them
 * exactly as before.
 */

import { getTaxlotsInBoundary, type Taxlot } from '@/lib/data/geo/getTaxlots'

/** How many parts are worth reading. Beyond this the outline is the drawing. */
const MAX_PARTS = 12

export type PlatFootprintTaxlotsInput = {
  /** The recorded plat slugs the footprint is made of. */
  partSlugs: readonly string[]
  /** Total lots across every part. */
  maxLots?: number
}

export async function getPlatFootprintTaxlots(
  input: PlatFootprintTaxlotsInput,
): Promise<Taxlot[]> {
  const parts = input.partSlugs.filter((s) => s.trim().length > 0).slice(0, MAX_PARTS)
  if (parts.length === 0) return []
  const total = input.maxLots ?? 320
  const perPart = Math.max(24, Math.ceil(total / parts.length))
  const reads = await Promise.all(
    parts.map((slug) =>
      getTaxlotsInBoundary({ geoType: 'subdivision', geoSlug: slug, maxLots: perPart }).catch(
        (err) => {
          // Fail-open per part, but never silent: one part that times out must
          // not delete the lots of the parts that answered.
          console.error('[getPlatFootprintTaxlots] part failed', { slug, err })
          return [] as Taxlot[]
        },
      ),
    ),
  )
  const seen = new Set<string>()
  const out: Taxlot[] = []
  for (const lots of reads) {
    for (const lot of lots) {
      if (out.length >= total) return out
      if (seen.has(lot.taxlot)) continue
      seen.add(lot.taxlot)
      out.push(lot)
    }
  }
  return out
}
