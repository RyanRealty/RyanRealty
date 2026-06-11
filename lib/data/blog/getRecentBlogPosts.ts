/**
 * getRecentBlogPosts — recent published posts from `blog_posts`, for the
 * "guides & insights" rail on city / community pages.
 *
 * Reads published posts (status='published', published_at not null) newest
 * first. When `cityName` is passed, posts whose title mentions the city are
 * floated to the front (stable) so a Bend page leads with Bend-specific
 * articles before falling back to general Central Oregon content.
 *
 * Column names are bare (the blog_posts columns are snake_case, no quoting).
 */

import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { resolveBlogHeroImage } from '@/lib/blog-hero-images'

export type BlogPostCard = {
  id: string
  title: string
  slug: string
  excerpt: string | null
  category: string | null
  heroImageUrl: string | null
  publishedAt: string | null
}

type BlogRow = {
  id: string
  title: string
  slug: string
  excerpt: string | null
  category: string | null
  hero_image_url: string | null
  published_at: string | null
}

async function _getRecentBlogPostsUncached(options: {
  limit?: number
  cityName?: string
} = {}): Promise<BlogPostCard[]> {
  const sb = supabaseAnon()
  if (!sb) return []
  const limit = options.limit ?? 3

  // Pull a small recent window, then prioritize city-title matches in Node.
  const { data, error } = await sb
    .from('blog_posts')
    .select('id, title, slug, excerpt, category, hero_image_url, published_at')
    .eq('status', 'published')
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })
    .limit(24)
  // THROW on a transient DB error so makeResilientCached never caches the empty
  // result (poison-null: one pooler/timeout blip would otherwise blank the
  // "guides & insights" rail on every city/community page for the whole window).
  if (error) throw new Error(`[getRecentBlogPosts] ${error.message ?? JSON.stringify(error)}`)
  if (!data) return []

  const rows = (data as BlogRow[]).map(
    (r): BlogPostCard => ({
      id: r.id,
      title: r.title,
      slug: r.slug,
      excerpt: r.excerpt,
      category: r.category,
      // P0-4: never serve a remote/stock/dead hero — resolve to a verified local photo.
      heroImageUrl: resolveBlogHeroImage(r.slug, r.category, r.hero_image_url),
      publishedAt: r.published_at,
    }),
  )

  if (options.cityName?.trim()) {
    const city = options.cityName.trim().toLowerCase()
    // Stable partition: city-in-title posts first, recency preserved within.
    const inTitle = rows.filter((r) => r.title.toLowerCase().includes(city))
    const rest = rows.filter((r) => !r.title.toLowerCase().includes(city))
    return [...inTitle, ...rest].slice(0, limit)
  }

  return rows.slice(0, limit)
}

export const getRecentBlogPosts = makeResilientCached(
  _getRecentBlogPostsUncached,
  // v2 — bumped alongside the poison-null fix (was unstable_cache, which cached []
  // on a transient error). v1 entries may be poisoned; v2 evicts them.
  // v3 — local hero resolution (P0-4); evicts cached rows carrying Unsplash URLs.
  ['recent-blog-posts-v3'],
  { revalidate: CACHE_WINDOWS.blog, tags: [cacheTag.blog] },
  [],
)
