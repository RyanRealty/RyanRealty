/**
 * getPopularBlogSlugs — most recent published blog post slugs, used as a
 * "popular posts" sidebar on the blog index.
 *
 * No-poison: throws on Supabase error so makeResilientCached never caches [].
 */

import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { makeResilientCached } from '@/lib/data/cache/resilient'

async function _getPopularBlogSlugsUncached(limit: number): Promise<string[]> {
  const sb = supabaseAnon()
  if (!sb) return []

  const { data, error } = await sb
    .from('blog_posts')
    .select('slug')
    .eq('status', 'published')
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`[getPopularBlogSlugs] ${error.message}`)
  return (data ?? []).map((r: { slug: string }) => r.slug)
}

export const getPopularBlogSlugs = makeResilientCached(
  _getPopularBlogSlugsUncached,
  ['popular-blog-slugs-v1'],
  { revalidate: CACHE_WINDOWS.blog, tags: [cacheTag.blog] },
  [],
)
