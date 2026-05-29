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

import { unstable_cache } from 'next/cache'
import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'

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
  if (error || !data) {
    if (error) console.error('[getRecentBlogPosts]', error)
    return []
  }

  const rows = (data as BlogRow[]).map(
    (r): BlogPostCard => ({
      id: r.id,
      title: r.title,
      slug: r.slug,
      excerpt: r.excerpt,
      category: r.category,
      heroImageUrl: r.hero_image_url,
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

export const getRecentBlogPosts = unstable_cache(
  _getRecentBlogPostsUncached,
  ['recent-blog-posts-v1'],
  { revalidate: CACHE_WINDOWS.blog, tags: [cacheTag.blog] },
)
