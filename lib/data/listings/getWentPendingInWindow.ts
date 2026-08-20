/**
 * getWentPendingInWindow — the homes that went pending inside a date window.
 *
 * ─── WHY THIS EXISTS ────────────────────────────────────────────────────────
 * The weekly market report promises "pending and closed sales by city" in its
 * title, its metadata, and its page copy, and every published report has shown
 * zero pendings since the surface shipped. Verified live 2026-08-19 across all
 * 20 rows of `market_reports`: not one carries a "Went pending" panel.
 *
 * The cause is a dead source, not a rendering bug. The report's pending path
 * read `listing_history` filtered `event ILIKE '%Pending%'`, and
 * `listing_history.event` has no such value. Verified live 2026-08-19 over
 * 3,900,010 rows — the vocabulary is FieldChange, Photo, OpenHouse,
 * NewListing, Document, TextChange, BackOnMarket, Video, VirtualTour,
 * CopyListing. Zero rows match `%Pending%` in any window, so the filter could
 * only ever return [], and the sales cards could only ever count zero pendings
 * while the copy promised them.
 *
 * ─── THE SOURCE, AND THE ONE THAT LOOKED RIGHT AND IS NOT ───────────────────
 * `activity_events`, `event_type = 'status_pending'` — the same table and the
 * same tile-MV hydration `getPriceDrops` uses. Verified live 2026-08-19 (anon
 * role, the role the public page reads with): 2026-03-08..14 → 153 events in
 * 312ms, 2026-05-24..30 → 237 in 154ms, 2026-08-09..15 → 275 in 124ms.
 * Earliest `status_pending` row is 2026-03-12, so windows before that have no
 * pending data and the report says nothing rather than guessing.
 *
 * `listings.pending_timestamp` carries the MLS PendingTimestamp and looks like
 * the better source — it does not survive contact with the anon role. There is
 * no index on that column, and every shape times out for anon (verified live
 * 2026-08-19: bare window 7.6s, window + city allowlist 7.1s, window +
 * `City = 'Bend'` 12.1s — all `canceling statement due to statement timeout`;
 * the service role, on a longer timeout, returns fine, which is exactly how a
 * dead public read hides during development). Building on it would have
 * shipped a second silently-empty pending panel. If it is ever indexed, it is
 * the more precise timestamp; until then this file uses the event log.
 *
 * ─── WHAT THE NUMBER MEANS ──────────────────────────────────────────────────
 * One row per HOME, not per event: a listing that goes pending, falls through,
 * and goes pending again inside one window is counted once, at its most recent
 * event. `event_at` is when the delta sync observed the status change, so a
 * listing that flips near midnight on a window boundary can land on either
 * side of it — a weekly count, not a legal timestamp.
 *
 * ─── SCOPE ──────────────────────────────────────────────────────────────────
 * `activity_events` is fed feed-wide and the MLS feed is statewide. Hydration
 * therefore passes `scope: 'service-area'` — the documented way to force the
 * Central Oregon allowlist on a DAL call that already carries listing keys —
 * plus a JS re-check. With an explicit `city` the caller has named its own
 * geography, the same contract the closed side of the report uses.
 */

import { supabaseAnon } from '@/lib/data/client'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { fetchPagedRows } from '@/lib/supabase/paginate'
import { getListingTiles } from '@/lib/data/listings/getListingTiles'
import { isServiceAreaCity } from '@/lib/data/listings/service-area'

/** Ceiling on events read for one window. A year of feed-wide pendings is
 *  well under this; the cap exists so a bad date range cannot page forever. */
const MAX_EVENTS = 20_000
/** Keys per hydration call — PostgREST caps any single response at 1,000. */
const HYDRATE_CHUNK = 500

export type WentPendingListing = {
  listingKey: string
  listNumber: string | null
  city: string | null
  /** ISO timestamp of the observed status change to pending. */
  pendingAt: string
  /** List price — the only price a pending home has. */
  listPrice: number | null
  /** "62739 Eagle", or null when the feed carries no street parts. */
  streetLine: string | null
  propertyType: string | null
}

export type WentPendingInWindowOptions = {
  fromIso: string
  toIso: string
  /** Exact `listings."City"` value. Omit for the Central Oregon service area. */
  city?: string | null
  /** Exact `listings."SubdivisionName"` value, only meaningful with `city`. */
  subdivision?: string | null
}

type PendingEventRow = { listing_key: string | null; event_at: string | null }

async function _getWentPendingInWindowUncached(
  options: WentPendingInWindowOptions,
): Promise<WentPendingListing[]> {
  const sb = supabaseAnon()
  if (!sb) return []

  const city = options.city?.trim() || null
  const subdivision = options.subdivision?.trim() || null

  const { rows: events, error } = await fetchPagedRows<PendingEventRow>(
    (from, to) =>
      sb
        .from('activity_events')
        .select('listing_key, event_at')
        .eq('event_type', 'status_pending')
        .gte('event_at', options.fromIso)
        .lte('event_at', options.toIso)
        // Stable total order — a paged read without one repeats and skips rows.
        .order('event_at', { ascending: false })
        .order('listing_key', { ascending: true })
        .range(from, to),
    MAX_EVENTS,
  )
  // Throw rather than return []: an empty pending panel is indistinguishable
  // from a quiet week, which is how the dead source hid for months.
  if (error) throw new Error(`[getWentPendingInWindow] ${error.message}`)

  // One row per home, at its most recent event in the window.
  const newestByKey = new Map<string, string>()
  for (const row of events) {
    const key = (row.listing_key ?? '').trim()
    const at = (row.event_at ?? '').trim()
    if (!key || !at) continue
    const seen = newestByKey.get(key)
    if (seen == null || at > seen) newestByKey.set(key, at)
  }
  const keys = [...newestByKey.keys()]
  if (keys.length === 0) return []

  const tiles = []
  for (let i = 0; i < keys.length; i += HYDRATE_CHUNK) {
    const chunk = keys.slice(i, i + HYDRATE_CHUNK)
    tiles.push(
      ...(await getListingTiles({
        listingKeys: chunk,
        status: 'all',
        // Force the Central Oregon allowlist: listing keys count as an
        // explicit geography, so the default guard would not apply here.
        ...(city ? { city, ...(subdivision ? { subdivision } : {}) } : { scope: 'service-area' }),
        limit: 1000,
        offset: 0,
      })),
    )
  }

  const out: WentPendingListing[] = []
  for (const tile of tiles) {
    const pendingAt = newestByKey.get(tile.listingKey)
    if (!pendingAt) continue
    // Second pass in JS for the unscoped call — one geography, checked twice.
    if (!city && !isServiceAreaCity(tile.city)) continue
    const streetLine =
      [tile.streetNumber, tile.streetName]
        .map((part) => (part ?? '').toString().trim())
        .filter(Boolean)
        .join(' ') || null
    out.push({
      listingKey: tile.listingKey,
      listNumber: tile.listNumber ?? null,
      city: (tile.city ?? '').trim() || null,
      pendingAt,
      listPrice:
        typeof tile.listPrice === 'number' && Number.isFinite(tile.listPrice) ? tile.listPrice : null,
      streetLine,
      propertyType: (tile.propertyType ?? '').trim() || null,
    })
  }
  out.sort((a, b) => b.pendingAt.localeCompare(a.pendingAt))
  return out
}

/**
 * Homes that went pending between `fromIso` and `toIso` (inclusive), newest
 * first. Never throws — a persistent read error degrades to an empty list
 * rather than caching poison.
 */
export const getWentPendingInWindow = makeResilientCached(
  _getWentPendingInWindowUncached,
  ['went-pending-in-window-v1'],
  { revalidate: CACHE_WINDOWS.marketReport, tags: [cacheTag.listings] },
  [],
)
