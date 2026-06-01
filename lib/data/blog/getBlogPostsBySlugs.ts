/**
 * getBlogPostsBySlugs — fetch a set of published blog posts by their slugs,
 * returning a map of slug -> { slug, title, heroImageUrl } for PUBLISHED posts
 * only. Posts that do not exist or are not published are omitted from the map.
 *
 * Used by community pages to resolve amenity blog_slug links into real post
 * metadata (title, hero image) so amenity cards can link out to blog content
 * and display the post's primary image.
 *
 * No-poison: throws on Supabase error (rather than returning a stale empty
 * map) so unstable_cache surfaces the failure and retries cleanly.
 *
 * Pattern mirrors getRecentBlogPosts.ts (same client + cache wrapper).
 */

import { unstable_cache } from 'next/cache'
import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'

export type AmenityBlogPost = {
  slug: string
  title: string
  heroImageUrl: string | null
}

type BlogRow = {
  slug: string
  title: string
  hero_image_url: string | null
  status: string
}

async function _getBlogPostsBySlugsUncached(
  slugs: string[],
): Promise<Record<string, AmenityBlogPost>> {
  if (slugs.length === 0) return {}

  const sb = supabaseAnon()
  if (!sb) return {}

  const { data, error } = await sb
    .from('blog_posts')
    .select('slug, title, hero_image_url, status')
    .in('slug', slugs)
    .eq('status', 'published')
    .not('published_at', 'is', null)

  if (error) {
    // No-poison: throw so unstable_cache does not store a bad empty result.
    throw new Error(`[getBlogPostsBySlugs] Supabase error: ${error.message}`)
  }

  const map: Record<string, AmenityBlogPost> = {}
  for (const row of (data ?? []) as BlogRow[]) {
    map[row.slug] = {
      slug: row.slug,
      title: row.title,
      heroImageUrl: row.hero_image_url ?? null,
    }
  }
  return map
}

export const getBlogPostsBySlugs = unstable_cache(
  _getBlogPostsBySlugsUncached,
  ['blog-posts-by-slugs-v1'],
  { revalidate: CACHE_WINDOWS.blog, tags: [cacheTag.blog] },
)
