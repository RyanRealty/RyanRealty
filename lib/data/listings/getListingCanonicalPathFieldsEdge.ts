/**
 * Edge twin of getListingCanonicalPathFields, for the listing-canonical hop in
 * middleware.ts (P14, visibility audit 2026-09-22, gsc-trend-6).
 *
 * WHY A SECOND READER EXISTS
 * --------------------------
 * The hop has to answer before the page renders: app/loading.tsx wraps every
 * route, so a redirect thrown from the listing page body ships HTTP 200 (see
 * app/listing/by-address/[...slug]/page.tsx and ci:streamed-redirect).
 * middleware.ts runs on the Edge runtime, where `unstable_cache` does not exist
 * and supabase-js would ship its realtime/auth clients inside the middleware
 * bundle for one indexed read. So this is one PostgREST GET with the anon key
 * — the same role, the same RLS (Coming Soon rows are invisible to it), the
 * same columns and the same display-permission refusal as the Node reader,
 * because both take them from ./listingCanonicalPathCore.
 *
 * COST, measured 2026-09-23 from the sandbox (5 runs each, anon key):
 *   or=(ListNumber.eq.220226356,ListingKey.eq.220226356)   99-127 ms warm
 *   a miss (999999999)                                     101-122 ms
 * Both columns are indexed (the miss is as fast as the hit). A per-isolate
 * memory cache holds hits for 5 minutes and misses for 1 minute, and
 * concurrent requests for one id share one fetch.
 *
 * FAILURE IS A PASS-THROUGH. Every error, timeout, missing env or refused row
 * returns a non-row result and the hop does nothing, so the request renders
 * exactly as it did before P14. The hop can cost latency; it can never 404 or
 * 5xx a listing.
 */

import {
  LISTING_CANONICAL_PATH_COLUMNS,
  mapListingCanonicalPathRow,
  mayDisplayListingPublicly,
  type ListingCanonicalPathFields,
} from './listingCanonicalPathCore'

export type EdgeCanonicalLookup =
  | { kind: 'row'; row: ListingCanonicalPathFields }
  | { kind: 'miss' }
  | { kind: 'error'; reason: string }

/**
 * ListNumber (9 digits) or RETS ListingKey (26 digits). Anything else is not a
 * key this table holds, and refusing it here keeps the PostgREST `or=` filter
 * free of anything but digits.
 */
const KEY_RE = /^[0-9]{5,40}$/

const HIT_TTL_MS = 5 * 60_000
const MISS_TTL_MS = 60_000
const MAX_ENTRIES = 2_000
const DEFAULT_TIMEOUT_MS = 1_500

type Entry = { expires: number; value: EdgeCanonicalLookup }
const memo = new Map<string, Entry>()
const inflight = new Map<string, Promise<EdgeCanonicalLookup>>()

/** Test seam: drop every memoised answer. */
export function resetListingCanonicalEdgeCache(): void {
  memo.clear()
  inflight.clear()
}

function remember(id: string, value: EdgeCanonicalLookup, now: number): void {
  // Errors are not memoised: a transient failure must not pin a pass-through.
  if (value.kind === 'error') return
  if (memo.size >= MAX_ENTRIES) {
    const oldest = memo.keys().next().value
    if (oldest !== undefined) memo.delete(oldest)
  }
  memo.set(id, { expires: now + (value.kind === 'row' ? HIT_TTL_MS : MISS_TTL_MS), value })
}

export type EdgeLookupOptions = {
  fetchImpl?: typeof fetch
  timeoutMs?: number
  now?: () => number
  supabaseUrl?: string | undefined
  anonKey?: string | undefined
}

async function fetchRow(id: string, opts: EdgeLookupOptions): Promise<EdgeCanonicalLookup> {
  const url = (opts.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim().replace(/\/$/, '')
  const key = (opts.anonKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim()
  if (!url || !key) return { kind: 'error', reason: 'supabase env missing' }
  const fetchImpl = opts.fetchImpl ?? fetch
  const params = new URLSearchParams({
    select: LISTING_CANONICAL_PATH_COLUMNS.join(','),
    // Dual-column resolve, the same order resolveCanonicalListingKey uses:
    // a pretty URL carries the ListNumber, a /listing/<key> URL the ListingKey.
    or: `(ListNumber.eq.${id},ListingKey.eq.${id})`,
    limit: '2',
  })
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  try {
    const res = await fetchImpl(`${url}/rest/v1/listings?${params.toString()}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
      signal: ctrl.signal,
    })
    if (!res.ok) return { kind: 'error', reason: `HTTP ${res.status}` }
    const data = (await res.json()) as unknown
    if (!Array.isArray(data)) return { kind: 'error', reason: 'non-array body' }
    const rows = data.filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
    const byNumber = rows.filter((r) => String(r.ListNumber ?? '').trim() === id)
    // Two rows under one ListNumber: resolveCanonicalListingKey's maybeSingle()
    // resolves neither, so the page renders its refusal. The hop must not pick
    // one of them and send the visitor somewhere the page would not go.
    if (byNumber.length > 1) return { kind: 'miss' }
    const row = byNumber[0] ?? rows.find((r) => String(r.ListingKey ?? '').trim() === id)
    if (!row) return { kind: 'miss' }
    if (!mayDisplayListingPublicly(row)) return { kind: 'miss' }
    const mapped = mapListingCanonicalPathRow(row)
    return mapped ? { kind: 'row', row: mapped } : { kind: 'miss' }
  } catch (err) {
    return { kind: 'error', reason: err instanceof Error ? err.message : String(err) }
  } finally {
    clearTimeout(timer)
  }
}

/** Resolve a ListNumber or ListingKey to its canonical-path fields, Edge-safe. */
export async function getListingCanonicalPathFieldsEdge(
  rawId: string,
  opts: EdgeLookupOptions = {},
): Promise<EdgeCanonicalLookup> {
  const id = String(rawId ?? '').trim()
  if (!KEY_RE.test(id)) return { kind: 'miss' }
  const now = (opts.now ?? Date.now)()
  const hit = memo.get(id)
  if (hit && hit.expires > now) return hit.value
  if (hit) memo.delete(id)
  const pending = inflight.get(id)
  if (pending) return pending
  const p = fetchRow(id, opts)
    .then((value) => {
      remember(id, value, (opts.now ?? Date.now)())
      return value
    })
    .finally(() => inflight.delete(id))
  inflight.set(id, p)
  return p
}
