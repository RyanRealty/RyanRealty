'use server'

/**
 * CRM bulk-action server actions (Wave 3) — the thin enqueue layer the bulk bar
 * calls. Each action mirrors the RBAC + compliance posture of its single-record
 * sibling in app/actions/crm.ts, builds a frozen BulkSelection (an explicit id
 * list OR a filter AST for "select all matching"), stamps the caller's broker
 * scope (FROZEN at enqueue), and hands the job to enqueueBulkJob. The chunked
 * crm-bulk-worker cron then drains it over the full ~18K book without ever
 * timing out a request.
 *
 * WHY enqueue instead of an inline loop: a bulk op can touch thousands of rows;
 * looping inline would blow the request budget and lose progress on a timeout.
 * The job row is the durable, resumable unit of work.
 *
 * COMPLIANCE (the rules these actions enforce at the ENQUEUE boundary; the worker
 * + handlers re-enforce per row at run time, fail-closed):
 *   - assign-broker is an OWNER op — superuser only (mirrors assignCrmBrokerAction).
 *   - bulk tag add/remove + bulk stage REFUSE to touch protected compliance tags
 *     (compliance:hard-stop, do-not-text/call, unsubscribed, ...). A bulk run can
 *     never lift a suppression or stamp a fake consent flag.
 *   - send kinds (email cohort) report a suppression-skip ESTIMATE in preflight so
 *     the UI shows "412 selected, 38 will be skipped" before the job is enqueued;
 *     the worker still isSuppressed-checks every contact at send time.
 *
 * The selection contract (also the contract the bulk bar in Phase B wires to):
 *   BulkActionSelection =
 *     | { mode: 'ids';     ids: number[] }          // an explicit checkbox set
 *     | { mode: 'matching'; filters: LegacyFilters } // "select all matching <filter>"
 * The action upgrades a 'matching' selection to a CrmSegment AST and stores
 * { ast } so the worker resolves it under the FROZEN broker scope at run time.
 *
 * DAL boundary (G1): the only raw .from() read in this file is inside
 * bulkPreflightCount, which compiles the SAME segment the job will run via
 * buildCrmPeopleQuery (the one resolver) under the caller's scope. Mutations never
 * happen here — they happen in the worker's handlers.
 */

import {
  enqueueBulkJob,
  type BulkSelection,
} from '@/lib/crm/bulk-jobs'
import { getCrmAccess, type CrmAccess } from '@/app/actions/crm'
import { scopeBroker } from '@/lib/crm/scope'
import {
  CRM_STAGES,
  CRM_BROKERS,
  type CrmBrokerSlug,
} from '@/lib/crm/constants'
import {
  upgradeLegacyFilters,
  validateSegment,
  type CrmSegment,
  type LegacyFilters,
} from '@/lib/crm/segment-ast'
import { TAG_CHANNEL } from '@/lib/crm/suppressions'
import { buildCrmPeopleQuery } from '@/lib/data/crm/buildCrmPeopleQuery'
import { createServiceClient } from '@/lib/supabase/service'

// ── Result + selection types ─────────────────────────────────────────────────

export type BulkEnqueueResult = { ok: true; jobId: number } | { ok: false; error: string }

/**
 * What the bulk bar sends. Either the explicit checkbox id set, or "select all
 * matching" the active list filter (which becomes an AST the worker resolves).
 */
export type BulkActionSelection =
  | { mode: 'ids'; ids: number[] }
  | { mode: 'matching'; filters: LegacyFilters }

/** The bulk job kinds these actions enqueue (1:1 with a worker handler). */
export type BulkKind =
  | 'crm:assign-broker'
  | 'crm:add-tag'
  | 'crm:remove-tag'
  | 'crm:set-stage'
  | 'crm:enroll-workflow'
  | 'crm:set-report-subscription'
  | 'email-cohort'

/** Kinds that send to a contact — these get a suppression-skip estimate. */
const SEND_KINDS: ReadonlySet<BulkKind> = new Set(['email-cohort', 'crm:enroll-workflow'])

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
 * Turn the bulk bar's selection into a frozen BulkSelection for the job row.
 *   - 'ids'      -> { ids: deduped, positive integers }
 *   - 'matching' -> { ast: validated CrmSegment from upgradeLegacyFilters }
 * Throws on an empty/invalid selection so a no-op job is never enqueued. PURE —
 * no I/O, so the worker resolves the AST later under the FROZEN broker scope.
 */
export function buildBulkSelection(selection: BulkActionSelection): BulkSelection {
  if (selection.mode === 'ids') {
    const ids = Array.from(
      new Set((selection.ids ?? []).filter((n) => Number.isInteger(n) && n > 0)),
    )
    if (ids.length === 0) throw new Error('No contacts selected')
    return { ids }
  }
  // 'matching' — upgrade the active list filter onto the one AST shape, validate
  // it, and store { ast }. The worker resolves it to ids under job.broker_scope.
  const ast = upgradeLegacyFilters(selection.filters ?? {})
  validateSegment(ast)
  return { ast }
}

/** Read the segment out of a built selection (for the preflight count). PURE. */
function selectionToSegment(sel: BulkSelection): CrmSegment | null {
  if ('ast' in sel) return sel.ast as CrmSegment
  return null
}

// ── Shared enqueue path ──────────────────────────────────────────────────────

/**
 * The one enqueue path every action funnels through. Resolves access, applies an
 * optional extra guard (e.g. superuser-only), builds + freezes the selection and
 * broker scope, and enqueues. Returns the new jobId or a stable error.
 */
async function enqueue(
  kind: BulkKind,
  selection: BulkActionSelection,
  params: Record<string, unknown>,
  opts?: { guard?: (access: CrmAccess) => string | null },
): Promise<BulkEnqueueResult> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }

  const guardErr = opts?.guard?.(access)
  if (guardErr) return { ok: false, error: guardErr }

  let built: BulkSelection
  try {
    built = buildBulkSelection(selection)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Invalid selection' }
  }

  // FROZEN at enqueue: the broker the actor is scoped to right now. A later RBAC
  // change can never widen the rows this job targets.
  const brokerScope = scopeBroker(access)

  try {
    const jobId = await enqueueBulkJob({
      kind,
      selection: built,
      params,
      actorEmail: access.email,
      brokerScope,
    })
    return { ok: true, jobId }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not start the bulk job' }
  }
}

// ── Actions ──────────────────────────────────────────────────────────────────

/**
 * Bulk reassign to a broker. OWNER op — superuser only (mirrors
 * assignCrmBrokerAction's elevated guard so no one can bulk-steal leads).
 */
export async function bulkAssignBrokerAction(
  selection: BulkActionSelection,
  broker: string,
): Promise<BulkEnqueueResult> {
  const slug = String(broker ?? '').trim() as CrmBrokerSlug
  if (!(CRM_BROKERS as readonly string[]).includes(slug)) {
    return { ok: false, error: 'Broker required' }
  }
  return enqueue('crm:assign-broker', selection, { brokerSlug: slug }, {
    guard: (access) =>
      scopeBroker(access) !== null
        ? 'Not authorized. Only an owner can reassign contacts'
        : null,
  })
}

/** Bulk add a tag. Refuses protected compliance/broker tags (mirrors addCrmTagAction's intent). */
export async function bulkAddTagAction(
  selection: BulkActionSelection,
  tag: string,
): Promise<BulkEnqueueResult> {
  const t = String(tag ?? '').trim().toLowerCase()
  if (!t || t.length > 80) return { ok: false, error: 'Tag required (max 80 chars)' }
  if (isProtectedBulkTag(t)) {
    return { ok: false, error: 'That tag is protected and cannot be set in bulk' }
  }
  return enqueue('crm:add-tag', selection, { tag: t })
}

/** Bulk remove a tag. Refuses protected tags so a bulk run can never lift a suppression. */
export async function bulkRemoveTagAction(
  selection: BulkActionSelection,
  tag: string,
): Promise<BulkEnqueueResult> {
  const t = String(tag ?? '').trim().toLowerCase()
  if (!t) return { ok: false, error: 'Tag required' }
  if (isProtectedBulkTag(t)) {
    return { ok: false, error: 'That tag is protected and cannot be removed in bulk' }
  }
  return enqueue('crm:remove-tag', selection, { tag: t })
}

/** Bulk set the pipeline stage (mirrors updateCrmStageAction's known-stage guard). */
export async function bulkSetStageAction(
  selection: BulkActionSelection,
  stage: string,
): Promise<BulkEnqueueResult> {
  const s = String(stage ?? '').trim()
  if (!s) return { ok: false, error: 'Stage required' }
  if (!(CRM_STAGES as readonly string[]).includes(s)) return { ok: false, error: 'Unknown stage' }
  return enqueue('crm:set-stage', selection, { stage: s })
}

/**
 * Bulk enroll into a workflow (mirrors manualEnrollPerson). A send kind: the
 * worker honors hard-stop + ENROLLMENT_EPOCH per contact and skips suppressed ones.
 */
export async function bulkEnrollWorkflowAction(
  selection: BulkActionSelection,
  sequenceId: number,
): Promise<BulkEnqueueResult> {
  const id = Number(sequenceId)
  if (!Number.isFinite(id) || id <= 0) return { ok: false, error: 'A workflow is required' }
  return enqueue('crm:enroll-workflow', selection, { sequenceId: id })
}

/**
 * Bulk turn a market-report subscription on/off for the cohort (mirrors
 * setReportSubscriptionAction). Turning ON requires at least one area; the worker
 * upserts per contact. Not a send kind (a preference flip, suppression-gated at
 * actual report delivery), so no skip estimate.
 */
export async function bulkSetReportSubscriptionAction(
  selection: BulkActionSelection,
  input: { areas: string[]; frequency: string; isActive: boolean },
): Promise<BulkEnqueueResult> {
  const isActive = input?.isActive === true
  const areas = Array.isArray(input?.areas) ? input.areas.filter((a) => typeof a === 'string') : []
  if (isActive && areas.length === 0) {
    return { ok: false, error: 'Pick at least one area to turn market reports on' }
  }
  return enqueue('crm:set-report-subscription', selection, {
    areas,
    frequency: String(input?.frequency ?? 'monthly'),
    isActive,
  })
}

/**
 * Bulk email a cohort. THE send kind. The worker isSuppressed-checks every
 * contact at send time and skips suppressed ones; the preflight reports the
 * estimate so the UI warns first. params carries the template / subject the
 * handler renders.
 */
export async function bulkEmailCohortAction(
  selection: BulkActionSelection,
  params: { templateId?: string; subject?: string; body?: string },
): Promise<BulkEnqueueResult> {
  const templateIdRaw = typeof params?.templateId === 'string' ? params.templateId.trim() : ''
  const subject = typeof params?.subject === 'string' ? params.subject.trim() : ''
  const body = typeof params?.body === 'string' ? params.body : ''
  if (!templateIdRaw && !(subject && body)) {
    return { ok: false, error: 'Pick a template, or write a subject and body' }
  }
  // EmailCohortParams.templateId is number|null — coerce from the UI's string input.
  const parsed = templateIdRaw ? parseInt(templateIdRaw, 10) : NaN
  const templateId: number | null = Number.isFinite(parsed) && parsed > 0 ? parsed : null
  return enqueue('email-cohort', selection, { templateId, subject: subject || null, body: body || null })
}

// ── Preflight count ──────────────────────────────────────────────────────────

export type BulkPreflightResult =
  | { ok: true; total: number; suppressedEstimate: number }
  | { ok: false; error: string }

/**
 * Count the affected contacts for a selection BEFORE enqueue, plus a
 * suppression-skip estimate for send kinds, so the bulk bar can show
 * "412 selected, 38 will be skipped".
 *
 * Both counts run under the caller's FROZEN scope via buildCrmPeopleQuery (the one
 * resolver), so an ids-mode selection and a matching-mode selection are counted by
 * the SAME compiler the worker will run — the preview can never disagree with the
 * job. For an ids-mode selection the count is constrained to the explicit id set
 * AND the scope (so a restricted broker's count excludes ids outside their book).
 *
 * The suppression estimate counts contacts in the cohort that carry an
 * email-channel suppressing TAG. It is an ESTIMATE (the worker's per-row
 * isSuppressed also reads crm_suppressions rows + fails closed on an unreadable
 * table), deliberately conservative-but-fast for a synchronous preview.
 */
export async function bulkPreflightCount(
  selection: BulkActionSelection,
  kind: BulkKind,
): Promise<BulkPreflightResult> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }

  let built: BulkSelection
  try {
    built = buildBulkSelection(selection)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Invalid selection' }
  }

  const brokerScope = scopeBroker(access)
  const sb = createServiceClient()
  const segment = selectionToSegment(built)
  const explicitIds = 'ids' in built ? built.ids : null

  try {
    // Total: compile the segment (or an empty "everyone" segment for ids-mode)
    // under scope, then for ids-mode constrain to the explicit id set.
    const totalSeg: CrmSegment = segment ?? { type: 'group', op: 'and', nodes: [] }
    let totalQuery = buildCrmPeopleQuery(sb, totalSeg, brokerScope, { countOnly: true }).query
    if (explicitIds) totalQuery = totalQuery.in('id', explicitIds)
    const { count: total, error: totalErr } = await totalQuery
    if (totalErr) return { ok: false, error: totalErr.message }

    let suppressedEstimate = 0
    if (SEND_KINDS.has(kind)) {
      // Same cohort, additionally filtered to contacts carrying an email-channel
      // suppressing tag (tags && {do_not_email,unsubscribed,...,compliance:hard-stop}).
      let suppQuery = buildCrmPeopleQuery(sb, totalSeg, brokerScope, { countOnly: true }).query
      if (explicitIds) suppQuery = suppQuery.in('id', explicitIds)
      suppQuery = suppQuery.overlaps('tags', EMAIL_SUPPRESS_TAGS as string[])
      const { count: supp, error: suppErr } = await suppQuery
      if (suppErr) return { ok: false, error: suppErr.message }
      suppressedEstimate = supp ?? 0
    }

    return { ok: true, total: total ?? 0, suppressedEstimate }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not count the selection' }
  }
}
