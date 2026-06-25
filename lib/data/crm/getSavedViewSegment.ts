import 'server-only'

/**
 * getSavedViewSegment — the read side of "a saved view is a reusable filter"
 * (Wave 4). The audience bus (lib/crm/audience.ts) and the bulk-action enqueue
 * path (app/actions/crm-bulk.ts) both need to recover a view's segment so a saved
 * view can BE the audience for a bulk action without re-specifying the filter.
 *
 * DAL boundary (G1): the raw crm_saved_views .from() lives HERE, inside lib/data/,
 * so neither the audience module nor the action file reads the table directly. The
 * read is a single primary-key lookup, cheap to run uncached — a saved view's
 * segment must be live (an edit to the view changes the next audience immediately,
 * so a stale unstable_cache window would target the wrong cohort).
 *
 * savedViewToSegment (PURE) recovers a CrmSegment from a row: it prefers the
 * native `ast` column, falls back to upgrading the legacy `filter` bag
 * ({stage, tagsAny, broker, q}) so a view written before the ast column existed
 * still resolves to the SAME shape the list uses, and yields EMPTY_SEGMENT
 * ("everyone", still scope-clamped by the resolver) for a row with neither. A
 * malformed stored ast THROWS rather than compiling garbage into a query.
 */

import { createServiceClient } from '@/lib/supabase/service'
import {
  validateSegment,
  upgradeLegacyFilters,
  EMPTY_SEGMENT,
  type CrmSegment,
  type LegacyFilters,
} from '@/lib/crm/segment-ast'

/** The raw saved-view columns we read to recover a segment. */
export const SAVED_VIEW_SEGMENT_SELECT = 'id,ast,filter'

export type SavedViewSegmentRow = {
  ast?: unknown
  filter?: unknown
}

/**
 * Recover a CrmSegment from a saved-view row. PURE (no I/O) so it is unit-testable
 * and shared by the audience bus + the enqueue path. See module header for the
 * ast → legacy-filter → empty precedence.
 */
export function savedViewToSegment(row: SavedViewSegmentRow | null | undefined): CrmSegment {
  if (!row) return EMPTY_SEGMENT
  if (row.ast && typeof row.ast === 'object') {
    return validateSegment(row.ast)
  }
  if (row.filter && typeof row.filter === 'object') {
    return upgradeLegacyFilters(row.filter as LegacyFilters)
  }
  return EMPTY_SEGMENT
}

/**
 * Load a saved view's segment by id. Returns null when the view does not exist or
 * the table is unreadable (callers turn that into a stable "view not found" error
 * rather than silently resolving to "everyone"). Throws only on a malformed stored
 * ast (a corrupt view must never compile into a wider-than-intended query).
 */
export async function getSavedViewSegment(viewId: number): Promise<CrmSegment | null> {
  const id = Number(viewId)
  if (!Number.isFinite(id) || id <= 0) return null
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('crm_saved_views')
    .select(SAVED_VIEW_SEGMENT_SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error) {
    console.error('[getSavedViewSegment]', error.message)
    return null
  }
  if (!data) return null
  return savedViewToSegment(data as SavedViewSegmentRow)
}
