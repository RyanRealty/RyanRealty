/**
 * Admin sync verification counts.
 *
 * These read directly from the `listings` + `listing_history` tables because
 * the sync-specific flags (`history_finalized`, `history_verified_full`) are
 * not projected into the public materialized view. Lives inside lib/data/
 * so it's the only place the DAL boundary allows it.
 *
 * Used exclusively by /admin/sync dashboards — not by any public LP route.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'

const ACTIVE_OR_PENDING_OR =
  'StandardStatus.is.null,StandardStatus.ilike.%Active%,StandardStatus.ilike.%For Sale%,StandardStatus.ilike.%Coming Soon%,StandardStatus.ilike.%Pending%,StandardStatus.ilike.%Under Contract%'

export type CountResult = { count: number; error?: string }

const ZERO: CountResult = { count: 0 }

function safe(result: { count: number | null; error: { message: string } | null }): CountResult {
  if (result.error) return { count: 0, error: result.error.message }
  return { count: result.count ?? 0 }
}

async function withRetry<T extends { count: number | null; error: { message: string } | null }>(
  fn: () => Promise<T>,
  retries = 2
): Promise<CountResult> {
  for (let i = 0; i <= retries; i++) {
    try {
      const r = await fn()
      if (!r.error) return safe(r)
      if (i === retries) return safe(r)
    } catch (e) {
      if (i === retries) return { count: 0, error: e instanceof Error ? e.message : String(e) }
    }
    await new Promise((resolve) => setTimeout(resolve, 100 * (i + 1)))
  }
  return ZERO
}

function isAdminConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  return !!url?.trim() && !!key?.trim()
}

function client(): SupabaseClient | null {
  if (!isAdminConfigured()) return null
  return createServiceClient()
}

/** Total rows in listing_history table. */
export async function getListingHistoryRowCount(): Promise<CountResult> {
  const sb = client()
  if (!sb) return ZERO
  return withRetry(async () =>
    sb.from('listing_history').select('listing_key', { count: 'exact', head: true })
  )
}

/** Active+Pending listings missing a history_finalized flag. */
export async function getActiveNeedingHistoryCount(): Promise<CountResult> {
  const sb = client()
  if (!sb) return ZERO
  return withRetry(async () =>
    sb
      .from('listings')
      .select('ListingKey', { count: 'exact', head: true })
      .or(ACTIVE_OR_PENDING_OR)
      .eq('history_finalized', false)
  )
}

/** Listings with history_finalized = true. */
export async function getHistoryFinalizedCount(): Promise<CountResult> {
  const sb = client()
  if (!sb) return ZERO
  return withRetry(async () =>
    sb.from('listings').select('ListingKey', { count: 'exact', head: true }).eq('history_finalized', true)
  )
}

/** Listings with history_verified_full = true. */
export async function getHistoryVerifiedFullCount(): Promise<CountResult> {
  const sb = client()
  if (!sb) return ZERO
  return withRetry(async () =>
    sb
      .from('listings')
      .select('ListingKey', { count: 'exact', head: true })
      .eq('history_verified_full', true)
  )
}

/** Listings finalized but NOT verified-full (the strict-verify backlog). */
export async function getFinalizedUnverifiedCount(): Promise<CountResult> {
  const sb = client()
  if (!sb) return ZERO
  return withRetry(async () =>
    sb
      .from('listings')
      .select('ListingKey', { count: 'exact', head: true })
      .eq('history_finalized', true)
      .eq('history_verified_full', false)
  )
}

export type TerminalBucket = 'Closed' | 'Expired' | 'Withdrawn' | 'Cancel'

/** Terminal-status total count (count of listings whose StandardStatus matches). */
export async function getTerminalBucketTotal(bucket: TerminalBucket): Promise<CountResult> {
  const sb = client()
  if (!sb) return ZERO
  return withRetry(async () =>
    sb
      .from('listings')
      .select('ListingKey', { count: 'exact', head: true })
      .ilike('StandardStatus', `%${bucket}%`)
  )
}

/** Terminal-status finalized count (finalized for that bucket). */
export async function getTerminalBucketFinalized(bucket: TerminalBucket): Promise<CountResult> {
  const sb = client()
  if (!sb) return ZERO
  return withRetry(async () =>
    sb
      .from('listings')
      .select('ListingKey', { count: 'exact', head: true })
      .ilike('StandardStatus', `%${bucket}%`)
      .eq('history_finalized', true)
  )
}

/** Total listings count (all statuses). Used by admin status breakdown. */
export async function getAllListingsCount(): Promise<CountResult> {
  const sb = client()
  if (!sb) return ZERO
  return withRetry(async () =>
    sb.from('listings').select('ListingKey', { count: 'exact', head: true })
  )
}

/** Count of listings whose StandardStatus ILIKE %pattern%. */
export async function getStatusIlikeCount(pattern: string): Promise<CountResult> {
  const sb = client()
  if (!sb) return ZERO
  return withRetry(async () =>
    sb
      .from('listings')
      .select('ListingKey', { count: 'exact', head: true })
      .ilike('StandardStatus', `%${pattern}%`)
  )
}

/** Count of pending listings excluding contingent. */
export async function getPendingNonContingentCount(): Promise<CountResult> {
  const sb = client()
  if (!sb) return ZERO
  return withRetry(async () =>
    sb
      .from('listings')
      .select('ListingKey', { count: 'exact', head: true })
      .or('StandardStatus.ilike.%pending%,StandardStatus.ilike.%under contract%,StandardStatus.ilike.%undercontract%')
      .not('StandardStatus', 'ilike', '%contingent%')
  )
}

/** Count of active-bucket listings (excludes pending/contingent/terminal). */
export async function getActiveBucketCount(): Promise<CountResult> {
  const sb = client()
  if (!sb) return ZERO
  return withRetry(async () =>
    sb
      .from('listings')
      .select('ListingKey', { count: 'exact', head: true })
      .or('StandardStatus.is.null,StandardStatus.ilike.%active%,StandardStatus.ilike.%for sale%,StandardStatus.ilike.%coming soon%')
      .not('StandardStatus', 'ilike', '%closed%')
      .not('StandardStatus', 'ilike', '%expired%')
      .not('StandardStatus', 'ilike', '%withdrawn%')
      .not('StandardStatus', 'ilike', '%cancel%')
      .not('StandardStatus', 'ilike', '%contingent%')
      .not('StandardStatus', 'ilike', '%pending%')
      .not('StandardStatus', 'ilike', '%under contract%')
      .not('StandardStatus', 'ilike', '%undercontract%')
  )
}

/** Terminal-status strict backlog (finalized but not verified-full). */
export async function getTerminalBucketStrictBacklog(bucket: TerminalBucket): Promise<CountResult> {
  const sb = client()
  if (!sb) return ZERO
  return withRetry(async () =>
    sb
      .from('listings')
      .select('ListingKey', { count: 'exact', head: true })
      .ilike('StandardStatus', `%${bucket}%`)
      .eq('history_finalized', true)
      .eq('history_verified_full', false)
  )
}
