'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { incrementListingSaveCount, decrementListingSaveCount } from '@/app/actions/engagement'

export async function getSavedListingKeys(): Promise<string[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase
    .from('saved_listings')
    .select('listing_key')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  return (data ?? []).map((r: { listing_key: string }) => r.listing_key)
}

export async function isListingSaved(listingKey: string): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data } = await supabase
    .from('saved_listings')
    .select('id')
    .eq('user_id', user.id)
    .eq('listing_key', listingKey)
    .maybeSingle()
  return !!data
}

export async function saveListing(listingKey: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  const { error } = await supabase.from('saved_listings').insert({
    user_id: user.id,
    listing_key: listingKey.trim(),
  })
  if (error) return { error: error.message }
  await incrementListingSaveCount(listingKey.trim())
  return { error: null }
}

export async function unsaveListing(listingKey: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  const { error } = await supabase
    .from('saved_listings')
    .delete()
    .eq('user_id', user.id)
    .eq('listing_key', listingKey.trim())
  if (error) return { error: error.message }
  await decrementListingSaveCount(listingKey.trim())
  return { error: null }
}

export async function toggleSavedListing(listingKey: string): Promise<{ saved: boolean; error: string | null }> {
  const saved = await isListingSaved(listingKey)
  if (saved) {
    const { error } = await unsaveListing(listingKey)
    return { saved: false, error }
  }
  const { error } = await saveListing(listingKey)
  return { saved: true, error }
}

/** Public save count for a listing (social proof). Uses service role to count saved_listings. */
export async function getSavedListingCount(listingKey: string): Promise<number> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !serviceKey?.trim() || !listingKey?.trim()) return 0
  const supabase = createServiceClient(url, serviceKey)
  const { count, error } = await supabase
    .from('saved_listings')
    .select('*', { count: 'exact', head: true })
    .eq('listing_key', listingKey.trim())
  if (error) return 0
  return count ?? 0
}
