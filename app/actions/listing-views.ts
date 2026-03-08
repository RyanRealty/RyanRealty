'use server'

import { createClient } from '@supabase/supabase-js'

/**
 * Record a listing detail page view for "Trending Homes" (most viewed in last 24h per city).
 * Call from client when listing page is viewed (e.g. TrackListingView). Uses anon key; RLS allows insert.
 */
export async function recordListingView(listingKey: string, city: string): Promise<{ error: string | null }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !anonKey?.trim() || !listingKey?.trim()) return { error: 'Missing config or listing key' }
  const supabase = createClient(url, anonKey)
  const { error } = await supabase.from('listing_views').insert({
    listing_key: listingKey.trim(),
    city: (city ?? '').trim() || 'Bend',
  })
  if (error) return { error: error.message }
  return { error: null }
}

/**
 * Top listing keys by view count in the given city over the past 24 hours. Used for "Trending Homes in [City], Oregon" row.
 * Uses public RPC so no service role required.
 */
export async function getTrendingListingKeys(city: string, limit = 16): Promise<string[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !anonKey?.trim() || !city?.trim()) return []
  const supabase = createClient(url, anonKey)
  const { data } = await supabase.rpc('get_trending_listing_keys', {
    p_city: city.trim(),
    p_limit: Math.min(limit, 24),
  })
  if (!Array.isArray(data)) return []
  return data.map((r: { listing_key?: string }) => (r?.listing_key ?? '').trim()).filter(Boolean)
}
