'use server'

import { createClient } from '@/lib/supabase/server'

export type AboutContent = { title: string; body_html: string } | null

export async function getAboutContent(): Promise<AboutContent> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('site_pages')
      .select('title, body_html')
      .eq('key', 'about')
      .maybeSingle()
    if (error) {
      console.error('[getAboutContent]', error.message)
      return null
    }
    if (!data) return null
    return {
      title: (data.title as string) ?? 'About Us',
      body_html: (data.body_html as string) ?? '',
    }
  } catch (err) {
    console.error('[getAboutContent]', err)
    return null
  }
}
