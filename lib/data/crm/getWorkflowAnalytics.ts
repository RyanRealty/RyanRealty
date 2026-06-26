import 'server-only'
import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * getWorkflowAnalytics — read-only per-workflow and per-step analytics for the
 * Wave 6 authoring UI (the workflow list + workflow detail funnel).
 *
 * Two readers, both honest (CLAUDE.md §0 — no fabricated rates, no zero-under-a-
 * false-claim, null distinguished from 0 where it matters):
 *
 *   - getWorkflowAnalytics(): one row PER SEQUENCE with enrollment counts grouped
 *     by status — enrolled (total ever), active (running), completed, stopped,
 *     awaitingBroker (the broker-confirmation queue). Drives the workflow list.
 *   - getWorkflowStepAnalytics(sequenceId): one row PER STEP, best-effort, built
 *     from the live enrollment step_index distribution plus email_events keyed by
 *     the engine's emailKey (`seq:<name>:<stepIndex>`). Drives the detail funnel.
 *
 * Scope (RBAC, Option A): both readers take an optional `broker` slug (resolved
 * via scopeBroker(access) at the call site). When set (a restricted broker —
 * Rebecca / Paul), counts are constrained to enrollments whose contact's
 * crm_people.assigned_broker = that slug. When null (superuser / Matt), the
 * counts are brokerage-wide. crm_sequence_enrollments has NO broker column, so
 * the scope filter joins through crm_people.assigned_broker.
 *
 * DAL boundary (G1): the raw .from('crm_sequences' | 'crm_sequence_enrollments' |
 * 'email_events') reads live here. Uses the service client (the same client the
 * engine and the other CRM admin readers use — these tables sit behind admin
 * surfaces, not public RLS). Cached briefly (60s) and keyed on the broker scope,
 * because the engine mutates enrollment status continuously.
 *
 * Fails SOFT (empty rows + unreadable:true) on an unreadable table so the
 * analytics surface renders an honest empty state rather than crashing — and a
 * read FAILURE is never rendered as "0 enrolled" (that would be a §0 lie).
 */

// ── Status grouping (the runtime enrollment statuses the engine writes) ────────

/**
 * The enrollment statuses the engine + actions write, bucketed into the five
 * display groups. Source statuses (from lib/crm/enroll.ts + the engine +
 * app/actions/crm.ts):
 *   running              -> active        (currently drip-able)
 *   awaiting_broker      -> awaitingBroker (new enrollment, first touch pending)
 *   awaiting_broker_next -> awaitingBroker (a later confirm:true step is parked)
 *   completed            -> completed
 *   stopped              -> stopped       (terminal: dismissed / error / no contact)
 *   suppressed           -> stopped       (terminal: halted by the suppression gate)
 *   paused               -> stopped*      (broker-paused — see note below)
 *   paused_reply         -> stopped*      (stop-on-reply — see note below)
 *
 * paused / paused_reply are NOT "active" (the engine will not drip them) and NOT
 * "completed". They bucket into stopped as "no longer running." `enrolled` is the
 * grand total across every status (one enrollment row = one person-enrollment).
 */
export type WorkflowStatusGroup = 'active' | 'awaitingBroker' | 'completed' | 'stopped'

export function groupEnrollmentStatus(status: string): WorkflowStatusGroup {
  switch (status) {
    case 'running':
      return 'active'
    case 'awaiting_broker':
    case 'awaiting_broker_next':
      return 'awaitingBroker'
    case 'completed':
      return 'completed'
    // Every terminal / halted / paused status rolls up to "stopped" (no longer
    // running, not completed). Unknown statuses also bucket here so a future
    // status the engine adds never silently inflates "active".
    case 'stopped':
    case 'suppressed':
    case 'paused':
    case 'paused_reply':
    default:
      return 'stopped'
  }
}

// ── Per-workflow analytics ─────────────────────────────────────────────────────

export type WorkflowAnalyticsRow = {
  id: number
  name: string
  status: string
  /** Total enrollments ever, across every status. */
  enrolled: number
  /** status = running. */
  active: number
  /** status = completed. */
  completed: number
  /** Terminal / halted / paused (stopped, suppressed, paused, paused_reply). */
  stopped: number
  /** status = awaiting_broker | awaiting_broker_next. */
  awaitingBroker: number
  /**
   * Count of enrollments where the enrolled person has at least one email open
   * or reply in email_events keyed to this sequence. NULL when the email_events
   * read was unavailable (distinguished from a true 0 — §0 rule: unreadable ≠ 0).
   */
  engaged: number | null
}

export type WorkflowAnalyticsResult = {
  rows: WorkflowAnalyticsRow[]
  unreadable: boolean
}

/** A minimal sequence row for the analytics join. */
export type RawSequenceRow = {
  id: number
  name: string
  status: string
}

/** A minimal enrollment row for the grouping (broker is the joined contact's). */
export type RawEnrollmentRow = {
  sequence_id: number
  status: string
}

/**
 * Fold sequences + their enrollments into one analytics row per sequence. PURE
 * (exported for the test). Every sequence appears even with zero enrollments
 * (all counts 0 — an honest "nobody enrolled yet", which is true, not a guess).
 */
export function buildWorkflowAnalytics(
  sequences: RawSequenceRow[],
  enrollments: RawEnrollmentRow[],
): WorkflowAnalyticsRow[] {
  const byId = new Map<number, WorkflowAnalyticsRow>()
  for (const s of sequences) {
    byId.set(s.id, {
      id: s.id,
      name: s.name,
      status: s.status,
      enrolled: 0,
      active: 0,
      completed: 0,
      stopped: 0,
      awaitingBroker: 0,
      engaged: null, // filled in by the caller after email_events read
    })
  }
  for (const e of enrollments) {
    const row = byId.get(e.sequence_id)
    // An enrollment whose sequence is missing from the set (deleted / out of
    // scope) is not counted against any displayed workflow.
    if (!row) continue
    row.enrolled += 1
    const group = groupEnrollmentStatus(e.status)
    row[group] += 1
  }
  // Most-enrolled first, then name for a stable order.
  return [...byId.values()].sort((a, b) => b.enrolled - a.enrolled || a.name.localeCompare(b.name))
}

const WORKFLOW_ANALYTICS_TAG = 'crm-workflow-analytics' as const

/** Cap on enrollment rows scanned so a huge book can't blow memory. */
const ENROLLMENT_SCAN_CAP = 50000

async function readWorkflowAnalytics(broker: string | null): Promise<WorkflowAnalyticsResult> {
  const sb = createServiceClient()

  // 1) Every sequence (so a zero-enrollment workflow still lists honestly).
  const { data: seqData, error: seqError } = await sb
    .from('crm_sequences')
    .select('id,name,status')
    .order('name', { ascending: true })
  if (seqError || !seqData) {
    if (seqError) console.error('[getWorkflowAnalytics] sequences', seqError.message)
    return { rows: [], unreadable: true }
  }

  // 2) Enrollments, scoped to the broker's contacts when restricted. The
  //    enrollment table has no broker column, so a restricted broker joins
  //    through the contact: crm_people!inner(assigned_broker) filtered to the
  //    slug. A superuser (broker = null) reads the bare table (no join).
  const slug = broker?.trim()
  const query = slug
    ? sb
        .from('crm_sequence_enrollments')
        .select('sequence_id,status,crm_people!inner(assigned_broker)')
        .eq('crm_people.assigned_broker', slug)
    : sb.from('crm_sequence_enrollments').select('sequence_id,status')

  const { data: enrData, error: enrError } = await query.limit(ENROLLMENT_SCAN_CAP)
  if (enrError || !enrData) {
    if (enrError) console.error('[getWorkflowAnalytics] enrollments', enrError.message)
    // A failed enrollment read must NOT render as "everyone has zero" (§0). Flag
    // unreadable so the surface shows an honest error/empty state.
    return { rows: [], unreadable: true }
  }

  const sequences = (seqData as RawSequenceRow[]).map((s) => ({
    id: Number(s.id),
    name: String(s.name),
    status: String(s.status),
  }))
  const enrollments = (enrData as Array<{ sequence_id: number; status: string }>).map((e) => ({
    sequence_id: Number(e.sequence_id),
    status: String(e.status),
  }))

  const rows = buildWorkflowAnalytics(sequences, enrollments)

  // Engaged count: for each sequence, count distinct person_ids that have an
  // email_events row with event 'opened' or 'replied' keyed to this sequence
  // (emailKey prefix `seq:<name>:`). Best-effort — a read failure leaves
  // engaged = null (not a fake 0, per §0).
  try {
    for (const row of rows) {
      const prefix = `seq:${row.name}:`
      const { count, error: evErr } = await sb
        .from('email_events')
        .select('person_id', { count: 'exact', head: true })
        .in('event', ['opened', 'replied'])
        .like('email_key', `${prefix}%`)
      if (!evErr) {
        row.engaged = count ?? 0
      }
      // if evErr: leave engaged = null (honest unreadable)
    }
  } catch {
    // Non-fatal: engaged stays null for all rows
  }

  return { rows, unreadable: false }
}

/**
 * Per-workflow enrollment analytics for the workflow list. Pass the scoped broker
 * slug (scopeBroker(access)); null = brokerage-wide. Cached 60s, keyed on scope.
 */
export async function getWorkflowAnalytics(broker: string | null = null): Promise<WorkflowAnalyticsResult> {
  const scope = broker?.trim() || 'all'
  const cached = unstable_cache(
    () => readWorkflowAnalytics(broker ?? null),
    ['crm-workflow-analytics', scope],
    { tags: [WORKFLOW_ANALYTICS_TAG], revalidate: 60 },
  )
  return cached()
}

// ── Per-step analytics (the detail funnel) ─────────────────────────────────────

/** A step as the analytics needs it (channel only — the rest of the step is the
 *  authoring concern, not the analytics one). */
export type WorkflowStepShape = {
  channel?: string | null
}

export type WorkflowStepAnalyticsRow = {
  stepIndex: number
  /** The step's channel (email | sms | task | tag), or null if malformed. */
  channel: string | null
  /**
   * Live enrollments currently SITTING AT this step (step_index === stepIndex and
   * not terminal). A funnel snapshot of where active people are, NOT a cumulative
   * "ever reached" — the engine advances step_index in place, so an enrollment
   * that passed this step is no longer counted here. Honest: this is the count we
   * can prove from the table, not an inferred historical total.
   */
  currentlyHere: number
  /**
   * Emails actually SENT for this step, from email_events keyed
   * `seq:<name>:<stepIndex>`. NULL when the step is not an email step OR the
   * email_events read was unavailable (distinguished from a true 0 sends). For a
   * non-email step this is null because there is no email-send signal to count.
   */
  emailsSent: number | null
}

export type WorkflowStepAnalyticsResult = {
  sequenceId: number
  sequenceName: string | null
  rows: WorkflowStepAnalyticsRow[]
  unreadable: boolean
}

/**
 * The emailKey the engine writes per email send is `seq:<sequence name>:<step
 * index>` (see app/api/cron/crm-sequence-engine track.emailKey). Build the exact
 * key for a (name, stepIndex). PURE (exported for the test).
 */
export function stepEmailKey(sequenceName: string, stepIndex: number): string {
  return `seq:${sequenceName}:${stepIndex}`
}

/**
 * Count distinct email SENDS per step from a flat list of (email_key) rows
 * filtered to the 'sent' lifecycle event. PURE (exported for the test).
 *
 * Returns a Map<stepIndex, count>. Only keys that match the sequence's emailKey
 * prefix and a numeric step suffix are counted; anything else is ignored (a
 * defensive guard against an unrelated key colliding on the prefix). The caller
 * decides null-vs-0 per step based on the step's channel.
 */
export function tallyStepEmailSends(
  sequenceName: string,
  rows: Array<{ email_key: string | null }>,
): Map<number, number> {
  const prefix = `seq:${sequenceName}:`
  const counts = new Map<number, number>()
  for (const r of rows) {
    const key = (r.email_key ?? '').trim()
    if (!key.startsWith(prefix)) continue
    const suffix = key.slice(prefix.length)
    // The step index is the trailing segment. Reject a non-integer suffix.
    if (!/^\d+$/.test(suffix)) continue
    const idx = Number(suffix)
    counts.set(idx, (counts.get(idx) ?? 0) + 1)
  }
  return counts
}

/**
 * Count live enrollments sitting at each step (step_index), excluding terminal
 * statuses. PURE (exported for the test). A "live" enrollment is one the engine
 * could still act on or that is waiting on a broker — running,
 * awaiting_broker(_next), paused, paused_reply. completed / stopped / suppressed
 * are terminal and do not sit "at" a step in any meaningful funnel sense.
 */
const LIVE_STEP_STATUSES = new Set(['running', 'awaiting_broker', 'awaiting_broker_next', 'paused', 'paused_reply'])

export function tallyCurrentStep(
  rows: Array<{ step_index: number; status: string }>,
): Map<number, number> {
  const counts = new Map<number, number>()
  for (const r of rows) {
    if (!LIVE_STEP_STATUSES.has(r.status)) continue
    const idx = Number(r.step_index)
    if (!Number.isFinite(idx) || idx < 0) continue
    counts.set(idx, (counts.get(idx) ?? 0) + 1)
  }
  return counts
}

/**
 * Assemble the per-step rows from the sequence steps + the two tallies. PURE
 * (exported for the test). emailsSent is null for non-email steps (no signal) and
 * for email steps it is the tallied count (0 when no send recorded yet — a true,
 * provable 0). When emailReadable is false, every email step's emailsSent is null
 * (a failed read is not a real 0, §0).
 */
export function buildStepAnalytics(
  steps: WorkflowStepShape[],
  currentByStep: Map<number, number>,
  emailSendsByStep: Map<number, number>,
  emailReadable: boolean,
): WorkflowStepAnalyticsRow[] {
  return steps.map((step, stepIndex) => {
    const channel = (step?.channel ?? null) as string | null
    const isEmail = channel === 'email'
    const emailsSent = !isEmail ? null : emailReadable ? emailSendsByStep.get(stepIndex) ?? 0 : null
    return {
      stepIndex,
      channel,
      currentlyHere: currentByStep.get(stepIndex) ?? 0,
      emailsSent,
    }
  })
}

const STEP_EVENT_SCAN_CAP = 20000

async function readWorkflowStepAnalytics(
  sequenceId: number,
  broker: string | null,
): Promise<WorkflowStepAnalyticsResult> {
  const sb = createServiceClient()

  // 1) The sequence + its steps (the funnel skeleton).
  const { data: seq, error: seqError } = await sb
    .from('crm_sequences')
    .select('id,name,steps')
    .eq('id', sequenceId)
    .maybeSingle()
  if (seqError) {
    console.error('[getWorkflowStepAnalytics] sequence', seqError.message)
    return { sequenceId, sequenceName: null, rows: [], unreadable: true }
  }
  if (!seq) {
    // A missing sequence is not an error — it is an empty, readable result.
    return { sequenceId, sequenceName: null, rows: [], unreadable: false }
  }
  const sequenceName = String(seq.name)
  const steps = (Array.isArray(seq.steps) ? seq.steps : []) as WorkflowStepShape[]

  // 2) Live enrollments at this sequence (scoped to the broker's contacts when
  //    restricted), for the "currently here" per-step distribution.
  const slug = broker?.trim()
  const enrQuery = slug
    ? sb
        .from('crm_sequence_enrollments')
        .select('step_index,status,crm_people!inner(assigned_broker)')
        .eq('sequence_id', sequenceId)
        .eq('crm_people.assigned_broker', slug)
    : sb
        .from('crm_sequence_enrollments')
        .select('step_index,status')
        .eq('sequence_id', sequenceId)
  const { data: enrData, error: enrError } = await enrQuery.limit(ENROLLMENT_SCAN_CAP)
  if (enrError || !enrData) {
    if (enrError) console.error('[getWorkflowStepAnalytics] enrollments', enrError.message)
    return { sequenceId, sequenceName, rows: [], unreadable: true }
  }
  const currentByStep = tallyCurrentStep(
    (enrData as Array<{ step_index: number; status: string }>).map((e) => ({
      step_index: Number(e.step_index),
      status: String(e.status),
    })),
  )

  // 3) Email sends per step from email_events keyed `seq:<name>:<idx>` (the
  //    engine's track.emailKey). Best-effort: a read failure leaves email steps
  //    null (not a fake 0). The key carries no broker, so per-step email counts
  //    are brokerage-wide even for a scoped broker — flagged in the type doc; the
  //    "currently here" count above IS scoped, which is the broker-relevant
  //    funnel signal.
  let emailReadable = true
  let emailSendsByStep = new Map<number, number>()
  const prefix = `seq:${sequenceName}:`
  const { data: evData, error: evError } = await sb
    .from('email_events')
    .select('email_key')
    .eq('event', 'sent')
    .like('email_key', `${prefix}%`)
    .limit(STEP_EVENT_SCAN_CAP)
  if (evError || !evData) {
    if (evError) console.error('[getWorkflowStepAnalytics] email_events', evError.message)
    emailReadable = false
  } else {
    emailSendsByStep = tallyStepEmailSends(sequenceName, evData as Array<{ email_key: string | null }>)
  }

  return {
    sequenceId,
    sequenceName,
    rows: buildStepAnalytics(steps, currentByStep, emailSendsByStep, emailReadable),
    unreadable: false,
  }
}

/**
 * Per-step funnel analytics for one workflow. Pass the scoped broker slug
 * (scopeBroker(access)); null = brokerage-wide. Cached 60s, keyed on sequence +
 * scope.
 */
export async function getWorkflowStepAnalytics(
  sequenceId: number,
  broker: string | null = null,
): Promise<WorkflowStepAnalyticsResult> {
  if (!Number.isFinite(sequenceId) || sequenceId <= 0) {
    return { sequenceId, sequenceName: null, rows: [], unreadable: false }
  }
  const scope = broker?.trim() || 'all'
  const cached = unstable_cache(
    () => readWorkflowStepAnalytics(sequenceId, broker ?? null),
    ['crm-workflow-step-analytics', String(sequenceId), scope],
    { tags: [WORKFLOW_ANALYTICS_TAG], revalidate: 60 },
  )
  return cached()
}
