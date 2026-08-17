/**
 * Pure expired-capture select policy. SQL in selectNewExpiredListings must
 * use these so already-seen rows cannot bury new ones behind `limit`.
 */

/** Include the floor via gte (0 = any list price). Do not switch back to gt. */
export const EXPIRED_CAPTURE_PRICE_OP = 'gte' as const

/** Scheduled sync-delta capture: 24h lookback, same cap as the manual cron. */
export const SCHEDULED_EXPIRED_CAPTURE = {
  lookbackHours: 24,
  maxPerRun: 30,
} as const

/** PostgREST `not.in` value, or null when there is nothing to exclude. */
export function expiredListingSeenKeyFilter(seenKeys: string[]): string | null {
  const keys = seenKeys.map((k) => String(k).trim()).filter(Boolean)
  if (keys.length === 0) return null
  return `(${keys.map((k) => `"${k.replace(/"/g, '')}"`).join(',')})`
}
