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

import 'server-only'
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

export type ClosedFinalizedRow = {
  listing_key: string
  city: string | null
  list_price: number | null
  standard_status: string | null
}

/** Closed-status listings that have been finalized in listing_history, sorted by price. */
export async function getClosedFinalizedListingRows(limit = 50): Promise<ClosedFinalizedRow[]> {
  const sb = client()
  if (!sb) return []
  const { data } = await sb
    .from('listings')
    .select('ListingKey, City, ListPrice, StandardStatus')
    .ilike('StandardStatus', '%Closed%')
    .eq('history_finalized', true)
    .order('ListPrice', { ascending: false, nullsFirst: false })
    .limit(Math.min(Math.max(limit, 1), 500))
  const rows = (data ?? []) as { ListingKey?: string; City?: string; ListPrice?: number; StandardStatus?: string }[]
  return rows.map((r) => ({
    listing_key: r.ListingKey ?? '',
    city: r.City ?? null,
    list_price: r.ListPrice ?? null,
    standard_status: r.StandardStatus ?? null,
  }))
}

/** Does listing_history table exist? (Admin diagnostic, no SQL needed.) */
export async function getListingHistoryTableStatus(): Promise<{ exists: boolean; error?: string }> {
  const sb = client()
  if (!sb) return { exists: false, error: 'Supabase not configured' }
  const { error } = await sb.from('listing_history').select('id').limit(1)
  if (error) {
    const msg = error.message ?? String(error)
    return {
      exists: false,
      error: /relation.*does not exist|relation "listing_history"/i.test(msg)
        ? 'Table missing. Run migration: supabase/migrations/20250303120000_listing_history.sql'
        : msg,
    }
  }
  return { exists: true }
}

/** Total listings count (all statuses). Used by admin status breakdown. */
export async function getAllListingsCount(): Promise<CountResult> {
  const sb = client()
  if (!sb) return ZERO
  // 'estimated' (planner reltuples) — an exact count is a full scan of the
  // ~589k-row table that times out, and withRetry collapsed that error into
  // {count: 0}, so the dashboard's "Listings (total)" card showed 0 next to
  // sibling cards proving ~585k. The estimate is instant and within a fraction
  // of a percent on a table this size, which is all a health card needs.
  return withRetry(async () =>
    sb.from('listings').select('ListingKey', { count: 'estimated', head: true })
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
