/**
 * Geo imagery helpers — SOURCE OF TRUTH for golf / master-planned community
 * tile + hero images, plus the deterministic picker used to choose one image
 * per area tile from the asset_library pool.
 *
 * Locked 2026-05-28 (Matt directive): the "golf & master communities" section
 * uses curated photos from the existing Central Oregon Golf landing page
 * (public/lp/central-oregon-golf/img/) and the Tetherow LP
 * (public/lp/tetherow/img/). Keyed by the resort-communities.json slug.
 *
 * `communityImage(slug)` — FULL resolver (hero + tile consumers).
 *   Priority order:
 *     1. Dedicated LP photo for that specific community (tetherow/img/ etc.)
 *     2. Central-Oregon-Golf LP photo for the community
 *     3. null (caller falls back to city asset_library photo via pickGeoImage)
 *
 * For communities that have no dedicated LP photo (broken-top, caldera-springs,
 * sunriver, northwest-crossing, black-butte-ranch, vandevert-ranch, three-rivers)
 * the resolver returns null so the page falls back to the city's asset_library
 * pool (Bend photos for Bend-city communities, Sisters for BBR, etc.). This is
 * intentional — a genuine city photo is better than a mismatched one.
 *
 * `golfCommunityImage(slug)` — legacy alias pointing at the same table;
 * existing callers continue to work unchanged.
 *
 * Reusable across the city page, the /communities index, community detail pages,
 * and any future page that lists golf / master-planned communities — import from
 * here, never hardcode an /lp/... path in a component.
 */

// ---------------------------------------------------------------------------
// Primary LP images — specific to each community, highest priority.
// ---------------------------------------------------------------------------

/**
 * Community-specific dedicated LP photos.
 * Tetherow has its own LP with aerial course photography.
 */
const COMMUNITY_DEDICATED_IMAGES: Record<string, string> = {
  // Tetherow: use the aerial course shot from its own LP — richer than the
  // golf-guide hero, which is a closer fairway shot.
  tetherow: '/lp/tetherow/img/tetherow-aerial-course.jpg',
}

// ---------------------------------------------------------------------------
// Central-Oregon-Golf LP photos — secondary tier.
// Files verified present at public/lp/central-oregon-golf/img/.
// ---------------------------------------------------------------------------

/**
 * Per-community curated images from the central-oregon-golf landing page.
 * Covers 7 of 14 resort communities. Remaining 7 have no curated LP photo
 * here; communityImage() returns null so city-level photos fill the gap.
 *
 * Coverage:
 *   tetherow        → tetherow-hero.jpg   (secondary; dedicated wins above)
 *   pronghorn       → pronghorn-01.jpg
 *   awbrey-glen     → awbrey-glen-01.jpg
 *   widgi-creek     → widgi-creek-01.jpg
 *   crosswater      → crosswater-01.jpg
 *   eagle-crest     → eagle-crest-01.jpg
 *   brasada-ranch   → brasada-01.jpg
 *   sunriver        → sunriver-river.jpg  (Sunriver river scene)
 *
 * No curated LP photo (falls back to city asset_library):
 *   broken-top        → Bend city photo
 *   caldera-springs   → Sunriver city photo
 *   northwest-crossing→ Bend city photo
 *   black-butte-ranch → Sisters city photo
 *   vandevert-ranch   → Bend city photo
 *   three-rivers      → Bend city photo
 */
export const GOLF_COMMUNITY_IMAGES: Record<string, string> = {
  tetherow: '/lp/central-oregon-golf/img/tetherow-hero.jpg',
  pronghorn: '/lp/central-oregon-golf/img/pronghorn-01.jpg',
  'awbrey-glen': '/lp/central-oregon-golf/img/awbrey-glen-01.jpg',
  'widgi-creek': '/lp/central-oregon-golf/img/widgi-creek-01.jpg',
  crosswater: '/lp/central-oregon-golf/img/crosswater-01.jpg',
  'eagle-crest': '/lp/central-oregon-golf/img/eagle-crest-01.jpg',
  'brasada-ranch': '/lp/central-oregon-golf/img/brasada-01.jpg',
  sunriver: '/lp/central-oregon-golf/img/sunriver-river.jpg',
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Full community image resolver — ALL 14 resort communities.
 *
 * Priority:
 *   1. Dedicated LP photo for that community (highest quality, most specific)
 *   2. Central-Oregon-Golf LP photo
 *   3. null — let the caller fall back to city asset_library via pickGeoImage
 *
 * Mapping (all 14 communities → source):
 *   tetherow          → /lp/tetherow/img/tetherow-aerial-course.jpg     (dedicated LP)
 *   pronghorn         → /lp/central-oregon-golf/img/pronghorn-01.jpg    (golf LP)
 *   awbrey-glen       → /lp/central-oregon-golf/img/awbrey-glen-01.jpg  (golf LP)
 *   widgi-creek       → /lp/central-oregon-golf/img/widgi-creek-01.jpg  (golf LP)
 *   crosswater        → /lp/central-oregon-golf/img/crosswater-01.jpg   (golf LP)
 *   eagle-crest       → /lp/central-oregon-golf/img/eagle-crest-01.jpg  (golf LP)
 *   brasada-ranch     → /lp/central-oregon-golf/img/brasada-01.jpg      (golf LP)
 *   sunriver          → /lp/central-oregon-golf/img/sunriver-river.jpg  (golf LP)
 *   broken-top        → null → Bend city photo                          (city fallback)
 *   caldera-springs   → null → Sunriver city photo                      (city fallback)
 *   northwest-crossing→ null → Bend city photo                          (city fallback)
 *   black-butte-ranch → null → Sisters city photo                       (city fallback)
 *   vandevert-ranch   → null → Bend city photo                          (city fallback)
 *   three-rivers      → null → Bend city photo                          (city fallback)
 */
export function communityImage(slug: string): string | null {
  return (
    COMMUNITY_DEDICATED_IMAGES[slug] ??
    GOLF_COMMUNITY_IMAGES[slug] ??
    null
  )
}

/**
 * Legacy alias — existing callers that import `golfCommunityImage` continue
 * to work. New code should prefer `communityImage`.
 */
export function golfCommunityImage(slug: string): string | null {
  return communityImage(slug)
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

// ---------------------------------------------------------------------------
// City hero photos — VERIFIED to depict the actual city (data-accuracy rule).
//
// Root cause of the wrong-city bug (IMG-01): the cities table has no
// hero_image_url, so every city page passed no photo and HeroBlock fell back to
// the hardcoded Bend Old Mill shot — showing Bend on Redmond, Sisters, etc.
// cityHero(slug) GUARANTEES a non-Bend city can never render the Bend photo.
//
// Each entry's alt text describes what the photo ACTUALLY shows (honest per the
// data-accuracy rule). Cities without a verified per-city photo yet use a
// regional Cascade-Range image (true for all of Central Oregon, never a
// specific wrong city) until a curated hero is sourced + verified.
// ---------------------------------------------------------------------------

export type CityHero = { src: string; alt: string }

const CITY_HERO: Record<string, CityHero> = {
  bend: {
    src: '/brand/hero/hero-old-mill-master-4k.jpg',
    alt: 'The Old Mill District and Deschutes River in Bend, Oregon',
  },
  sisters: {
    src: '/lp/central-oregon-golf/img/three-sisters-backdrop.jpg',
    alt: 'The Three Sisters mountains rising above Sisters, Oregon',
  },
  sunriver: {
    src: '/lp/central-oregon-golf/img/sunriver-river.jpg',
    alt: 'The Deschutes River winding through Sunriver, Oregon',
  },
}

/** Regional fallback — accurate for any Central Oregon place; NEVER the Bend
 *  Old Mill. Replaced per-city as curated heroes are sourced + verified. */
const REGION_HERO: CityHero = {
  src: '/lp/central-oregon-golf/img/three-sisters-backdrop.jpg',
  alt: 'The Cascade Range over Central Oregon',
}

/** Resolve a verified hero photo for a city slug. Never returns the Bend
 *  Old Mill photo for a non-Bend city. */
export function cityHero(slug: string): CityHero {
  return CITY_HERO[slug] ?? REGION_HERO
}

/** True when a slug has a city-specific (not regional-fallback) verified hero.
 *  Used by the check-geo-hero gate to track sourcing coverage. */
export function hasCuratedCityHero(slug: string): boolean {
  return slug in CITY_HERO
}
