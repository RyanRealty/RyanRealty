/**
 * lib/data/agent/actions.ts — the ONE door the broker SMS agent uses onto
 * public.marketing_brain_actions (G1: no raw `.from('marketing_brain_actions')`
 * outside lib/data/). lib/agent/tools/produce.ts calls only these functions;
 * it never touches Supabase directly.
 *
 * docs/plans/BROKER_SMS_AGENT_2026-07-31.md R2.2/R3.1-R3.4 + Amendment
 * R2.9/R3.6/R3.7. Row lifecycle for a broker-created action:
 *
 *   pending --setInProduction--> in_production --(producer completes)--> ready
 *      ^                                                                     |
 *      |                                                     approveAction  |
 *   needs_changes <--appendChangeRequest-- (revise_action re-reads a job) <--+
 *                                                                            |
 *                                                                       approved
 *                                                                            |
 *                                                             unapproveAction (HOLD)
 *                                                                            v
 *                                                                          ready
 *
 * Ownership: every row this module creates carries `payload.requested_by_slug`
 * (the broker who asked for it) AND `assigned_approver` set to that same
 * slug — the SMS agent never creates a row Matt has to approve on someone
 * else's behalf. Every read/mutation below re-checks ownership before acting,
 * so one broker's SMS thread can never see or touch another's job.
 */
import { createServiceClient } from '@/lib/supabase/service'

/** Statuses a broker's SMS thread cares about — the full active lifecycle
 *  short of 'executed'/'measured'/'killed'. */
export const BROKER_ACTIVE_STATUSES = [
  'pending',
  'in_production',
  'ready',
  'needs_changes',
  'approved',
] as const
export type BrokerActiveStatus = (typeof BROKER_ACTIVE_STATUSES)[number]

/** Source statuses setInProduction may transition FROM. */
const IN_PRODUCTION_SOURCE_STATUSES = ['pending', 'needs_changes'] as const

export interface BrokerJobRow {
  id: string
  actionType: string
  target: string
  status: string
  assignedProducer: string
  generationReason: string | null
  payload: Record<string, unknown>
  executorResponse: Record<string, unknown> | null
  assignedApprover: string
  createdAt: string
}

type RawActionRow = {
  id: string
  action_type: string | null
  target: string | null
  status: string | null
  assigned_producer: string | null
  generation_reason: string | null
  payload: Record<string, unknown> | null
  executor_response: Record<string, unknown> | null
  assigned_approver: string | null
  created_at: string | null
}

const JOB_SELECT =
  'id, action_type, target, status, assigned_producer, generation_reason, payload, executor_response, assigned_approver, created_at'

function rowToBrokerJob(row: RawActionRow): BrokerJobRow {
  return {
    id: String(row.id),
    actionType: row.action_type ?? '',
    target: row.target ?? '',
    status: row.status ?? '',
    assignedProducer: row.assigned_producer ?? '',
    generationReason: row.generation_reason ?? null,
    payload: row.payload ?? {},
    executorResponse: row.executor_response ?? null,
    assignedApprover: row.assigned_approver ?? '',
    createdAt: row.created_at ?? '',
  }
}

export interface CreateActionRowInput {
  topic: string
  format: string
  actionType: string
  target: string
  assignedProducer: string
  payload: Record<string, unknown>
  generatedBy: string
  generationReason: string
  /** Defaults to the DB column default ('matt') when omitted. Broker-initiated
   *  rows MUST pass the requesting broker's slug so self-approval resolves. */
  assignedApprover?: string
}

export type CreateActionRowResult = { ok: true; id: string } | { ok: false; error: string }

/**
 * INSERT one marketing_brain_actions row per the produce-protocol contract
 * (marketing_brain_skills/produce/SKILL.md Step 5): platforms/hook/
 * target_audience/data_sources/predicted_outcome/data_evidence seeded exactly
 * as every other produce-path caller seeds them, status always 'pending'.
 */
export async function createActionRow(input: CreateActionRowInput): Promise<CreateActionRowResult> {
  if (!input.actionType?.trim() || !input.target?.trim() || !input.assignedProducer?.trim()) {
    return { ok: false, error: 'actionType, target, and assignedProducer are required' }
  }
  try {
    const sb = createServiceClient()
    const row: Record<string, unknown> = {
      topic: input.topic || input.target,
      format: input.format || input.actionType.replace(/^content:/, ''),
      platforms: [],
      hook: '',
      body: null,
      cta: null,
      target_audience: 'brand_default',
      data_sources: [],
      predicted_outcome: {},
      status: 'pending',
      generated_by: input.generatedBy,
      generation_reason: input.generationReason,
      action_type: input.actionType,
      target: input.target,
      assigned_producer: input.assignedProducer,
      payload: input.payload ?? {},
      data_evidence: {},
    }
    if (input.assignedApprover?.trim()) row.assigned_approver = input.assignedApprover.trim()

    const { data, error } = await sb.from('marketing_brain_actions').insert(row).select('id').single()
    if (error || !data) return { ok: false, error: error?.message ?? 'insert returned no row' }
    return { ok: true, id: String(data.id) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * A broker's active jobs, oldest first — the stable order behind numbered
 * job handles ("1: CMA Awbrey · 2: IG post Tumalo") everywhere in the agent
 * tool set. Filters on `payload->>requested_by_slug` (never throws; empty
 * slug or a DB error both resolve to an empty list — job_status degrades to
 * "nothing in flight" rather than crashing a conversation turn).
 */
export async function listBrokerJobs(brokerSlug: string): Promise<BrokerJobRow[]> {
  const slug = (brokerSlug ?? '').trim()
  if (!slug) return []
  try {
    const sb = createServiceClient()
    const { data, error } = await sb
      .from('marketing_brain_actions')
      .select(JOB_SELECT)
      .eq('payload->>requested_by_slug', slug)
      .in('status', BROKER_ACTIVE_STATUSES as unknown as string[])
      .order('created_at', { ascending: true })
    if (error || !data) {
      if (error) console.error('[listBrokerJobs]', error.message)
      return []
    }
    return (data as RawActionRow[]).map(rowToBrokerJob)
  } catch (e) {
    console.error('[listBrokerJobs] threw', e)
    return []
  }
}

/**
 * One job, scoped to the broker who asked for it. Returns null for a genuine
 * miss AND for a job that exists but belongs to someone else — the caller
 * cannot distinguish "not found" from "not yours" from the return value,
 * which is deliberate (no cross-broker existence leak).
 */
export async function getActionForBroker(actionId: string, brokerSlug: string): Promise<BrokerJobRow | null> {
  const id = (actionId ?? '').trim()
  const slug = (brokerSlug ?? '').trim()
  if (!id || !slug) return null
  try {
    const sb = createServiceClient()
    const { data, error } = await sb
      .from('marketing_brain_actions')
      .select(JOB_SELECT)
      .eq('id', id)
      .maybeSingle()
    if (error || !data) return null
    const raw = data as RawActionRow
    const owned = raw.payload?.requested_by_slug === slug || raw.assigned_approver === slug
    if (!owned) return null
    return rowToBrokerJob(raw)
  } catch (e) {
    console.error('[getActionForBroker] threw', e)
    return null
  }
}

export type AppendChangeRequestResult = { ok: true } | { ok: false; error: string }

/**
 * Append a broker's free-text feedback as a comment (same shape the approval
 * queue's request_changes verb writes:
 * app/api/admin/approval-queue/[id]/action/route.ts) and flip the row to
 * 'needs_changes'. The caller (revise_action) re-runs the producer
 * immediately after this succeeds — the CHECK constraint accepting
 * 'needs_changes' was fixed live 2026-07-31
 * (20260801050000_marketing_brain_actions_needs_changes_status.sql).
 */
export async function appendChangeRequest(
  actionId: string,
  comment: string,
  opts?: { author?: string },
): Promise<AppendChangeRequestResult> {
  const id = (actionId ?? '').trim()
  const body = (comment ?? '').trim()
  if (!id || !body) return { ok: false, error: 'actionId and comment are required' }
  try {
    const sb = createServiceClient()
    const { data: existing, error: fetchErr } = await sb
      .from('marketing_brain_actions')
      .select('comments')
      .eq('id', id)
      .maybeSingle()
    if (fetchErr || !existing) return { ok: false, error: fetchErr?.message ?? 'row not found' }

    const existingComments = Array.isArray(existing.comments) ? (existing.comments as unknown[]) : []
    const newComment = {
      id: crypto.randomUUID(),
      author: opts?.author ?? 'broker_sms_agent',
      body,
      posted_at: new Date().toISOString(),
      type: 'change_request',
    }

    const { error } = await sb
      .from('marketing_brain_actions')
      .update({
        status: 'needs_changes',
        needs_changes_at: new Date().toISOString(),
        comments: [...existingComments, newComment],
      })
      .eq('id', id)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export interface ApproveActionInput {
  approvedBy: string
  /** Stamped onto the row alongside approved_by — belt-and-braces in case the
   *  row's assigned_approver drifted from who is actually approving it. */
  assignedApprover?: string
}
export type ApproveActionResult =
  | { ok: true }
  | { ok: false; error: string; reason: 'not_ready' | 'db_error' | 'invalid_input' }

/**
 * ready -> approved. Optimistic lock: only fires when the row is STILL
 * 'ready' at update time, so a job that finished executing (or was approved
 * by a concurrent call) fails clean with reason 'not_ready' instead of
 * silently re-approving. §1 amendment 2026-07-31: a literal APPROVE reply
 * from the requesting broker satisfies the publisher's approval gate exactly
 * like Matt's approval-queue approve_now — approved_by is checked by
 * /api/social/publish, not hardcoded to Matt.
 */
export async function approveAction(actionId: string, input: ApproveActionInput): Promise<ApproveActionResult> {
  const id = (actionId ?? '').trim()
  if (!id || !input.approvedBy?.trim()) {
    return { ok: false, error: 'actionId and approvedBy are required', reason: 'invalid_input' }
  }
  try {
    const sb = createServiceClient()
    const update: Record<string, unknown> = {
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: input.approvedBy,
    }
    if (input.assignedApprover?.trim()) update.assigned_approver = input.assignedApprover.trim()

    const { data, error } = await sb
      .from('marketing_brain_actions')
      .update(update)
      .eq('id', id)
      .eq('status', 'ready')
      .select('id')
    if (error) return { ok: false, error: error.message, reason: 'db_error' }
    if (!data || data.length === 0) {
      return {
        ok: false,
        error: 'Row is not in ready status (already approved, still drafting, or not found).',
        reason: 'not_ready',
      }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), reason: 'db_error' }
  }
}

export type UnapproveActionResult = { ok: true } | { ok: false; error: string }

/**
 * approved -> ready. HOLD/CANCEL rollback (edge-case ledger D.5): "wait, hold
 * that" after APPROVE but before the publisher-sweep executes it. Optimistic
 * lock: only fires when the row is STILL 'approved' — a row the sweep already
 * flipped to 'executed' cannot be un-approved (there is nothing left to hold,
 * the post is live).
 */
export async function unapproveAction(actionId: string): Promise<UnapproveActionResult> {
  const id = (actionId ?? '').trim()
  if (!id) return { ok: false, error: 'actionId is required' }
  try {
    const sb = createServiceClient()
    const { data, error } = await sb
      .from('marketing_brain_actions')
      .update({ status: 'ready', approved_by: null, approved_at: null })
      .eq('id', id)
      .eq('status', 'approved')
      .select('id')
    if (error) return { ok: false, error: error.message }
    if (!data || data.length === 0) {
      return { ok: false, error: 'Row is not in approved status (already executed, or not found).' }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export type SetInProductionResult = { ok: true } | { ok: false; error: string }

/**
 * pending|needs_changes -> in_production. Merges `envelope` into the
 * existing executor_response (never overwrites it) so a visual-deferral
 * envelope (buildVisualDeferralEnvelope) layers on top of anything a prior
 * run already wrote. Stamps the same dispatch shape the admin one-shot route
 * writes, tagged for this caller instead of 'queued_by_admin'.
 */
export async function setInProduction(
  actionId: string,
  envelope?: Record<string, unknown>,
): Promise<SetInProductionResult> {
  const id = (actionId ?? '').trim()
  if (!id) return { ok: false, error: 'actionId is required' }
  try {
    const sb = createServiceClient()
    const { data: existing, error: fetchErr } = await sb
      .from('marketing_brain_actions')
      .select('status, executor_response')
      .eq('id', id)
      .maybeSingle()
    if (fetchErr || !existing) return { ok: false, error: fetchErr?.message ?? 'row not found' }

    const fromStatus = existing.status as string
    if (!(IN_PRODUCTION_SOURCE_STATUSES as readonly string[]).includes(fromStatus)) {
      return { ok: false, error: `Row is in status '${fromStatus}'; cannot start production from there.` }
    }

    const queuedAt = new Date().toISOString()
    const mergedEnvelope = {
      ...((existing.executor_response as Record<string, unknown> | null) ?? {}),
      dispatch_status: 'queued_by_broker_sms_agent',
      queued_at: queuedAt,
      ready_for_runtime: true,
      ...(envelope ?? {}),
    }

    const { error } = await sb
      .from('marketing_brain_actions')
      .update({ status: 'in_production', executed_at: queuedAt, executor_response: mergedEnvelope })
      .eq('id', id)
      .eq('status', fromStatus)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
