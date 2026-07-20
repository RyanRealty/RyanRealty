/**
 * Shared Active / Pending / Closed status classifiers.
 *
 * Spark stores listing state in StandardStatus exactly as the MLS sends it.
 * These helpers collapse the raw string into Spark's three display states:
 *   - Active:  for sale / available ("Active", "For Sale", "Coming Soon", or null)
 *   - Pending: under contract (contains "Pending" / "Under Contract" / "Contingent")
 *   - Closed:  sold / closed (contains "Closed")
 *
 * Extracted from app/actions/listings.ts so the brokerage-listings DAL reader
 * and the action-layer callers classify status through one implementation and
 * cannot drift. Logic is byte-identical to the prior private helpers.
 */

export function isActiveStatus(s: string | null | undefined): boolean {
  const t = String(s ?? '').trim().toLowerCase()
  if (t === '') return true
  if (t === 'active') return true
  if (t.includes('for sale')) return true
  if (t.includes('coming soon')) return true
  return false
}

export function isPendingStatus(s: string | null | undefined): boolean {
  const t = String(s ?? '').toLowerCase()
  return /pending/.test(t) || /under contract/.test(t) || /undercontract/.test(t) || /contingent/.test(t)
}

export function isClosedStatus(s: string | null | undefined): boolean {
  return /closed/i.test(String(s ?? ''))
}
