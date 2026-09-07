/**
 * blogPostWrites — the one server-side write path for machine-published blog
 * posts (crons, generators). The admin editor writes through
 * app/actions/blog.ts saveBlogPost, which carries in-body admin auth a cron
 * cannot satisfy; this path is for callers that already passed
 * requireCronAuth.
 *
 * Every publish runs checkBrandVoice on title, excerpt, meta, and body and
 * refuses on a violation, the same gate the editor path applies
 * (ci:voice-send-paths). Upserts on slug, so a rerun for the same month is a
 * no-op on identity and a refresh on content.
 */
import { createServiceClient } from '@/lib/supabase/service'
import { checkBrandVoice } from '@/lib/voice/check'

export const MATT_BROKER_ID = '2fda6811-2edf-49e3-b3ca-33e1052f82e6'

export type PublishBlogPostInput = {
  slug: string
  title: string
  content: string
  excerpt: string
  category: string
  tags: string[]
  seoTitle: string
  seoDescription: string
  heroImageUrl?: string | null
  authorBrokerId?: string
}

export type PublishBlogPostResult =
  | { ok: true; slug: string; created: boolean }
  | { ok: false; reason: string }

export async function publishBlogPost(input: PublishBlogPostInput): Promise<PublishBlogPostResult> {
  // Same field shape as saveBlogPost: the metadata joins into `subject`, the
  // body scans as HTML.
  const voice = checkBrandVoice(
    {
      subject: [input.title, input.excerpt, input.seoTitle, input.seoDescription].filter(Boolean).join(' '),
      bodyHtml: input.content,
    },
    { stripHtml: true },
  )
  if (!voice.ok) {
    return {
      ok: false,
      reason: `voice: ${voice.violations.map((v) => `${v.kind}:${v.term}${v.field ? `@${v.field}` : ''}`).join(', ')}`,
    }
  }
  const supabase = createServiceClient()
  const { data: existing, error: readErr } = await supabase
    .from('blog_posts')
    .select('slug, status, published_at')
    .eq('slug', input.slug)
    .maybeSingle()
  if (readErr) return { ok: false, reason: `read: ${readErr.message}` }
  const now = new Date().toISOString()
  const publishedAt = existing?.status === 'published' && existing.published_at ? existing.published_at : now
  const { error } = await supabase.from('blog_posts').upsert(
    {
      slug: input.slug,
      title: input.title,
      content: input.content,
      excerpt: input.excerpt,
      category: input.category,
      tags: input.tags,
      hero_image_url: input.heroImageUrl ?? null,
      author_broker_id: input.authorBrokerId ?? MATT_BROKER_ID,
      seo_title: input.seoTitle,
      seo_description: input.seoDescription,
      status: 'published',
      published_at: publishedAt,
      updated_at: now,
    },
    { onConflict: 'slug' },
  )
  if (error) return { ok: false, reason: `upsert: ${error.message}` }
  return { ok: true, slug: input.slug, created: !existing }
}
