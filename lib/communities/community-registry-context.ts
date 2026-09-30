/**
 * Which registry community a /communities/[slug] page is, derived exactly once.
 *
 * The raw name BEFORE SITE-28 resolution, so the <title> and the <h1> cannot
 * disagree. generateMetadata used to read getResortCommunityBySlug(slug) while
 * the body read the alias-aware resortMatch, which is a real divergence on
 * alias slugs (sisters-bbr: the head said "Bbr", the body said "Black Butte
 * Ranch"). The page head, the page body and the community's for-sale
 * population (lib/place/community-population.ts) all call this.
 *
 * Isomorphic: committed JSON only.
 */
import { cityResorts } from '@/lib/kb/resort-active-counts'
import { getResortCommunityBySlug } from '@/lib/data/communities/registry'

export function communityRegistryContext(
  community: { citySlug: string; subdivision: string; name: string },
  slug: string,
) {
  const subdivisionLc = community.subdivision.toLowerCase().trim()
  const resortMatch = cityResorts(community.citySlug).find(
    (r) =>
      r.slug === slug ||
      r.label.toLowerCase().trim() === subdivisionLc ||
      (r.subdivision_aliases ?? []).some((a) => a.toLowerCase().trim() === subdivisionLc),
  )
  const resortSlug = resortMatch?.slug ?? slug
  const registryEntry = getResortCommunityBySlug(resortSlug)
  return { resortMatch, resortSlug, registryEntry, rawName: registryEntry?.label ?? community.name }
}
