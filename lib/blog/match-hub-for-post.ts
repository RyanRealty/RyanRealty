/**
 * Contextual inventory hub for a blog post.
 *
 * A community named in slug / title / tags wins (matchGeoLinksForPost).
 * Otherwise a named city in that same haystack lands on /homes-for-sale/{city}
 * with the exact-match inventory anchor. Lifestyle posts that name no place
 * return null — they keep the existing "Talk to a broker" CTA.
 */
import { matchGeoLinksForPost, type GeoLink } from '@/lib/blog-geo-links'
import {
  HOMES_FOR_SALE_CITY_HUBS,
  type AreaHubLink,
} from '@/lib/site/homes-for-sale-by-area'

export type BlogHubLink = Pick<GeoLink, 'slug' | 'label' | 'href' | 'anchor'> & {
  kind: 'community' | 'city'
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function matchHubForPost(post: {
  slug: string
  title?: string | null
  tags?: string[] | null
}): BlogHubLink | null {
  const geo = matchGeoLinksForPost(post, 1)[0]
  if (geo) {
    return {
      kind: 'community',
      slug: geo.slug,
      label: geo.label,
      href: geo.href,
      anchor: geo.anchor,
    }
  }

  const haystack = ` ${norm(post.slug)} ${norm(post.title ?? '')} ${(post.tags ?? [])
    .map(norm)
    .join(' ')} `
  const cities = [...HOMES_FOR_SALE_CITY_HUBS].sort((a, b) => b.label.length - a.label.length)
  const hit = cities.find((c) => haystack.includes(` ${norm(c.label)} `))
  if (!hit) return null
  return cityHubLink(hit)
}

function cityHubLink(hub: AreaHubLink): BlogHubLink {
  return {
    kind: 'city',
    slug: hub.slug,
    label: hub.label,
    href: hub.href,
    anchor: hub.anchor,
  }
}
