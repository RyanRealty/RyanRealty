'use server'

import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/app/actions/auth'

export type Collection = {
  id: string
  name: string
  description: string | null
  share_token: string
  user_id: string
  listing_keys: string[]
  created_at: string
  updated_at: string
}

/**
 * Create a new listing collection.
 * Collections are shareable — anyone with the share URL can view (but not edit).
 */
export async function createCollection(input: {
  name: string
  description?: string
  listingKeys?: string[]
}): Promise<{ data: Collection | null; error: string | null }> {
  try {
    const session = await getSession()
    if (!session) return { data: null, error: 'Please sign in to create collections' }

    const supabase = await createClient()
    const shareToken = generateShareToken()

    const { data, error } = await supabase
      .from('listing_collections')
      .insert({
        name: input.name.trim(),
        description: input.description?.trim() || null,
        user_id: session.user.id,
        share_token: shareToken,
        listing_keys: input.listingKeys ?? [],
      })
      .select()
      .single()

    if (error) {
      console.error('[createCollection]', error.message)
      // If table doesn't exist, return a helpful message
      if (error.message.includes('relation') || error.code === '42P01') {
        return { data: null, error: 'Collections feature is being set up. Please try again later.' }
      }
      return { data: null, error: error.message }
    }

    return { data: data as Collection, error: null }
  } catch (err) {
    console.error('[createCollection]', err)
    return { data: null, error: 'Failed to create collection' }
  }
}

/**
 * Add a listing to an existing collection.
 */
export async function addToCollection(collectionId: string, listingKey: string): Promise<{ error: string | null }> {
  try {
    const session = await getSession()
    if (!session) return { error: 'Please sign in' }

    const supabase = await createClient()

    // Get current listing_keys
    const { data: collection, error: fetchError } = await supabase
      .from('listing_collections')
      .select('listing_keys')
      .eq('id', collectionId)
      .eq('user_id', session.user.id)
      .single()

    if (fetchError || !collection) return { error: 'Collection not found' }

    const keys = Array.isArray(collection.listing_keys) ? collection.listing_keys as string[] : []
    if (keys.includes(listingKey)) return { error: null } // Already in collection

    const { error } = await supabase
      .from('listing_collections')
      .update({
        listing_keys: [...keys, listingKey],
        updated_at: new Date().toISOString(),
      })
      .eq('id', collectionId)
      .eq('user_id', session.user.id)

    if (error) return { error: error.message }
    return { error: null }
  } catch (err) {
    console.error('[addToCollection]', err)
    return { error: 'Failed to add to collection' }
  }
}

/**
 * Remove a listing from a collection.
 */
export async function removeFromCollection(
  collectionId: string,
  listingKey: string,
): Promise<{ error: string | null }> {
  try {
    const session = await getSession()
    if (!session) return { error: 'Please sign in' }
    const supabase = await createClient()
    const { data: collection, error: fetchError } = await supabase
      .from('listing_collections')
      .select('listing_keys')
      .eq('id', collectionId)
      .eq('user_id', session.user.id)
      .single()
    if (fetchError || !collection) return { error: 'Collection not found' }
    const keys = Array.isArray(collection.listing_keys) ? (collection.listing_keys as string[]) : []
    const next = keys.filter((k) => k !== listingKey)
    const { error } = await supabase
      .from('listing_collections')
      .update({ listing_keys: next, updated_at: new Date().toISOString() })
      .eq('id', collectionId)
      .eq('user_id', session.user.id)
    if (error) return { error: error.message }
    return { error: null }
  } catch (err) {
    console.error('[removeFromCollection]', err)
    return { error: 'Failed to remove from collection' }
  }
}

/**
 * Delete a collection (owner only).
 */
export async function deleteCollection(collectionId: string): Promise<{ error: string | null }> {
  try {
    const session = await getSession()
    if (!session) return { error: 'Please sign in' }
    const supabase = await createClient()
    const { error } = await supabase
      .from('listing_collections')
      .delete()
      .eq('id', collectionId)
      .eq('user_id', session.user.id)
    if (error) return { error: error.message }
    return { error: null }
  } catch (err) {
    console.error('[deleteCollection]', err)
    return { error: 'Failed to delete collection' }
  }
}

/**
 * Get a single collection the signed-in user owns, by id.
 */
export async function getCollectionById(collectionId: string): Promise<{ data: Collection | null; error: string | null }> {
  try {
    const session = await getSession()
    if (!session) return { data: null, error: 'Please sign in' }
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('listing_collections')
      .select('id, name, description, share_token, user_id, listing_keys, created_at, updated_at')
      .eq('id', collectionId)
      .eq('user_id', session.user.id)
      .single()
    if (error) return { data: null, error: error.message }
    return { data: data as Collection, error: null }
  } catch (err) {
    console.error('[getCollectionById]', err)
    return { data: null, error: 'Failed to load collection' }
  }
}

/**
 * Get all collections for the signed-in user.
 */
export async function getUserCollections(): Promise<{ data: Collection[]; error: string | null }> {
  try {
    const session = await getSession()
    if (!session) return { data: [], error: null }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('listing_collections')
      .select('id, name, description, share_token, user_id, listing_keys, created_at, updated_at')
      .eq('user_id', session.user.id)
      .order('updated_at', { ascending: false })

    if (error) {
      if (error.message.includes('relation') || error.code === '42P01') {
        return { data: [], error: null } // Table doesn't exist yet
      }
      return { data: [], error: error.message }
    }

    return { data: (data ?? []) as Collection[], error: null }
  } catch (err) {
    console.error('[getUserCollections]', err)
    return { data: [], error: 'Failed to load collections' }
  }
}

function generateShareToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}
