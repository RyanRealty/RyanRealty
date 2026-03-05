'use server'

import { createClient } from '@/lib/supabase/server'

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
