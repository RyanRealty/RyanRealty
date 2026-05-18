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
 * This file reads `blog_posts` today; `content_calendar` wiring lands once
 * the per-platform publisher pipeline starts populating it.
 */

import { createClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'

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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

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

async function _getBrainBlogCardsUncached(limit: number): Promise<BrainBlogCard[]> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return []
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  const { data, error } = await supabase
    .from('blog_posts')
    .select('id, slug, title, excerpt, category, hero_image_url, published_at, tags')
    .eq('status', 'published')
    .not('hero_image_url', 'is', null)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(Math.min(40, Math.max(1, limit)))
  if (error || !data) return []
  return data
    .filter((row) => row.hero_image_url && row.title && row.slug)
    .map((row): BrainBlogCard => {
      const tone = mapCategoryToTone(row.category ?? null)
      return {
        id: `blog-${row.slug}`,
        category: tone,
        kicker: kickerForCategory(tone),
        headline: row.title as string,
        body: ((row.excerpt as string | null) ?? '').slice(0, 140),
        backgroundImage: row.hero_image_url as string,
        backgroundAlt: row.title as string,
        href: `/blog/${row.slug}`,
        publishedAt: (row.published_at as string | null) ?? null,
        blogCategory: (row.category as string | null) ?? null,
        tags: ((row.tags as string[] | null) ?? []).slice(0, 6),
      }
    })
}

/** Cached read of the brain's published blog feed. Revalidates every 10 min. */
export const getBrainBlogCards = unstable_cache(_getBrainBlogCardsUncached, ['pulse-brain-blog-cards-v1'], {
  revalidate: 600,
  tags: ['pulse-brain', 'blog-posts'],
})
