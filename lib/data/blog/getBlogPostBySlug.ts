/**
 * getBlogPostBySlug — full blog post by slug with author attribution,
 * for the blog detail page (/blog/[slug]).
 *
 * Returns the full post including content, tags, and joined author broker row.
 * Returns null on a genuine miss (post not found or not published).
 *
 * No-poison: throws on Supabase error so makeResilientCached never caches a
 * null result caused by a transient DB outage.
 */

import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { resolveBlogHeroImage } from '@/lib/blog-hero-images'

export type BlogPostFull = {
  id: string
  title: string
  slug: string
  content: string | null
  excerpt: string | null
  category: string | null
  tags: string[] | null
  hero_image_url: string | null
  published_at: string | null
  updated_at: string | null
  author_broker_id: string | null
  seo_title: string | null
  seo_description: string | null
  author_name: string | null
  author_slug: string | null
  author_photo_url: string | null
}

type PostRow = {
  id: string
  title: string
  slug: string
  content: string | null
  excerpt: string | null
  category: string | null
  tags: string[] | null
  hero_image_url: string | null
  published_at: string | null
  updated_at: string | null
  author_broker_id: string | null
  seo_title: string | null
  seo_description: string | null
}

async function _getBlogPostBySlugUncached(slug: string): Promise<BlogPostFull | null> {
  const sb = supabaseAnon()
  if (!sb) return null

  const { data: row, error } = await sb
    .from('blog_posts')
    .select('id, title, slug, content, excerpt, category, tags, hero_image_url, published_at, updated_at, author_broker_id, seo_title, seo_description')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()

  if (error) throw new Error(`[getBlogPostBySlug] ${error.message}`)
  if (!row) return null // genuine miss — post does not exist or is not published

  const post = row as PostRow
  let author_name: string | null = null
  let author_slug: string | null = null
  let author_photo_url: string | null = null

  if (post.author_broker_id) {
    const { data: broker, error: brokerError } = await sb
      .from('brokers')
      .select('display_name, slug, photo_url')
      .eq('id', post.author_broker_id)
      .maybeSingle()
    if (brokerError) throw new Error(`[getBlogPostBySlug] brokers: ${brokerError.message}`)
    if (broker) {
      author_name = (broker as { display_name?: string }).display_name ?? null
      author_slug = (broker as { slug?: string }).slug ?? null
      author_photo_url = (broker as { photo_url?: string }).photo_url ?? null
    }
  }

  return {
    ...post,
    // P0-4: never serve a remote/stock/dead hero — resolve to a verified local photo.
    hero_image_url: resolveBlogHeroImage(post.slug, post.category, post.hero_image_url),
    author_name,
    author_slug,
    author_photo_url,
  }
}

export const getBlogPostBySlug = makeResilientCached(
  _getBlogPostBySlugUncached,
  // v2 — local hero resolution (P0-4); evicts cached rows carrying Unsplash URLs.
  ['blog-post-by-slug-v2'],
  { revalidate: CACHE_WINDOWS.blog, tags: [cacheTag.blog] },
  null,
)
