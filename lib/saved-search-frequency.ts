/**
 * saved-search-frequency — the single source of truth for the three alert
 * cadences a saved search can fire on (CONTACT360 Phase 7.5).
 *
 * The alert cron (`app/actions/saved-search-alerts.ts`) decides whether a saved
 * search is due by reading the PER-ROW `saved_searches.notification_frequency`
 * column ('instant' | 'daily' | 'weekly'), defaulting unknown values to
 * 'daily'. The consumer "Saved search matches" control on /account/notifications
 * historically wrote a GLOBAL `profiles.notification_preferences.savedSearchFrequency`
 * that no cron reads, so the control lied. Phase 7.5 fans that choice out to
 * every saved-search row so the value the cron honors is the value the user
 * picked.
 *
 * This module holds the pure normalizer so both the cron and the fan-out write
 * the identical, validated value. No DB access here, unit-tested directly.
 */

export type SavedSearchFrequency = 'instant' | 'daily' | 'weekly'

/** The cadences a saved search can fire on, in escalating order of frequency. */
export const SAVED_SEARCH_FREQUENCIES: readonly SavedSearchFrequency[] = [
  'instant',
  'daily',
  'weekly',
]

/**
 * PURE: coerce any stored / user-supplied value to one of the three valid
 * cadences. Mirrors the cron's own normalizer exactly. Trims, lowercases,
 * accepts 'instant' / 'daily' / 'weekly', and defaults everything else to
 * 'daily' (the same fallback the cron uses) so a row written here is always a
 * value the cron honors. Unit-tested directly.
 */
export function normalizeSavedSearchFrequency(raw: unknown): SavedSearchFrequency {
  const value = (typeof raw === 'string' ? raw : '').trim().toLowerCase()
  if (value === 'instant') return 'instant'
  if (value === 'weekly') return 'weekly'
  return 'daily'
}
