/**
 * getContactListingAlerts — the "what listing alerts is this contact getting"
 * reader for the Contact-360 view (CONTACT360 Phase 3.1, read side).
 *
 * Alerts were unified into ONE table (public.listing_alerts, migration
 * 20260707160000_unify_listing_alerts.sql), so this is now a single-table read:
 * the old union of saved_searches + guest_search_alerts — and its URL-dedupe
 * pass — collapsed away. The DB's unique (email, filters_hash) pair guarantees
 * one row per search per address.
 *
 * Identity comes from the keystone resolver (resolvePersonIdentity): it yields
 * the person's normalized emails, the auth uuid, and the FUB legacy id — all
 * three are join keys on listing_alerts (plus crm_person_id directly).
 * Resolution is FUB-independent — a native lead resolves the same way as an
 * imported one.
 *
 * `source` keeps the historical 'saved-search' / 'guest-alert' vocabulary so
 * the admin UI needs no changes: a row with a user_id renders as the signed-in
 * kind, a row without one as the guest kind.
 *
 * DAL boundary (G1): listing_alerts is read through the canonical DAL reader
 * (getListingAlertsForLead) rather than re-querying the table.
 */
import { resolvePersonIdentity } from '@/lib/data/crm/resolvePersonIdentity'
import { getListingAlertsForLead, type ListingAlertRow } from '@/lib/data/leads/listingAlerts'
import { buildSearchUrlFromFilters, type SavedSearchFilters } from '@/lib/search-filters'

export type ContactListingAlertSource = 'saved-search' | 'guest-alert'

export type ContactListingAlert = {
  /** Stable row id from listing_alerts (uuid). */
  id: string
  source: ContactListingAlertSource
  /** Display name for the alert (the saved name, or a fallback from the criteria). */
  label: string
  /** Humanized one-line criteria, e.g. "Homes in Bend, $400k-$800k, 3+ beds, 2+ baths". */
  criteriaText: string
  /** Deep link to the search-results page that reproduces these filters. */
  url: string
  /** Normalized so true = receiving alerts (paused/inactive => false). */
  active: boolean
  /** Send cadence (instant/daily/weekly) when stored, else null. */
  cadence?: string | null
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function asTrimmedString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const next = value.trim()
  return next.length > 0 ? next : undefined
}

function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const next = value.trim().toLowerCase()
    if (next === '1' || next === 'true' || next === 'yes') return true
    if (next === '0' || next === 'false' || next === 'no') return false
  }
  return undefined
}

/** Round a dollar amount to a compact "$400k" / "$1.2m" label. */
function formatPriceShort(value: number): string {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000
    const text = millions % 1 === 0 ? String(millions) : millions.toFixed(1)
    return `$${text}m`
  }
  if (value >= 1_000) {
    return `$${Math.round(value / 1_000)}k`
  }
  return `$${Math.round(value)}`
}

/**
 * PURE: turn a saved-search filter object into a readable sentence, e.g.
 *   "Homes in Bend, $400k-$800k, 3+ beds, 2+ baths"
 * Order: place, price, beds, baths, then notable feature flags. An empty / all-
 * null filter set returns a sensible default ("All homes"). Reads the same
 * filter keys every alert row stores (city/subdivision/minPrice/maxPrice/beds/
 * baths/the has* feature flags). No DB access — unit-tested directly.
 */
export function humanizeSearchCriteria(filters: Record<string, unknown>): string {
  const f = (filters ?? {}) as Record<string, unknown>
  const parts: string[] = []

  // Place — subdivision in city, or just one of them.
  const city = asTrimmedString(f.city)
  const subdivision = asTrimmedString(f.subdivision)
  const postalCode = asTrimmedString(f.postalCode)
  if (city && subdivision) parts.push(`Homes in ${subdivision}, ${city}`)
  else if (city) parts.push(`Homes in ${city}`)
  else if (subdivision) parts.push(`Homes in ${subdivision}`)
  else if (postalCode) parts.push(`Homes in ${postalCode}`)
  else parts.push('Homes')

  // Price range.
  const minPrice = asNumber(f.minPrice)
  const maxPrice = asNumber(f.maxPrice)
  if (minPrice && maxPrice) parts.push(`${formatPriceShort(minPrice)}-${formatPriceShort(maxPrice)}`)
  else if (minPrice) parts.push(`${formatPriceShort(minPrice)}+`)
  else if (maxPrice) parts.push(`under ${formatPriceShort(maxPrice)}`)

  // Beds / baths.
  const beds = asNumber(f.beds)
  const baths = asNumber(f.baths)
  if (beds && beds > 0) parts.push(`${beds}+ beds`)
  if (baths && baths > 0) parts.push(`${baths}+ baths`)

  // Notable feature flags (only when true; keeps the sentence honest).
  const features: Array<[unknown, string]> = [
    [f.hasPool, 'pool'],
    [f.hasView, 'view'],
    [f.hasWaterfront, 'waterfront'],
    [f.hasGolfCourse, 'golf course'],
  ]
  for (const [raw, label] of features) {
    if (asBoolean(raw) === true) parts.push(label)
  }

  // parts[0] is always "Homes..."; if nothing else qualified it, broaden it to
  // "All homes" so a fully-empty search reads as a sensible default.
  if (parts.length === 1 && parts[0] === 'Homes') return 'All homes'
  return parts.join(', ')
}

/**
 * PURE: deep link to the search-results page that reproduces these filters.
 * Delegates to the canonical buildSearchUrlFromFilters so the query-param
 * convention (and the /homes-for-sale vs city/subdivision path choice) matches
 * the rest of the app exactly. Unit-tested directly.
 */
export function buildSearchUrl(filters: Record<string, unknown>): string {
  return buildSearchUrlFromFilters((filters ?? {}) as SavedSearchFilters)
}

/** Best-effort display name when the saved name is blank. */
function labelFor(name: string | null | undefined, filters: Record<string, unknown>): string {
  const trimmed = asTrimmedString(name)
  if (trimmed) return trimmed
  return humanizeSearchCriteria(filters)
}

/** The subset of a listing_alerts row this mapper needs (pure, testable). */
export type ListingAlertLikeRow = {
  id: string
  user_id?: string | null
  name: string | null
  filters: Record<string, unknown> | null
  notification_frequency: string | null
  is_active: boolean | null
}

/**
 * PURE: map unified listing_alerts rows to the humanized + deep-linked shape
 * the contact panels render. Split out from the DB read so the normalize logic
 * is unit-testable without a live client. `source` derives from the presence
 * of a user_id (signed-in vs guest vocabulary the UI already speaks).
 */
export function toContactListingAlerts(rows: ListingAlertLikeRow[]): ContactListingAlert[] {
  return rows.map((row) => {
    const filters = (row.filters ?? {}) as Record<string, unknown>
    return {
      id: row.id,
      source: row.user_id ? ('saved-search' as const) : ('guest-alert' as const),
      label: labelFor(row.name, filters),
      criteriaText: humanizeSearchCriteria(filters),
      url: buildSearchUrl(filters),
      active: row.is_active === true,
      cadence: asTrimmedString(row.notification_frequency) ?? null,
    }
  })
}

/**
 * Every listing alert a contact receives, humanized + deep-linked — one call,
 * one table, regardless of whether the alert was created signed-in, as a
 * guest, by a broker, or by the system.
 */
export async function getContactListingAlerts(crmPersonId: number): Promise<ContactListingAlert[]> {
  if (!Number.isFinite(crmPersonId) || crmPersonId <= 0) return []

  const identity = await resolvePersonIdentity(crmPersonId)

  const rows: ListingAlertRow[] = await getListingAlertsForLead({
    userId: identity.authUserId,
    crmPersonId,
    fubPersonId: identity.fubLegacyId,
    emails: identity.emails,
  })

  return toContactListingAlerts(rows)
}
