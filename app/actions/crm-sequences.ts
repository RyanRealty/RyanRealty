'use server'

/**
 * Workflow (sequence) LIFECYCLE CRUD — the authoring half of Wave 6.
 *
 * The EXECUTION engine (app/api/cron/crm-sequence-engine) and the activate /
 * pause toggle (setCrmSequenceStatusAction in app/actions/crm.ts) already
 * exist. This module adds the build-time operations the authoring UI calls:
 * create, duplicate, archive (soft), delete (guarded), settings edit, and the
 * step rewrite.
 *
 * Contract: every step written to crm_sequences.steps passes parseSteps
 * (lib/crm/sequence-step-schema) — the SAME schema the engine reads. A
 * malformed step never reaches the steps jsonb.
 *
 * Safety:
 *  - All actions are access-guarded (requireCrmAccess) and return
 *    { ok: true } | { ok: false; error } — never throw to the caller.
 *  - archive is SOFT (status='archived') — an enrolled sequence is never
 *    hard-deleted out from under its enrollments.
 *  - delete REFUSES when the sequence has live enrollments (running /
 *    paused_reply) or is wired as an auto-enroll master (fub_legacy_plan_id),
 *    so enrollments are never orphaned.
 *  - updateSteps validates that every templateKey resolves to a LIVE template
 *    before writing.
 *
 * DAL note: these are mutations, so the raw .from() writes live here in the
 * action (the DAL boundary keeps READS in lib/data/). The reads inside a
 * mutation guard (enrollment count, template existence) are part of the write
 * transaction and stay co-located with it.
 */

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { requireCrmAccess, type CrmActionResult } from '@/app/actions/crm'
import { getCrmTemplatesAdmin } from '@/lib/data/crm/getCrmTemplatesAdmin'
import { parseSteps, parseSequenceTriggers, isConditionNode, type Step, type AnyStepOrCondition, type SequenceTrigger } from '@/lib/crm/sequence-step-schema'

/** Enrollment statuses that count as LIVE (the unique active index treats both
 *  as occupying the person+sequence slot). A delete must refuse while any of
 *  these exist; archive is the safe alternative. */
const LIVE_ENROLLMENT_STATUSES = ['running', 'paused_reply'] as const

/**
 * Authoring a workflow is an OWNER operation. A sequence drives automated
 * outbound across every enrolled contact (including other brokers' leads), so
 * create / duplicate / archive / delete / step-rewrite / settings-edit are all
 * superuser-gated. A restricted broker is refused. Returns the standard result
 * shape so callers keep their early-return on !ok.
 */
async function requireSuperuser(): Promise<
  { ok: true; brokerSlug: string | null } | { ok: false; error: string }
> {
  const access = await requireCrmAccess()
  if (!access.ok) return access
  if (access.access.role !== 'superuser') {
    return { ok: false, error: 'Not authorized. Only an owner can manage workflows.' }
  }
  return { ok: true, brokerSlug: access.access.brokerSlug ?? null }
}

/** Revalidate every surface that renders workflows. */
function revalidateWorkflows(id?: number): void {
  revalidatePath('/admin/crm/sequences')
  if (id) revalidatePath(`/admin/crm/sequences/${id}`)
}

/**
 * Validate a steps payload: shape (parseSteps) THEN that every templateKey
 * resolves to a live (is_active) template. Returns the parsed steps or an error
 * string. Pure-ish: only reads the cached template admin list.
 */
async function validateStepsWithTemplates(
  raw: unknown,
): Promise<{ ok: true; steps: AnyStepOrCondition[] } | { ok: false; error: string }> {
  let steps: AnyStepOrCondition[]
  try {
    steps = parseSteps(raw)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'invalid steps'
    return { ok: false, error: `Step validation failed. ${msg}` }
  }

  const usedKeys = [...new Set(
    steps
      .filter((s): s is Step => !isConditionNode(s))
      .map((s) => s.templateKey)
      .filter((k): k is string => !!k)
  )]
  if (usedKeys.length) {
    const templates = await getCrmTemplatesAdmin()
    const liveKeys = new Set(templates.filter((t) => t.isActive).map((t) => t.key))
    const missing = usedKeys.filter((k) => !liveKeys.has(k))
    if (missing.length) {
      return { ok: false, error: `Unknown or inactive template: ${missing.join(', ')}` }
    }
  }
  return { ok: true, steps }
}

// ── Create ──────────────────────────────────────────────────────────────────

/**
 * Create a new workflow. Always starts PAUSED (status default) so nothing
 * fires until a human activates it. Steps are optional (a shell to fill in) and
 * validated when present.
 */
export async function createCrmSequenceAction(input: {
  name: string
  description?: string | null
  steps?: unknown
  stopOnReply?: boolean
}): Promise<(CrmActionResult & { id?: number })> {
  const guard = await requireSuperuser()
  if (!guard.ok) return guard

  const name = (input.name ?? '').trim()
  if (!name) return { ok: false, error: 'Name is required' }

  let steps: AnyStepOrCondition[] = []
  if (input.steps !== undefined && input.steps !== null) {
    const validated = await validateStepsWithTemplates(input.steps)
    if (!validated.ok) return validated
    steps = validated.steps
  }

  const sb = createServiceClient()
  const { data, error } = await sb
    .from('crm_sequences')
    .insert({
      name,
      description: input.description?.trim() || null,
      stop_on_reply: input.stopOnReply ?? true,
      steps,
      status: 'paused',
      // Created By (§12.2.3 col 7): stamp the authoring broker.
      created_by: guard.brokerSlug ?? 'matt',
    })
    .select('id')
    .single()
  if (error) return { ok: false, error: error.message }

  revalidateWorkflows()
  return { ok: true, id: data.id as number }
}

// ── Duplicate ─────────────────────────────────────────────────────────────────

/**
 * Deep-copy an existing workflow into a new PAUSED sequence. The copy never
 * inherits the source's fub_legacy_plan_id (that column is unique + maps the 4
 * auto-enroll masters — a duplicate is a hand-built workflow, not a master).
 * Steps are copied verbatim (already validated when the source was written).
 */
export async function duplicateCrmSequenceAction(
  id: number,
): Promise<(CrmActionResult & { id?: number })> {
  const guard = await requireSuperuser()
  if (!guard.ok) return guard
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'Bad input' }

  const sb = createServiceClient()
  const { data: src, error: readErr } = await sb
    .from('crm_sequences')
    .select('name,description,stop_on_reply,steps,folder_id')
    .eq('id', id)
    .maybeSingle()
  if (readErr) return { ok: false, error: readErr.message }
  if (!src) return { ok: false, error: 'Workflow not found' }

  // Deep clone the steps so the copy shares no reference with the source.
  const clonedSteps = JSON.parse(JSON.stringify(src.steps ?? [])) as unknown

  const { data, error } = await sb
    .from('crm_sequences')
    .insert({
      name: `${src.name} (copy)`,
      description: src.description ?? null,
      stop_on_reply: src.stop_on_reply ?? true,
      steps: clonedSteps,
      status: 'paused',
      folder_id: src.folder_id ?? null,
      created_by: guard.brokerSlug ?? 'matt',
    })
    .select('id')
    .single()
  if (error) return { ok: false, error: error.message }

  revalidateWorkflows()
  return { ok: true, id: data.id as number }
}

// ── Archive (soft) ────────────────────────────────────────────────────────────

/**
 * Soft-archive a workflow: status='archived'. The engine only processes
 * enrollments whose sequence is 'active', so archiving immediately halts new
 * sends without touching the enrollment rows — nothing is orphaned. An archived
 * workflow can be re-activated via setCrmSequenceStatusAction.
 */
export async function archiveCrmSequenceAction(id: number): Promise<CrmActionResult> {
  const guard = await requireSuperuser()
  if (!guard.ok) return guard
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'Bad input' }

  const sb = createServiceClient()
  const { error } = await sb
    .from('crm_sequences')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { ok: false, error: error.message }

  revalidateWorkflows(id)
  return { ok: true }
}

// ── Delete (guarded) ──────────────────────────────────────────────────────────

/**
 * Hard-delete a workflow — REFUSED when unsafe. A delete is only allowed when:
 *  - the sequence has NO live enrollments (running / paused_reply), and
 *  - it is not an auto-enroll master (no fub_legacy_plan_id).
 * Otherwise the caller is steered to archive. This is the guard that keeps a
 * delete from orphaning enrollments or breaking an auto-enroll rule.
 *
 * Note: crm_sequence_enrollments cascades on delete, so the DB would silently
 * drop terminal (completed/stopped/suppressed) enrollment history — acceptable,
 * but a LIVE enrollment would lose its in-flight contact. The guard refuses
 * exactly that case.
 */
export async function deleteCrmSequenceAction(id: number): Promise<CrmActionResult> {
  const guard = await requireSuperuser()
  if (!guard.ok) return guard
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'Bad input' }

  const sb = createServiceClient()

  // Referenced as an auto-enroll master? Never delete — archive instead.
  const { data: seq, error: seqErr } = await sb
    .from('crm_sequences')
    .select('id,fub_legacy_plan_id')
    .eq('id', id)
    .maybeSingle()
  if (seqErr) return { ok: false, error: seqErr.message }
  if (!seq) return { ok: false, error: 'Workflow not found' }
  if (seq.fub_legacy_plan_id != null) {
    return { ok: false, error: 'This is an auto-enroll workflow. Archive it instead of deleting.' }
  }

  // Live enrollments? Refuse — orphaning an in-flight contact is not allowed.
  const { count, error: countErr } = await sb
    .from('crm_sequence_enrollments')
    .select('id', { count: 'exact', head: true })
    .eq('sequence_id', id)
    .in('status', LIVE_ENROLLMENT_STATUSES as unknown as string[])
  // Fail CLOSED: an unreadable enrollment table must NOT permit a delete.
  if (countErr) return { ok: false, error: 'Could not verify enrollments. Delete refused.' }
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: `Workflow has ${count} live enrollment${count === 1 ? '' : 's'}. Archive it instead.`,
    }
  }

  const { error } = await sb.from('crm_sequences').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }

  revalidateWorkflows()
  return { ok: true }
}

// ── Settings edit ─────────────────────────────────────────────────────────────

/**
 * Edit a workflow's identity + reply behavior (name, description, stop-on-reply).
 * Does not touch steps or status — those have dedicated actions.
 */
export async function updateCrmSequenceSettingsAction(input: {
  id: number
  name: string
  description?: string | null
  stopOnReply: boolean
}): Promise<CrmActionResult> {
  const guard = await requireSuperuser()
  if (!guard.ok) return guard
  if (!Number.isInteger(input.id) || input.id <= 0) return { ok: false, error: 'Bad input' }
  const name = (input.name ?? '').trim()
  if (!name) return { ok: false, error: 'Name is required' }

  const sb = createServiceClient()
  const { error } = await sb
    .from('crm_sequences')
    .update({
      name,
      description: input.description?.trim() || null,
      stop_on_reply: input.stopOnReply,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.id)
  if (error) return { ok: false, error: error.message }

  revalidateWorkflows(input.id)
  return { ok: true }
}

// ── Triggers rewrite ─────────────────────────────────────────────────────────

/**
 * Rewrite a workflow's triggers array. Validates each trigger shape then writes
 * the `triggers` jsonb column. The steps column is not touched. Empty array is
 * valid (manual-enroll-only workflow).
 */
export async function updateCrmSequenceTriggersAction(
  id: number,
  triggers: unknown,
): Promise<CrmActionResult> {
  const guard = await requireSuperuser()
  if (!guard.ok) return guard
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'Bad input' }

  let parsed: SequenceTrigger[]
  try {
    parsed = parseSequenceTriggers(triggers)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'invalid triggers'
    return { ok: false, error: `Trigger validation failed. ${msg}` }
  }

  const sb = createServiceClient()
  const { data: seq, error: seqErr } = await sb
    .from('crm_sequences')
    .select('id')
    .eq('id', id)
    .maybeSingle()
  if (seqErr) return { ok: false, error: seqErr.message }
  if (!seq) return { ok: false, error: 'Workflow not found' }

  const { error } = await sb
    .from('crm_sequences')
    .update({ triggers: parsed, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { ok: false, error: error.message }

  revalidateWorkflows(id)
  return { ok: true }
}

// ── Step rewrite ──────────────────────────────────────────────────────────────

/**
 * Rewrite a workflow's steps. Validates SHAPE (parseSteps — same schema the
 * engine reads) AND that every referenced templateKey resolves to a live
 * template, then writes the steps jsonb. A malformed payload never lands in the
 * column, so the engine never dead-ends a live enrollment on a bad step.
 */
export async function updateCrmSequenceStepsAction(
  id: number,
  steps: unknown,
): Promise<CrmActionResult> {
  const guard = await requireSuperuser()
  if (!guard.ok) return guard
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'Bad input' }

  const validated = await validateStepsWithTemplates(steps)
  if (!validated.ok) return validated

  const sb = createServiceClient()
  // Confirm the target exists before writing (clearer error than a silent no-op).
  const { data: seq, error: seqErr } = await sb
    .from('crm_sequences')
    .select('id')
    .eq('id', id)
    .maybeSingle()
  if (seqErr) return { ok: false, error: seqErr.message }
  if (!seq) return { ok: false, error: 'Workflow not found' }

  const { error } = await sb
    .from('crm_sequences')
    .update({ steps: validated.steps, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { ok: false, error: error.message }

  revalidateWorkflows(id)
  return { ok: true }
}

// ── Folders (§12.2 — Create Folder, Move to Folder, folder edit) ─────────────

/** Create a user folder for grouping automations (§12.2.1 Create Folder). */
export async function createCrmSequenceFolderAction(input: {
  name: string
}): Promise<CrmActionResult & { id?: number }> {
  const guard = await requireSuperuser()
  if (!guard.ok) return guard
  const name = (input.name ?? '').trim()
  if (!name) return { ok: false, error: 'Folder name is required' }

  const sb = createServiceClient()
  const { data, error } = await sb
    .from('crm_sequence_folders')
    .insert({ name, is_system: false, created_by: guard.brokerSlug ?? 'matt' })
    .select('id')
    .single()
  if (error) return { ok: false, error: error.message }
  revalidateWorkflows()
  return { ok: true, id: data.id as number }
}

/** Rename a USER folder. System folders (My Automations) are refused. */
export async function renameCrmSequenceFolderAction(input: {
  id: number
  name: string
}): Promise<CrmActionResult> {
  const guard = await requireSuperuser()
  if (!guard.ok) return guard
  if (!Number.isInteger(input.id) || input.id <= 0) return { ok: false, error: 'Bad input' }
  const name = (input.name ?? '').trim()
  if (!name) return { ok: false, error: 'Folder name is required' }

  const sb = createServiceClient()
  const { data: folder, error: readErr } = await sb
    .from('crm_sequence_folders')
    .select('id,is_system')
    .eq('id', input.id)
    .maybeSingle()
  if (readErr) return { ok: false, error: readErr.message }
  if (!folder) return { ok: false, error: 'Folder not found' }
  if (folder.is_system) return { ok: false, error: 'System folders cannot be renamed.' }

  const { error } = await sb.from('crm_sequence_folders').update({ name }).eq('id', input.id)
  if (error) return { ok: false, error: error.message }
  revalidateWorkflows()
  return { ok: true }
}

/**
 * Delete a USER folder. Members are NOT deleted — their folder_id clears via
 * the FK's ON DELETE SET NULL, so the automations simply become unfoldered.
 */
export async function deleteCrmSequenceFolderAction(id: number): Promise<CrmActionResult> {
  const guard = await requireSuperuser()
  if (!guard.ok) return guard
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'Bad input' }

  const sb = createServiceClient()
  const { data: folder, error: readErr } = await sb
    .from('crm_sequence_folders')
    .select('id,is_system')
    .eq('id', id)
    .maybeSingle()
  if (readErr) return { ok: false, error: readErr.message }
  if (!folder) return { ok: false, error: 'Folder not found' }
  if (folder.is_system) return { ok: false, error: 'System folders cannot be deleted.' }

  const { error } = await sb.from('crm_sequence_folders').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidateWorkflows()
  return { ok: true }
}

/** Move an automation into a folder (or out — folderId null) per §12.2.3 row actions. */
export async function moveCrmSequenceToFolderAction(input: {
  sequenceId: number
  folderId: number | null
}): Promise<CrmActionResult> {
  const guard = await requireSuperuser()
  if (!guard.ok) return guard
  if (!Number.isInteger(input.sequenceId) || input.sequenceId <= 0) return { ok: false, error: 'Bad input' }

  const sb = createServiceClient()
  if (input.folderId != null) {
    const { data: folder, error: fErr } = await sb
      .from('crm_sequence_folders')
      .select('id')
      .eq('id', input.folderId)
      .maybeSingle()
    if (fErr) return { ok: false, error: fErr.message }
    if (!folder) return { ok: false, error: 'Folder not found' }
  }

  const { error } = await sb
    .from('crm_sequences')
    .update({ folder_id: input.folderId, updated_at: new Date().toISOString() })
    .eq('id', input.sequenceId)
  if (error) return { ok: false, error: error.message }
  revalidateWorkflows(input.sequenceId)
  return { ok: true }
}
