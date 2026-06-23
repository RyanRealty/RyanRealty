/**
 * Saved-search alert cadence — the single source of truth for the notification
 * frequencies the alert cron actually honors.
 *
 * The signed-in alert sender (app/actions/saved-search-alerts.ts
 * `normalizeFrequency` + `shouldSendByFrequency`) recognizes exactly three
 * values: `instant`, `daily`, `weekly`. Anything else falls back to `daily`.
 * The consumer "manage my saved searches" UI on /account must offer ONLY these
 * three so a user can't pick a cadence the cron silently ignores.
 *
 * Pure module (no imports, no I/O) so the option list + validator are unit-
 * testable and shared by the server action (validate the client value) and the
 * client island (render the Select options).
 */

export type SavedSearchCadence = 'instant' | 'daily' | 'weekly'

/** Default cadence when a row has no stored frequency (matches the DB default + the cron fallback). */
export const DEFAULT_SAVED_SEARCH_CADENCE: SavedSearchCadence = 'daily'

/**
 * The cadence options the cron honors, in the order shown in the Select.
 * `value` is what's stored in saved_searches.notification_frequency.
 * `label` is the visible, sentence-case option text. `hint` is a short
 * plain-language gloss for the active cadence.
 */
export const SAVED_SEARCH_CADENCES: ReadonlyArray<{
  value: SavedSearchCadence
  label: string
  hint: string
}> = [
  { value: 'instant', label: 'As they hit the market', hint: 'New matches as soon as we find them' },
  { value: 'daily', label: 'Once a day', hint: 'A daily roundup of new matches' },
  { value: 'weekly', label: 'Once a week', hint: 'A weekly roundup of new matches' },
] as const

const CADENCE_VALUES: ReadonlySet<string> = new Set(SAVED_SEARCH_CADENCES.map((c) => c.value))

/** True when `value` is one of the three cron-honored cadences. */
export function isSavedSearchCadence(value: unknown): value is SavedSearchCadence {
  return typeof value === 'string' && CADENCE_VALUES.has(value)
}

/**
 * Coerce an arbitrary client-supplied value to a valid cadence. Trims and
 * lowercases, then returns the matched cadence or null when it isn't one the
 * cron honors. The server action refuses the write on null.
 */
export function validateCadence(value: unknown): SavedSearchCadence | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  return isSavedSearchCadence(normalized) ? normalized : null
}

/**
 * Coerce a stored/unknown frequency to a cadence for display, falling back to
 * the default when the stored value is missing or unrecognized (mirrors the
 * cron's `normalizeFrequency`).
 */
export function normalizeStoredCadence(value: unknown): SavedSearchCadence {
  return validateCadence(value) ?? DEFAULT_SAVED_SEARCH_CADENCE
}

/** The visible option label for a cadence (sentence case). */
export function cadenceLabel(value: unknown): string {
  const cadence = normalizeStoredCadence(value)
  const match = SAVED_SEARCH_CADENCES.find((c) => c.value === cadence)
  return match ? match.label : SAVED_SEARCH_CADENCES[1].label
}
