/**
 * AI blog post generation. Step 16.
 * Triggered from admin or report generation. Creates draft in blog_posts and ai_content.
 */

import { inngest } from '@/lib/inngest'
import { createClient } from '@supabase/supabase-js'

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) throw new Error('Supabase service role not configured')
  return createClient(url, key)
}

function slugFromTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export const generateBlogPost = inngest.createFunction(
  {
    id: 'content/generate-blog-post',
    name: 'Generate blog post',
    retries: 1,
  },
  { event: 'content/generate-blog-post' },
  async ({ event }) => {
    const supabase = getServiceSupabase()
    const { topic, type, context } = (event.data as { topic?: string; type?: string; context?: Record<string, unknown> }) ?? {}
    const title = typeof topic === 'string' && topic.trim() ? topic.trim() : 'Draft post'
    const slug = slugFromTitle(title) || 'draft-' + Date.now()
    const existing = await supabase.from('blog_posts').select('id').eq('slug', slug).maybeSingle()
    const finalSlug = existing.data ? `${slug}-${Date.now()}` : slug

    const { data: post, error: postErr } = await supabase
      .from('blog_posts')
      .insert({
        title,
        slug: finalSlug,
        content: '<p>Draft content. Edit in admin or regenerate with AI.</p>',
        excerpt: (typeof context?.excerpt === 'string' ? context.excerpt : null) ?? title.slice(0, 160),
        category: typeof type === 'string' ? type : null,
        status: 'draft',
      })
      .select('id')
      .single()

    if (postErr || !post) return { error: postErr?.message ?? 'Failed to create post' }

    await supabase.from('ai_content').insert({
      entity_type: 'blog_post',
      entity_id: (post as { id: string }).id,
      content_type: 'blog_post',
      content_text: title,
      status: 'draft',
    })

    return { blogPostId: (post as { id: string }).id, slug: finalSlug }
  }
)
