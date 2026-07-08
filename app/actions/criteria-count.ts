'use server'

/**
 * criteria-count — the live "142 listings match today" count behind the
 * criteria editors (components/admin/crm/criteria).
 *
 * Rides the SAME cached search path the site and the alert cron use
 * (getCachedSearchListings → getListingsWithAdvanced, unstable_cache 5 min),
 * with pageSize 1 so only the total is paid for. Filters run through
 * normalizeSavedSearchFilters first, so the count always reflects what the
 * saved filters JSON will actually match. Never throws.
 */

import { getCachedSearchListings } from '@/app/actions/search-cache'
import { normalizeSavedSearchFilters, type SavedSearchFilters } from '@/lib/search-filters'

export async function countMatchingListings(
  filters: SavedSearchFilters,
): Promise<{ data: { count: number } | null; error: string | null }> {
  try {
    const normalized = normalizeSavedSearchFilters(filters ?? {})
    const result = await getCachedSearchListings(normalized, 1, 1)
    const count = Number.isFinite(result.totalCount) ? Math.max(0, result.totalCount) : 0
    return { data: { count }, error: null }
  } catch (err) {
    console.error('[countMatchingListings]', err)
    return { data: null, error: 'Could not count matching listings' }
  }
}
