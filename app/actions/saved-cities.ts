'use server'

import { createClient } from '@/lib/supabase/server'

export async function getSavedCitySlugs(): Promise<string[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase
    .from('saved_cities')
    .select('city_slug')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  return (data ?? []).map((r: { city_slug: string }) => r.city_slug)
}

export async function isCitySaved(citySlug: string): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data } = await supabase
    .from('saved_cities')
    .select('id')
    .eq('user_id', user.id)
    .eq('city_slug', citySlug.trim().toLowerCase())
    .maybeSingle()
  return !!data
}

export async function unsaveCity(citySlug: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  const slug = citySlug.trim().toLowerCase()
  const { error } = await supabase
    .from('saved_cities')
    .delete()
    .eq('user_id', user.id)
    .eq('city_slug', slug)
  return { error: error?.message ?? null }
}

export async function toggleSavedCity(citySlug: string): Promise<{ saved: boolean; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { saved: false, error: 'Not signed in' }
  const slug = citySlug.trim().toLowerCase()
  if (!slug) return { saved: false, error: 'Invalid city' }
  const saved = await isCitySaved(slug)
  if (saved) {
    const { error } = await unsaveCity(slug)
    return { saved: false, error }
  }
  const { error } = await supabase.from('saved_cities').insert({
    user_id: user.id,
    city_slug: slug,
  })
  return { saved: true, error: error?.message ?? null }
}
