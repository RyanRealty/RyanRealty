/**
 * Server-side activity logging to user_activities. Non-blocking, bulk-friendly.
 * Step 18.
 */

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function getSupabase() {
  if (!url?.trim() || !anonKey?.trim()) throw new Error('Supabase not configured')
  return createClient(url, anonKey)
}

export type ActivityRecord = {
  user_id?: string | null
  visitor_cookie_id?: string | null
  activity_type: string
  entity_type: string
  entity_id: string
  metadata?: Record<string, unknown>
}

/**
 * Log one activity. Prefer logActivities for multiple.
 */
export async function logActivity(record: ActivityRecord): Promise<void> {
  const supabase = getSupabase()
  await supabase.from('user_activities').insert({
    user_id: record.user_id ?? null,
    visitor_cookie_id: record.visitor_cookie_id ?? null,
    activity_type: record.activity_type,
    entity_type: record.entity_type,
    entity_id: record.entity_id,
    metadata: record.metadata ?? {},
  })
}

/**
 * Bulk insert activities. Non-blocking; fire-and-forget.
 */
export async function logActivities(records: ActivityRecord[]): Promise<void> {
  if (records.length === 0) return
  const supabase = getSupabase()
  const rows = records.map((r) => ({
    user_id: r.user_id ?? null,
    visitor_cookie_id: r.visitor_cookie_id ?? null,
    activity_type: r.activity_type,
    entity_type: r.entity_type,
    entity_id: r.entity_id,
    metadata: r.metadata ?? {},
  }))
  await supabase.from('user_activities').insert(rows)
}
