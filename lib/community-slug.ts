import { slugify, subdivisionEntityKey } from './slug'

/** Convert entity_key (e.g. "bend:sunriver") to URL slug "bend-sunriver". */
export function entityKeyToSlug(entityKey: string): string {
  return entityKey.replace(':', '-')
}

/** SEO-friendly community page path (e.g. "Bend", "Sunriver" -> "/communities/bend-sunriver"). Use for all community/subdivision links. */
export function communityPagePath(city: string, subdivision: string): string {
  return `/communities/${entityKeyToSlug(subdivisionEntityKey(city, subdivision))}`
}

/** Parse URL slug "bend-sunriver" to { city, subdivision }. Uses known cities to split. */
export function parseCommunitySlug(
  slug: string,
  citySlugs: Set<string>
): { city: string; subdivision: string } | null {
  const parts = slug.trim().toLowerCase().split('-')
  if (parts.length < 2) return null
  for (let i = 1; i < parts.length; i++) {
    const citySlug = parts.slice(0, i).join('-')
    if (citySlugs.has(citySlug)) {
      const subdivisionSlug = parts.slice(i).join('-')
      const format = (s: string) =>
        s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      return {
        city: format(citySlug),
        subdivision: format(subdivisionSlug),
      }
    }
  }
  return null
}
