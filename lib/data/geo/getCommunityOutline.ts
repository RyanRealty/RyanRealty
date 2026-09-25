/**
 * getCommunityOutlineGeoJSON: a registry community's outline: its stored
 * `boundaries` neighborhood row, keyed by the registry's durable slug, read
 * only when the trust rule allows it (lib/communities/community-outline.ts).
 *
 * WHAT THIS REPLACED (2026-09-25). getResortBoundaryGeoJSON unioned every
 * county plat whose LABEL contained a pattern (resort_plat_union_geojson,
 * RESORT_PLAT_PATTERNS) and outranked the stored row. A label is not a
 * membership record:
 *   - '%broken top%' unioned 2,043.3 acres against the stored 491.3: it pulled
 *     in "Highlands At Broken Top Phase 2" (d4b35ef1, 1,071.9 acres), which
 *     covers 692.6 of Tetherow's 699.3 acres, so the
 *     Broken Top map counted all of Tetherow, Skyliner Summit, the Highlands
 *     and the Parks: 55 for sale against 19 inside the recorded outline;
 *   - '%vandevert%' added Vandevert Acres (+119.2 acres), 2 for sale against 0.
 * The other seven pattern unions equalled their stored rows (0.0 acre
 * difference), because the stored rows were rebuilt from the same plats on
 * 2026-08-23 WITH the curated exclusions the pattern could not express. So the
 * stored row is the one outline, for every community and every caller: the
 * community page, the listing page's frame, the community type pages, and the
 * Atlas dots route.
 *
 * Null when the URL is not a registry community, when the outline is not
 * trusted, or when no row is stored.
 */

import { getBoundaryGeoJSON, type BoundaryGeometry } from '@/lib/data/geo/getBoundaryGeoJSON'
import { communityOutlineRef } from '@/lib/communities/community-outline'

export async function getCommunityOutlineGeoJSON(slug: string): Promise<BoundaryGeometry | null> {
  const ref = communityOutlineRef(slug)
  if (!ref || !ref.trusted) return null
  return getBoundaryGeoJSON({ geoType: 'neighborhood', geoSlug: ref.outlineSlug })
}
