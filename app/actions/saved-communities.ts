'use server'

import { createClient } from '@/lib/supabase/server'
import { decrementCommunitySaveCount } from './community-engagement'

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
