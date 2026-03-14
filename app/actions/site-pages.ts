'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

export type SitePageContent = { title: string; body_html: string } | null

const serviceSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createServiceClient(url, key)
}

/** Get editable content for a site page by key (about, sell, contact, etc.). */
export async function getPageContent(key: string): Promise<SitePageContent> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('site_pages')
    .select('title, body_html')
    .eq('key', key)
    .single()
  if (!data) return null
  return {
    title: (data.title as string) ?? '',
    body_html: (data.body_html as string) ?? '',
  }
}

/** Update a site page (admin). Creates row if key does not exist. */
export async function updatePageContent(
  key: string,
  payload: { title: string; body_html: string }
): Promise<{ ok: boolean; error?: string }> {
  const supabase = serviceSupabase()
  if (!supabase) return { ok: false, error: 'Server not configured' }
  const { error } = await supabase.from('site_pages').upsert(
    {
      key,
      title: payload.title?.trim() ?? '',
      body_html: payload.body_html?.trim() ?? '',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' }
  )
  if (error) return { ok: false, error: error.message }
  revalidatePath('/about')
  revalidatePath('/sell')
  revalidatePath('/contact')
  revalidatePath('/')
  return { ok: true }
}

/** List all site page keys (for admin). */
export async function listSitePageKeys(): Promise<string[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('site_pages').select('key').order('key')
  return (data ?? []).map((r) => (r as { key: string }).key)
}
