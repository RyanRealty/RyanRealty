'use server'

import { createClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'
import { checkAdminAction } from '@/lib/admin/require-admin'
import { checkBrandVoice } from '@/lib/voice/check'
import { reviewProse, type VoiceReview } from '@/lib/voice/reviewer'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createClient(url, key)
}

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createServiceClient()
}

export type BlogPostRow = {
  id: string
  title: string
  slug: string
  excerpt: string | null
  category: string | null
  hero_image_url: string | null
  published_at: string | null
  updated_at?: string | null
  author_broker_id: string | null
  seo_title: string | null
  seo_description: string | null
}

export type BlogPostWithAuthor = BlogPostRow & {
  author_name: string | null
  author_slug: string | null
  author_photo_url: string | null
  content?: string | null
  tags?: string[] | null
  /**
   * Present only on reads that ask for it — the public readers below do not,
   * because they filter on it server-side instead. Optional here rather than on
   * BlogPostRow so a reader that omits the column cannot claim to have it.
   *
   * `blog_posts.status` is free text with a 'draft' default, NOT a Postgres
   * enum, so this is a string. Four values are live (measured 2026-08-08 via
   * the audit query in this commit): published 55, archived_stats_unverified
   * 28, draft 3, pending_pilot_review 1.
   */
  status?: string | null
}

const PAGE_SIZE = 12

const CATEGORIES = [
  'All',
  'Market Reports',
  'Market Updates',
  'Market Analysis',
  'Buying Guides',
  'Selling Guides',
  'Community Spotlights',
  'Lifestyle & Living',
  'Investment & Finance',
  'First-Time Buyers',
  'Relocation Guides',
  'Home Improvement',
  'Local Housing News',
] as const

export async function getPublishedBlogPosts(options: {
  category?: string | null
  limit?: number
  offset?: number
}): Promise<{ posts: BlogPostWithAuthor[]; total: number }> {
  const supabase = getSupabase()
  if (!supabase) return { posts: [], total: 0 }
  const limit = options.limit ?? PAGE_SIZE
  const offset = options.offset ?? 0
  let query = supabase
    .from('blog_posts')
    .select('id, title, slug, excerpt, category, hero_image_url, published_at, author_broker_id, seo_title, seo_description', { count: 'exact' })
    .eq('status', 'published')
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })
  if (options.category && options.category !== 'All') {
    query = query.eq('category', options.category)
  }
  const { data: rows, count, error } = await query.range(offset, offset + limit - 1)
  if (error) return { posts: [], total: 0 }
  const posts = (rows ?? []) as BlogPostRow[]
  const brokerIds = [...new Set(posts.map((p) => p.author_broker_id).filter(Boolean))] as string[]
  const brokers = brokerIds.length
    ? await supabase.from('brokers').select('id, display_name, slug, photo_url').in('id', brokerIds)
    : { data: [] }
  const brokerMap = new Map((brokers.data ?? []).map((b) => [b.id, b]))
  const withAuthor: BlogPostWithAuthor[] = posts.map((p) => {
    const author = p.author_broker_id ? brokerMap.get(p.author_broker_id) : null
    return {
      ...p,
      author_name: author?.display_name ?? null,
      author_slug: author?.slug ?? null,
      author_photo_url: author?.photo_url ?? null,
    }
  })
  return { posts: withAuthor, total: count ?? 0 }
}

export async function getBlogCategories(): Promise<readonly string[]> {
  return CATEGORIES
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPostWithAuthor | null> {
  const supabase = getSupabase()
  if (!supabase) return null
  const { data: row } = await supabase
    .from('blog_posts')
    .select('id, title, slug, content, excerpt, category, tags, hero_image_url, published_at, updated_at, author_broker_id, seo_title, seo_description')
    .eq('slug', slug)
    .eq('status', 'published')
    .single()
  if (!row) return null
  const post = row as BlogPostRow & { content: string | null; tags: string[] | null }
  let author_name: string | null = null
  let author_slug: string | null = null
  let author_photo_url: string | null = null
  if (post.author_broker_id) {
    const { data: broker } = await supabase.from('brokers').select('display_name, slug, photo_url').eq('id', post.author_broker_id).single()
    if (broker) {
      author_name = (broker as { display_name?: string }).display_name ?? null
      author_slug = (broker as { slug?: string }).slug ?? null
      author_photo_url = (broker as { photo_url?: string }).photo_url ?? null
    }
  }
  return {
    ...post,
    author_name,
    author_slug,
    author_photo_url,
  }
}

export async function getPopularBlogSlugs(limit: number = 5): Promise<string[]> {
  const supabase = getSupabase()
  if (!supabase) return []
  const { data } = await supabase
    .from('blog_posts')
    .select('slug')
    .eq('status', 'published')
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })
    .limit(limit)
  return (data ?? []).map((r: { slug: string }) => r.slug)
}

export async function getRelatedBlogPosts(
  currentSlug: string,
  category: string | null,
  limit: number = 3
): Promise<BlogPostWithAuthor[]> {
  const supabase = getSupabase()
  if (!supabase) return []

  let query = supabase
    .from('blog_posts')
    .select('id, title, slug, excerpt, category, hero_image_url, published_at, author_broker_id, seo_title, seo_description')
    .eq('status', 'published')
    .not('published_at', 'is', null)
    .neq('slug', currentSlug)
    .order('published_at', { ascending: false })
    .limit(limit)

  if (category) {
    query = query.eq('category', category)
  }

  const { data: rows, error } = await query
  if (error || !rows) return []

  // If category filter returned fewer than limit, backfill from other categories
  let posts = rows as BlogPostRow[]
  if (posts.length < limit && category) {
    const { data: backfill } = await supabase
      .from('blog_posts')
      .select('id, title, slug, excerpt, category, hero_image_url, published_at, author_broker_id, seo_title, seo_description')
      .eq('status', 'published')
      .not('published_at', 'is', null)
      .neq('slug', currentSlug)
      .neq('category', category)
      .order('published_at', { ascending: false })
      .limit(limit - posts.length)
    if (backfill) posts = [...posts, ...(backfill as BlogPostRow[])]
  }

  return posts.map((p) => ({
    ...p,
    author_name: null,
    author_slug: null,
    author_photo_url: null,
  }))
}

// ─── Admin actions ────────────────────────────────────────────────

export async function getAdminBlogPosts(): Promise<BlogPostWithAuthor[]> {
  // Guard the read too: this service-role action returns ALL posts incl. drafts —
  // an unauthenticated caller must not read unpublished editorial content.
  const gate = await checkAdminAction('content.blog')
  if (!gate.ok) return []
  const supabase = getServiceSupabase()
  if (!supabase) return []
  // P1-1 fix: include content and tags so the edit form can pre-populate them.
  // P12 fix: include `status`. Without it the edit form had no way to read the
  // column the public blog actually filters on, so it inferred the value from
  // published_at — and every one of the 87 posts carries a publish date. Opening
  // any of the 32 non-published posts and saving therefore wrote
  // status:'published' and put it on the public site. Nothing had been flipped
  // when this was found; the column was simply never fetched.
  const { data } = await supabase
    .from('blog_posts')
    .select('id, title, slug, content, excerpt, category, tags, hero_image_url, published_at, author_broker_id, seo_title, seo_description, status')
    .order('published_at', { ascending: false, nullsFirst: true })
    .limit(500)
  return ((data ?? []) as (BlogPostRow & { content?: string | null; tags?: string[] | null })[]).map((p) => ({
    ...p,
    author_name: null,
    author_slug: null,
    author_photo_url: null,
  }))
}

export async function saveBlogPost(input: {
  id?: string
  slug: string
  title: string
  content?: string
  excerpt?: string
  category?: string
  tags?: string[]
  heroImageUrl?: string
  seoTitle?: string
  seoDescription?: string
  /**
   * Written through verbatim. A closed 'draft' | 'published' union used to sit
   * here, which meant the editor could not round-trip the two non-editorial
   * states the table actually holds (archived_stats_unverified,
   * pending_pilot_review) — saving an archived post would have collapsed it to
   * one of the two even once the prefill was reading the right column. The
   * column is free text; the caller preserves what it read.
   */
  status: string
  publishedAt?: string
  authorBrokerId?: string
}): Promise<{ ok: boolean; error?: string; voiceReview?: VoiceReview | null }> {
  // In-body auth (RC5 fix): a server action is an independently-invocable POST —
  // the admin layout gate does not run on it. Without this, anyone who extracts
  // the action id could publish arbitrary HTML/JS on the public blog.
  const gate = await checkAdminAction('content.blog')
  if (!gate.ok) return { ok: false, error: gate.error }

  // Brand-voice hard-fail gate (W11.2 / CLAUDE.md §"Brand Voice"): a published
  // blog post is public copy the CI voice gate never sees (scripts/check-
  // brand-voice.mjs scopes to app/ and this is a server action, not a page).
  // Drafts stay work-in-progress and are not gated — only a status:'published'
  // save is a real send.
  let voiceReview: VoiceReview | null = null
  if (input.status === 'published') {
    const voice = checkBrandVoice(
      { subject: [input.title, input.excerpt, input.seoTitle, input.seoDescription].filter(Boolean).join(' '), bodyHtml: input.content },
      { stripHtml: true },
    )
    if (!voice.ok) return { ok: false, error: 'Brand voice: ' + voice.violations.map((v) => v.term).join(', ') }

    // Advisory Orwell-rules review (W11.3) — runs alongside the hard-fail gate
    // above, never replacing it. Purely advisory: never throws, never blocks
    // the publish. Attached to the result for the admin edit UI to surface.
    voiceReview = await reviewProse(input.content ?? '', { context: 'blog' }).catch(() => null)
  }

  const supabase = getServiceSupabase()
  if (!supabase) return { ok: false, error: 'Database not configured', voiceReview }

  const payload: Record<string, unknown> = {
    slug: input.slug.trim().toLowerCase(),
    title: input.title.trim(),
    content: input.content?.trim() || null,
    excerpt: input.excerpt?.trim() || null,
    category: input.category?.trim() || null,
    tags: input.tags ?? [],
    hero_image_url: input.heroImageUrl?.trim() || null,
    seo_title: input.seoTitle?.trim() || null,
    seo_description: input.seoDescription?.trim() || null,
    status: input.status,
    published_at: input.publishedAt || (input.status === 'published' ? new Date().toISOString() : null),
    author_broker_id: input.authorBrokerId || null,
  }
  if (input.id) payload.id = input.id

  const { error } = await supabase.from('blog_posts').upsert(payload, { onConflict: 'slug' })
  if (error) {
    console.error('[saveBlogPost]', error)
    return { ok: false, error: error.message, voiceReview }
  }
  // Revalidate public and admin blog routes after save/update
  const { revalidatePath } = await import('next/cache')
  revalidatePath('/blog')
  revalidatePath('/admin/blog')
  return { ok: true, voiceReview }
}

export async function deleteBlogPost(id: string): Promise<{ ok: boolean; error?: string }> {
  const gate = await checkAdminAction('content.blog')
  if (!gate.ok) return { ok: false, error: gate.error }
  const supabase = getServiceSupabase()
  if (!supabase) return { ok: false, error: 'Database not configured' }
  const { error } = await supabase.from('blog_posts').delete().eq('id', id)
  if (error) {
    console.error('[deleteBlogPost]', error)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}
