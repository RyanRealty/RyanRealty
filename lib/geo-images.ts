/**
 * Geo imagery helpers — SOURCE OF TRUTH for golf / master-planned community
 * tile + hero images, plus the deterministic picker used to choose one image
 * per area tile from the asset_library pool.
 *
 * Locked 2026-05-28 (Matt directive): the "golf & master communities" section
 * uses these curated photos from the existing Central Oregon Golf landing page
 * (public/lp/central-oregon-golf/img/). Keyed by the resort-communities.json
 * slug. Add a new community here when its LP image lands. Communities without
 * a curated image fall back to their city's asset_library photo (see the city
 * page wiring) so a tile is never a blank box.
 *
 * Reusable across the city page, the /communities index, and any future page
 * that lists golf / master-planned communities — import from here, never
 * hardcode an /lp/... path in a component.
 */

/** registry slug → curated landing-page image (served from /public). */
export const GOLF_COMMUNITY_IMAGES: Record<string, string> = {
  tetherow: '/lp/central-oregon-golf/img/tetherow-hero.jpg',
  pronghorn: '/lp/central-oregon-golf/img/pronghorn-01.jpg',
  'awbrey-glen': '/lp/central-oregon-golf/img/awbrey-glen-01.jpg',
  'widgi-creek': '/lp/central-oregon-golf/img/widgi-creek-01.jpg',
  crosswater: '/lp/central-oregon-golf/img/crosswater-01.jpg',
  'eagle-crest': '/lp/central-oregon-golf/img/eagle-crest-01.jpg',
  'brasada-ranch': '/lp/central-oregon-golf/img/brasada-01.jpg',
}

export function golfCommunityImage(slug: string): string | null {
  return GOLF_COMMUNITY_IMAGES[slug] ?? null
}

/**
 * Deterministically pick one URL from a pool, seeded by a stable string
 * (e.g. the area slug) so a given place always shows the same photo but
 * different places vary. Returns null for an empty pool.
 */
export function pickGeoImage(urls: string[] | undefined, seed: string): string | null {
  if (!urls || urls.length === 0) return null
  let h = 0
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return urls[h % urls.length]
}
