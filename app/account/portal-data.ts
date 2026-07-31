import 'server-only'

/**
 * Server-side composition for the /account portal (Phase 4.1,
 * docs/plans/SEARCH_OPTIMIZATION_PLAN_2026-07-29.md).
 *
 * The portal page renders one surface out of several existing subsystems, so
 * the multi-read composition lives here instead of bloating page.tsx. Nothing
 * in this module talks to a table directly: saved-search rows come from the
 * alert DAL through app/actions/saved-searches.ts, match sets come from the
 * cached search reader, and the pure badge rules live in
 * lib/data/leads/newSince.ts.
 *
 * §0: every number the portal renders is produced by one of these reads. There
 * is no placeholder count anywhere on the surface. When a read cannot be made
 * honestly (a saved search whose named area was deleted, or one with no
 * narrowing filter at all) the insight is simply omitted and the UI shows no
 * number rather than a wrong one.
 */

import { getCachedSearchListings } from '@/app/actions/search-cache'
import type { SavedSearchRow } from '@/app/actions/saved-searches'
import { getHiddenListingKeys } from '@/app/actions/hidden-listings'
import { getUserCollections } from '@/app/actions/collections'
import { getAreasByIds } from '@/lib/data'
import {
  NEW_SINCE_SCAN_SIZE,
  countNewSince,
  newSinceBaseline,
  type NewSinceResult,
} from '@/lib/data/leads/newSince'
import { getAreaIdsFromFilters, resolveAreasToShapeSet } from '@/lib/alerts/area-resolve'
import { hasNarrowingFilter } from '@/lib/search-filters'
import type { SearchShapes } from '@/lib/data'

/** Per-saved-search live figures rendered on the alert card. */
export type SavedSearchInsight = {
  /** Exact current match count for the search (cached 5 min). */
  totalCount: number
  /** "New since last visit" over the newest page of matches. */
  newSince: NewSinceResult
}

/**
 * Cap on how many saved searches get a live insight in one portal render.
 * Each one is a cached search read; a subscriber with dozens of searches gets
 * badges on the newest ones rather than a slow page.
 */
export const PORTAL_INSIGHT_LIMIT = 12

async function insightFor(search: SavedSearchRow): Promise<SavedSearchInsight | null> {
  const filters = (search.filters ?? {}) as Record<string, unknown>

  // Same two guards the alert engine applies before it will run a saved
  // search: an unnarrowed search would count the whole feed, and a search
  // scoped to a deleted named area matches nothing knowable.
  if (!hasNarrowingFilter(filters)) return null

  let shapes: SearchShapes | undefined
  const areaIds = getAreaIdsFromFilters(filters)
  if (areaIds.length > 0) {
    const resolved = resolveAreasToShapeSet(await getAreasByIds(areaIds))
    if (!resolved) return null
    shapes = resolved
  }

  try {
    // Newest-first regardless of the search's own sort: the badge counts the
    // most recent arrivals, so the scan window has to hold them.
    const result = await getCachedSearchListings(
      { ...filters, sort: 'newest' },
      1,
      NEW_SINCE_SCAN_SIZE,
      shapes,
    )
    const baseline = newSinceBaseline({
      lastViewedAt: search.last_viewed_at,
      createdAt: search.created_at,
    })
    return {
      totalCount: result.totalCount,
      newSince: countNewSince(
        result.listings.map((row) => row.OnMarketDate ?? null),
        baseline,
        NEW_SINCE_SCAN_SIZE,
      ),
    }
  } catch (error) {
    console.error('[portal-data] saved-search insight failed', { searchId: search.id, error })
    return null
  }
}

/**
 * Live match count + "new since last visit" for each saved search, keyed by
 * search id. A missing key means the figure could not be produced honestly;
 * the card then renders without numbers.
 */
export async function getSavedSearchInsights(
  searches: SavedSearchRow[],
): Promise<Record<string, SavedSearchInsight>> {
  const scoped = searches.slice(0, PORTAL_INSIGHT_LIMIT)
  const results = await Promise.all(scoped.map((search) => insightFor(search)))
  const out: Record<string, SavedSearchInsight> = {}
  scoped.forEach((search, index) => {
    const insight = results[index]
    if (insight) out[search.id] = insight
  })
  return out
}

/**
 * The two per-visitor lists the Homes panel counts.
 *
 * These stay owned by their action modules on purpose. Both are RLS-scoped
 * single-user reads that can never become cached DAL readers (a cache window
 * over per-person rows would serve one visitor their own stale list while
 * pinning memory for everyone else), and both modules already own the matching
 * WRITES — hide/unhide and collection create/delete. Re-implementing the reads
 * in lib/data would split ownership of one table across two modules, which is a
 * worse outcome than routing them through this composition seam. The portal
 * page therefore reads this module, not the action layer.
 */
export async function getPortalHomeLists(): Promise<{
  hiddenKeys: string[]
  collections: Array<{ id: string; name: string; listing_keys: string[] }>
}> {
  const [hiddenKeys, collectionsResult] = await Promise.all([
    getHiddenListingKeys(),
    getUserCollections(),
  ])
  return {
    hiddenKeys,
    collections: collectionsResult.data.map((c) => ({
      id: c.id,
      name: c.name,
      listing_keys: c.listing_keys ?? [],
    })),
  }
}

/** Total new-since count across every search that produced one. */
export function totalNewSince(insights: Record<string, SavedSearchInsight>): {
  count: number
  saturated: boolean
} {
  let count = 0
  let saturated = false
  for (const insight of Object.values(insights)) {
    count += insight.newSince.count
    if (insight.newSince.saturated) saturated = true
  }
  return { count, saturated }
}
