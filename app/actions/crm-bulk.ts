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
 * The selection contract (also the contract the bulk bar + saved-view sidebar
 * wire to):
 *   BulkActionSelection =
 *     | { mode: 'ids';     ids: number[] }          // an explicit checkbox set
 *     | { mode: 'matching'; filters: LegacyFilters } // "select all matching <filter>"
 *     | { mode: 'view';    viewId: number }          // "email/assign/enroll this saved view"
 * The action upgrades a 'matching' selection to a CrmSegment AST and stores
 * { ast }; a 'view' selection LOADS the saved view's segment and ALSO stores
 * { ast } — so a saved-view audience and a matching audience resolve through the
 * EXACT same worker path. The worker is never changed: it only ever sees an
 * { ids } or { ast } job.
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
  validateSegment,
  type CrmSegment,
} from '@/lib/crm/segment-ast'
import { getSavedViewSegment } from '@/lib/data/crm/getSavedViewSegment'
import { buildCrmPeopleQuery } from '@/lib/data/crm/buildCrmPeopleQuery'
import { resolveAudienceIds } from '@/lib/crm/audience'
import { createServiceClient } from '@/lib/supabase/service'
import {
  buildBulkSelection,
  isProtectedBulkTag,
  EMAIL_SUPPRESS_TAGS,
  type BulkEnqueueResult,
  type BulkActionSelection,
  type BulkKind,
  type BulkPreflightResult,
} from '@/lib/crm/bulk-helpers'

/** Kinds that send to a contact — these get a suppression-skip estimate. */
const SEND_KINDS: ReadonlySet<BulkKind> = new Set(['email-cohort', 'crm:enroll-workflow'])

/**
 * Resolve ANY selection (including a saved view) to a frozen BulkSelection.
 *
 * For 'view' it loads the saved view's stored segment (prefers the native `ast`
 * column, falls back to upgrading the legacy `filter` bag via savedViewToSegment),
 * validates it, and stores { ast } on the job — so the worker resolves a
 * saved-view audience through the EXACT same { ast } path as a matching audience.
 * The view is NOT inlined to an id list at enqueue time: storing { ast } keeps the
 * audience live + scope-clamped at run time, identical to "select all matching".
 *
 * For 'ids', when a brokerScope is supplied (the enqueue path always supplies it)
 * the explicit id set is routed through resolveAudienceIds, which intersects the
 * ids with the caller's book via buildCrmPeopleQuery's scope clamp. So a stored
 * ids-mode job is PRE-CLAMPED at enqueue: a restricted broker can never freeze a
 * foreign id onto a job, even by hand-passing a list of ids outside their scope.
 * When no scope is supplied (the pure preflight path with its own clamp), ids pass
 * through the pure builder unchanged.
 *
 * 'matching' passes straight through the pure builder.
 */
export async function resolveBulkSelection(
  selection: BulkActionSelection,
  brokerScope?: string | null,
): Promise<BulkSelection> {
  if (selection.mode === 'view') {
    const viewId = Number(selection.viewId)
    if (!Number.isFinite(viewId) || viewId <= 0) throw new Error('A saved view is required')
    // getSavedViewSegment owns the raw crm_saved_views read (DAL boundary) and
    // recovers the segment (ast column, else upgraded legacy filter). Storing the
    // resolved { ast } keeps the worker resolving a view exactly like a matching
    // selection (it never sees a viewId).
    const ast = await getSavedViewSegment(viewId)
    if (!ast) throw new Error('That saved view no longer exists')
    validateSegment(ast)
    return { ast }
  }
  // ids-mode at enqueue: pre-clamp the explicit set to the caller's book so the
  // FROZEN job can never carry a foreign id. resolveAudienceIds compiles an
  // "everyone" segment under scope and intersects with the ids (the worker's
  // defensive re-clamp catches anything that slips through later).
  if (selection.mode === 'ids' && brokerScope !== undefined) {
    const ids = Array.from(
      new Set((selection.ids ?? []).filter((n) => Number.isInteger(n) && n > 0)),
    )
    if (ids.length === 0) throw new Error('No contacts selected')
    const sb = createServiceClient()
    const clamped = await resolveAudienceIds(sb, { ids }, brokerScope)
    if (clamped.length === 0) {
      throw new Error('No contacts in your book match that selection')
    }
    return { ids: clamped }
  }
  return buildBulkSelection(selection)
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

  // FROZEN at enqueue: the broker the actor is scoped to right now. A later RBAC
  // change can never widen the rows this job targets. Resolved BEFORE the
  // selection so an ids-mode set is pre-clamped to this book at enqueue.
  const brokerScope = scopeBroker(access)

  let built: BulkSelection
  try {
    built = await resolveBulkSelection(selection, brokerScope)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Invalid selection' }
  }

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

/**
 * Count the affected contacts for a selection BEFORE enqueue, plus a
 * suppression-skip estimate for send kinds, so the bulk bar can show
 * "412 selected, 38 will be skipped".
 *
 * Both counts run under the caller's FROZEN scope via buildCrmPeopleQuery (the one
 * resolver), so an ids-mode, matching-mode, and view-mode selection are counted by
 * the SAME compiler the worker will run, and the preview can never disagree with
 * the job. A view-mode selection resolves to its stored { ast } first
 * (resolveBulkSelection), so "email this saved view" previews the exact cohort the
 * job will touch. For an ids-mode selection the count is constrained to the
 * explicit id set AND the scope (so a restricted broker's count excludes ids
 * outside their book).
 *
 * The suppression estimate counts contacts in the cohort that carry an
 * email-channel suppressing TAG. It is an ESTIMATE (the worker's per-row
 * isSuppressed also reads crm_suppressions rows + fails closed on an unreadable
 * table), deliberately conservative-but-fast for a synchronous preview.
 */
/**
 * Soft-delete a selection of contacts (sets deleted=true so they vanish from all
 * lists). Owner-only: only a superuser (no broker scope restriction) may delete.
 */
export async function bulkDeleteAction(
  selection: BulkActionSelection,
): Promise<BulkEnqueueResult> {
  return enqueue('crm:delete', selection, {}, {
    guard: (access) =>
      scopeBroker(access) !== null
        ? 'Not authorized. Only an owner can delete contacts in bulk'
        : null,
  })
}

// ── §14.3 mass actions (05-people-list spec) ─────────────────────────────────
// Per the FUB architectural rule replicated in §14.3, none of these fire
// automation triggers — the handlers are plain column/junction updates + audit
// rows and never touch the automation-rule engine.

/** Bulk change the lead source (§14.3 #2 Update Source). */
export async function bulkSetSourceAction(
  selection: BulkActionSelection,
  source: string,
): Promise<BulkEnqueueResult> {
  const s = String(source ?? '').trim()
  if (!s || s.length > 100) return { ok: false, error: 'Source required (max 100 chars)' }
  return enqueue('crm:set-source', selection, { source: s })
}

/** Bulk set the Timeframe field (§14.3 #10 Update Timeframe). */
export async function bulkSetTimeframeAction(
  selection: BulkActionSelection,
  timeframe: string,
): Promise<BulkEnqueueResult> {
  const t = String(timeframe ?? '').trim()
  if (!t) return { ok: false, error: 'Timeframe required' }
  return enqueue('crm:set-timeframe', selection, { timeframe: t })
}

/** Bulk assign a lender (§14.3 #5 Assign Lender — crm_people.lender_name). */
export async function bulkSetLenderAction(
  selection: BulkActionSelection,
  lender: string,
): Promise<BulkEnqueueResult> {
  const l = String(lender ?? '').trim()
  if (!l || l.length > 120) return { ok: false, error: 'Lender name required (max 120 chars)' }
  return enqueue('crm:set-lender', selection, { lender: l })
}

/** Bulk assign to a pond (§14.3 #4 Assign Ponds). */
export async function bulkAssignPondAction(
  selection: BulkActionSelection,
  pondId: number,
): Promise<BulkEnqueueResult> {
  const id = Number(pondId)
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'A pond is required' }
  return enqueue('crm:assign-pond', selection, { pondId: id })
}

/** Bulk add a collaborator (§14.3 #6 Add Collaborators). */
export async function bulkAddCollaboratorAction(
  selection: BulkActionSelection,
  broker: string,
): Promise<BulkEnqueueResult> {
  const slug = String(broker ?? '').trim().toLowerCase()
  if (!(CRM_BROKERS as readonly string[]).includes(slug)) return { ok: false, error: 'Broker required' }
  return enqueue('crm:add-collaborator', selection, { brokerSlug: slug })
}

/** Bulk remove a collaborator (§14.3 #7 Remove Collaborators). */
export async function bulkRemoveCollaboratorAction(
  selection: BulkActionSelection,
  broker: string,
): Promise<BulkEnqueueResult> {
  const slug = String(broker ?? '').trim().toLowerCase()
  if (!(CRM_BROKERS as readonly string[]).includes(slug)) return { ok: false, error: 'Broker required' }
  return enqueue('crm:remove-collaborator', selection, { brokerSlug: slug })
}

export async function bulkPreflightCount(
  selection: BulkActionSelection,
  kind: BulkKind,
): Promise<BulkPreflightResult> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }

  let built: BulkSelection
  try {
    built = await resolveBulkSelection(selection)
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
