'use server'

import { createClient } from '@/lib/supabase/server'

export type ViewListingRow = {
  id: string
  entity_id: string
  created_at: string
}

/**
 * Recent listing views for the current user. Reads user_events (the real, written
 * source — event_type='listing_view', written by TrackListingView). Previously this
 * read user_activities, a table nothing ever wrote, so the history + "Recently
 * viewed" surfaces were permanently empty and the Remove button operated on rows
 * that could not exist. Deduped to the latest view per listing.
 */
export async function getRecentListingViews(limit = 100): Promise<ViewListingRow[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('user_events')
    .select('id, listing_key, event_at')
    .eq('user_id', user.id)
    .eq('event_type', 'listing_view')
    .not('listing_key', 'is', null)
    .order('event_at', { ascending: false })
    .limit(limit * 3) // over-fetch so dedup below still yields up to `limit` distinct

  const seen = new Set<string>()
  const rows: ViewListingRow[] = []
  for (const r of (data ?? []) as { id: string; listing_key: string; event_at: string }[]) {
    if (seen.has(r.listing_key)) continue
    seen.add(r.listing_key)
    rows.push({ id: r.id, entity_id: r.listing_key, created_at: r.event_at })
    if (rows.length >= limit) break
  }
  return rows
}

export async function removeRecentListingView(eventId: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  // Remove every view row for this listing (the list shows one deduped row per
  // listing; removing just the newest would leave older ones behind).
  const { data: target } = await supabase
    .from('user_events')
    .select('listing_key')
    .eq('id', eventId.trim())
    .eq('user_id', user.id)
    .maybeSingle()
  if (!target?.listing_key) return { error: null }
  const { error } = await supabase
    .from('user_events')
    .delete()
    .eq('user_id', user.id)
    .eq('event_type', 'listing_view')
    .eq('listing_key', target.listing_key)
  return { error: error?.message ?? null }
}
