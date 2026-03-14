'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function getLikedListingKeys(): Promise<string[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase
    .from('likes')
    .select('listing_key')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  return (data ?? []).map((r: { listing_key: string }) => r.listing_key)
}

export async function isListingLiked(listingKey: string): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data } = await supabase
    .from('likes')
    .select('id')
    .eq('user_id', user.id)
    .eq('listing_key', listingKey.trim())
    .maybeSingle()
  return !!data
}

export async function likeListing(listingKey: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  const { error } = await supabase.from('likes').insert({
    user_id: user.id,
    listing_key: listingKey.trim(),
  })
  if (error) return { error: error.message }
  return { error: null }
}

export async function unlikeListing(listingKey: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  const { error } = await supabase
    .from('likes')
    .delete()
    .eq('user_id', user.id)
    .eq('listing_key', listingKey.trim())
  if (error) return { error: error.message }
  return { error: null }
}

export async function toggleLikeListing(listingKey: string): Promise<{ liked: boolean; error: string | null }> {
  const liked = await isListingLiked(listingKey)
  if (liked) {
    const { error } = await unlikeListing(listingKey)
    return { liked: false, error }
  }
  const { error } = await likeListing(listingKey)
  return { liked: true, error }
}

/** Public like count for a listing (anon/authenticated can read). */
export async function getLikeCount(listingKey: string): Promise<number> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('likes')
    .select('*', { count: 'exact', head: true })
    .eq('listing_key', listingKey.trim())
  if (error) return 0
  return count ?? 0
}
