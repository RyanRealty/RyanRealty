/**
 * Typed listing-alert event detection — PURE (no I/O, no imports beyond types)
 * so the alert engine's core diff is unit-testable and shared by the cron and
 * the preview-queue release path.
 *
 * Phase 3 of docs/plans/SEARCH_OPTIMIZATION_PLAN_2026-07-29.md: an alert no
 * longer fires only on "new result-set keys" — it classifies per-listing
 * typed events (new · price_change · status_change · back_on_market · sold ·
 * open_house) by diffing the alert row's per-key notified state against the
 * current match set plus a lightweight status lookup for previously-notified
 * keys (lib/data/listings/getListingEventStates.ts).
 *
 * Notified-state schema (listing_alerts.notified_listing_keys jsonb):
 *   - legacy entry: a plain listing-key string (rows written before the
 *     typed-event upgrade). Parsed with price/status unknown and notified_at
 *     falling back to the row's last_notified_at.
 *   - typed entry: { key, price, status, notified_at, open_house } — the state
 *     of the listing AS LAST NOTIFIED, so deltas are per-subscriber, not
 *     global.
 * Both shapes coexist in one array; the serializer always writes typed
 * entries, so legacy rows migrate forward on their next engine pass.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type ListingEventType =
  | 'new'
  | 'price_change'
  | 'status_change'
  | 'back_on_market'
  | 'sold'
  | 'open_house'

export type AlertEventToggles = Record<ListingEventType, boolean>

/**
 * Flexmls-inherited defaults (plan §1.5 "Default Subscription Settings"):
 * New ✓ · Price Change ✓ · Status Change ✓ · Back On Market ✗ · Sold ✗ ·
 * Open House ✗. Must match the listing_alerts.events column DEFAULT in
 * migration 20260729235500_listing_alerts_typed_events.sql.
 */
export const DEFAULT_EVENT_TOGGLES: AlertEventToggles = {
  new: true,
  price_change: true,
  status_change: true,
  back_on_market: false,
  sold: false,
  open_house: false,
}

export const EVENT_TYPES: readonly ListingEventType[] = [
  'new',
  'price_change',
  'status_change',
  'back_on_market',
  'sold',
  'open_house',
]

/**
 * Coerce a stored events jsonb (possibly null/partial/garbage — rows created
 * before the migration read as undefined) to a complete toggle map. Missing or
 * non-boolean keys fall back to the defaults.
 */
export function normalizeEventToggles(raw: unknown): AlertEventToggles {
  const out: AlertEventToggles = { ...DEFAULT_EVENT_TOGGLES }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>
    for (const type of EVENT_TYPES) {
      if (typeof obj[type] === 'boolean') out[type] = obj[type] as boolean
    }
  }
  return out
}

/** Per-key notified state, as last emailed (or absorbed) for one alert row. */
export type NotifiedEntry = {
  key: string
  /** List price at last notify. Null = unknown (legacy plain-key entry). */
  price: number | null
  /** StandardStatus at last notify. Null = unknown. */
  status: string | null
  /** ISO timestamp of the notify that wrote this entry. Null = unknown. */
  notified_at: string | null
  /** Whether the listing had an upcoming open house at last notify.
   *  Undefined = unknown (legacy entry) — unknown SUPPRESSES open_house so a
   *  legacy row can never blast an open-house event for every stored key. */
  open_house?: boolean
}

/**
 * Event-source row: the columns the detector needs, resolved by the engine
 * from the listings lookup (lib/data/listings/getListingEventStates.ts) with
 * a tile-row fallback. All timestamps ISO strings.
 */
export type ListingEventSource = {
  /** Canonical alert key (ListNumber preferred, ListingKey fallback). */
  listingKey: string
  standardStatus: string | null
  listPrice: number | null
  closeDate: string | null
  lastPriceChangeDate: string | null
  lastPriceChangeAmount: number | null
  lastPriceChangePct: number | null
  pendingTimestamp: string | null
  backOnMarketTimestamp: string | null
  statusChangeTimestamp: string | null
  hasOpenHouse: boolean
}

export type ListingEvent = {
  type: ListingEventType
  listingKey: string
  /** price_change: price at last notify (null when legacy state had none). */
  oldPrice?: number | null
  /** price_change: current list price. */
  newPrice?: number | null
  /** price_change: signed delta (newPrice - oldPrice), when computable. */
  changeAmount?: number | null
  /** price_change: signed percent delta, when computable. */
  changePct?: number | null
  /** price_change direction. */
  direction?: 'up' | 'down'
  /** status_change / sold: the status that fired the event. */
  newStatus?: string | null
}

export type DetectionResult = {
  /** Every detected event, before toggle filtering. At most one event per
   *  (listing, type); a listing may carry several types (price + open house). */
  events: ListingEvent[]
  /** The full next notified state to persist (typed entries, uncapped — the
   *  DAL caps at 1,000 newest-last). */
  nextState: NotifiedEntry[]
  /** True when the previous state held at least one legacy plain-key entry. */
  hadLegacyState: boolean
}

// ── Parsing ───────────────────────────────────────────────────────────────────

function toFiniteOrNull(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}

function toStringOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

/**
 * Parse a stored notified_listing_keys value (jsonb array of strings and/or
 * typed objects) into a key→entry map. Legacy plain-key strings become entries
 * with unknown price/status and notified_at = fallbackNotifiedAt (the row's
 * last_notified_at) so "since last notify" comparisons still work.
 */
export function parseNotifiedState(
  raw: unknown,
  fallbackNotifiedAt: string | null,
): { entries: Map<string, NotifiedEntry>; hadLegacyState: boolean } {
  const entries = new Map<string, NotifiedEntry>()
  let hadLegacyState = false
  if (!Array.isArray(raw)) return { entries, hadLegacyState }
  for (const item of raw) {
    if (typeof item === 'string') {
      const key = item.trim()
      if (!key) continue
      hadLegacyState = true
      if (!entries.has(key)) {
        entries.set(key, { key, price: null, status: null, notified_at: fallbackNotifiedAt })
      }
      continue
    }
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const obj = item as Record<string, unknown>
      const key = toStringOrNull(obj.key)
      if (!key) continue
      entries.set(key, {
        key,
        price: toFiniteOrNull(obj.price),
        status: toStringOrNull(obj.status),
        notified_at: toStringOrNull(obj.notified_at) ?? fallbackNotifiedAt,
        ...(typeof obj.open_house === 'boolean' ? { open_house: obj.open_house } : {}),
      })
    }
  }
  return { entries, hadLegacyState }
}

// ── Detection ─────────────────────────────────────────────────────────────────

function parseMs(iso: string | null | undefined): number | null {
  if (!iso) return null
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? ms : null
}

/** True when `stampIso` is strictly after `sinceIso` (unparseable stamp = no). */
function isAfter(stampIso: string | null, sinceIso: string | null): boolean {
  const stamp = parseMs(stampIso)
  if (stamp == null) return false
  const since = parseMs(sinceIso)
  // No usable "since" on a previously-notified key: treat the stamp as old —
  // firing on an unknown baseline would re-blast history.
  if (since == null) return false
  return stamp > since
}

const SOLD_STATUSES = new Set(['closed', 'sold'])
const PENDING_STATUSES = new Set(['pending', 'active under contract', 'activeundercontract', 'contingent'])

/**
 * Detect typed events for ONE alert row.
 *
 * - `currentMatches`: event-source rows for the listings currently matching
 *   the saved search (the engine's match window).
 * - `departedLookup`: event-source rows for previously-notified keys ABSENT
 *   from the current window, resolved by the status lookup. Absence alone
 *   never fires an event (the window is truncated); only a looked-up row with
 *   a sold/pending signal does.
 *
 * Rules (once each, per listing):
 * - new: key never notified. A new listing fires ONLY `new` (its price/status
 *   history predates the subscriber seeing it).
 * - price_change: last_price_change_date after the key's last notify, or the
 *   current price differing from the notified price. Direction/amount from the
 *   notified price when known, else the listings history columns.
 * - status_change: pending_timestamp after last notify (Pending / under
 *   contract), or a departed key whose looked-up status is pending-family.
 * - back_on_market: back_on_market_timestamp after last notify.
 * - sold: a previously-notified key whose looked-up status is Closed with
 *   close_date after last notify (the search MV serves on-market only, so
 *   sold detection rides the departed lookup).
 * - open_house: has_open_house newly true (prior entry explicitly false).
 *
 * State: current matches get fresh typed entries stamped `nowIso`; departed
 * keys that sold (or vanished from the lookup) drop out of the state; other
 * departed keys are carried forward unchanged so a listing sorted out of the
 * match window is not re-announced as "new" when it sorts back in.
 */
export function detectListingEvents(args: {
  prevRaw: unknown
  lastNotifiedAt: string | null
  currentMatches: ListingEventSource[]
  departedLookup: ListingEventSource[]
  now: Date
}): DetectionResult {
  const { entries: prev, hadLegacyState } = parseNotifiedState(args.prevRaw, args.lastNotifiedAt)
  const nowIso = args.now.toISOString()
  const events: ListingEvent[] = []
  const nextState: NotifiedEntry[] = []
  const currentKeys = new Set<string>()

  for (const row of args.currentMatches) {
    const key = row.listingKey.trim()
    if (!key || currentKeys.has(key)) continue
    currentKeys.add(key)
    const entry = prev.get(key)

    if (!entry) {
      events.push({ type: 'new', listingKey: key })
    } else {
      const since = entry.notified_at

      // price_change fires ONLY from the per-subscriber notified price: the
      // price WE recorded when we last emailed them, compared to the price the
      // MV serves now. Both sides are sourced and current, so every figure in
      // the email is defensible (§0).
      //
      // The listings.last_price_change_* fallback was REMOVED 2026-07-30: the
      // MLS feed stopped populating those columns on 2026-04-07 (see
      // lib/data/listings/getPriceDrops.ts), so the stamp can no longer fire
      // honestly, and when it did it reported amount/pct from equally stale
      // columns — an adversarial test caught a real price DROP being announced
      // as direction 'up' against a stale old price. An unsourced number does
      // not go in a client email; a legacy entry with no stored price simply
      // waits one cycle and then has one.
      const priceDelta =
        entry.price != null && row.listPrice != null && row.listPrice !== entry.price
          ? row.listPrice - entry.price
          : null
      if (priceDelta != null) {
        const pct = entry.price ? Math.round((priceDelta / entry.price) * 1000) / 10 : null
        events.push({
          type: 'price_change',
          listingKey: key,
          oldPrice: entry.price,
          newPrice: row.listPrice,
          changeAmount: priceDelta,
          changePct: pct,
          direction: priceDelta < 0 ? 'down' : 'up',
        })
      }

      // status_change (pending-family) — the listing can still be in the
      // match window under the wide on-market predicate.
      if (isAfter(row.pendingTimestamp, since)) {
        events.push({ type: 'status_change', listingKey: key, newStatus: row.standardStatus ?? 'Pending' })
      }

      // back_on_market
      if (isAfter(row.backOnMarketTimestamp, since)) {
        events.push({ type: 'back_on_market', listingKey: key })
      }

      // open_house: newly true only. Unknown prior state (legacy entry)
      // suppresses — never blast an OH event for every stored key.
      if (row.hasOpenHouse && entry.open_house === false) {
        events.push({ type: 'open_house', listingKey: key })
      }
    }

    nextState.push({
      key,
      price: row.listPrice,
      status: row.standardStatus,
      notified_at: nowIso,
      open_house: row.hasOpenHouse,
    })
  }

  // Departed keys: previously notified, absent from the current window.
  const departedByKey = new Map<string, ListingEventSource>()
  for (const row of args.departedLookup) {
    const key = row.listingKey.trim()
    if (key) departedByKey.set(key, row)
  }

  for (const [key, entry] of prev) {
    if (currentKeys.has(key)) continue
    const looked = departedByKey.get(key)
    if (!looked) {
      // No longer resolvable (purged / key drift): drop from state silently.
      continue
    }
    const status = (looked.standardStatus ?? '').trim().toLowerCase()
    const since = entry.notified_at

    if (SOLD_STATUSES.has(status) && isAfter(looked.closeDate, since)) {
      // Sold: fire once, then drop from state (the listing is off-market; a
      // future re-list arrives under a fresh key or as back_on_market).
      events.push({ type: 'sold', listingKey: key, newStatus: looked.standardStatus })
      continue
    }
    if (PENDING_STATUSES.has(status) && isAfter(looked.pendingTimestamp, since)) {
      events.push({ type: 'status_change', listingKey: key, newStatus: looked.standardStatus })
      // Stamp the entry so the pending event cannot re-fire next run.
      nextState.push({
        key,
        price: looked.listPrice ?? entry.price,
        status: looked.standardStatus,
        notified_at: nowIso,
        ...(typeof entry.open_house === 'boolean' ? { open_house: entry.open_house } : {}),
      })
      continue
    }
    if (SOLD_STATUSES.has(status)) {
      // Sold before this alert's window (or unparseable close date): no event,
      // and the key leaves the state.
      continue
    }
    // Still on-market (just outside the truncated window), or in some other
    // resolvable status: carry the entry forward unchanged.
    nextState.push(entry)
  }

  return { events, nextState, hadLegacyState }
}

/** Filter detected events by the alert's toggle map, preserving order. */
export function filterEventsByToggles(
  events: ListingEvent[],
  toggles: AlertEventToggles,
  /**
   * VOW eligibility of the alert's recipient. Sold data is VOW-only under the
   * ODS rules (§5-4 A.4 / reference_ods_rules): it may go to a registered user
   * who accepted terms, never to a guest email capture. A guest row is any
   * alert with no user_id. Defaults to false so a caller that forgets to pass
   * it can only ever be MORE restrictive, never less.
   */
  opts?: { vowEligible?: boolean },
): ListingEvent[] {
  const vowEligible = opts?.vowEligible === true
  return events.filter((e) => {
    if (!toggles[e.type]) return false
    // Enforced here, not only at the toggle UI: a `sold: true` already stored on
    // a guest row (or set by an admin) must still be unable to fire.
    if (e.type === 'sold' && !vowEligible) return false
    return true
  })
}
