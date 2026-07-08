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
import { estimateReadTimeMinutes } from '@/lib/content/read-time'

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
  read_time_min: number
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
  content: string | null
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
    .select('id, title, slug, excerpt, category, hero_image_url, published_at, author_broker_id, seo_title, seo_description, content', { count: 'exact' })
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
    const { content, ...rest } = p
    return {
      ...rest,
      // P0-4: never serve a remote/stock/dead hero — resolve to a verified local photo.
      hero_image_url: resolveBlogHeroImage(p.slug, p.category, p.hero_image_url),
      author_name: author?.display_name ?? null,
      author_slug: author?.slug ?? null,
      author_photo_url: author?.photo_url ?? null,
      // design-audit #126: every index card showed "1 min read" because this
      // computed from the excerpt (~30 words), not the article body.
      read_time_min: estimateReadTimeMinutes(content),
    }
  })

  return { posts: withAuthor, total: count ?? 0 }
}

// category+limit+offset are part of the cache key so each combination is stored
// independently. TTL matches the existing blog window (CACHE_WINDOWS.blog = 600s).
export const getPublishedBlogPosts = makeResilientCached(
  _getPublishedBlogPostsUncached,
  // v3 (design-audit #126): adds read_time_min computed from the full body,
  // not the excerpt — evicts v2 rows that don't carry the field.
  ['published-blog-posts-v3'],
  { revalidate: CACHE_WINDOWS.blog, tags: [cacheTag.blog] },
  { posts: [], total: 0 },
)
