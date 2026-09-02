'use server'

import { createServiceClient } from '@/lib/supabase/service'
import { checkAdminAction } from '@/lib/admin/require-admin'

export type GuideRow = {
  id: string
  slug: string
  title: string
  meta_description: string | null
  content_html: string
  category: string | null
  city: string | null
  status: 'draft' | 'published' | 'archived'
  published_at: string | null
  updated_at: string
}

export async function getAdminGuides(): Promise<GuideRow[]> {
  // Guard the read too: returns drafts/archived — not for unauthenticated callers.
  const gate = await checkAdminAction('content.guides')
  if (!gate.ok) return []
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('guides')
    .select('id, slug, title, meta_description, content_html, category, city, status, published_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(300)
  return (data ?? []) as GuideRow[]
}

export async function saveGuide(input: {
  id?: string
  slug: string
  title: string
  metaDescription?: string
  contentHtml: string
  category?: string
  city?: string
  status: 'draft' | 'published' | 'archived'
}): Promise<{ ok: boolean; error?: string }> {
  // In-body auth (RC5 fix): guide HTML renders on the public site — an unguarded
  // action id would let anyone publish arbitrary HTML/JS there.
  const gate = await checkAdminAction('content.guides')
  if (!gate.ok) return { ok: false, error: gate.error }
  const supabase = createServiceClient()
  const payload = {
    id: input.id,
    slug: input.slug.trim().toLowerCase(),
    title: input.title.trim(),
    meta_description: input.metaDescription?.trim() || null,
    content_html: input.contentHtml.trim(),
    category: input.category?.trim() || null,
    city: input.city?.trim() || null,
    status: input.status,
    published_at: input.status === 'published' ? new Date().toISOString() : null,
  }
  const { error } = await supabase.from('guides').upsert(payload, { onConflict: 'slug' })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/** P1-2: Delete a guide by id. Superuser-only operation (called from admin UI). */
export async function deleteGuide(id: string): Promise<{ ok: boolean; error?: string }> {
  const gate = await checkAdminAction('content.guides')
  if (!gate.ok) return { ok: false, error: gate.error }
  if (!id?.trim()) return { ok: false, error: 'No guide id provided.' }
  const supabase = createServiceClient()
  const { error } = await supabase.from('guides').delete().eq('id', id)
  if (error) {
    console.error('[deleteGuide]', error)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}
