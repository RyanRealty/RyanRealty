'use server'

import { createClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'

function serviceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createClient(url, key)
}

export type EngagementCounts = {
  view_count: number
  like_count: number
  save_count: number
  share_count: number
}

/**
 * Batch fetch engagement counts for listing tiles (views, likes, save, share).
 * Returns a map of listing_key -> counts; missing keys get zeros.
 */
export async function getEngagementCountsBatch(listingKeys: string[]): Promise<Record<string, EngagementCounts>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !anonKey?.trim()) return {}

  const keys = [...new Set(listingKeys.map((k) => String(k).trim()).filter(Boolean))]
  if (keys.length === 0) return {}

  const supabase = createClient(url, anonKey)
  const { data: rows, error } = await supabase
    .from('engagement_metrics')
    .select('listing_key, view_count, like_count, save_count, share_count')
    .in('listing_key', keys)

  if (error) return {}

  const result: Record<string, EngagementCounts> = {}
  for (const k of keys) {
    result[k] = { view_count: 0, like_count: 0, save_count: 0, share_count: 0 }
  }
  for (const row of (rows ?? []) as { listing_key?: string; view_count?: number; like_count?: number; save_count?: number; share_count?: number }[]) {
    const key = (row.listing_key ?? '').trim()
    if (!key) continue
    const n = (v: unknown) => (Number.isFinite(Number(v)) ? Math.max(0, Math.floor(Number(v))) : 0)
    result[key] = {
      view_count: n(row.view_count),
      like_count: n(row.like_count),
      save_count: n(row.save_count),
      share_count: n(row.share_count),
    }
  }
  return result
}

const _getEngagementCountsBatchCached = unstable_cache(
  async (listingKeys: string[]) => getEngagementCountsBatch(listingKeys),
  ['engagement-counts-batch-v1'],
  { revalidate: 120, tags: ['engagement-metrics'] }
)

export async function getEngagementCountsBatchCached(
  listingKeys: string[]
): Promise<Record<string, EngagementCounts>> {
  return _getEngagementCountsBatchCached(listingKeys)
}

export type ListingDetailEngagement = {
  view_count: number
  like_count: number
  save_count: number
  share_count: number
}

/**
 * Fetch engagement metrics for a single listing (detail page: views, likes, saves, shares).
 */
export async function getEngagementForListingDetail(listingKey: string): Promise<ListingDetailEngagement> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !anonKey?.trim()) {
    return { view_count: 0, like_count: 0, save_count: 0, share_count: 0 }
  }
  const key = String(listingKey ?? '').trim()
  if (!key) return { view_count: 0, like_count: 0, save_count: 0, share_count: 0 }

  const supabase = createClient(url, anonKey)
  const { data: row } = await supabase
    .from('engagement_metrics')
    .select('view_count, like_count, save_count, share_count')
    .eq('listing_key', key)
    .maybeSingle()

  const r = row as { view_count?: unknown; like_count?: unknown; save_count?: unknown; share_count?: unknown } | null
  const safe = (v: unknown): number => {
    const n = Number(v)
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
  }
  return {
    view_count: safe(r?.view_count),
    like_count: safe(r?.like_count),
    save_count: safe(r?.save_count),
    share_count: safe(r?.share_count),
  }
}

/** Ensure engagement_metrics row exists (used before increment/decrement). */
async function ensureEngagementRow(listingKey: string): Promise<boolean> {
  const supabase = serviceSupabase()
  if (!supabase) return false
  const key = String(listingKey).trim()
  if (!key) return false
  const { data } = await supabase
    .from('engagement_metrics')
    .select('listing_key')
    .eq('listing_key', key)
    .maybeSingle()
  if (data) return true
  const { error } = await supabase.from('engagement_metrics').insert({
    listing_key: key,
    view_count: 0,
    like_count: 0,
    save_count: 0,
    share_count: 0,
  })
  if (error?.code === '23505') return true
  return !error
}

/** Increment share_count for a listing (call when user shares). */
export async function incrementListingShareCount(listingKey: string): Promise<void> {
  const supabase = serviceSupabase()
  if (!supabase) return
  const key = String(listingKey).trim()
  if (!key) return
  await ensureEngagementRow(key)
  const { data: row } = await supabase
    .from('engagement_metrics')
    .select('share_count')
    .eq('listing_key', key)
    .single()
  const cur = Math.max(0, Number((row as { share_count?: number } | null)?.share_count) ?? 0)
  await supabase
    .from('engagement_metrics')
    .update({ share_count: cur + 1, updated_at: new Date().toISOString() })
    .eq('listing_key', key)
}

/** Increment save_count (call after user saves listing). */
export async function incrementListingSaveCount(listingKey: string): Promise<void> {
  const supabase = serviceSupabase()
  if (!supabase) return
  const key = String(listingKey).trim()
  if (!key) return
  await ensureEngagementRow(key)
  const { data: row } = await supabase
    .from('engagement_metrics')
    .select('save_count')
    .eq('listing_key', key)
    .single()
  const cur = Math.max(0, Number((row as { save_count?: number } | null)?.save_count) ?? 0)
  await supabase
    .from('engagement_metrics')
    .update({ save_count: cur + 1, updated_at: new Date().toISOString() })
    .eq('listing_key', key)
}

/** Decrement save_count (call after user unsaves listing). */
export async function decrementListingSaveCount(listingKey: string): Promise<void> {
  const supabase = serviceSupabase()
  if (!supabase) return
  const key = String(listingKey).trim()
  if (!key) return
  const { data: row } = await supabase
    .from('engagement_metrics')
    .select('save_count')
    .eq('listing_key', key)
    .maybeSingle()
  const cur = Math.max(0, Number((row as { save_count?: number } | null)?.save_count) ?? 0)
  if (cur > 0) {
    await supabase
      .from('engagement_metrics')
      .update({ save_count: cur - 1, updated_at: new Date().toISOString() })
      .eq('listing_key', key)
  }
}

/** Increment like_count (call after user likes listing). */
export async function incrementListingLikeCount(listingKey: string): Promise<void> {
  const supabase = serviceSupabase()
  if (!supabase) return
  const key = String(listingKey).trim()
  if (!key) return
  await ensureEngagementRow(key)
  const { data: row } = await supabase
    .from('engagement_metrics')
    .select('like_count')
    .eq('listing_key', key)
    .single()
  const cur = Math.max(0, Number((row as { like_count?: number } | null)?.like_count) ?? 0)
  await supabase
    .from('engagement_metrics')
    .update({ like_count: cur + 1, updated_at: new Date().toISOString() })
    .eq('listing_key', key)
}

/** Decrement like_count (call after user unlikes listing). */
export async function decrementListingLikeCount(listingKey: string): Promise<void> {
  const supabase = serviceSupabase()
  if (!supabase) return
  const key = String(listingKey).trim()
  if (!key) return
  const { data: row } = await supabase
    .from('engagement_metrics')
    .select('like_count')
    .eq('listing_key', key)
    .maybeSingle()
  const cur = Math.max(0, Number((row as { like_count?: number } | null)?.like_count) ?? 0)
  if (cur > 0) {
    await supabase
      .from('engagement_metrics')
      .update({ like_count: cur - 1, updated_at: new Date().toISOString() })
      .eq('listing_key', key)
  }
}
