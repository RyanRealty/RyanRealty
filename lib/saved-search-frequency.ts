/**
 * saved-search-frequency — the single source of truth for the alert cadences a
 * saved search can fire on (CONTACT360 Phase 7.5; monthly added 2026-07-21).
 *
 * The alert cron (`app/actions/saved-search-alerts.ts`) decides whether a saved
 * search is due by reading the PER-ROW `listing_alerts.notification_frequency`
 * column ('instant' | 'daily' | 'weekly' | 'monthly'), defaulting unknown
 * values to 'daily'. The consumer "Saved search matches" control on
 * /account/notifications historically wrote a GLOBAL
 * `profiles.notification_preferences.savedSearchFrequency` that no cron reads,
 * so the control lied. Phase 7.5 fans that choice out to every saved-search
 * row so the value the cron honors is the value the user picked.
 *
 * This module holds the pure normalizer so both the cron and the fan-out write
 * the identical, validated value. No DB access here, unit-tested directly.
 */

export type SavedSearchFrequency = 'instant' | 'daily' | 'weekly' | 'monthly'

/** The cadences a saved search can fire on, most frequent first. */
export const SAVED_SEARCH_FREQUENCIES: readonly SavedSearchFrequency[] = [
  'instant',
  'daily',
  'weekly',
  'monthly',
]

/**
 * PURE: coerce any stored / user-supplied value to one of the four valid
 * cadences. Mirrors the cron's own normalizer exactly. Trims, lowercases,
 * accepts 'instant' / 'daily' / 'weekly' / 'monthly', and defaults everything
 * else to 'daily' (the same fallback the cron uses) so a row written here is
 * always a value the cron honors. Unit-tested directly.
 */
export function normalizeSavedSearchFrequency(raw: unknown): SavedSearchFrequency {
  const value = (typeof raw === 'string' ? raw : '').trim().toLowerCase()
  if (value === 'instant') return 'instant'
  if (value === 'weekly') return 'weekly'
  if (value === 'monthly') return 'monthly'
  return 'daily'
}
