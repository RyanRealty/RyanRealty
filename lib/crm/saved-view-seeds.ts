/**
 * saved-view-seeds — the canonical Ryan Realty smart lists as CrmSegment ASTs.
 *
 * This is the SINGLE definition of the seeded system views. A migration
 * (supabase/migrations/20260703140000_crm_saved_views_canonical.sql) replaces the
 * system-view set with the same rows; the seed test (saved-view-seeds.test.ts)
 * validates every AST here and checks the migration mirrors this list. Keeping the
 * defs in one PURE module (no Supabase, no server-only) means the migration, the
 * DAL, and the test can never drift.
 *
 * v2 (2026-07-03): after the tag/segment streamline, the lists key on the CANONICAL
 * segment/realtor tags the migration emits (docs/plans/CRM_STREAMLINE_PLAN_V2). Eight
 * workflow lists (each on ONE canonical signal) + four operational lists. Stage
 * navigation (Leads/Nurture/Sphere/Closed) moves to the Stages strip, not a list.
 *
 * Stage keys MUST match crm_stages / lib/crm/constants.ts CRM_STAGES exactly.
 */

import type { CrmSegment } from '@/lib/crm/segment-ast'

export type SavedViewSeed = {
  name: string
  description: string
  position: number
  ast: CrmSegment
  /** When the mapping is an approximation, why. Empty for a clean mapping. */
  mappingNote: string
}

/** A single-tag "has" list. */
const tagList = (value: string): CrmSegment => ({
  type: 'group', op: 'and', nodes: [{ field: 'tag', op: 'has', value }],
})
/** A single-stage list. */
const stageList = (value: string): CrmSegment => ({
  type: 'group', op: 'and', nodes: [{ field: 'stage', value }],
})

/**
 * The canonical smart lists. `now` kept in the signature for API compatibility with
 * the previous date-windowed seeds (unused now — none of the canonical lists are
 * time-based; dormancy is handled by the demote sweep, not a list).
 */
export function buildSavedViewSeeds(_now: Date = new Date()): SavedViewSeed[] {
  return [
    { name: 'Sellers', description: 'Seller prospects (the farm).', position: 0, ast: tagList('segment:seller'), mappingNote: '' },
    { name: 'Buyers', description: 'Active and prospective buyers.', position: 1, ast: tagList('segment:buyer'), mappingNote: '' },
    { name: 'Expired', description: 'Expired listings to recover.', position: 2, ast: tagList('segment:expired'), mappingNote: '' },
    { name: 'FSBO', description: 'For-sale-by-owner leads.', position: 3, ast: tagList('segment:fsbo'), mappingNote: '' },
    { name: 'Out Of Area Home Owners', description: 'Own a local property, mail out of the area.', position: 4, ast: tagList('segment:out-of-area'), mappingNote: '' },
    { name: 'Local Realtors', description: 'Central Oregon agents.', position: 5, ast: tagList('realtor:local'), mappingNote: '' },
    { name: 'Migration Realtors', description: 'Feeder-market referral agents.', position: 6, ast: tagList('realtor:migration'), mappingNote: '' },
    { name: 'Vendors', description: 'Your vendor rolodex.', position: 7, ast: tagList('segment:vendor'), mappingNote: '' },
    { name: 'Active Clients', description: 'Clients under active representation.', position: 8, ast: stageList('Active Client'), mappingNote: '' },
    { name: 'Past Clients', description: 'Closed clients to stay in touch with.', position: 9, ast: stageList('Past Client'), mappingNote: '' },
    { name: 'Pending', description: 'Transactions in progress.', position: 10, ast: stageList('Pending'), mappingNote: '' },
    { name: 'Compliance Blocked', description: 'Do-not-contact / hard stop.', position: 11, ast: tagList('compliance:hard-stop'), mappingNote: '' },
  ]
}

/** The canonical seeds with the default window — convenience for non-test callers. */
export const SAVED_VIEW_SEEDS: SavedViewSeed[] = buildSavedViewSeeds()

/** Just the names, in order — used by the seed test against the migration block. */
export const SAVED_VIEW_SEED_NAMES = SAVED_VIEW_SEEDS.map((s) => s.name)
