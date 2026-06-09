/**
 * Pulse feed accessor for the marketing brain's published content stream.
 *
 * The brain publishes blog posts to `public.blog_posts` and (eventually)
 * per-platform social posts to `public.content_calendar`. Once a row reaches
 * `status='published'`, it's also eligible to appear on /pulse as a lifestyle
 * card. Same content, multiple surfaces — no hand-curation.
 *
 * Source-of-truth tables:
 *   - `blog_posts`         · long-form ryan-realty.com/blog/[slug] entries
 *   - `content_calendar`   · per-platform publishes (IG/FB/LinkedIn/etc.) with asset_url + platform_post_id
 *   - `content_performance` · post-publish 48h/7d/30d metrics
 *
 * This file reads blog_posts via the canonical cached DAL reader
 * (getPublishedBlogPosts from @/lib/data). The raw supabase query that used
 * to live here was repointed to the DAL as part of Gate 6 (2026-06-09).
 */

import { getPublishedBlogPosts } from '@/lib/data/blog/getPublishedBlogPosts'

export type BrainBlogCard = {
  /** Stable card id. */
  id: string
  /** Lifestyle category — drives chip tone. Derived from blog category. */
  category: 'news' | 'neighborhood' | 'culture' | 'event' | 'outdoor' | 'dining'
  /** Chip text. */
  kicker: string
  /** Display headline. */
  headline: string
  /** One-line body. */
  body: string
  /** Hero image URL — already a CDN URL when published by the brain. */
  backgroundImage: string
  /** Alt text. */
  backgroundAlt: string
  /** Where the card tap goes — the blog post URL. */
  href: string
  /** ISO publish date — used for "X days ago" + freshness ranking. */
  publishedAt: string | null
  /** Original blog category, in case the consumer wants to display it raw. */
  blogCategory: string | null
  /** Brain-assigned tags for personalization signals. */
  tags: string[]
}

/** Map blog category → pulse-feed category for chip tone + filter logic. */
function mapCategoryToTone(blogCategory: string | null): BrainBlogCard['category'] {
  const c = (blogCategory ?? '').toLowerCase()
  if (c.includes('news') || c.includes('market')) return 'news'
  if (c.includes('community') || c.includes('neighborhood') || c.includes('spotlight')) return 'neighborhood'
  if (c.includes('lifestyle') || c.includes('living') || c.includes('culture')) return 'culture'
  if (c.includes('event')) return 'event'
  if (c.includes('outdoor') || c.includes('trail')) return 'outdoor'
  if (c.includes('food') || c.includes('dining') || c.includes('restaurant')) return 'dining'
  return 'culture'
}

/** Human-readable kicker (chip text) per category. */
function kickerForCategory(category: BrainBlogCard['category']): string {
  switch (category) {
    case 'news': return 'Local housing news'
    case 'neighborhood': return 'Community spotlight'
    case 'culture': return 'Lifestyle & living'
    case 'event': return 'Bend events'
    case 'outdoor': return 'On the trail'
    case 'dining': return 'Where to eat'
    default: return 'From Ryan Realty'
  }
}

/**
 * Cached read of the brain's published blog feed.
 *
 * Delegates to the canonical DAL reader (getPublishedBlogPosts) which already
 * uses makeResilientCached with a 600s TTL and the 'blog' cache tag. No
 * double-caching — the DAL owns the cache boundary.
 */
export async function getBrainBlogCards(limit: number): Promise<BrainBlogCard[]> {
  const result = await getPublishedBlogPosts({ category: null, limit: Math.min(40, Math.max(1, limit)), offset: 0 })
  return result.posts
    .filter((p) => p.hero_image_url && p.title && p.slug)
    .map((p): BrainBlogCard => {
      const tone = mapCategoryToTone(p.category ?? null)
      return {
        id: `blog-${p.slug}`,
        category: tone,
        kicker: kickerForCategory(tone),
        headline: p.title,
        body: (p.excerpt ?? '').slice(0, 140),
        backgroundImage: p.hero_image_url!,
        backgroundAlt: p.title,
        href: `/blog/${p.slug}`,
        publishedAt: p.published_at ?? null,
        blogCategory: p.category ?? null,
        // tags is not part of the blog index shape (BlogPostWithAuthor); default to empty.
        tags: [],
      }
    })
}
