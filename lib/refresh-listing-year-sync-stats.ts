import { createClient } from '@supabase/supabase-js'

export type RefreshListingYearSyncStatsResult = { ok: true } | { ok: false; error: string }

/**
 * Rebuilds listing_year_* materialized views (full listings scan; use cron only).
 */
export async function refreshListingYearSyncStats(): Promise<RefreshListingYearSyncStatsResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    return { ok: false, error: 'Supabase not configured' }
  }
  const supabase = createClient(url, key)
  const { error } = await supabase.rpc('refresh_listing_year_sync_stats')
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
