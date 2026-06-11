/**
 * getPublishedBlogPosts — paginated published blog posts with author info,
 * for the blog index page (/blog).
 *
 * Reads blog_posts joined to brokers (for author attribution). Returns a page
 * of posts plus the total published count so the page can render pagination.
 *
 * No-poison: throws on Supabase error (rather than returning stale empty results)
 * so makeResilientCached never caches a blank page.
 */

import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { resolveBlogHeroImage } from '@/lib/blog-hero-images'

export type BlogPostWithAuthor = {
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
  author_name: string | null
  author_slug: string | null
  author_photo_url: string | null
}

export type GetPublishedBlogPostsResult = {
  posts: BlogPostWithAuthor[]
  total: number
}

const PAGE_SIZE = 12

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

type BrokerRow = {
  id: string
  display_name: string
  slug: string
  photo_url: string | null
}

async function _getPublishedBlogPostsUncached(options: {
  category: string | null
  limit: number
  offset: number
}): Promise<GetPublishedBlogPostsResult> {
  const sb = supabaseAnon()
  if (!sb) return { posts: [], total: 0 }

  const limit = options.limit ?? PAGE_SIZE
  const offset = options.offset ?? 0

  let query = sb
    .from('blog_posts')
    .select('id, title, slug, excerpt, category, hero_image_url, published_at, author_broker_id, seo_title, seo_description', { count: 'exact' })
    .eq('status', 'published')
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })

  if (options.category && options.category !== 'All') {
    query = query.eq('category', options.category)
  }

  const { data: rows, count, error } = await query.range(offset, offset + limit - 1)
  if (error) throw new Error(`[getPublishedBlogPosts] ${error.message}`)

  const posts = (rows ?? []) as PostRow[]
  const brokerIds = [...new Set(posts.map((p) => p.author_broker_id).filter(Boolean))] as string[]

  let brokerMap = new Map<string, BrokerRow>()
  if (brokerIds.length > 0) {
    const { data: brokers, error: brokerError } = await sb
      .from('brokers')
      .select('id, display_name, slug, photo_url')
      .in('id', brokerIds)
    if (brokerError) throw new Error(`[getPublishedBlogPosts] brokers: ${brokerError.message}`)
    brokerMap = new Map((brokers ?? []).map((b) => [b.id, b as BrokerRow]))
  }

  const withAuthor: BlogPostWithAuthor[] = posts.map((p) => {
    const author = p.author_broker_id ? brokerMap.get(p.author_broker_id) : null
    return {
      ...p,
      // P0-4: never serve a remote/stock/dead hero — resolve to a verified local photo.
      hero_image_url: resolveBlogHeroImage(p.slug, p.category, p.hero_image_url),
      author_name: author?.display_name ?? null,
      author_slug: author?.slug ?? null,
      author_photo_url: author?.photo_url ?? null,
    }
  })

  return { posts: withAuthor, total: count ?? 0 }
}

// category+limit+offset are part of the cache key so each combination is stored
// independently. TTL matches the existing blog window (CACHE_WINDOWS.blog = 600s).
export const getPublishedBlogPosts = makeResilientCached(
  _getPublishedBlogPostsUncached,
  // v2 — local hero resolution (P0-4); evicts cached rows carrying Unsplash URLs.
  ['published-blog-posts-v2'],
  { revalidate: CACHE_WINDOWS.blog, tags: [cacheTag.blog] },
  { posts: [], total: 0 },
)
