/**
 * Live featured-community slugs that use the comm-d restyle.
 *
 * HOLD stays on the existing KB template: sunriver (resort page), Discovery West
 * (404), Tree Farm (no page), Caraway (404). Seventh Mountain as an MPC is not
 * a separate route; `/communities/inn-of-the-7th-mountain` is the live page.
 * `/communities/juniper-preserve` is 404; Pronghorn keeps `/communities/pronghorn`.
 *
 * Catch-all `/communities/{city}-{anything}` 200s are not this list.
 */

export const FEATURED_COMMUNITY_SLUGS = [
  'tetherow',
  'broken-top',
  'eagle-crest',
  'pronghorn',
  'caldera-springs',
  'awbrey-glen',
  'northwest-crossing',
  'crosswater',
  'black-butte-ranch',
  'brasada-ranch',
  'widgi-creek',
  'vandevert-ranch',
  'three-rivers',
  'mt-bachelor-village',
  'inn-of-the-7th-mountain',
  'rivers-edge',
  'mountain-high',
  'crooked-river-ranch',
  'bend-westgate',
  'bend-petrosa',
  'bend-shevlin-commons',
] as const

export type FeaturedCommunitySlug = (typeof FEATURED_COMMUNITY_SLUGS)[number]

export const HELD_COMMUNITY_SLUGS = ['sunriver'] as const

const FEATURED = new Set<string>(FEATURED_COMMUNITY_SLUGS)
const HELD = new Set<string>(HELD_COMMUNITY_SLUGS)

export function isFeaturedCommunitySlug(slug: string): boolean {
  const key = slug.trim().toLowerCase()
  if (!key || HELD.has(key)) return false
  return FEATURED.has(key)
}

/** Bare resort slug, or the trailing segment of a compound city slug. */
export function featuredSlugOf(slug: string): string {
  const key = slug.trim().toLowerCase()
  if (FEATURED.has(key)) return key
  for (const featured of FEATURED_COMMUNITY_SLUGS) {
    if (key === featured || key.endsWith(`-${featured}`)) return featured
  }
  return key
}
