/**
 * saved-view-seeds — the 12 FUB smart lists as canonical CrmSegment ASTs.
 *
 * This is the SINGLE definition of the seeded system views. The migration
 * (supabase/migrations/<ts>_crm_saved_views_ast.sql) inserts the same 12 rows;
 * the seed test (lib/crm/saved-view-seeds.test.ts) validates every AST here with
 * validateSegment and checks the migration's seed block mirrors this list. Keeping
 * the defs in one PURE module (no Supabase, no server-only) means the migration,
 * the DAL, and the test can never drift from one another.
 *
 * Each FUB smart list maps to an intent expressed with the stage/tag/last_activity
 * conditions the CrmSegment AST already supports (lib/crm/segment-ast.ts). Where a
 * clean mapping is not possible (Email Activity, IDX Activity have no first-class
 * event condition yet) the closest last_activity / tag approximation is used and
 * the reason is noted in `mappingNote`.
 *
 * Stage keys MUST match the crm_stages config table exactly (READ getCrmStages /
 * lib/crm/constants.ts CRM_STAGES). They are pinned below as literals so the test
 * can assert against CRM_STAGES without a DB.
 */

import type { CrmSegment } from '@/lib/crm/segment-ast'

/** ~90 days, the "Stay In Touch" staleness window, in milliseconds. */
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000
/** ~30 days, the "recent activity" approximation window for Email / IDX activity. */
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

/**
 * A relative date condition is resolved to an absolute ISO at seed time so the AST
 * stays a plain serializable shape (the resolver has no "relative now" support).
 * The seeded value is a fixed point; the views are refreshable by re-running the
 * seed if the window needs to advance. For the live DAL count the AST is read
 * straight from the row, so the seeded window is what the count reflects.
 */
function isoDaysAgo(ms: number, now: Date = new Date()): string {
  return new Date(now.getTime() - ms).toISOString()
}

export type SavedViewSeed = {
  /** Display name (matches the FUB smart-list name). */
  name: string
  /** Short description shown under the chip. */
  description: string
  /** Render order. Dense 0..n-1. */
  position: number
  /** The segment AST that resolves the list. */
  ast: CrmSegment
  /** When the mapping is an approximation, why. Empty for a clean mapping. */
  mappingNote: string
}

/**
 * Build the 12 seeds. `now` is injectable so the test gets deterministic ISO
 * windows for the date-based views.
 */
export function buildSavedViewSeeds(now: Date = new Date()): SavedViewSeed[] {
  const ninetyDaysAgo = isoDaysAgo(NINETY_DAYS_MS, now)
  const thirtyDaysAgo = isoDaysAgo(THIRTY_DAYS_MS, now)

  return [
    {
      name: 'Leads',
      description: 'New leads in the pipeline.',
      position: 0,
      ast: { type: 'group', op: 'and', nodes: [{ field: 'stage', value: 'Lead' }] },
      mappingNote: '',
    },
    {
      name: 'Hot Prospects',
      description: 'Hot prospects, 1 to 3 months out.',
      position: 1,
      ast: { type: 'group', op: 'and', nodes: [{ field: 'stage', value: 'A - Hot 1-3 Months' }] },
      mappingNote: '',
    },
    {
      name: 'Sellers',
      description: 'Seller audience and seller prospects.',
      position: 2,
      ast: {
        type: 'group',
        op: 'or',
        nodes: [
          { field: 'tag', op: 'has', value: 'audience:seller' },
          { field: 'stage', value: 'Seller Prospect' },
        ],
      },
      mappingNote: '',
    },
    {
      name: 'Buyers',
      description: 'Buyer audience.',
      position: 3,
      ast: { type: 'group', op: 'and', nodes: [{ field: 'tag', op: 'has', value: 'audience:buyer' }] },
      mappingNote: '',
    },
    {
      name: 'Past Clients',
      description: 'Closed clients to stay in touch with.',
      position: 4,
      ast: { type: 'group', op: 'and', nodes: [{ field: 'stage', value: 'Past Client' }] },
      mappingNote: '',
    },
    {
      name: 'Sphere',
      description: 'Your sphere of influence.',
      position: 5,
      ast: { type: 'group', op: 'and', nodes: [{ field: 'stage', value: 'Sphere' }] },
      mappingNote: '',
    },
    {
      name: 'Nurture',
      description: 'Long-term nurture contacts.',
      position: 6,
      ast: { type: 'group', op: 'and', nodes: [{ field: 'stage', value: 'Nurture' }] },
      mappingNote: '',
    },
    {
      name: 'Pending',
      description: 'Contacts with a transaction in progress.',
      position: 7,
      ast: { type: 'group', op: 'and', nodes: [{ field: 'stage', value: 'Pending' }] },
      mappingNote: '',
    },
    {
      name: 'Closed',
      description: 'Closed transactions.',
      position: 8,
      ast: { type: 'group', op: 'and', nodes: [{ field: 'stage', value: 'Closed' }] },
      mappingNote: '',
    },
    {
      name: 'Stay In Touch',
      description: 'No activity in the last 90 days.',
      position: 9,
      ast: {
        type: 'group',
        op: 'and',
        nodes: [{ field: 'last_activity', op: 'before', value: ninetyDaysAgo }],
      },
      mappingNote: 'Staleness proxy: last_activity older than 90 days (no dedicated dormancy column).',
    },
    {
      name: 'Email Activity',
      description: 'Recent email engagement.',
      position: 10,
      ast: {
        type: 'group',
        op: 'and',
        nodes: [{ field: 'last_activity', op: 'after', value: thirtyDaysAgo }],
      },
      mappingNote: 'Approximation: last_activity within 30 days (no first-class email-event condition in the AST yet).',
    },
    {
      name: 'IDX Activity',
      description: 'Recent website and search activity.',
      position: 11,
      ast: {
        type: 'group',
        op: 'and',
        nodes: [{ field: 'last_activity', op: 'after', value: thirtyDaysAgo }],
      },
      mappingNote: 'Approximation: last_activity within 30 days (no first-class IDX-event condition in the AST yet).',
    },
  ]
}

/** The 12 seeds with the default (now) window — convenience for non-test callers. */
export const SAVED_VIEW_SEEDS: SavedViewSeed[] = buildSavedViewSeeds()

/** Just the names, in order — used by the seed test against the migration block. */
export const SAVED_VIEW_SEED_NAMES = SAVED_VIEW_SEEDS.map((s) => s.name)
