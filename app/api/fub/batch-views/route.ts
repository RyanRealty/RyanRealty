/**
 * Flush batched property views to FUB. Called by Inngest every 5 minutes.
 * Step 18.
 */

import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { pushToFub } from '@/lib/fub'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function getSupabase() {
  if (!url?.trim() || !serviceKey?.trim()) throw new Error('Supabase service role not configured')
  return createClient(url, serviceKey)
}

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

/**
 * POST (from Inngest): query user_activities for property_view in last 5 min, group by user_id, send one FUB event per user.
 */
export async function POST(request: NextRequest) {
  const supabase = getSupabase()
  const since = new Date(Date.now() - 5 * 60 * 1000).toISOString()
  const { data: rows } = await supabase
    .from('user_activities')
    .select('user_id, entity_id, metadata')
    .eq('activity_type', 'property_view')
    .gte('created_at', since)
  const byUser = new Map<string, string[]>()
  for (const r of rows ?? []) {
    const uid = (r as { user_id?: string }).user_id
    if (!uid) continue
    const listingKey = (r as { entity_id: string }).entity_id
    const list = byUser.get(uid) ?? []
    if (!list.includes(listingKey)) list.push(listingKey)
    byUser.set(uid, list)
  }
  for (const [userId, listingKeys] of byUser) {
    if (listingKeys.length === 0) continue
    const { data: user } = await supabase.auth.admin.getUserById(userId)
    const email = user?.user?.email ?? ''
    if (!email) continue
    const listingUrls = listingKeys.map((k) => `${siteUrl}/listing/${encodeURIComponent(k)}`)
    await pushToFub('Property Viewed', { email }, { listingUrls })
  }
  return Response.json({ flushed: byUser.size })
}
