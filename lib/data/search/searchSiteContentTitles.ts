/**
 * searchSiteContentTitles — title matches from published blog posts + guides
 * for the search-suggestions dropdown (W4.1: blog + guides join the
 * suggestion scope).
 *
 * Both tables are small (hundreds of rows), anon-readable, and already served
 * by cached DAL readers for their index pages — a per-keystroke ILIKE here is
 * cheap and always fresh. Fail-soft on either query (the guides table has a
 * known migration-drift history) so suggestions never 500.
 */

import { supabaseAnon } from '@/lib/data/client'

export type ContentTitleMatch = { title: string; slug: string }

export type SiteContentTitlesResult = {
  blog: ContentTitleMatch[]
  guides: ContentTitleMatch[]
}

const EMPTY: SiteContentTitlesResult = { blog: [], guides: [] }

export async function searchSiteContentTitles(
  query: string,
  limitPerKind = 5
): Promise<SiteContentTitlesResult> {
  const sb = supabaseAnon()
  if (!sb) return EMPTY
  const q = (query ?? '').trim().replace(/[%\\,()]/g, '')
  if (q.length < 2) return EMPTY
  const like = `%${q}%`
  const limit = Math.min(Math.max(limitPerKind, 1), 10)

  const [blogRes, guideRes] = await Promise.all([
    sb
      .from('blog_posts')
      .select('title, slug')
      .eq('status', 'published')
      .not('published_at', 'is', null)
      .ilike('title', like)
      .order('published_at', { ascending: false })
      .limit(limit),
    sb
      .from('guides')
      .select('title, slug')
      .eq('status', 'published')
      .ilike('title', like)
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(limit),
  ])

  const clean = (rows: unknown): ContentTitleMatch[] =>
    (Array.isArray(rows) ? (rows as Array<{ title?: string | null; slug?: string | null }>) : [])
      .filter((r) => r.title?.trim() && r.slug?.trim())
      .map((r) => ({ title: (r.title ?? '').trim(), slug: (r.slug ?? '').trim() }))

  if (blogRes.error) console.error(`[searchSiteContentTitles] blog: ${blogRes.error.message}`)
  if (guideRes.error) console.error(`[searchSiteContentTitles] guides: ${guideRes.error.message}`)

  return {
    blog: blogRes.error ? [] : clean(blogRes.data),
    guides: guideRes.error ? [] : clean(guideRes.data),
  }
}
