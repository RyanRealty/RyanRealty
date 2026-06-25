/**
 * saved-view-grouping — the PURE helpers behind SavedViewSidebar.
 *
 * Factored into a plain module (no 'use client', no React, no server action
 * imports) so the grouping rule + the save-dialog preview AST are unit-tested
 * without pulling the client island or the 'use server' action chain into the
 * test graph. The sidebar imports these and renders them.
 */

import type { CrmSegment, CrmNode, LegacyFilters } from '@/lib/crm/segment-ast'

/** The per-view shape the sidebar renders (subset of CrmSavedViewWithCount). */
export type SavedViewItem = {
  id: number
  name: string
  description: string | null
  ast: CrmSegment
  isShared: boolean
  isProtected: boolean
  isSystem: boolean
  isOwn: boolean
  count: number | null
}

/**
 * Bucket the views the caller may see into the three sidebar groups.
 *   - system: seeded protected lists (isSystem)
 *   - mine:   the caller's own non-system views (isOwn)
 *   - shared: everything else the caller can see (someone else's shared view)
 * The buckets are disjoint and together cover every input row (system wins over
 * own when both are set, which never happens for a real row but keeps the split
 * total-preserving). Input order is preserved within each bucket.
 */
export function groupSavedViews(views: SavedViewItem[]): {
  system: SavedViewItem[]
  mine: SavedViewItem[]
  shared: SavedViewItem[]
} {
  const system: SavedViewItem[] = []
  const mine: SavedViewItem[] = []
  const shared: SavedViewItem[] = []
  for (const v of views) {
    if (v.isSystem) system.push(v)
    else if (v.isOwn) mine.push(v)
    else shared.push(v)
  }
  return { system, mine, shared }
}

/**
 * Build a preview AST from the active legacy filter bag, for the save-dialog blurb.
 * Mirrors upgradeLegacyFilters' AND-of-conditions shape, but each tag is its own
 * has-condition (the dialog only needs a human label, not the OR-grouping the
 * real resolver applies for multi-tag). An empty bag yields the everyone segment.
 */
export function legacyToPreview(filters: LegacyFilters): CrmSegment {
  const nodes: CrmNode[] = []
  if (filters.stage) nodes.push({ field: 'stage', value: filters.stage })
  for (const t of filters.tagsAny ?? []) {
    if (t) nodes.push({ field: 'tag', op: 'has', value: t })
  }
  if (filters.broker) nodes.push({ field: 'assigned_broker', value: filters.broker })
  if (filters.q) nodes.push({ field: 'q', value: filters.q })
  return { type: 'group', op: 'and', nodes }
}
