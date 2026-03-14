'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'

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

/**
 * Batch fetch engagement counts for community tiles (view, like, save, share).
 * Returns a map of entity_key -> counts; missing keys get zeros.
 */
export async function getCommunityEngagementBatch(
  entityKeys: string[]
): Promise<Record<string, CommunityEngagementCounts>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !anonKey?.trim()) return {}

  const keys = [...new Set(entityKeys.map((k) => String(k).trim().toLowerCase()).filter((k) => k.includes(':')))]
  if (keys.length === 0) return {}

  const supabase = createSupabaseClient(url, anonKey)
  const { data: rows, error } = await communityMetrics(supabase)
    .select('entity_key, view_count, like_count, save_count, share_count')
    .in('entity_key', keys)

  if (error) return {}

  const result: Record<string, CommunityEngagementCounts> = {}
  for (const k of keys) {
    result[k] = { view_count: 0, like_count: 0, save_count: 0, share_count: 0 }
  }
  for (const row of (rows ?? []) as {
    entity_key?: string
    view_count?: number
    like_count?: number
    save_count?: number
    share_count?: number
  }[]) {
    const key = (row.entity_key ?? '').trim().toLowerCase()
    if (!key) continue
    result[key] = {
      view_count: Math.max(0, Number(row.view_count) ?? 0),
      like_count: Math.max(0, Number(row.like_count) ?? 0),
      save_count: Math.max(0, Number(row.save_count) ?? 0),
      share_count: Math.max(0, Number(row.share_count) ?? 0),
    }
  }
  return result
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

export async function isCommunityLiked(entityKey: string): Promise<boolean> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false
  const key = entityKey.trim().toLowerCase()
  if (!key || !key.includes(':')) return false
  const { data } = await supabase
    .from('liked_communities')
    .select('id')
    .eq('user_id', user.id)
    .eq('entity_key', key)
    .maybeSingle()
  return !!data
}

async function ensureCommunityMetricsRow(serviceSupabase: SupabaseClient, entityKey: string) {
  const { data } = await communityMetrics(serviceSupabase)
    .select('id')
    .eq('entity_key', entityKey)
    .maybeSingle()
  if (!data) {
    await communityMetrics(serviceSupabase).insert({
      entity_key: entityKey,
      view_count: 0,
      like_count: 0,
      save_count: 0,
      share_count: 0,
      updated_at: new Date().toISOString(),
    })
  }
}

export async function toggleCommunityLike(
  entityKey: string
): Promise<{ liked: boolean; error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { liked: false, error: 'Not signed in' }
  const key = entityKey.trim().toLowerCase()
  if (!key || !key.includes(':')) return { liked: false, error: 'Invalid entity_key' }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !serviceKey?.trim()) return { liked: false, error: 'Server not configured' }
  const serviceSupabase = createSupabaseClient(url, serviceKey)

  const liked = await isCommunityLiked(entityKey)
  if (liked) {
    const { error: delErr } = await supabase.from('liked_communities').delete().eq('user_id', user.id).eq('entity_key', key)
    if (delErr) return { liked: true, error: delErr.message }
    await ensureCommunityMetricsRow(serviceSupabase, key)
  const { data: row } = await communityMetrics(serviceSupabase).select('like_count').eq('entity_key', key).single()
  const cur = Math.max(0, (row as { like_count?: number } | null)?.like_count ?? 0)
  await communityMetrics(serviceSupabase)
    .update({ like_count: Math.max(0, cur - 1), updated_at: new Date().toISOString() })
    .eq('entity_key', key)
    return { liked: false, error: null }
  }
  const { error: insErr } = await supabase.from('liked_communities').insert({ user_id: user.id, entity_key: key })
  if (insErr) return { liked: false, error: insErr.message }
  await ensureCommunityMetricsRow(serviceSupabase, key)
  const { data: row } = await communityMetrics(serviceSupabase).select('like_count').eq('entity_key', key).single()
  const cur = Math.max(0, (row as { like_count?: number } | null)?.like_count ?? 0)
  await communityMetrics(serviceSupabase)
    .update({ like_count: cur + 1, updated_at: new Date().toISOString() })
    .eq('entity_key', key)
  return { liked: true, error: null }
}

export async function incrementCommunityView(entityKey: string): Promise<void> {
  const key = entityKey.trim().toLowerCase()
  if (!key || !key.includes(':')) return
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !serviceKey?.trim()) return
  const supabase = createSupabaseClient(url, serviceKey)
  const { data } = await communityMetrics(supabase).select('view_count').eq('entity_key', key).maybeSingle()
  if (data) {
    await communityMetrics(supabase)
      .update({
        view_count: (data as { view_count: number }).view_count + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('entity_key', key)
  } else {
    await communityMetrics(supabase).insert({
      entity_key: key,
      view_count: 1,
      like_count: 0,
      save_count: 0,
      share_count: 0,
      updated_at: new Date().toISOString(),
    })
  }
}

export async function incrementCommunityShare(entityKey: string): Promise<void> {
  const key = entityKey.trim().toLowerCase()
  if (!key || !key.includes(':')) return
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !serviceKey?.trim()) return
  const supabase = createSupabaseClient(url, serviceKey)
  const { data } = await communityMetrics(supabase).select('share_count').eq('entity_key', key).maybeSingle()
  if (data) {
    await communityMetrics(supabase)
      .update({
        share_count: (data as { share_count: number }).share_count + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('entity_key', key)
  } else {
    await communityMetrics(supabase).insert({
      entity_key: key,
      view_count: 0,
      like_count: 0,
      save_count: 0,
      share_count: 1,
      updated_at: new Date().toISOString(),
    })
  }
}

/** Called when a user saves a community; bumps save_count in community_engagement_metrics. */
export async function incrementCommunitySaveCount(entityKey: string): Promise<void> {
  const key = entityKey.trim().toLowerCase()
  if (!key || !key.includes(':')) return
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !serviceKey?.trim()) return
  const supabase = createSupabaseClient(url, serviceKey)
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
  const supabase = createSupabaseClient(url, serviceKey)
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
