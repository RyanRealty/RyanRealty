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
 *     2. Professional Area Guide photo (public/images/communities/<slug>.jpg)
 *     3. Central-Oregon-Golf LP photo for the community
 *     4. null (caller falls back to city asset_library photo via pickGeoImage)
 *
 * Area Guide photos sourced 2026-06-01 from snowdriftvisuals professional
 * photography (shared via Google Drive). Licensed to Ryan Realty. Covers
 * 5 of the 6 previously-null communities:
 *   broken-top       → Area Guide - Broken Top - 01.JPG         (entrance sign + pines)
 *   caldera-springs  → Area Guide - Caldera Springs - 01.JPG    (branded boulder + reflection)
 *   northwest-crossing→ Area Guide - Northwest Crossing - 01.JPG (roundabout drone)
 *   vandevert-ranch  → Area Guide - Vandevert Ranch - 01.JPG    (wooden gate entrance)
 *   three-rivers     → Area Guide - Three Rivers Recreation Sites - 01.JPG (entry sign)
 *
 * Still falling back to city asset_library (no photo found):
 *   black-butte-ranch → no snowdriftvisuals Area Guide photo exists in Drive
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
 *
 * Also includes the 5 communities whose Area Guide photos were sourced
 * 2026-06-01 from snowdriftvisuals professional photography (Google Drive).
 * Files are at public/images/communities/<slug>.jpg — processed to max
 * 1920px wide, EXIF-rotated, metadata stripped, jpeg q60-75.
 *
 * Coverage:
 *   tetherow          → dedicated LP aerial (highest quality)
 *   broken-top        → Area Guide 01 — entrance sign + pines       (1280x960,  384KB)
 *   caldera-springs   → Area Guide 01 — branded boulder + pool      (1280x853,  277KB)
 *   northwest-crossing→ Area Guide 01 — roundabout drone shot       (1920x1440, 393KB)
 *   vandevert-ranch   → Area Guide 01 — wooden gate entrance        (1280x853,  299KB)
 *   three-rivers      → Area Guide 01 — Three Rivers entry sign     (1920x1280, 355KB)
 *
 * Still no dedicated photo (city fallback remains):
 *   black-butte-ranch → no snowdriftvisuals Area Guide photo in Drive
 */
const COMMUNITY_DEDICATED_IMAGES: Record<string, string> = {
  // Tetherow: use the aerial course shot from its own LP — richer than the
  // golf-guide hero, which is a closer fairway shot.
  tetherow: '/lp/tetherow/img/tetherow-aerial-course.jpg',
  // Heath is a sub-plat at Tetherow — use the Tetherow aerial (genuinely the
  // same place) so the homepage tile shows a photo instead of the navy fallback.
  heath: '/lp/tetherow/img/tetherow-aerial-course.jpg',

  // Area Guide photos — snowdriftvisuals professional photography, 2026-06-01
  'broken-top': '/images/communities/broken-top.jpg',
  'caldera-springs': '/images/communities/caldera-springs.jpg',
  'northwest-crossing': '/images/communities/northwest-crossing.jpg',
  'vandevert-ranch': '/images/communities/vandevert-ranch.jpg',
  'three-rivers': '/images/communities/three-rivers.jpg',
}

// ---------------------------------------------------------------------------
// Central-Oregon-Golf LP photos — secondary tier.
// Files verified present at public/lp/central-oregon-golf/img/.
// ---------------------------------------------------------------------------

/**
 * Per-community curated images from the central-oregon-golf landing page.
 * Covers 7 of 14 resort communities. Remaining 7 have no curated LP photo
 * here; communityImage() checks COMMUNITY_DEDICATED_IMAGES first, so 5 of
 * those 7 now resolve to Area Guide photos before reaching this tier.
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
 * No curated LP photo — resolved by higher tiers or city fallback:
 *   broken-top        → COMMUNITY_DEDICATED_IMAGES (Area Guide photo)
 *   caldera-springs   → COMMUNITY_DEDICATED_IMAGES (Area Guide photo)
 *   northwest-crossing→ COMMUNITY_DEDICATED_IMAGES (Area Guide photo)
 *   vandevert-ranch   → COMMUNITY_DEDICATED_IMAGES (Area Guide photo)
 *   three-rivers      → COMMUNITY_DEDICATED_IMAGES (Area Guide photo)
 *   black-butte-ranch → city fallback (Sisters city photo) — no AG photo
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
 *   2. Area Guide photo at public/images/communities/<slug>.jpg
 *   3. Central-Oregon-Golf LP photo
 *   4. null — let the caller fall back to city asset_library via pickGeoImage
 *
 * Note: tiers 1 and 2 both live in COMMUNITY_DEDICATED_IMAGES (tetherow uses
 * the LP, the 5 Area Guide communities use /images/communities/<slug>.jpg).
 *
 * Mapping (all 14 communities → source):
 *   tetherow          → /lp/tetherow/img/tetherow-aerial-course.jpg          (dedicated LP)
 *   broken-top        → /images/communities/broken-top.jpg                   (Area Guide photo)
 *   caldera-springs   → /images/communities/caldera-springs.jpg              (Area Guide photo)
 *   northwest-crossing→ /images/communities/northwest-crossing.jpg           (Area Guide photo)
 *   vandevert-ranch   → /images/communities/vandevert-ranch.jpg              (Area Guide photo)
 *   three-rivers      → /images/communities/three-rivers.jpg                 (Area Guide photo)
 *   pronghorn         → /lp/central-oregon-golf/img/pronghorn-01.jpg         (golf LP)
 *   awbrey-glen       → /lp/central-oregon-golf/img/awbrey-glen-01.jpg       (golf LP)
 *   widgi-creek       → /lp/central-oregon-golf/img/widgi-creek-01.jpg       (golf LP)
 *   crosswater        → /lp/central-oregon-golf/img/crosswater-01.jpg        (golf LP)
 *   eagle-crest       → /lp/central-oregon-golf/img/eagle-crest-01.jpg       (golf LP)
 *   brasada-ranch     → /lp/central-oregon-golf/img/brasada-01.jpg           (golf LP)
 *   sunriver          → /lp/central-oregon-golf/img/sunriver-river.jpg       (golf LP)
 *   black-butte-ranch → null → Sisters city photo                            (city fallback — no AG photo)
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
