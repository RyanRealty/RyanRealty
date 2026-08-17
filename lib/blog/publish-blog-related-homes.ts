/**
 * Related homes + contextual CTA on a blog post.
 *
 * Fleet content-blog: related homes render when the post is about a place a
 * shopper can buy. SITE_PAGE_STANDARD §7: neighborhood → see those homes;
 * lifestyle / relocation → talk to a broker. Lifestyle posts (arts, retirement
 * with no named place) must not invent a rail.
 *
 * Community matches reuse matchGeoLinksForPost (label, registry slug, or a
 * short alias in slug / title / tags). City matches require a buy-intent
 * token in slug or title so a regional lifestyle post tagged with a city
 * does not grow a Bend inventory rail. A neighborhood short name
 * (NW Crossing) wins over that city fallback.
 */
import { matchGeoLinksForPost } from '@/lib/blog-geo-links'
import { SITE_CITY_SLUGS } from '@/lib/central-oregon'
import resortRegistry from '@/data/resort-communities.json' assert { type: 'json' }

export type BuyablePlaceKind = 'community' | 'city'

export type BuyablePlace = {
  kind: BuyablePlaceKind
  slug: string
  label: string
  city: string
  citySlug: string
  href: string
}

type RegistryCommunity = {
  slug: string
  label: string
  city: string
  city_slug: string
}

const COMMUNITIES: RegistryCommunity[] = (
  resortRegistry as { communities: RegistryCommunity[] }
).communities

const CITY_LABEL: Record<string, string> = {
  bend: 'Bend',
  redmond: 'Redmond',
  sisters: 'Sisters',
  sunriver: 'Sunriver',
  'la-pine': 'La Pine',
  madras: 'Madras',
  prineville: 'Prineville',
  culver: 'Culver',
  terrebonne: 'Terrebonne',
  'powell-butte': 'Powell Butte',
}

const BUY_INTENT = /\b(neighborhoods?|homes?|buyers?|real estate|for sale|moving to|living in)\b/i

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function cityHaystack(post: { slug: string; title?: string | null }): string {
  return ` ${norm(post.slug)} ${norm(post.title ?? '')} `
}

export function matchBuyablePlaceForPost(post: {
  slug: string
  title?: string | null
  tags?: string[] | null
}): BuyablePlace | null {
  const geo = matchGeoLinksForPost(post, 1)[0]
  if (geo) {
    const row = COMMUNITIES.find((c) => c.slug === geo.slug)
    return {
      kind: 'community',
      slug: geo.slug,
      label: geo.label,
      city: geo.city,
      citySlug: row?.city_slug ?? geo.slug,
      href: geo.href,
    }
  }

  const hay = cityHaystack(post)
  if (!BUY_INTENT.test(hay)) return null

  const cities = SITE_CITY_SLUGS.map((slug) => ({
    slug,
    label: CITY_LABEL[slug] ?? slug,
    token: norm(CITY_LABEL[slug] ?? slug.replace(/-/g, ' ')),
  })).sort((a, b) => b.token.length - a.token.length)

  const hit = cities.find((c) => hay.includes(` ${c.token} `))
  if (!hit) return null
  return {
    kind: 'city',
    slug: hit.slug,
    label: hit.label,
    city: hit.label,
    citySlug: hit.slug,
    href: `/cities/${hit.slug}`,
  }
}

export type PublishedBlogRelatedHomes = {
  place: BuyablePlace
  listingKeys: string[]
}

export function publishBlogRelatedHomes(input: {
  place: BuyablePlace | null
  listingKeys: readonly string[]
}): PublishedBlogRelatedHomes | null {
  if (!input.place) return null
  const listingKeys = [...new Set(input.listingKeys.filter((k) => k.trim()))]
  if (listingKeys.length === 0) return null
  return { place: input.place, listingKeys }
}

export type BlogContextualCta = {
  label: string
  href: string
}

export function publishBlogContextualCta(place: BuyablePlace | null): BlogContextualCta {
  if (place) {
    return { label: `See ${place.label} homes`, href: place.href }
  }
  return { label: 'Talk to a broker', href: '/contact' }
}
