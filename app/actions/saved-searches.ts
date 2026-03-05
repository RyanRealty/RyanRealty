'use server'

import { createClient } from '@/lib/supabase/server'

export type SavedSearchRow = {
  id: string
  name: string
  filters: Record<string, unknown>
  created_at: string
}

export async function getSavedSearches(): Promise<SavedSearchRow[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase
    .from('saved_searches')
    .select('id, name, filters, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  return (data ?? []) as SavedSearchRow[]
}

export async function createSavedSearch(name: string, filters: Record<string, unknown>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  const { error } = await supabase.from('saved_searches').insert({
    user_id: user.id,
    name: name.trim() || 'Saved search',
    filters: filters ?? {},
  })
  if (error) return { error: error.message }
  return { error: null }
}

export async function deleteSavedSearch(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  const { error } = await supabase
    .from('saved_searches')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) return { error: error.message }
  return { error: null }
}
