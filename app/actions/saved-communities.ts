'use server'

import { createClient } from '@/lib/supabase/server'
import { subdivisionEntityKey } from '@/lib/slug'
import { incrementCommunitySaveCount, decrementCommunitySaveCount } from './community-engagement'

export async function getSavedCommunityKeys(): Promise<string[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase
    .from('saved_communities')
    .select('entity_key')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  return (data ?? []).map((r: { entity_key: string }) => r.entity_key)
}

export async function isCommunitySaved(entityKey: string): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data } = await supabase
    .from('saved_communities')
    .select('id')
    .eq('user_id', user.id)
    .eq('entity_key', entityKey.trim())
    .maybeSingle()
  return !!data
}

export async function saveCommunity(entityKey: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  const key = entityKey.trim().toLowerCase()
  if (!key || !key.includes(':')) return { error: 'Invalid entity_key' }
  const { error } = await supabase.from('saved_communities').insert({
    user_id: user.id,
    entity_key: key,
  })
  if (error) return { error: error.message }
  await incrementCommunitySaveCount(key).catch(() => {})
  return { error: null }
}

export async function unsaveCommunity(entityKey: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  const key = entityKey.trim().toLowerCase()
  const { error } = await supabase
    .from('saved_communities')
    .delete()
    .eq('user_id', user.id)
    .eq('entity_key', key)
  if (error) return { error: error.message }
  await decrementCommunitySaveCount(key).catch(() => {})
  return { error: null }
}

export async function toggleSavedCommunity(entityKey: string): Promise<{ saved: boolean; error: string | null }> {
  const saved = await isCommunitySaved(entityKey)
  if (saved) {
    const { error } = await unsaveCommunity(entityKey)
    return { saved: false, error }
  }
  const { error } = await saveCommunity(entityKey)
  return { saved: true, error }
}
