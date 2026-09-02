'use server'

import { createServiceClient } from '@/lib/supabase/service'
import { checkAdminAction } from '@/lib/admin/require-admin'
import { checkBrandVoice } from '@/lib/voice/check'
import { reviewProse, type VoiceReview } from '@/lib/voice/reviewer'

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

export async function getBlogCategories(): Promise<readonly string[]> {
  return CATEGORIES
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
  // P12 audit trail: content publishes / status transitions.
  const { logAdminAction } = await import('@/app/actions/log-admin-action')
  await logAdminAction({
    adminEmail: gate.ctx.email,
    role: gate.ctx.role,
    actionType: input.status === 'published' ? 'blog_publish' : 'blog_save',
    resourceType: 'blog_post',
    resourceId: String(payload.slug),
    details: { status: input.status, id: input.id ?? null, title: input.title },
  })
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
