/**
 * getRelatedBlogPosts — related posts for a blog detail page sidebar.
 *
 * Fetches posts in the same category first, backfills from other categories
 * if fewer than `limit` are found in the same category.
 *
 * No-poison: throws on Supabase error so makeResilientCached never caches [].
 */

import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import type { BlogPostWithAuthor } from './getPublishedBlogPosts'
import { resolveBlogHeroImage } from '@/lib/blog-hero-images'

type PostRow = {
  id: string
  title: string
  slug: string
  excerpt: string | null
  category: string | null
  hero_image_url: string | null
  published_at: string | null
  author_broker_id: string | null
  seo_title: string | null
  seo_description: string | null
}

async function _getRelatedBlogPostsUncached(
  currentSlug: string,
  category: string | null,
  limit: number,
): Promise<BlogPostWithAuthor[]> {
  const sb = supabaseAnon()
  if (!sb) return []

  const SELECT = 'id, title, slug, excerpt, category, hero_image_url, published_at, author_broker_id, seo_title, seo_description'

  let query = sb
    .from('blog_posts')
    .select(SELECT)
    .eq('status', 'published')
    .not('published_at', 'is', null)
    .neq('slug', currentSlug)
    .order('published_at', { ascending: false })
    .limit(limit)

  if (category) {
    query = query.eq('category', category)
  }

  const { data: rows, error } = await query
  if (error) throw new Error(`[getRelatedBlogPosts] ${error.message}`)

  let posts = (rows ?? []) as PostRow[]

  // Backfill from other categories if we got fewer than limit
  if (posts.length < limit && category) {
    const { data: backfill, error: backfillError } = await sb
      .from('blog_posts')
      .select(SELECT)
      .eq('status', 'published')
      .not('published_at', 'is', null)
      .neq('slug', currentSlug)
      .neq('category', category)
      .order('published_at', { ascending: false })
      .limit(limit - posts.length)

    if (backfillError) throw new Error(`[getRelatedBlogPosts] backfill: ${backfillError.message}`)
    if (backfill) posts = [...posts, ...(backfill as PostRow[])]
  }

  // Author info omitted intentionally — related post cards only show
  // title + hero image + publish date, no author attribution.
  return posts.map((p) => ({
    ...p,
    // P0-4: never serve a remote/stock/dead hero — resolve to a verified local photo.
    hero_image_url: resolveBlogHeroImage(p.slug, p.category, p.hero_image_url),
    author_name: null,
    author_slug: null,
    author_photo_url: null,
  }))
}

export const getRelatedBlogPosts = makeResilientCached(
  _getRelatedBlogPostsUncached,
  // v2 — local hero resolution (P0-4); evicts cached rows carrying Unsplash URLs.
  ['related-blog-posts-v2'],
  { revalidate: CACHE_WINDOWS.blog, tags: [cacheTag.blog] },
  [],
)
