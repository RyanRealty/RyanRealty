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
 * Keywords that identify neighborhood/area system lists (FUB "Neighborhoods" collection).
 * Any system list whose name contains one of these (case-insensitive) lands in the
 * Neighborhoods collection; everything else lands in Pipeline.
 */
const NEIGHBORHOOD_KEYWORDS = [
  'tetherow', 'sunriver', 'pronghorn', 'black butte', 'northwest crossing', 'vandevert',
  'awbrey', 'shevlin', 'tumalo', 'bend', 'redmond', 'sisters', 'la pine',
  'neighborhood', 'area', 'community',
]

export type SystemCollection = {
  label: string
  views: SavedViewItem[]
}

/**
 * Split the system views into FUB-style named collections.
 * Returns a Pipeline collection (workflow/stage lists) and a Neighborhoods
 * collection (geography-keyed lists), dropping empty collections.
 */
export function groupSystemByCollection(systemViews: SavedViewItem[]): SystemCollection[] {
  const pipeline: SavedViewItem[] = []
  const neighborhoods: SavedViewItem[] = []
  for (const v of systemViews) {
    const lower = v.name.toLowerCase()
    if (NEIGHBORHOOD_KEYWORDS.some((kw) => lower.includes(kw))) {
      neighborhoods.push(v)
    } else {
      pipeline.push(v)
    }
  }
  const result: SystemCollection[] = []
  if (pipeline.length > 0) result.push({ label: 'Pipeline', views: pipeline })
  if (neighborhoods.length > 0) result.push({ label: 'Neighborhoods', views: neighborhoods })
  // Fallback: if somehow none matched, put everything in Pipeline
  if (result.length === 0 && systemViews.length > 0) result.push({ label: 'Pipeline', views: systemViews })
  return result
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
