'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getSession } from '@/app/actions/auth'
import { prewarmSearchCache } from '@/app/actions/search-cache'
import {
  upsertListingAlert,
  getListingAlertsForUser,
  updateListingAlertForUser,
  setListingAlertActiveForUser,
  deleteListingAlertForUser,
  setListingAlertFrequencyForUser,
} from '@/lib/data/leads/listingAlerts'
import {
  buildSearchUrlFromFilters,
  getFilterNameFallback,
  getFiltersSummary,
  getSavedSearchHash,
  normalizeSavedSearchFilters,
  type SavedSearchFilters,
} from '@/lib/search-filters'
import {
  validateCadence,
  type SavedSearchCadence,
} from '@/lib/saved-search-cadence'
import {
  normalizeSavedSearchFrequency,
  type SavedSearchFrequency,
} from '@/lib/saved-search-frequency'

/**
 * Signed-in saved-search (listing-alert) self-management.
 *
 * ALERT rows live in the unified public.listing_alerts table (migration
 * 20260707160000_unify_listing_alerts.sql) and are read/written through the
 * canonical DAL (lib/data/leads/listingAlerts.ts) on the service client, with
 * an EXPLICIT session check up front (getSession → user.id + email). Every
 * user-scoped DAL write carries BOTH the row id AND the session user_id, so a
 * user can only ever touch their own rows.
 *
 * The PUBLIC-search feature (is_public / public_title / cache_listing_keys /
 * public_click_count) deliberately stays on the LEGACY saved_searches table —
 * see getPopularPublicSearches / trackPublicSearchClick /
 * setSavedSearchPublicState / refreshSavedSearchCache at the bottom. Only
 * alert functionality moved off.
 */

export type SavedSearchRow = {
  id: string
  name: string
  filters: Record<string, unknown>
  created_at: string
  is_public: boolean
  public_title: string | null
  filters_hash: string | null
  result_count: number | null
  cache_listing_keys: string[] | null
  cache_refreshed_at: string | null
  public_click_count: number | null
  /** false = receiving alerts, true = paused (the alert cron skips paused rows). */
  is_paused: boolean
  /** instant | daily | weekly — the cadence the alert cron honors. */
  notification_frequency: SavedSearchCadence
}

export type PublicSearchRow = {
  id: string
  name: string
  title: string
  href: string
  summary: string
  resultCount: number
  clickCount: number
  createdAt: string
}

export async function getSavedSearches(): Promise<SavedSearchRow[]> {
  const session = await getSession()
  if (!session) return []
  const rows = await getListingAlertsForUser(session.user.id)
  return rows.map((row): SavedSearchRow => ({
    id: row.id,
    name: row.name ?? 'Saved search',
    filters: (row.filters ?? {}) as Record<string, unknown>,
    created_at: row.created_at ?? new Date(0).toISOString(),
    // The public/social fields live on the legacy saved_searches table only —
    // alert rows are never public. Kept in the shape so the account UI's row
    // type is unchanged.
    is_public: false,
    public_title: null,
    filters_hash: row.filters_hash,
    result_count: null,
    cache_listing_keys: null,
    cache_refreshed_at: null,
    public_click_count: null,
    is_paused: row.is_active === false,
    notification_frequency: validateCadence(row.notification_frequency) ?? 'daily',
  }))
}

export async function createSavedSearch(
  name: string,
  filters: SavedSearchFilters,
  options?: { isPublic?: boolean; publicTitle?: string }
): Promise<{ error: string | null }> {
  const session = await getSession()
  if (!session) return { error: 'Not signed in' }
  const email = session.user.email?.trim().toLowerCase()
  if (!email) return { error: 'Your account has no email address' }

  const normalizedFilters = normalizeSavedSearchFilters(filters ?? {})
  const filtersHash = getSavedSearchHash(normalizedFilters)
  const searchName = name.trim() || getFilterNameFallback(normalizedFilters) || 'Saved search'
  const warm = await prewarmSearchCache(normalizedFilters, 24)

  const persisted = await upsertListingAlert({
    email,
    filters: normalizedFilters,
    filtersHash,
    name: searchName,
    userId: session.user.id,
  })
  if (!persisted.ok) return { error: 'Could not save this search. Please try again.' }

  // The public/social feature stays on the LEGACY saved_searches table. When
  // the user opts into sharing, mirror a legacy row carrying the public fields
  // so getPopularPublicSearches keeps receiving entries. That row is display-
  // only — the alert cron scans listing_alerts exclusively.
  if (options?.isPublic === true) {
    const supabase = await createClient()
    const publicTitle = options.publicTitle?.trim() || searchName
    const { error } = await supabase.from('saved_searches').insert({
      user_id: session.user.id,
      name: searchName,
      filters: normalizedFilters,
      filters_hash: filtersHash,
      is_public: true,
      public_title: publicTitle,
      is_paused: true, // never alert-scanned; belt-and-suspenders
      result_count: warm.totalCount,
      cache_listing_keys: warm.listingKeys.slice(0, 24),
      cache_refreshed_at: new Date().toISOString(),
    })
    if (error) console.error('[createSavedSearch] public mirror', error.message)
  }

  // Mirror to FUB — saving a search is a top buyer-intent signal. Fire-and-forget
  // so a FUB hiccup never blocks the save. The user is signed in here, so attach
  // by their account email.
  void (async () => {
    try {
      const { trackSavedPropertySearch } = await import('@/lib/followupboss')
      const base = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
      await trackSavedPropertySearch({
        user: { email },
        searchName,
        filtersSummary: getFiltersSummary(normalizedFilters),
        searchUrl: `${base}${buildSearchUrlFromFilters(normalizedFilters)}`,
        resultsCount: warm.totalCount ?? undefined,
      })
    } catch {
      // non-blocking
    }
  })()

  return { error: null }
}

/**
 * Edit a user's own saved search — rename and/or change its parameters. Scoped
 * to the signed-in user (the DAL write carries user_id). When filters change,
 * re-warm the search cache so results render fast on the next visit.
 */
export async function updateSavedSearch(
  id: string,
  fields: { name?: string; filters?: SavedSearchFilters }
): Promise<{ error: string | null }> {
  const session = await getSession()
  if (!session) return { error: 'Not signed in' }
  const patch: {
    name?: string
    filters?: Record<string, unknown>
    filtersHash?: string
  } = {}
  if (fields.name !== undefined) patch.name = fields.name.trim() || 'Saved search'
  if (fields.filters !== undefined) {
    const normalizedFilters = normalizeSavedSearchFilters(fields.filters ?? {})
    patch.filters = normalizedFilters
    patch.filtersHash = getSavedSearchHash(normalizedFilters)
    await prewarmSearchCache(normalizedFilters, 24)
  }
  if (Object.keys(patch).length === 0) return { error: null }
  const result = await updateListingAlertForUser(id, session.user.id, patch)
  if (!result.ok) return { error: 'Could not save those changes' }
  return { error: null }
}

export async function deleteSavedSearch(id: string) {
  const session = await getSession()
  if (!session) return { error: 'Not signed in' }
  const result = await deleteListingAlertForUser(id.trim(), session.user.id)
  if (!result.ok) return { error: 'Could not delete that search' }
  return { error: null }
}

/**
 * CONTACT360 Phase 7.4 — consumer self-management of saved-search alerts.
 *
 * These let a SIGNED-IN user manage their own listing alerts from /account:
 * pause/resume, change the email cadence, and rename. Every one is scoped to
 * the session user — getSession() returns the authenticated id, and every DAL
 * write carries BOTH the row id AND user_id. A client never passes a user id,
 * so a user can only ever touch their own rows. The matching admin-side toggles
 * live in lib/data/crm/getContactMemberships.ts; these are the consumer
 * counterpart.
 */

type SavedSearchActionResult = { error: string | null }

/** Pause a saved search so the alert cron stops emailing matches. Scoped to the session user. */
export async function pauseSavedSearch(id: string): Promise<SavedSearchActionResult> {
  return setSavedSearchPausedState(id, true)
}

/** Resume a paused saved search so alerts start sending again. Scoped to the session user. */
export async function resumeSavedSearch(id: string): Promise<SavedSearchActionResult> {
  return setSavedSearchPausedState(id, false)
}

async function setSavedSearchPausedState(id: string, paused: boolean): Promise<SavedSearchActionResult> {
  const searchId = (id ?? '').trim()
  if (!searchId) return { error: 'Search not found' }
  const session = await getSession()
  if (!session) return { error: 'Not signed in' }
  const result = await setListingAlertActiveForUser(searchId, session.user.id, !paused)
  if (!result.ok) return { error: 'Could not update that search' }
  return { error: null }
}

/**
 * Change a saved search's email cadence. Only the three cron-honored values
 * (instant / daily / weekly) are accepted — validateCadence refuses anything
 * else so the user can't pick a frequency the alert sender silently ignores.
 * Scoped to the session user.
 */
export async function setSavedSearchCadence(
  id: string,
  frequency: string,
): Promise<SavedSearchActionResult> {
  const searchId = (id ?? '').trim()
  if (!searchId) return { error: 'Search not found' }
  const cadence = validateCadence(frequency)
  if (!cadence) return { error: 'Pick a valid alert frequency.' }
  const session = await getSession()
  if (!session) return { error: 'Not signed in' }
  const result = await updateListingAlertForUser(searchId, session.user.id, { frequency: cadence })
  if (!result.ok) return { error: 'Could not update that search' }
  return { error: null }
}

/**
 * Rename a saved search. Thin, explicitly-named wrapper over updateSavedSearch
 * so the consumer UI reads clearly and never reaches into the filters branch.
 * Scoped to the session user (updateSavedSearch carries the user_id guard).
 */
export async function renameSavedSearch(id: string, name: string): Promise<SavedSearchActionResult> {
  const next = (name ?? '').trim()
  if (!next) return { error: 'Give this search a name.' }
  return updateSavedSearch(id, { name: next })
}

/**
 * Set the alert cadence on EVERY saved search the signed-in user owns
 * (CONTACT360 Phase 7.5). The alert cron decides whether a search is due by
 * reading the per-row listing_alerts.notification_frequency, so this is the
 * write that actually changes what the user receives. The /account/notifications
 * "Saved search matches" control writes here.
 *
 * Scoped to the signed-in user's auth id, never a client-passed id. Returns the
 * normalized value the rows now hold so the caller can keep its UI / profile
 * mirror in sync.
 */
export async function setSavedSearchFrequencyForUser(
  frequency: string,
): Promise<{ error: string | null; frequency: SavedSearchFrequency }> {
  const normalized = normalizeSavedSearchFrequency(frequency)
  const session = await getSession()
  if (!session) return { error: 'Not signed in', frequency: normalized }
  const result = await setListingAlertFrequencyForUser(session.user.id, normalized)
  if (!result.ok) return { error: 'Could not update your alert frequency', frequency: normalized }
  return { error: null, frequency: normalized }
}

// ── LEGACY public-search feature (stays on saved_searches) ───────────────────
// The community "popular public searches" surface reads the legacy table. It is
// deliberately NOT migrated to listing_alerts (alerts and public/social display
// are different products). These functions are the only remaining consumers of
// saved_searches outside the DAL — see the unification migration notes.

export async function setSavedSearchPublicState(
  id: string,
  isPublic: boolean,
  publicTitle?: string
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }

  const updatePayload: Record<string, unknown> = {
    is_public: isPublic,
    public_title: isPublic ? (publicTitle?.trim() || null) : null,
  }
  if (!isPublic) updatePayload.public_click_count = 0

  const { error } = await supabase
    .from('saved_searches')
    .update(updatePayload)
    .eq('id', id.trim())
    .eq('user_id', user.id)
  if (error) return { error: error.message }
  return { error: null }
}

export async function refreshSavedSearchCache(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  const { data, error } = await supabase
    .from('saved_searches')
    .select('id, filters')
    .eq('id', id.trim())
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) return { error: error.message }
  if (!data) return { error: 'Search not found' }

  const filters = normalizeSavedSearchFilters((data.filters ?? {}) as SavedSearchFilters)
  const warm = await prewarmSearchCache(filters, 24)
  const { error: updateError } = await supabase
    .from('saved_searches')
    .update({
      filters_hash: warm.cacheKey,
      result_count: warm.totalCount,
      cache_listing_keys: warm.listingKeys.slice(0, 24),
      cache_refreshed_at: new Date().toISOString(),
    })
    .eq('id', data.id)
    .eq('user_id', user.id)
  if (updateError) return { error: updateError.message }
  return { error: null }
}

export async function getPopularPublicSearches(limit = 12): Promise<PublicSearchRow[]> {
  try {
    const service = createServiceClient()
    const safeLimit = Math.max(1, Math.min(20, Math.floor(limit)))
    const { data, error } = await service
      .from('saved_searches')
      .select('id, name, public_title, filters, result_count, public_click_count, created_at')
      .eq('is_public', true)
      .order('public_click_count', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(safeLimit)
    if (error) return []
    const rows = (data ?? []) as Array<{
      id: string
      name: string
      public_title: string | null
      filters: SavedSearchFilters | null
      result_count: number | null
      public_click_count: number | null
      created_at: string
    }>
    return rows.map((row) => {
      const filters = normalizeSavedSearchFilters(row.filters ?? {})
      const title = row.public_title?.trim() || row.name?.trim() || getFilterNameFallback(filters)
      return {
        id: row.id,
        name: row.name?.trim() || 'Saved search',
        title,
        href: buildSearchUrlFromFilters(filters),
        summary: getFiltersSummary(filters),
        resultCount: Math.max(0, Number(row.result_count ?? 0)),
        clickCount: Math.max(0, Number(row.public_click_count ?? 0)),
        createdAt: row.created_at,
      }
    })
  } catch (error) {
    console.error('[getPopularPublicSearches]', error)
    return []
  }
}

export async function trackPublicSearchClick(id: string): Promise<void> {
  const searchId = id.trim()
  if (!searchId) return
  try {
    const service = createServiceClient()
    const { data } = await service
      .from('saved_searches')
      .select('public_click_count')
      .eq('id', searchId)
      .eq('is_public', true)
      .maybeSingle()
    if (!data) return
    const next = Math.max(0, Number((data as { public_click_count?: number | null }).public_click_count ?? 0)) + 1
    await service
      .from('saved_searches')
      .update({ public_click_count: next })
      .eq('id', searchId)
      .eq('is_public', true)
  } catch (error) {
    console.error('[trackPublicSearchClick]', error)
  }
}
