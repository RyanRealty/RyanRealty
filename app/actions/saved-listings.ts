'use server'

import { cookies, headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { recordSaveListingEvent } from '@/lib/data/crm/recordSaveListingEvent'
import { incrementListingSaveCount, decrementListingSaveCount } from '@/app/actions/engagement'
import { unlikeListing } from '@/app/actions/likes'
import { normalizeListingKey, planSavedHomeRemoval } from '@/lib/saved-home-toggle'
import { resolveCanonicalListingKey } from '@/lib/data'

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
  // Resolve to the canonical RETS ListingKey first: saved_listings is keyed by
  // ListingKey, but callers (pretty /homes-for-sale URLs, paid-ad landings) can
  // pass an MLS ListNumber, which would silently match nothing. Writes resolve
  // the same way, so the table stays consistently canonical-keyed.
  const canonicalKey = await resolveCanonicalListingKey(listingKey)
  const { data } = await supabase
    .from('saved_listings')
    .select('id')
    .eq('user_id', user.id)
    .eq('listing_key', canonicalKey)
    .maybeSingle()
  return !!data
}

export async function saveListing(listingKey: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  const canonicalKey = await resolveCanonicalListingKey(listingKey.trim())
  const { error } = await supabase.from('saved_listings').insert({
    user_id: user.id,
    listing_key: canonicalKey,
  })
  if (error) return { error: error.message }
  await incrementListingSaveCount(canonicalKey)
  await emitSaveEvent(canonicalKey)
  return { error: null }
}

/** First-party behavioral mirror (best-effort, GPC + session gated inside) so
 *  the CRM behavior panels see the save on the visitor's trail. */
async function emitSaveEvent(canonicalKey: string): Promise<void> {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()])
  await recordSaveListingEvent({
    listingKey: canonicalKey,
    action: 'save',
    rrVid: cookieStore.get('rr_vid')?.value ?? null,
    secGpcHeader: headerStore.get('sec-gpc'),
  })
}

/**
 * Idempotent, auth-honest save for the post-sign-in resume (RC7). NEVER toggles:
 * a resume must only ever ADD, so a stale/optimistic "not saved" client state can
 * never silently REMOVE a listing the user already saved. Returns needsAuth=true
 * (not saved) when the session isn't established — the caller re-stashes and tries
 * again on the next return, instead of consuming the intent and showing a false
 * "Saved". Already-saved is a success no-op.
 */
export async function resumeSaveListing(listingKey: string): Promise<{ saved: boolean; needsAuth: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { saved: false, needsAuth: true }
  const canonicalKey = await resolveCanonicalListingKey(listingKey.trim())
  const { data: existing } = await supabase
    .from('saved_listings')
    .select('id')
    .eq('user_id', user.id)
    .eq('listing_key', canonicalKey)
    .maybeSingle()
  if (existing) return { saved: true, needsAuth: false } // already saved — no-op success
  const { error } = await supabase.from('saved_listings').insert({ user_id: user.id, listing_key: canonicalKey })
  if (error) return { saved: false, needsAuth: false } // a real write error is NOT auth — don't claim saved
  await incrementListingSaveCount(canonicalKey)
  await emitSaveEvent(canonicalKey)
  return { saved: true, needsAuth: false }
}

export async function unsaveListing(listingKey: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  const canonicalKey = await resolveCanonicalListingKey(listingKey.trim())
  const { error } = await supabase
    .from('saved_listings')
    .delete()
    .eq('user_id', user.id)
    .eq('listing_key', canonicalKey)
  if (error) return { error: error.message }
  await decrementListingSaveCount(canonicalKey)
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

/**
 * Remove a saved home for the signed-in user across BOTH stores.
 *
 * The /account/saved-homes page renders the UNION of `saved_listings` (bookmark)
 * and `likes` (heart). The old remove only called `unsaveListing`, so a home
 * that lived only in `likes` was a silent no-op. This clears both stores so the
 * home is actually gone. A delete against a store with no matching row is a
 * harmless zero-row delete, never an error. Both helpers resolve the user from
 * the session (`supabase.auth.getUser()`) — the client-passed listing key is the
 * only client input, and it never selects a different user's rows.
 */
export async function removeSavedHome(listingKey: string): Promise<{ error: string | null }> {
  const key = normalizeListingKey(listingKey)
  if (!key) return { error: 'Missing listing' }
  // Membership isn't known at the page level, so plan a full clear (both stores).
  const plan = planSavedHomeRemoval()
  const [saveResult, likeResult] = await Promise.all([
    plan.removeSaved ? unsaveListing(key) : Promise.resolve({ error: null }),
    plan.removeLiked ? unlikeListing(key) : Promise.resolve({ error: null }),
  ])
  return { error: saveResult.error ?? likeResult.error ?? null }
}

/** Public save count for a listing (social proof). Uses service role to count saved_listings. */
export async function getSavedListingCount(listingKey: string): Promise<number> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !serviceKey?.trim() || !listingKey?.trim()) return 0
  const canonicalKey = await resolveCanonicalListingKey(listingKey.trim())
  const supabase = createServiceClient()
  const { count, error } = await supabase
    .from('saved_listings')
    .select('*', { count: 'exact', head: true })
    .eq('listing_key', canonicalKey)
  if (error) return 0
  return count ?? 0
}
