/**
 * getContactListingAlerts — the unified "what listing alerts is this contact
 * getting" reader for the Contact-360 view (CONTACT360 Phase 3.1, read side).
 *
 * A person can have BOTH signed-in saved searches (`saved_searches`, keyed by
 * the auth `user_id`) AND guest saved-search alerts (`guest_search_alerts`,
 * keyed by email / FUB id). Today the broker view only shows the guest rows;
 * the signed-in saved searches are never surfaced. This reader UNIONs both into
 * one humanized list so one call returns every alert a contact receives,
 * regardless of signed-in vs guest.
 *
 * Identity comes from the keystone resolver (resolvePersonIdentity): it yields
 * the person's normalized emails (a guest-alert join key), the auth uuid (the
 * saved_searches join key), and the FUB legacy id (the other guest-alert join
 * key). Resolution is FUB-independent — a native lead resolves the same way as
 * an imported one.
 *
 * Dedupe: a contact who saved the same criteria both signed-in and as a guest
 * would otherwise show twice. We dedupe by the deep-link URL — a stable,
 * normalized representation of the same filters that both tables produce —
 * saved-search winning over guest for an identical URL (the signed-in row is
 * the authoritative one with the richer cadence/pause state).
 *
 * `active` is normalized across the two tables so a UI toggle isn't backwards:
 *   - saved_searches.is_paused      -> active = !is_paused
 *   - guest_search_alerts.is_active -> active = is_active
 *
 * DAL boundary (G1): the raw .from() read of saved_searches lives here, inside
 * lib/data/. Guest alerts are read through the existing DAL reader
 * (getGuestSearchAlertsForLead) rather than re-querying the table.
 */
import { createServiceClient } from '@/lib/supabase/service'
import { resolvePersonIdentity } from '@/lib/data/crm/resolvePersonIdentity'
import { getGuestSearchAlertsForLead, type GuestSearchAlertRow } from '@/lib/data/leads/guestSearchAlerts'
import { buildSearchUrlFromFilters, type SavedSearchFilters } from '@/lib/search-filters'

export type ContactListingAlertSource = 'saved-search' | 'guest-alert'

export type ContactListingAlert = {
  /** Stable row id from the underlying table (uuid). */
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

type SavedSearchRow = {
  id: string
  user_id: string | null
  name: string | null
  filters: Record<string, unknown> | null
  notification_frequency: string | null
  is_paused: boolean | null
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
 * filter keys both tables store (city/subdivision/minPrice/maxPrice/beds/baths/
 * the has* feature flags). No DB access — unit-tested directly.
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

/**
 * PURE: merge the signed-in saved searches and the guest alerts into one list,
 * humanized + deep-linked, deduped by deep-link URL (saved-search wins). Split
 * out from the DB read so the union/dedupe/normalize logic is unit-testable
 * without a live client. Saved searches are listed first (the authoritative
 * signed-in rows), then any guest alerts whose URL wasn't already seen.
 */
export function mergeListingAlertRows(
  savedSearches: SavedSearchRow[],
  guestAlerts: GuestSearchAlertRow[],
): ContactListingAlert[] {
  const out: ContactListingAlert[] = []
  const seenUrls = new Set<string>()

  for (const row of savedSearches) {
    const filters = (row.filters ?? {}) as Record<string, unknown>
    const url = buildSearchUrl(filters)
    seenUrls.add(url)
    out.push({
      id: row.id,
      source: 'saved-search',
      label: labelFor(row.name, filters),
      criteriaText: humanizeSearchCriteria(filters),
      url,
      active: row.is_paused !== true,
      cadence: asTrimmedString(row.notification_frequency) ?? null,
    })
  }

  for (const row of guestAlerts) {
    const filters = (row.filters ?? {}) as Record<string, unknown>
    const url = buildSearchUrl(filters)
    // Skip a guest alert that duplicates a signed-in saved search (same filters
    // => same normalized URL). The signed-in row already represents it.
    if (seenUrls.has(url)) continue
    seenUrls.add(url)
    out.push({
      id: row.id,
      source: 'guest-alert',
      label: labelFor(row.name, filters),
      criteriaText: humanizeSearchCriteria(filters),
      url,
      active: row.is_active === true,
      cadence: asTrimmedString(row.notification_frequency) ?? null,
    })
  }

  return out
}

/**
 * Every listing alert a contact receives, humanized + deep-linked, regardless
 * of signed-in (saved_searches) vs guest (guest_search_alerts). One call.
 */
export async function getContactListingAlerts(crmPersonId: number): Promise<ContactListingAlert[]> {
  if (!Number.isFinite(crmPersonId) || crmPersonId <= 0) return []

  const identity = await resolvePersonIdentity(crmPersonId)

  // Signed-in saved searches are keyed by the auth user_id; only fetch when the
  // contact was stitched to an auth account.
  const savedSearches: SavedSearchRow[] = []
  if (identity.authUserId) {
    const sb = createServiceClient()
    const { data, error } = await sb
      .from('saved_searches')
      .select('id, user_id, name, filters, notification_frequency, is_paused')
      .eq('user_id', identity.authUserId)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) {
      console.error('[getContactListingAlerts] saved_searches', error.message)
    } else {
      for (const r of data ?? []) {
        savedSearches.push({
          id: String(r.id),
          user_id: (r.user_id as string | null) ?? null,
          name: (r.name as string | null) ?? null,
          filters: (r.filters as Record<string, unknown> | null) ?? null,
          notification_frequency: (r.notification_frequency as string | null) ?? null,
          is_paused: (r.is_paused as boolean | null) ?? null,
        })
      }
    }
  }

  // Guest alerts are keyed by FUB id OR any of the contact's emails. Reuse the
  // existing DAL reader rather than re-querying the table.
  const guestAlerts = await getGuestSearchAlertsForLead({
    fubPersonId: identity.fubLegacyId,
    emails: identity.emails,
  })

  return mergeListingAlertRows(savedSearches, guestAlerts)
}
