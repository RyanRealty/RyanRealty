/**
 * Pure hidden-listing exclusion logic, shared by:
 *  - components/search/SearchResults.tsx (client-side per-user filtering —
 *    server listing caches are SHARED across users, so hidden homes are
 *    filtered at the edge of render, never baked into cached results)
 *  - app/actions/saved-search-alerts.ts (alert engine: a hidden home is
 *    excluded from the matched set BEFORE the seen-set diff, so it never
 *    counts as "new" and never lands in an alert email)
 *
 * hidden_listings stores the canonical RETS ListingKey (writes resolve via
 * resolveCanonicalListingKey). Listing rows travel under BOTH identifiers
 * (ListingKey and MLS ListNumber), so membership checks match either form.
 */

export type HiddenMatchable = {
  ListingKey?: string | null
  // MLS ListNumber travels as a string on most rows but as a number on some map
  // pin rows (ListingForMap); normalizeHiddenKey String()-coerces either.
  ListNumber?: string | number | null
}

/** Normalize one stored/incoming key: string-coerce + trim. Empty → ''. */
export function normalizeHiddenKey(key: string | number | null | undefined): string {
  return String(key ?? '').trim()
}

/** Build the membership set from stored keys, dropping empties. */
export function buildHiddenKeySet(keys: Iterable<string | null | undefined>): Set<string> {
  const set = new Set<string>()
  for (const key of keys) {
    const normalized = normalizeHiddenKey(key)
    if (normalized) set.add(normalized)
  }
  return set
}

/** True when the listing matches the hidden set under either identifier. */
export function isHiddenListing(listing: HiddenMatchable, hidden: Set<string>): boolean {
  if (hidden.size === 0) return false
  const byListingKey = normalizeHiddenKey(listing.ListingKey)
  if (byListingKey && hidden.has(byListingKey)) return true
  const byListNumber = normalizeHiddenKey(listing.ListNumber)
  return byListNumber !== '' && hidden.has(byListNumber)
}

/** Rows minus the hidden ones. Returns the SAME array when nothing is hidden. */
export function excludeHiddenListings<T extends HiddenMatchable>(rows: T[], hidden: Set<string>): T[] {
  if (hidden.size === 0 || rows.length === 0) return rows
  const kept = rows.filter((row) => !isHiddenListing(row, hidden))
  return kept.length === rows.length ? rows : kept
}
