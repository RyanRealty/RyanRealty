/**
 * Keep public.place_membership current for listings that changed.
 *
 * WHY (audit COMP-3, package P9, 2026-09-23). Every Market Truth cell
 * (market_metric) joins place_membership. The table was built by hand once on
 * 2026-08-23 and nothing refreshed it again, so by 2026-09-22 174 of 752
 * Active Bend single-family tiles had no membership row and the published Bend
 * verdict read 3.30 months "seller's" where the full set read 4.26 "balanced".
 *
 * The durable fix is migration 20260923014500: refresh_place_membership_changed()
 * on pg_cron every 15 minutes. Until that migration is applied this module is
 * the schedule, called hourly from /api/cron/refresh-mvs (the other transitional
 * duty that route holds until its migration lands):
 *
 *   1. It calls refresh_place_membership_changed() first. When the migration is
 *      applied that function exists, holds advisory lock 7109 (a run that
 *      overlaps the pg_cron job returns skipped) and this module does nothing
 *      else.
 *   2. When PostgREST answers PGRST202 (function not in the schema cache) it
 *      applies the same candidate rule with row reads: a listing modified inside
 *      the lookback whose membership rows are older than its
 *      ModificationTimestamp, or that has none. Each candidate run is rebuilt
 *      through the long-standing service-role keyset RPC
 *      refresh_place_membership(p_after, p_limit)
 *      (20260823001500_refresh_place_membership.sql), which deletes and rebuilds
 *      membership for exactly the p_limit keys after p_after in ListingKey
 *      order. The window is read first and must start at the candidate, so a
 *      call only ever rebuilds candidates. Listings with no rows go first (they
 *      are missing from every count); stale rows follow, newest change first,
 *      until the time budget runs out. The next run picks up the rest.
 *
 * A rebuild applies the same rules every time, so rebuilding a key twice is
 * harmless; the only failure that matters is a key never rebuilt, which the
 * scoreboard flags (lib/data/loop/place-membership-freshness.ts).
 */
import type { SupabaseClient } from '@supabase/supabase-js'

/** Default lookback for the row-read path: one week of MLS modifications. */
export const MEMBERSHIP_LOOKBACK_HOURS = 168
/** Longest candidate run handed to one keyset call. */
export const MEMBERSHIP_RUN_MAX = 200
/** PostgREST caps one response at 1,000 rows. */
const PAGE = 1000
/** Keys per place_membership probe (a listing holds 4 to 7 membership rows). */
const PROBE_CHUNK = 150

export type ChangedListing = { key: string; modifiedAt: string }

export type MembershipPlan = {
  /** Listings with no membership row at all, ListingKey ascending. */
  missing: string[]
  /** Listings whose newest membership row predates their modification, newest change first. */
  stale: string[]
}

/** Pure: the refresh_place_membership_changed candidate rule over row reads. */
export function planMembershipRefresh(
  changed: ReadonlyArray<ChangedListing>,
  newestComputedAt: ReadonlyMap<string, string>,
): MembershipPlan {
  const missing: string[] = []
  const staleRows: ChangedListing[] = []
  const seen = new Set<string>()
  for (const row of changed) {
    if (!row.key || seen.has(row.key)) continue
    seen.add(row.key)
    const computed = newestComputedAt.get(row.key)
    if (computed == null) {
      missing.push(row.key)
      continue
    }
    const computedMs = Date.parse(computed)
    const modifiedMs = Date.parse(row.modifiedAt)
    if (Number.isFinite(computedMs) && Number.isFinite(modifiedMs) && computedMs < modifiedMs) {
      staleRows.push(row)
    }
  }
  missing.sort()
  staleRows.sort((a, b) => Date.parse(b.modifiedAt) - Date.parse(a.modifiedAt) || (a.key < b.key ? -1 : 1))
  return { missing, stale: staleRows.map((r) => r.key) }
}

/**
 * Pure: how many leading keys of a ListingKey-ordered window are pending
 * candidates. The keyset RPC rebuilds exactly that many keys after p_after.
 */
export function leadingCandidateRun(
  windowKeys: ReadonlyArray<string>,
  pending: ReadonlySet<string>,
  max = MEMBERSHIP_RUN_MAX,
): number {
  let n = 0
  while (n < windowKeys.length && n < max && pending.has(windowKeys[n])) n++
  return n
}

export type PlaceMembershipRefreshResult = {
  ok: boolean
  mode: 'pg_function' | 'keyset_fallback'
  since: string
  error: string | null
  /** pg_function mode: the function's own jsonb result. */
  result?: unknown
  /** keyset_fallback mode counters. */
  listingsScanned?: number
  missing?: number
  stale?: number
  rebuiltKeys?: number
  rowsInserted?: number
  calls?: number
  remaining?: number
  skippedWindows?: number
  durationMs: number
}

function isMissingFunction(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code === 'PGRST202') return true
  return /could not find the function/i.test(error.message ?? '')
}

async function readChangedListings(
  sb: SupabaseClient,
  sinceIso: string,
  maxListings: number,
): Promise<ChangedListing[]> {
  const out: ChangedListing[] = []
  for (let from = 0; from < maxListings; from += PAGE) {
    const { data, error } = await sb
      .from('listings')
      .select('ListingKey, ModificationTimestamp')
      .gte('ModificationTimestamp', sinceIso)
      .order('ModificationTimestamp', { ascending: false })
      .order('ListingKey', { ascending: true })
      .range(from, Math.min(from + PAGE, maxListings) - 1)
    if (error) throw new Error(`listings (modified since ${sinceIso}): ${error.message}`)
    const rows = (data ?? []) as Array<{ ListingKey: string | null; ModificationTimestamp: string | null }>
    for (const r of rows) {
      if (r.ListingKey && r.ModificationTimestamp) out.push({ key: r.ListingKey, modifiedAt: r.ModificationTimestamp })
    }
    if (rows.length < PAGE) break
  }
  return out
}

async function readNewestComputedAt(sb: SupabaseClient, keys: string[]): Promise<Map<string, string>> {
  const newest = new Map<string, string>()
  for (let i = 0; i < keys.length; i += PROBE_CHUNK) {
    const chunk = keys.slice(i, i + PROBE_CHUNK)
    for (let from = 0; ; from += PAGE) {
      // The keys are listings."ListingKey" values read from the listings table
      // itself in this module, and place_membership stores that key.
      const { data, error } = await sb
        .from('place_membership')
        .select('listing_key, computed_at')
        .in('listing_key', chunk) // @canonical-key
        .order('listing_key', { ascending: true })
        .order('geo_type', { ascending: true })
        .order('geo_slug', { ascending: true })
        .range(from, from + PAGE - 1)
      if (error) throw new Error(`place_membership probe: ${error.message}`)
      const rows = (data ?? []) as Array<{ listing_key: string; computed_at: string }>
      for (const r of rows) {
        const prior = newest.get(r.listing_key)
        if (!prior || Date.parse(r.computed_at) > Date.parse(prior)) newest.set(r.listing_key, r.computed_at)
      }
      if (rows.length < PAGE) break
    }
  }
  return newest
}

/**
 * Rebuild membership for listings that changed. Never loops on a failed call:
 * the first RPC error ends the run with ok:false and the rest waits for the
 * next scheduled run.
 */
export async function refreshChangedPlaceMembership(
  sb: SupabaseClient,
  opts: { lookbackHours?: number; maxListings?: number; budgetMs?: number; now?: Date } = {},
): Promise<PlaceMembershipRefreshResult> {
  const started = Date.now()
  const lookbackHours = opts.lookbackHours ?? MEMBERSHIP_LOOKBACK_HOURS
  const budgetMs = opts.budgetMs ?? 150_000
  const maxListings = opts.maxListings ?? 5000
  const now = opts.now ?? new Date()
  const since = new Date(now.getTime() - lookbackHours * 3_600_000).toISOString()

  const pg = await sb.rpc('refresh_place_membership_changed', {
    p_limit: 2000,
    p_lookback_hours: lookbackHours,
  })
  if (!isMissingFunction(pg.error)) {
    const data = pg.data as { ok?: boolean; error?: string } | null
    return {
      ok: !pg.error && data?.ok !== false,
      mode: 'pg_function',
      since,
      error: pg.error?.message ?? data?.error ?? null,
      result: pg.data,
      durationMs: Date.now() - started,
    }
  }

  const base = { mode: 'keyset_fallback' as const, since }
  let changed: ChangedListing[]
  let newest: Map<string, string>
  try {
    changed = await readChangedListings(sb, since, maxListings)
    newest = await readNewestComputedAt(sb, [...new Set(changed.map((c) => c.key))])
  } catch (err) {
    return { ...base, ok: false, error: err instanceof Error ? err.message : String(err), durationMs: Date.now() - started }
  }

  const plan = planMembershipRefresh(changed, newest)
  const queue = [...plan.missing, ...plan.stale]
  const pending = new Set(queue)
  let calls = 0
  let rebuiltKeys = 0
  let rowsInserted = 0
  let skippedWindows = 0
  let error: string | null = null

  for (const key of queue) {
    if (!pending.has(key)) continue
    if (Date.now() - started > budgetMs) break

    const prev = await sb
      .from('listings')
      .select('ListingKey')
      .lt('ListingKey', key)
      .order('ListingKey', { ascending: false })
      .limit(1)
    if (prev.error) {
      error = `listings predecessor of ${key}: ${prev.error.message}`
      break
    }
    const after = ((prev.data ?? [])[0] as { ListingKey?: string } | undefined)?.ListingKey ?? ''

    const win = await sb
      .from('listings')
      .select('ListingKey')
      .gt('ListingKey', after)
      .order('ListingKey', { ascending: true })
      .limit(MEMBERSHIP_RUN_MAX)
    if (win.error) {
      error = `listings window after ${after}: ${win.error.message}`
      break
    }
    const windowKeys = ((win.data ?? []) as Array<{ ListingKey: string }>).map((r) => r.ListingKey)
    const run = windowKeys[0] === key ? leadingCandidateRun(windowKeys, pending) : 0
    if (run === 0) {
      // The listing left the table, or a key landed between the two reads.
      pending.delete(key)
      skippedWindows++
      continue
    }

    const res = await sb.rpc('refresh_place_membership', { p_after: after, p_limit: run })
    calls++
    const data = res.data as { ok?: boolean; upserted?: number; last_key?: string } | null
    if (res.error || data?.ok === false) {
      error = `refresh_place_membership(after ${after}, ${run}): ${res.error?.message ?? 'ok:false'}`
      break
    }
    const runKeys = windowKeys.slice(0, run)
    for (const k of runKeys) pending.delete(k)
    if (data?.last_key !== runKeys[run - 1]) {
      // A listing inserted between the window read and the call shifted the
      // window by one: every key it rebuilt was rebuilt correctly, and the one
      // it did not reach stays a candidate for the next run.
      skippedWindows++
    } else {
      rebuiltKeys += run
    }
    rowsInserted += Number(data?.upserted ?? 0)
  }

  return {
    ...base,
    ok: error == null,
    error,
    listingsScanned: changed.length,
    missing: plan.missing.length,
    stale: plan.stale.length,
    rebuiltKeys,
    rowsInserted,
    calls,
    remaining: pending.size,
    skippedWindows,
    durationMs: Date.now() - started,
  }
}
