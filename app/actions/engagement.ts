'use server'

import { createClient } from '@supabase/supabase-js'

export type EngagementCounts = {
  like_count: number
  save_count: number
  share_count: number
}

/**
 * Batch fetch engagement counts for listing tiles (like, save, share).
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
    .select('listing_key, like_count, save_count, share_count')
    .in('listing_key', keys)

  if (error) return {}

  const result: Record<string, EngagementCounts> = {}
  for (const k of keys) {
    result[k] = { like_count: 0, save_count: 0, share_count: 0 }
  }
  for (const row of (rows ?? []) as { listing_key?: string; like_count?: number; save_count?: number; share_count?: number }[]) {
    const key = (row.listing_key ?? '').trim()
    if (!key) continue
    result[key] = {
      like_count: Math.max(0, Number(row.like_count) ?? 0),
      save_count: Math.max(0, Number(row.save_count) ?? 0),
      share_count: Math.max(0, Number(row.share_count) ?? 0),
    }
  }
  return result
}

export type ListingDetailEngagement = {
  view_count: number
  like_count: number
  save_count: number
}

/**
 * Fetch engagement metrics for a single listing (detail page summary: views, likes, saves).
 */
export async function getEngagementForListingDetail(listingKey: string): Promise<ListingDetailEngagement> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !anonKey?.trim()) {
    return { view_count: 0, like_count: 0, save_count: 0 }
  }
  const key = String(listingKey ?? '').trim()
  if (!key) return { view_count: 0, like_count: 0, save_count: 0 }

  const supabase = createClient(url, anonKey)
  const { data: row } = await supabase
    .from('engagement_metrics')
    .select('view_count, like_count, save_count')
    .eq('listing_key', key)
    .maybeSingle()

  const r = row as { view_count?: unknown; like_count?: unknown; save_count?: unknown } | null
  const safe = (v: unknown): number => {
    const n = Number(v)
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
  }
  return {
    view_count: safe(r?.view_count),
    like_count: safe(r?.like_count),
    save_count: safe(r?.save_count),
  }
}
