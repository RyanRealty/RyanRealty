/**
 * Run policy for the listing-alert engine (Matt 2026-10-14: place-page alerts
 * cover every property type and run daily). Pure: no imports, no I/O, so the
 * cron and the tests share one definition.
 *
 * THE MATCH WINDOW. Each run reads the newest N matches for an alert and diffs
 * them against what the subscriber was already sent. N used to be 15 for every
 * cadence. Bend alone had up to 30 new listings in a day across all property
 * types (listings, City 'Bend', OnMarketDate 2026-08-15..2026-10-14: 688 rows
 * over 60 days, max 30 a day, median 10), so a daily all-types alert read 15
 * and silently dropped the rest on a busy day. The window now scales with the
 * gap between sends. getCachedSearchListings caps a page at 100.
 *
 * THE FIRST EMAIL. A never-sent alert has nothing to diff against, so every
 * listing in the window would fire as "new" (60 cards for a city). The first
 * email carries the newest FIRST_SEND_BATCH, one email's worth of cards, and
 * the rest of the window is recorded as seen without an email. Its copy says
 * "newest", not "new" (lib/crm/listing-alert-email.ts, `firstSend`).
 *
 * THE FRESHNESS GUARD. After the first email, a listing the subscriber was
 * never sent fires "new" only when it came on the market within
 * NEW_LISTING_LOOKBACK_MS of the last send. Without it, widening a row's
 * window (15 to 60 on the day this shipped) would announce up to 45 old
 * listings as new. Seven days, not zero: the MLS feed can land a listing a day
 * or more after its on-market date, and OnMarketDate is a calendar date, so a
 * tight cut would drop real new listings. A listing with no on-market stamp
 * fires, so a missing column can only ever over-tell, never hide a listing.
 */

export type AlertCadenceName = 'instant' | 'daily' | 'weekly' | 'monthly'

/** Newest matches read per run, by cadence. */
export const ALERT_MATCH_WINDOW: Record<AlertCadenceName, number> = {
  instant: 30,
  daily: 60,
  weekly: 100,
  monthly: 100,
}

/** Window for a stored frequency; unknown values take the daily window, like the cadence fallback. */
export function alertMatchWindow(frequency: string | null | undefined): number {
  const key = (frequency ?? '').trim().toLowerCase() as AlertCadenceName
  return ALERT_MATCH_WINDOW[key] ?? ALERT_MATCH_WINDOW.daily
}

/** Cards in the first email. Equal to MAX_LISTINGS_PER_EMAIL in lib/alerts/send.ts. */
export const FIRST_SEND_BATCH = 12

/** How far before the last send a never-sent listing may have come on the market and still fire "new". */
export const NEW_LISTING_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Per-send stamp for the email key (`listing-alert:<rowId>:<stamp>`). It was the
 * UTC date, so every send to one alert inside a UTC day shared a key, and the
 * open pixel's dedupe (`track:open:<pid>:<emailKey>`) dropped the second
 * email's open. Minute precision gives each send its own key. No colons, so
 * `email_key.split(':')[1]` stays the row id for every reader.
 */
export function alertSendStamp(now: Date): string {
  const iso = now.toISOString()
  return `${iso.slice(0, 10)}T${iso.slice(11, 13)}${iso.slice(14, 16)}Z`
}

type EventLike = { type: string; listingKey: string }

/**
 * Apply the first-email batch and the freshness guard to detected events.
 * `onMarketByKey` holds each current match's on-market stamp (ISO or date),
 * null when the feed had none. Order is preserved, and the window arrives
 * newest first, so the first FIRST_SEND_BATCH "new" events are the newest.
 */
export function gateNewListingEvents<E extends EventLike>(args: {
  events: readonly E[]
  /** True when the alert has never been sent and carries no notified state. */
  firstSend: boolean
  lastNotifiedAt: string | null
  onMarketByKey: ReadonlyMap<string, string | null | undefined>
}): E[] {
  if (args.firstSend) {
    let kept = 0
    return args.events.filter((event) => {
      if (event.type !== 'new') return true
      kept += 1
      return kept <= FIRST_SEND_BATCH
    })
  }
  const last = args.lastNotifiedAt ? Date.parse(args.lastNotifiedAt) : NaN
  if (!Number.isFinite(last)) return [...args.events]
  const floor = last - NEW_LISTING_LOOKBACK_MS
  return args.events.filter((event) => {
    if (event.type !== 'new') return true
    const stamp = args.onMarketByKey.get(event.listingKey)
    const onMarket = stamp ? Date.parse(stamp) : NaN
    return !Number.isFinite(onMarket) || onMarket >= floor
  })
}
