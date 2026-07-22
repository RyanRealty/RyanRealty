'use server'

import { createClient } from '@/lib/supabase/server'
import { resolveCanonicalListingKey } from '@/lib/data'

/**
 * Hidden listings — "Hide homes I don't want to see."
 *
 * Mirrors app/actions/saved-listings.ts: auth-user scoped, every write resolves
 * the incoming identifier (ListNumber from pretty URLs OR ListingKey) to the
 * canonical RETS ListingKey via resolveCanonicalListingKey so the table stays
 * consistently canonical-keyed.
 *
 * Feature detection: the hidden_listings table ships in migration
 * 20260722010200_hidden_listings.sql, which the orchestrator applies AFTER the
 * code lands. Until then every action fails soft to a no-op (empty list /
 * success) instead of surfacing "relation does not exist" to the UI.
 */

/** True when the error means hidden_listings has not been migrated yet. */
function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  // 42P01 = Postgres undefined_table; PGRST205 = PostgREST relation not in
  // schema cache (what supabase-js actually reports for a missing table).
  if (error.code === '42P01' || error.code === 'PGRST205') return true
  return /hidden_listings/i.test(error.message ?? '') && /does not exist|schema cache/i.test(error.message ?? '')
}

/** Canonical hidden keys for the signed-in user, newest first. Empty when signed out. */
export async function getHiddenListingKeys(): Promise<string[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data, error } = await supabase
    .from('hidden_listings')
    .select('listing_key')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  if (error) {
    if (!isMissingTableError(error)) {
      console.error('[hidden-listings] getHiddenListingKeys failed', error.message)
    }
    return []
  }
  return (data ?? []).map((r: { listing_key: string }) => r.listing_key)
}

/** Hide a listing for the signed-in user. Idempotent (re-hiding is a success no-op). */
export async function hideListing(listingKey: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  const key = String(listingKey ?? '').trim()
  if (!key) return { error: 'Missing listing' }
  const canonicalKey = await resolveCanonicalListingKey(key)
  const { error } = await supabase
    .from('hidden_listings')
    .upsert(
      { user_id: user.id, listing_key: canonicalKey },
      { onConflict: 'user_id,listing_key', ignoreDuplicates: true },
    )
  if (error) {
    // Pre-migration: fail soft — the client's optimistic hide still applies
    // for the session, and nothing user-facing breaks.
    if (isMissingTableError(error)) return { error: null }
    return { error: error.message }
  }
  return { error: null }
}

/** Unhide a listing for the signed-in user. Zero-row deletes are a success. */
export async function unhideListing(listingKey: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  const key = String(listingKey ?? '').trim()
  if (!key) return { error: 'Missing listing' }
  const canonicalKey = await resolveCanonicalListingKey(key)
  const { error } = await supabase
    .from('hidden_listings')
    .delete()
    .eq('user_id', user.id)
    // The table is canonical-keyed, but delete under BOTH forms so an unhide
    // issued with the raw URL identifier can never strand a row if the
    // canonical resolve ever misses (resolver returns input unchanged then).
    .in('listing_key', canonicalKey === key ? [key] : [canonicalKey, key])
  if (error) {
    if (isMissingTableError(error)) return { error: null }
    return { error: error.message }
  }
  return { error: null }
}
