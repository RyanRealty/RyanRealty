'use server'

import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'

/** Community metrics table (not yet in generated Supabase types). Use for insert/update/select. */
function communityMetrics(supabase: SupabaseClient) {
  return supabase.from('community_engagement_metrics')
}

export type CommunityEngagementCounts = {
  view_count: number
  like_count: number
  save_count: number
  share_count: number
}

export async function getLikedCommunityKeys(): Promise<string[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase
    .from('liked_communities')
    .select('entity_key')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  return (data ?? []).map((r: { entity_key: string }) => r.entity_key)
}

export async function removeCommunityLike(entityKey: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  const key = entityKey.trim().toLowerCase()
  if (!key || !key.includes(':')) return { error: 'Invalid entity_key' }
  const { error } = await supabase
    .from('liked_communities')
    .delete()
    .eq('user_id', user.id)
    .eq('entity_key', key)
  return { error: error?.message ?? null }
}

/** Called when a user saves a community; bumps save_count in community_engagement_metrics. */
export async function incrementCommunitySaveCount(entityKey: string): Promise<void> {
  const key = entityKey.trim().toLowerCase()
  if (!key || !key.includes(':')) return
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !serviceKey?.trim()) return
  const supabase = createServiceClient()
  const { data } = await communityMetrics(supabase).select('save_count').eq('entity_key', key).maybeSingle()
  if (data) {
    await communityMetrics(supabase)
      .update({
        save_count: (data as { save_count: number }).save_count + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('entity_key', key)
  } else {
    await communityMetrics(supabase).insert({
      entity_key: key,
      view_count: 0,
      like_count: 0,
      save_count: 1,
      share_count: 0,
      updated_at: new Date().toISOString(),
    })
  }
}

/** Called when a user unsaves a community; decrements save_count. */
export async function decrementCommunitySaveCount(entityKey: string): Promise<void> {
  const key = entityKey.trim().toLowerCase()
  if (!key || !key.includes(':')) return
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !serviceKey?.trim()) return
  const supabase = createServiceClient()
  const { data } = await communityMetrics(supabase).select('save_count').eq('entity_key', key).maybeSingle()
  if (data) {
    const cur = (data as { save_count: number }).save_count
    await communityMetrics(supabase)
      .update({
        save_count: Math.max(0, cur - 1),
        updated_at: new Date().toISOString(),
      })
      .eq('entity_key', key)
  }
}
