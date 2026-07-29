/**
 * blog-geo-links — deterministic community cross-link matcher for blog posts.
 *
 * WHY (westside backlog #2, 2026-07-28): the six blog posts ranking for
 * community queries (GSC 93d) carried ZERO links to /communities/* — the
 * pages that hold inventory and lead capture. Ranking pages passed no
 * authority to converting pages. This module gives the blog template a
 * structural cross-link so every current and future post funnels to its
 * community page automatically — no per-post editing, no second source to
 * drift.
 *
 * Matching is deliberately narrow: the community label must appear in the
 * post's slug, title, or tags (never the body — body mentions are too noisy
 * and would over-link listicles). Capped at 2 matches, longest label first,
 * so "Broken Top" wins over any shorter accidental containment.
 */
import registry from '@/data/resort-communities.json'

export type GeoLink = {
  slug: string
  label: string
  city: string
  href: string
  /** Exact-match anchor for the query the community page targets. */
  anchor: string
}

type RegistryCommunity = {
  slug: string
  label: string
  city: string
}

const COMMUNITIES: RegistryCommunity[] = (
  registry as { communities: RegistryCommunity[] }
).communities

/** Normalize for containment checks: lowercase, collapse punctuation to spaces. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Match a post's slug/title/tags against the community registry.
 * Returns at most `max` links, longest label first (most specific wins).
 */
export function matchGeoLinksForPost(
  post: { slug: string; title?: string | null; tags?: string[] | null },
  max = 2,
): GeoLink[] {
  const haystack = ` ${norm(post.slug)} ${norm(post.title ?? '')} ${(post.tags ?? [])
    .map(norm)
    .join(' ')} `

  return COMMUNITIES.filter((c) => haystack.includes(` ${norm(c.label)} `))
    .sort((a, b) => b.label.length - a.label.length)
    .slice(0, max)
    .map((c) => ({
      slug: c.slug,
      label: c.label,
      city: c.city,
      href: `/communities/${c.slug}`,
      anchor: `${c.label} homes for sale`,
    }))
}
