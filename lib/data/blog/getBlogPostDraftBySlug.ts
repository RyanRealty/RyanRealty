/**
 * getBlogPostDraftBySlug — one blog_posts row by slug, ANY status, for the
 * login-only draft preview (/admin/blog/preview/[slug], Matt 2026-10-05).
 *
 * Returns the same BlogPostFull shape the public page renders (author joined
 * from brokers, hero resolved through resolveBlogHeroImage exactly as
 * getBlogPostBySlug resolves it), plus the row's `status`, so the preview hands
 * the shared render path (app/blog/[slug]/_v3/render-blog-post.tsx) the row as
 * it will publish.
 *
 * UNCACHED on purpose: no unstable_cache, no cache tag. A draft is being edited
 * and must show its current text, and a draft must never land in a cache entry
 * a public read could share. Service role, because RLS hides non-published rows
 * from anon. server-only: a client bundle can never import it.
 *
 * NEVER import this from a public route or from the shared render module.
 * lib/blog/draft-preview.test.ts fails if anything outside app/admin/ names it.
 *
 * Returns null when no row has this slug. Throws on a Supabase error so the
 * preview shows an error instead of a false "not found".
 */

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { resolveBlogHeroImage } from '@/lib/blog-hero-images'
import type { BlogPostFull } from '@/lib/data/blog/getBlogPostBySlug'

export type BlogPostDraft = BlogPostFull & { status: string | null }

type DraftRow = Omit<BlogPostFull, 'author_name' | 'author_slug' | 'author_photo_url' | 'author_title'> & {
  status: string | null
}

export async function getBlogPostDraftBySlug(slug: string): Promise<BlogPostDraft | null> {
  const sb = createServiceClient()

  const { data: row, error } = await sb
    .from('blog_posts')
    .select('id, title, slug, content, excerpt, category, tags, hero_image_url, published_at, updated_at, author_broker_id, seo_title, seo_description, status')
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw new Error(`[getBlogPostDraftBySlug] ${error.message}`)
  if (!row) return null

  const post = row as DraftRow
  let author_name: string | null = null
  let author_slug: string | null = null
  let author_photo_url: string | null = null
  let author_title: string | null = null

  if (post.author_broker_id) {
    const { data: broker, error: brokerError } = await sb
      .from('brokers')
      .select('display_name, slug, photo_url, title')
      .eq('id', post.author_broker_id)
      .maybeSingle()
    if (brokerError) throw new Error(`[getBlogPostDraftBySlug] brokers: ${brokerError.message}`)
    if (broker) {
      author_name = (broker as { display_name?: string }).display_name ?? null
      author_slug = (broker as { slug?: string }).slug ?? null
      author_photo_url = (broker as { photo_url?: string }).photo_url ?? null
      author_title = (broker as { title?: string }).title?.trim() || null
    }
  }

  return {
    ...post,
    hero_image_url: resolveBlogHeroImage(post.slug, post.category, post.hero_image_url),
    author_name,
    author_slug,
    author_photo_url,
    author_title,
  }
}
