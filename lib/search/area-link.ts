/**
 * area-link — build the "use this area in search" URL from a saved area's
 * shapes. Client-safe and pure.
 *
 * The search surface consumes `?shapes=<encoded>` on /homes-for-sale, encoded
 * by the canonical `encodeMapShapes` grammar in lib/map-polygon.ts (landed
 * this same wave: `p|xp;lat,lng;...` / `c|xc;lat,lng;radius`, '*'-joined).
 * This module converts a saved area's DB shape array ([lng,lat] tuples +
 * exclude flags, lib/data/areas/validation.ts) into DrawnShape[] ({lat,lng}
 * points) and defers to that one encoder so an area link and a hand-drawn
 * search serialize identically.
 *
 * Known cap: the URL grammar keeps at most 80 vertices per polygon
 * (MAX_POINTS in lib/map-polygon.ts) — a saved polygon denser than that is
 * simplified in the LINK only. The alert path never uses the URL: it resolves
 * areaIds → raw shapes via lib/alerts/area-resolve.ts at full fidelity, and
 * the in-map picker wave can swap this link for an ?areaIds= param without
 * touching callers (areaSearchHref is the single seam).
 */

import { encodeMapShapes, type DrawnShape } from '@/lib/map-polygon'
import type { AreaShape } from '@/lib/data/areas/validation'

/** Saved area shapes (DB contract, [lng,lat] tuples) → drawn shapes ({lat,lng}). */
export function areaShapesToDrawnShapes(shapes: AreaShape[]): DrawnShape[] {
  const out: DrawnShape[] = []
  for (const shape of shapes) {
    if (shape.type === 'polygon') {
      out.push({
        type: 'polygon',
        points: shape.coords.map(([lng, lat]) => ({ lat, lng })),
        exclude: shape.exclude === true,
      })
    } else {
      const [lng, lat] = shape.center
      out.push({
        type: 'circle',
        center: { lat, lng },
        radiusM: shape.radius_m,
        exclude: shape.exclude === true,
      })
    }
  }
  return out
}

/**
 * The "use in search" href for a saved area: /homes-for-sale?shapes=<encoded>.
 * Null when the area has no encodable include shape (an all-exclude or
 * degenerate set must not produce a whole-feed search link).
 */
export function areaSearchHref(shapes: AreaShape[]): string | null {
  const drawn = areaShapesToDrawnShapes(shapes)
  if (!drawn.some((s) => !s.exclude)) return null
  const encoded = encodeMapShapes(drawn)
  if (!encoded) return null
  const params = new URLSearchParams()
  params.set('shapes', encoded)
  return `/homes-for-sale?${params.toString()}`
}
