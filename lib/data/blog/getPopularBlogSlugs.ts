/**
 * getPopularBlogSlugs — most recent published blog post slugs + titles, used as a
 * "recent posts" sidebar on the blog index. No view-count/popularity signal is
 * tracked per post — this orders by published_at desc (design-audit #127: the
 * sidebar previously mislabeled this "Popular posts").
 *
 * Returns { slug, title } pairs so the sidebar can display the real DB title
 * rather than a slug-derived approximation.
 *
 * No-poison: throws on Supabase error so makeResilientCached never caches [].
 */

import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { makeResilientCached } from '@/lib/data/cache/resilient'

export type PopularBlogPost = { slug: string; title: string }

async function _getPopularBlogSlugsUncached(limit: number): Promise<PopularBlogPost[]> {
  const sb = supabaseAnon()
  if (!sb) return []

  const { data, error } = await sb
    .from('blog_posts')
    .select('slug, title')
    .eq('status', 'published')
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`[getPopularBlogSlugs] ${error.message}`)
  return (data ?? []).map((r: { slug: string; title: string }) => ({ slug: r.slug, title: r.title }))
}

export const getPopularBlogSlugs = makeResilientCached(
  _getPopularBlogSlugsUncached,
  ['popular-blog-slugs-v2'],
  { revalidate: CACHE_WINDOWS.blog, tags: [cacheTag.blog] },
  [],
)
