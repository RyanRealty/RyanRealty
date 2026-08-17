/**
 * Buyable place on a blog post.
 *
 * Fleet content-blog: related homes render when the post is about a place a
 * shopper can buy. Community labels win over city (Eagle Crest in Redmond is
 * the resort, not the city inventory). Checklist and region-only posts return
 * null. Matching is slug/title/tags only, same haystack as matchGeoLinksForPost.
 */
import { SITE_CITY_SLUGS } from '@/lib/central-oregon'
import { matchGeoLinksForPost } from '@/lib/blog-geo-links'
import registry from '@/data/resort-communities.json'

export type BlogPlaceKind = 'city' | 'community'

export type BlogPlace = {
  kind: BlogPlaceKind
  slug: string
  label: string
  href: string
  /** MLS City or SubdivisionName values to fetch tiles with. */
  queryNames: string[]
}

type RegistryCommunity = {
  slug: string
  label: string
  subdivision_aliases?: string[]
}

const COMMUNITIES: RegistryCommunity[] = (
  registry as { communities: RegistryCommunity[] }
).communities

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function cityLabel(slug: string): string {
  return slug
    .split('-')
    .map((part) => (part ? part[0]!.toUpperCase() + part.slice(1) : part))
    .join(' ')
}

export function matchBlogCity(
  post: { slug: string; title?: string | null; tags?: string[] | null },
): BlogPlace | null {
  const haystack = ` ${norm(post.slug)} ${norm(post.title ?? '')} ${(post.tags ?? [])
    .map(norm)
    .join(' ')} `
  const cities = [...SITE_CITY_SLUGS].sort((a, b) => b.length - a.length)
  for (const slug of cities) {
    if (!haystack.includes(` ${norm(slug)} `)) continue
    const label = cityLabel(slug)
    return {
      kind: 'city',
      slug,
      label,
      href: `/cities/${slug}`,
      queryNames: [label],
    }
  }
  return null
}

export function matchBlogPlace(
  post: { slug: string; title?: string | null; tags?: string[] | null },
): BlogPlace | null {
  const community = matchGeoLinksForPost(post, 1)[0]
  if (community) {
    const row = COMMUNITIES.find((c) => c.slug === community.slug)
    const aliases = (row?.subdivision_aliases ?? [community.label]).filter((name) => name.trim())
    return {
      kind: 'community',
      slug: community.slug,
      label: community.label,
      href: community.href,
      queryNames: aliases.length > 0 ? aliases : [community.label],
    }
  }
  return matchBlogCity(post)
}
