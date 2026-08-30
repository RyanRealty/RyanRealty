import { getResortCommunityContent } from '@/lib/resort-community-content'
import type { ResortCommunityContent } from '@/lib/resort-community-content'

/**
 * Leftover authored neighborhood file for a listing, if one exists.
 * Tries city-prefixed slug first (`bend-old-bend`), then the raw slug.
 */
export async function loadListingNeighborhoodContent(
  citySlug: string | null | undefined,
  neighborhoodSlug: string | null | undefined,
): Promise<ResortCommunityContent | null> {
  const nabe = neighborhoodSlug?.trim().toLowerCase() ?? ''
  if (!nabe) return null
  const city = citySlug?.trim().toLowerCase() ?? ''
  const slugs = [
    city && nabe.startsWith(`${city}-`) ? nabe : null,
    city && !nabe.startsWith(`${city}-`) ? `${city}-${nabe}` : null,
    nabe,
  ].filter((s): s is string => Boolean(s))
  const seen = new Set<string>()
  for (const slug of slugs) {
    if (seen.has(slug)) continue
    seen.add(slug)
    const content = await getResortCommunityContent(slug)
    if (content) return content
  }
  return null
}
