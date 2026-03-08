'use server'

import { createClient } from '@/lib/supabase/server'

export type AboutContent = { title: string; body_html: string } | null

export async function getAboutContent(): Promise<AboutContent> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('site_pages')
    .select('title, body_html')
    .eq('key', 'about')
    .single()
  if (!data) return null
  return {
    title: (data.title as string) ?? 'About Us',
    body_html: (data.body_html as string) ?? '',
  }
}
