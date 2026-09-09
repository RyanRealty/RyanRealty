/**
 * getAllPublishedBlogRefs — every published post, as the little the geo matcher
 * needs to decide which place a post is about.
 *
 * WHY THIS EXISTS AND WHY IT IS NOT getRecentBlogPosts (site queue SITE-30,
 * 2026-09-09). The blog→place direction has worked since 2026-07-28:
 * lib/blog-geo-links.ts matches a post's slug, title and tags against the
 * community registry and renders two links from the post to
 * /communities/<slug>. The place→blog direction did not exist. Community pages
 * rendered no link to any individual post — verified live on sunriver,
 * broken-top, brasada-ranch, northwest-crossing, tetherow and caldera-springs,
 * all six carrying zero `<a href="/blog/…">` — while the eleven community
 * guides published on 2026-09-08 sat with no inbound link from the page each
 * one is about.
 *
 * The obvious reuse does not work. getRecentBlogPosts reads a fixed window of
 * the 24 newest posts and then floats city-title matches inside it, which is
 * right for a "latest guides" rail and wrong for "which post is about THIS
 * place": a community whose only guide is the 30th newest post can never be
 * matched, and every community would silently lose its guide as the blog grows.
 * Reverse matching has to see every published post, so this read returns every
 * published post and nothing else does the filtering.
 *
 * SMALL BY CONSTRUCTION. Five scalar columns, no body and no author
 * join: 80 published posts on 2026-09-09 (`select count(*) from blog_posts
 * where status='published' and published_at is not null`), well inside one
 * PostgREST page and far inside the unstable_cache 2 MB ceiling. The row cap is
 * explicit so growth past it fails loudly in a log line rather than silently
 * truncating the match set.
 *
 * NO-POISON. Throws on a transient Supabase error so makeResilientCached never
 * caches an empty result — a pooler blip would otherwise blank the guides
 * section on every community page for the whole 10-minute window.
 *
 * Column names are bare: blog_posts is snake_case, so no quoting (CLAUDE.md §7
 * — the mixed-case rule is `listings`, and supabase-js takes bare names anyway).
 */

import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { resolveBlogHeroImage } from '@/lib/blog-hero-images'

/** One published post, as the geo matcher and a guides row need it. */
export type PublishedBlogRef = {
  slug: string
  title: string
  /** The one-sentence summary the row prints. Null when the post has none. */
  excerpt: string | null
  /** ISO timestamp. Non-null by the query's own filter. */
  publishedAt: string
  /** Post tags, part of the geo matcher's haystack. Empty array when unset. */
  tags: string[]
  /**
   * The post's category, null when unset. Carried so a caller can resolve the
   * post's hero through `resolveBlogHeroImage` without a second read — that
   * resolver takes (slug, category, storedUrl) and this read deliberately does
   * not select the stored URL, because P0-4 replaces every remote one anyway.
   */
  category: string | null
  /** A local, verified hero photo for the post. Never a remote URL (P0-4). */
  heroImageUrl: string
}

/**
 * How many published posts this read will return. Above it the read still
 * returns a full page, but it says so — a matcher that silently stops seeing
 * new posts is the exact failure this function was built to end.
 */
export const PUBLISHED_BLOG_REF_CAP = 1000

/** One `blog_posts` row as this read selects it. */
export type PublishedBlogRow = {
  slug: string
  title: string
  excerpt: string | null
  published_at: string | null
  tags: string[] | null
  category: string | null
}

/**
 * Rows to refs. Pure, so the shape rules are pinned by vitest without mocking
 * Supabase: a post with no slug, no title, or no publish date is not a
 * published post and is dropped rather than rendered as a nameless door.
 */
export function toPublishedBlogRefs(rows: readonly PublishedBlogRow[]): PublishedBlogRef[] {
  const out: PublishedBlogRef[] = []
  for (const r of rows) {
    const slug = r?.slug?.trim()
    const title = r?.title?.trim()
    const publishedAt = r?.published_at
    if (!slug || !title || !publishedAt) continue
    const category = r.category?.trim() ? r.category.trim() : null
    out.push({
      slug,
      title,
      excerpt: r.excerpt?.trim() ? r.excerpt.trim() : null,
      publishedAt,
      tags: Array.isArray(r.tags) ? r.tags.filter((t): t is string => typeof t === 'string') : [],
      category,
      // P0-4: never serve a remote/stock/dead hero — resolve to a verified
      // local photo, the same resolver every other blog read uses.
      heroImageUrl: resolveBlogHeroImage(slug, category, null),
    })
  }
  return out
}

type Row = PublishedBlogRow

async function _getAllPublishedBlogRefsUncached(): Promise<PublishedBlogRef[]> {
  const sb = supabaseAnon()
  if (!sb) return []

  const { data, error } = await sb
    .from('blog_posts')
    .select('slug, title, excerpt, published_at, tags, category')
    .eq('status', 'published')
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })
    .limit(PUBLISHED_BLOG_REF_CAP)

  if (error) {
    throw new Error(`[getAllPublishedBlogRefs] ${error.message ?? JSON.stringify(error)}`)
  }
  const rows = (data ?? []) as Row[]
  if (rows.length >= PUBLISHED_BLOG_REF_CAP) {
    console.warn(
      `[getAllPublishedBlogRefs] hit the ${PUBLISHED_BLOG_REF_CAP}-row cap — posts past it are invisible to every place page. Paginate this read.`,
    )
  }

  return toPublishedBlogRefs(rows)
}

/**
 * Cached on the same blog window and the same tag as every other blog read, so
 * publishing a post refreshes the place pages that name it at the same moment
 * it refreshes /blog.
 */
export const getAllPublishedBlogRefs = makeResilientCached(
  _getAllPublishedBlogRefsUncached,
  ['all-published-blog-refs-v1'],
  { revalidate: CACHE_WINDOWS.blog, tags: [cacheTag.blog] },
  [],
)
