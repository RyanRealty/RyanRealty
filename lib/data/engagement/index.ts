/**
 * Engagement metrics DAL.
 *
 * Owns every read + write against the `engagement_metrics` table. Pages /
 * components / server actions consume this module — never touch the table
 * directly. The ESLint DAL boundary rule enforces this.
 *
 * Reads are anon-key fast-path. Writes use the service role for the bumped
 * counter operations (the table is RLS-locked).
 */

import { supabaseAnon } from '@/lib/data/client'
import { createServiceClient } from '@/lib/supabase/service'

export type EngagementCounts = {
  view_count: number
  like_count: number
  save_count: number
  share_count: number
}

const ZERO_COUNTS: EngagementCounts = {
  view_count: 0,
  like_count: 0,
  save_count: 0,
  share_count: 0,
}

function safeInt(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
}

/**
 * Batch-fetch engagement counts for a set of listing keys.
 * Missing keys get zeros. Returns an object keyed by listing_key.
 */
export async function getEngagementCountsBatch(
  listingKeys: string[]
): Promise<Record<string, EngagementCounts>> {
  const supabase = supabaseAnon()
  if (!supabase) return {}
  const keys = [...new Set(listingKeys.map((k) => String(k).trim()).filter(Boolean))]
  if (keys.length === 0) return {}

  const { data: rows, error } = await supabase
    .from('engagement_metrics')
    .select('listing_key, view_count, like_count, save_count, share_count')
    .in('listing_key', keys)
  if (error) return {}

  const result: Record<string, EngagementCounts> = {}
  for (const k of keys) result[k] = { ...ZERO_COUNTS }
  for (const row of (rows ?? []) as Array<Partial<EngagementCounts> & { listing_key?: string }>) {
    const key = (row.listing_key ?? '').toString().trim()
    if (!key) continue
    result[key] = {
      view_count: safeInt(row.view_count),
      like_count: safeInt(row.like_count),
      save_count: safeInt(row.save_count),
      share_count: safeInt(row.share_count),
    }
  }
  return result
}

/**
 * Fetch engagement counts for a single listing detail page.
 */
export async function getEngagementForListing(listingKey: string): Promise<EngagementCounts> {
  const supabase = supabaseAnon()
  if (!supabase) return { ...ZERO_COUNTS }
  const key = String(listingKey ?? '').trim()
  if (!key) return { ...ZERO_COUNTS }
  const { data: row } = await supabase
    .from('engagement_metrics')
    .select('view_count, like_count, save_count, share_count')
    .eq('listing_key', key)
    .maybeSingle()
  const r = (row ?? {}) as Partial<EngagementCounts>
  return {
    view_count: safeInt(r.view_count),
    like_count: safeInt(r.like_count),
    save_count: safeInt(r.save_count),
    share_count: safeInt(r.share_count),
  }
}

/**
 * Ensure a counter row exists. Returns true on success.
 */
async function ensureRow(listingKey: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return false
  const supabase = createServiceClient()
  const k = String(listingKey).trim()
  if (!k) return false
  const { data } = await supabase
    .from('engagement_metrics')
    .select('listing_key')
    .eq('listing_key', k)
    .maybeSingle()
  if (data) return true
  const { error } = await supabase.from('engagement_metrics').insert({
    listing_key: k,
    view_count: 0,
    like_count: 0,
    save_count: 0,
    share_count: 0,
  })
  if (error?.code === '23505') return true
  return !error
}

type CounterField = 'view_count' | 'like_count' | 'save_count' | 'share_count'

async function bumpCounter(
  listingKey: string,
  field: CounterField,
  direction: 1 | -1
): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return
  const k = String(listingKey).trim()
  if (!k) return
  if (direction === 1) {
    await ensureRow(k)
  }
  const supabase = createServiceClient()
  const { data: row } = await supabase
    .from('engagement_metrics')
    .select(field)
    .eq('listing_key', k)
    .maybeSingle()
  const cur = Math.max(0, Number((row as Record<string, unknown> | null)?.[field]) || 0)
  if (direction === -1 && cur <= 0) return
  await supabase
    .from('engagement_metrics')
    .update({ [field]: cur + direction, updated_at: new Date().toISOString() })
    .eq('listing_key', k)
}

export const incrementListingShareCount = (k: string) => bumpCounter(k, 'share_count', 1)
export const incrementListingSaveCount = (k: string) => bumpCounter(k, 'save_count', 1)
export const decrementListingSaveCount = (k: string) => bumpCounter(k, 'save_count', -1)
export const incrementListingLikeCount = (k: string) => bumpCounter(k, 'like_count', 1)
export const decrementListingLikeCount = (k: string) => bumpCounter(k, 'like_count', -1)
export const incrementListingViewCount = (k: string) => bumpCounter(k, 'view_count', 1)

/**
 * Top N listing_keys by view_count (descending). Used by the homepage
 * "featured" tile picker. Returns empty array if engagement_metrics is empty.
 */
export async function getTopViewedListingKeys(limit = 20): Promise<string[]> {
  const supabase = supabaseAnon()
  if (!supabase) return []
  const safeLimit = Math.min(Math.max(limit, 1), 200)
  const { data } = await supabase
    .from('engagement_metrics')
    .select('listing_key, view_count')
    .order('view_count', { ascending: false })
    .limit(safeLimit)
  return ((data ?? []) as Array<{ listing_key?: string }>)
    .map((r) => (r?.listing_key ?? '').trim())
    .filter(Boolean)
}
