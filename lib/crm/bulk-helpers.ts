/**
 * CRM bulk-action helpers — the PURE result/selection types, the protected-tag
 * policy consts + predicate, and the pure selection builder extracted from the
 * 'use server' action module (app/actions/crm-bulk.ts). A 'use server' file may
 * export ONLY async functions, so everything non-async lives here in a plain
 * module the action imports back. No behavior change — verbatim move.
 */

import { type BulkSelection } from '@/lib/crm/bulk-jobs'
import {
  upgradeLegacyFilters,
  validateSegment,
  type LegacyFilters,
} from '@/lib/crm/segment-ast'
import { TAG_CHANNEL } from '@/lib/crm/suppressions'

// ── Result + selection types ─────────────────────────────────────────────────

export type BulkEnqueueResult = { ok: true; jobId: number } | { ok: false; error: string }

/**
 * What the bulk bar + saved-view sidebar send. Either the explicit checkbox id
 * set, "select all matching" the active list filter (which becomes an AST the
 * worker resolves), or a saved VIEW by id (whose stored segment becomes the SAME
 * { ast } shape — so the sidebar's "email/assign/enroll this view" buttons funnel
 * straight into the existing enqueue actions with { mode: 'view', viewId }).
 */
export type BulkActionSelection =
  | { mode: 'ids'; ids: number[] }
  | { mode: 'matching'; filters: LegacyFilters }
  | { mode: 'view'; viewId: number }

/** The bulk job kinds these actions enqueue (1:1 with a worker handler). */
export type BulkKind =
  | 'crm:assign-broker'
  | 'crm:add-tag'
  | 'crm:remove-tag'
  | 'crm:set-stage'
  | 'crm:enroll-workflow'
  | 'crm:set-report-subscription'
  | 'crm:assign-saved-search'
  | 'crm:delete'
  | 'crm:set-source'
  | 'crm:set-timeframe'
  | 'crm:set-lender'
  | 'crm:assign-pond'
  | 'crm:add-collaborator'
  | 'crm:remove-collaborator'
  | 'email-cohort'

// ── Protected-tag policy (PURE, exported for tests) ──────────────────────────

/**
 * The tag prefixes/literals a bulk tag-add, tag-remove, or stage op may NEVER
 * touch. Derived from the SAME TAG_CHANNEL mapping the suppression chokepoint
 * enforces, so this can never drift from what actually suppresses a contact.
 * `broker:` is added because broker assignment is owned by the assign action
 * (it keeps the broker: tag and assigned_broker in lockstep); a stray bulk
 * tag-add/remove of a broker: tag would desync them.
 */
const PROTECTED_TAG_LITERALS: ReadonlySet<string> = new Set(
  TAG_CHANNEL.map((m) => m.tag.toLowerCase()),
)
const PROTECTED_TAG_PREFIXES: readonly string[] = ['broker:', 'compliance:']

/**
 * True when a tag is protected from bulk mutation. PURE. Case-insensitive. A
 * protected tag may only be changed by the dedicated, audited single-record path
 * (suppression lift, broker reassign) — never in a bulk run.
 */
export function isProtectedBulkTag(tag: string): boolean {
  const t = tag.trim().toLowerCase()
  if (!t) return false
  if (PROTECTED_TAG_LITERALS.has(t)) return true
  return PROTECTED_TAG_PREFIXES.some((p) => t.startsWith(p))
}

/** Email-channel suppressing tags — the basis for the send-kind skip estimate. PURE. */
export const EMAIL_SUPPRESS_TAGS: readonly string[] = TAG_CHANNEL.filter(
  (m) => m.channels.includes('all') || m.channels.includes('email'),
).map((m) => m.tag)

// ── Selection building (PURE, exported for tests) ────────────────────────────

/**
 * Turn an ids/matching selection into a frozen BulkSelection for the job row.
 *   - 'ids'      -> { ids: deduped, positive integers }
 *   - 'matching' -> { ast: validated CrmSegment from upgradeLegacyFilters }
 * Throws on an empty/invalid selection so a no-op job is never enqueued. PURE —
 * no I/O, so the worker resolves the AST later under the FROZEN broker scope.
 *
 * 'view' is NOT handled here (it needs a saved-view read); resolveBulkSelection
 * loads the view's segment and funnels it back through this builder. A 'view'
 * passed to the pure builder throws rather than silently producing a no-op.
 */
export function buildBulkSelection(selection: BulkActionSelection): BulkSelection {
  if (selection.mode === 'ids') {
    const ids = Array.from(
      new Set((selection.ids ?? []).filter((n) => Number.isInteger(n) && n > 0)),
    )
    if (ids.length === 0) throw new Error('No contacts selected')
    return { ids }
  }
  if (selection.mode === 'matching') {
    // Upgrade the active list filter onto the one AST shape, validate it, and
    // store { ast }. The worker resolves it to ids under job.broker_scope.
    const ast = upgradeLegacyFilters(selection.filters ?? {})
    validateSegment(ast)
    return { ast }
  }
  // 'view' must be resolved via resolveBulkSelection (it reads the saved view).
  throw new Error('A saved view selection must be resolved before building')
}

// ── Preflight result ─────────────────────────────────────────────────────────

export type BulkPreflightResult =
  | { ok: true; total: number; suppressedEstimate: number }
  | { ok: false; error: string }
