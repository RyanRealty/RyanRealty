import { homesForSalePath } from './slug'

/** Convert entity_key (e.g. "bend:sunriver") to URL slug "bend-sunriver". */
export function entityKeyToSlug(entityKey: string): string {
  return entityKey.replace(':', '-')
}

/** Canonical community/subdivision listings path (e.g. "Bend", "Sunriver" -> "/homes-for-sale/bend/sunriver"). */
export function communityPagePath(city: string, subdivision: string): string {
  return homesForSalePath(city, subdivision)
}

/**
 * Registry of bare resort-community slugs → city slug.
 * The 14 resort/master-planned communities in data/resort-communities.json
 * use bare slugs (e.g. "tetherow") as their canonical URL, NOT the
 * city-prefixed "bend-tetherow" format used by generic subdivisions.
 * This map lets parseCommunitySlug resolve bare slugs to their city.
 */
const RESORT_SLUG_TO_CITY: Record<string, string> = {
  tetherow:           'Bend',
  'broken-top':       'Bend',
  pronghorn:          'Bend',
  'awbrey-glen':      'Bend',
  'northwest-crossing': 'Bend',
  'widgi-creek':      'Bend',
  'vandevert-ranch':  'Bend',
  'three-rivers':     'Bend',
  'mt-bachelor-village': 'Bend',
  'inn-of-the-7th-mountain': 'Bend',
  'rivers-edge':      'Bend',
  'mountain-high':    'Bend',
  'crooked-river-ranch': 'Terrebonne',
  sunriver:           'Sunriver',
  crosswater:         'Sunriver',
  'caldera-springs':  'Sunriver',
  'eagle-crest':      'Redmond',
  'black-butte-ranch': 'Sisters',
  'brasada-ranch':    'Powell Butte',
}

/**
 * Format a slug into Title Case name (hyphens to spaces, each word capitalised).
 * "black-butte-ranch" → "Black Butte Ranch"
 */
function slugToTitle(s: string): string {
  return s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Parse a URL community slug to { city, subdivision }.
 *
 * Handles two formats:
 *   1. Bare resort slug — "tetherow", "broken-top", "sunriver"
 *      Resolved via RESORT_SLUG_TO_CITY registry (fast O(1) lookup).
 *   2. city-subdivision compound slug — "bend-sunriver", "redmond-eagle-crest"
 *      Resolved by scanning citySlugs (the existing algorithm).
 *
 * Returns null when the slug cannot be resolved to a known city.
 */
export function parseCommunitySlug(
  slug: string,
  citySlugs: Set<string>
): { city: string; subdivision: string } | null {
  const normalised = slug.trim().toLowerCase()

  // 1. Bare resort slug (highest precedence — checked first so "sunriver"
  //    resolves to { city: 'Sunriver', subdivision: 'Sunriver' } rather than
  //    falling into the compound-slug loop which would fail because
  //    parts.length < 2).
  if (RESORT_SLUG_TO_CITY[normalised]) {
    return {
      city:        RESORT_SLUG_TO_CITY[normalised]!,
      subdivision: slugToTitle(normalised),
    }
  }

  // 2. Compound city-subdivision slug (e.g. "bend-tetherow" or "bend-awbrey-glen")
  const parts = normalised.split('-')
  if (parts.length < 2) return null
  for (let i = 1; i < parts.length; i++) {
    const citySlug = parts.slice(0, i).join('-')
    if (citySlugs.has(citySlug)) {
      const subdivisionSlug = parts.slice(i).join('-')
      return {
        city:        slugToTitle(citySlug),
        subdivision: slugToTitle(subdivisionSlug),
      }
    }
  }

  return null
}
