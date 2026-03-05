'use server'

import { createClient } from '@supabase/supabase-js'

export type SyncRunType = 'listings' | 'history' | 'photos' | 'full'

export type SyncHistoryRow = {
  id: string
  run_type: SyncRunType
  started_at: string
  completed_at: string
  duration_seconds: number
  listings_upserted: number
  history_rows_upserted: number
  photos_updated: number
  error: string | null
  created_at: string
}

export type RecordSyncRunInput = {
  runType: SyncRunType
  startedAt: number
  completedAt: number
  listingsUpserted?: number
  historyRowsUpserted?: number
  photosUpdated?: number
  error?: string | null
}

export async function recordSyncRun(input: RecordSyncRunInput): Promise<{ ok: boolean; error?: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !serviceKey?.trim()) {
    return { ok: false, error: 'Supabase not configured' }
  }
  const durationSeconds = Math.round((input.completedAt - input.startedAt) / 1000)
  const supabase = createClient(url, serviceKey)
  const { error } = await supabase.from('sync_history').insert({
    run_type: input.runType,
    started_at: new Date(input.startedAt).toISOString(),
    completed_at: new Date(input.completedAt).toISOString(),
    duration_seconds: durationSeconds,
    listings_upserted: input.listingsUpserted ?? 0,
    history_rows_upserted: input.historyRowsUpserted ?? 0,
    photos_updated: input.photosUpdated ?? 0,
    error: input.error ?? null,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function getSyncHistory(limit = 30): Promise<SyncHistoryRow[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !serviceKey?.trim()) return []
  const supabase = createClient(url, serviceKey)
  const { data, error } = await supabase
    .from('sync_history')
    .select('id, run_type, started_at, completed_at, duration_seconds, listings_upserted, history_rows_upserted, photos_updated, error, created_at')
    .order('completed_at', { ascending: false })
    .limit(limit)
  if (error) return []
  return (data ?? []) as SyncHistoryRow[]
}

/**
 * Recompute the full listings breakdown from all rows and update the report cache.
 * Call after every listings (or full) sync so reports are 100% accurate and stay fast.
 */
export async function refreshListingsBreakdown(): Promise<{ ok: boolean; error?: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !serviceKey?.trim()) {
    return { ok: false, error: 'Supabase not configured' }
  }
  const supabase = createClient(url, serviceKey)
  const { error } = await supabase.rpc('refresh_listings_breakdown')
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
