/**
 * Public display labels for `public.activity_events.event_type` — THE single
 * source of truth. Every public surface that renders an MLS activity event
 * resolves its tag through this module.
 *
 * WHY THIS EXISTS
 * ---------------
 * `event_type` is a free-text column (schema snapshot: `activity_events.event_type
 * text not null`), and the sole writer — `lib/sync/deltaSync.ts` — builds one of
 * its values by interpolation:
 *
 *     event_type: `status_${slug}`   // slug = StandardStatus, lowercased
 *
 * so the set of values is open-ended by construction. Four separate consumers
 * each kept their own partial map with a fallback that printed the raw column
 * value, and `/activity` shipped rows reading "status_canceled · Bend ·
 * Stonegate" to the public site. Live counts at 2026-08-18 05:20Z:
 *
 *     price_drop 10,660 · new_listing 10,172 · status_pending 6,028 ·
 *     status_closed 4,996 · status_expired 1,199 · status_canceled 1,067 ·
 *     status_withdrawn 546 · price_increase 369 · status_active 230 ·
 *     back_on_market 2
 *
 * Four of those ten (status_canceled, status_withdrawn, price_increase,
 * status_active — 2,212 rows) had no label anywhere and leaked verbatim.
 *
 * WHY UNKNOWN `status_*` IS "Off market"
 * --------------------------------------
 * Provable from the writer, not guessed. `deltaSync.ts` emits exactly three
 * fixed `status_*` values on non-terminal transitions — `status_pending`,
 * `status_closed`, `status_active`. Its ONLY other `status_*` emission is the
 * `nowTerminal && !wasTerminal && !isClosed` branch, i.e. expired / canceled /
 * withdrawn / any future terminal RESO status. So any `status_*` outside the
 * three named above is, by construction, a listing that left the market.
 *
 * Expired / canceled / withdrawn all collapse to one public label on purpose.
 * `lib/listing-status-public.ts` already names those three words "broker
 * prospecting vocabulary — never a public browse mode"; "Off market" is the
 * public register, and it was already the shipped label for `status_expired`.
 *
 * Anything that is neither a known type nor a `status_*` transition falls to
 * "Listing update" — true of every row in the table, and it can never print an
 * internal identifier at a visitor.
 *
 * Enforced by `scripts/check-activity-event-labels.mjs` (`ci:activity-event-labels`).
 */

/** The kind tag (drives weight/intent styling) plus the public label. */
export type ActivityEventDisplay = {
  /** Styling intent only. Never rendered as text. */
  kind: 'new' | 'price_drop' | 'price_increase' | 'pending' | 'sold' | 'expired' | 'update'
  /** The words a visitor reads. */
  label: string
}

/**
 * Every `event_type` literal `lib/sync/deltaSync.ts` writes, plus the legacy
 * `back_on_market` rows already in the table. The gate re-derives this list
 * from the writer and fails if the writer grows a literal this map lacks.
 */
export const ACTIVITY_EVENT_DISPLAY: Readonly<Record<string, ActivityEventDisplay>> = Object.freeze({
  new_listing: { kind: 'new', label: 'New' },
  price_drop: { kind: 'price_drop', label: 'Price cut' },
  price_increase: { kind: 'price_increase', label: 'Price increase' },
  status_pending: { kind: 'pending', label: 'Pending' },
  status_closed: { kind: 'sold', label: 'Sold' },
  // isActive && !wasActive — the listing was pending/closed/terminal and is
  // now for sale again. Same fact as the legacy back_on_market rows.
  status_active: { kind: 'new', label: 'Back on market' },
  back_on_market: { kind: 'new', label: 'Back on market' },
})

/** Any `status_*` that is not pending/closed/active is a terminal transition. */
const OFF_MARKET: ActivityEventDisplay = Object.freeze({ kind: 'expired', label: 'Off market' })

/** Terminal fallback. True of every row; leaks nothing. */
const LISTING_UPDATE: ActivityEventDisplay = Object.freeze({ kind: 'update', label: 'Listing update' })

/**
 * Resolve an `activity_events.event_type` to its public kind + label.
 * Total: never returns the raw column value, for any input.
 */
export function activityEventDisplay(eventType: string | null | undefined): ActivityEventDisplay {
  const key = String(eventType ?? '').trim().toLowerCase()
  if (!key) return LISTING_UPDATE
  const known = ACTIVITY_EVENT_DISPLAY[key]
  if (known) return known
  if (key.startsWith('status_')) return OFF_MARKET
  return LISTING_UPDATE
}

/** The public label alone. */
export function activityEventLabel(eventType: string | null | undefined): string {
  return activityEventDisplay(eventType).label
}
