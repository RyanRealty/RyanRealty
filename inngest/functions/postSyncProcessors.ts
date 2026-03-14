/**
 * Post-sync processors. Section 7.10.
 * Match saved searches, queue price-drop/status-change notifications, init engagement metrics.
 */

import { inngest } from '@/lib/inngest'
import { createClient } from '@supabase/supabase-js'
import * as Sentry from '@sentry/nextjs'

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) throw new Error('Supabase service role not configured')
  return createClient(url, key)
}

/** Match new/changed listings against saved searches; enqueue notifications by user frequency. */
export const matchSavedSearches = inngest.createFunction(
  { id: 'sync/match-saved-searches', name: 'Match saved searches', retries: 1 },
  { event: 'sync/match-saved-searches', data: { listingKeys: [] as string[] } },
  async ({ event }) => {
    const listingKeys = (event.data as { listingKeys: string[] }).listingKeys ?? []
    if (listingKeys.length === 0) return { matched: 0 }
    const supabase = getServiceSupabase()
    const { data: searches } = await supabase.from('saved_searches').select('id, user_id, filters, notification_frequency').eq('is_paused', false)
    if (!searches?.length) return { matched: 0 }
    const { data: listings } = await supabase.from('listings').select('listing_key, beds_total, baths_full, living_area, list_price, subdivision_name, city').in('listing_key', listingKeys)
    const listingMap = new Map((listings ?? []).map((l) => [l.listing_key, l]))
    let inserted = 0
    for (const search of searches) {
      const filters = (search.filters as Record<string, unknown>) ?? {}
      for (const listing of listings ?? []) {
        const match = matchFilters(listing, filters)
        if (match) {
          const { error } = await supabase.from('notification_queue').insert({
            user_id: search.user_id,
            notification_type: 'saved_search_match',
            payload: { listing_key: listing.listing_key, search_id: search.id },
            channel: 'email',
            status: 'pending',
          })
          if (!error) inserted++
        }
      }
    }
    return { matched: inserted }
  }
)

function matchFilters(
  listing: { beds_total?: number | null; baths_full?: number | null; living_area?: number | null; list_price?: number | null; subdivision_name?: string | null; city?: string | null },
  filters: Record<string, unknown>
): boolean {
  const minBeds = typeof filters.minBeds === 'number' ? filters.minBeds : null
  const maxPrice = typeof filters.maxPrice === 'number' ? filters.maxPrice : null
  const city = typeof filters.city === 'string' ? filters.city : null
  const subdivision = typeof filters.subdivision === 'string' ? filters.subdivision : null
  if (minBeds != null && (listing.beds_total ?? 0) < minBeds) return false
  if (maxPrice != null && (listing.list_price ?? 0) > maxPrice) return false
  if (city != null && (listing.city ?? '').toLowerCase() !== city.toLowerCase()) return false
  if (subdivision != null && (listing.subdivision_name ?? '').toLowerCase() !== subdivision.toLowerCase()) return false
  return true
}

/** For each listing with price decrease, find users who saved it and enqueue notifications. */
export const queuePriceDropNotifications = inngest.createFunction(
  { id: 'sync/queue-price-drop-notifications', name: 'Queue price drop notifications', retries: 1 },
  { event: 'sync/queue-price-drop-notifications', data: { listings: [] as Array<{ listing_key: string; old_price: number | null; new_price: number | null }> } },
  async ({ event }) => {
    const list = (event.data as { listings: Array<{ listing_key: string; old_price: number | null; new_price: number | null }> }).listings ?? []
    const supabase = getServiceSupabase()
    let inserted = 0
    for (const { listing_key, old_price, new_price } of list) {
      if (old_price == null || new_price == null || new_price >= old_price) continue
      const { data: users } = await supabase.from('saved_listings').select('user_id').eq('listing_key', listing_key)
      for (const row of users ?? []) {
        const { error } = await supabase.from('notification_queue').insert({
          user_id: row.user_id,
          notification_type: 'price_drop',
          payload: { listing_key, old_price, new_price },
          channel: 'email',
          status: 'pending',
        })
        if (!error) inserted++
      }
    }
    return { inserted }
  }
)

/** For each listing with status change, find users who saved it and enqueue notifications. */
export const queueStatusChangeNotifications = inngest.createFunction(
  { id: 'sync/queue-status-change-notifications', name: 'Queue status change notifications', retries: 1 },
  { event: 'sync/queue-status-change-notifications', data: { listings: [] as Array<{ listing_key: string; old_status: string | null; new_status: string | null }> } },
  async ({ event }) => {
    const list = (event.data as { listings: Array<{ listing_key: string; old_status: string | null; new_status: string | null }> }).listings ?? []
    const supabase = getServiceSupabase()
    let inserted = 0
    for (const { listing_key, new_status } of list) {
      const { data: users } = await supabase.from('saved_listings').select('user_id').eq('listing_key', listing_key)
      for (const row of users ?? []) {
        const { error } = await supabase.from('notification_queue').insert({
          user_id: row.user_id,
          notification_type: 'status_change',
          payload: { listing_key, new_status },
          channel: 'email',
          status: 'pending',
        })
        if (!error) inserted++
      }
    }
    return { inserted }
  }
)

/** Ensure engagement_metrics row exists for every new listing (zeros). */
export const updateEngagementMetrics = inngest.createFunction(
  { id: 'sync/update-engagement-metrics', name: 'Init engagement metrics for new listings', retries: 1 },
  { event: 'sync/update-engagement-metrics', data: { listingKeys: [] as string[] } },
  async ({ event }) => {
    const keys = (event.data as { listingKeys: string[] }).listingKeys ?? []
    if (keys.length === 0) return { upserted: 0 }
    const supabase = getServiceSupabase()
    for (const key of keys) {
      try {
        await supabase.from('engagement_metrics').upsert(
          { listing_key: key, view_count: 0, like_count: 0, save_count: 0, share_count: 0, updated_at: new Date().toISOString() },
          { onConflict: 'listing_key' }
        )
      } catch (e) {
        Sentry.captureException(e, { extra: { listingKey: key } })
      }
    }
    return { upserted: keys.length }
  }
)
