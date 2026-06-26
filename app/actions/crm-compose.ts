'use server'

/**
 * Compose-to-cohort server actions (Wave 5) — the thin layer behind the
 * /admin/email/compose surface. A broker picks an AUDIENCE (a saved smart list or
 * a pipeline stage), a TEMPLATE (or writes a subject + body), sees a real
 * recipient + skip preview, and dispatches OR schedules a suppression-safe cohort
 * send.
 *
 * ONE send path: every dispatch funnels into the Wave-3 bulkEmailCohortAction +
 * the audience bus (lib/crm/audience.ts), and every preview funnels into the
 * Wave-3 bulkPreflightCount — the SAME compiler the worker runs. The preview the
 * broker sees and the cohort the worker mails can never diverge. A scheduled send
 * stores the frozen selection + scope and the cron re-enters the identical worker
 * path via enqueueBulkJob — still no second send path.
 *
 * §0 data accuracy: every count rendered traces to a live buildCrmPeopleQuery
 * count under the caller's scope (via bulkPreflightCount). Nothing is fabricated.
 *
 * DAL boundary (G1): the only reads here go through DAL functions
 * (getComposeAudienceOptions) and the Wave-3 actions; the scheduled-send insert is
 * the one mutation and writes the dedicated crm_scheduled_sends table.
 */

import { getCrmAccess } from '@/app/actions/crm'
import { scopeBroker } from '@/lib/crm/scope'
import {
  bulkPreflightCount,
  bulkEmailCohortAction,
  resolveBulkSelection,
} from '@/app/actions/crm-bulk'
import type { BulkEnqueueResult, BulkPreflightResult } from '@/lib/crm/bulk-helpers'
import {
  getComposeAudienceOptions,
  type ComposeAudienceOptions,
} from '@/lib/data/crm/getComposeAudienceOptions'
import {
  parseComposeAudience,
  audienceToSelection,
  shapeComposePreview,
  normalizeScheduledAt,
  validateComposeContent,
  type ComposeContentInput,
  type ComposePreview,
} from '@/lib/crm/compose-audience'
import { createServiceClient } from '@/lib/supabase/service'

// ── Options ──────────────────────────────────────────────────────────────────

export type ComposeOptionsResult =
  | ({ ok: true } & ComposeAudienceOptions)
  | { ok: false; error: string }

/** Load the audience + template options the compose picker renders (scoped). */
export async function getComposeOptionsAction(): Promise<ComposeOptionsResult> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }
  try {
    const opts = await getComposeAudienceOptions(access)
    return { ok: true, ...opts }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not load compose options' }
  }
}

// ── Preview ──────────────────────────────────────────────────────────────────

export type ComposePreviewResult =
  | ({ ok: true } & ComposePreview)
  | { ok: false; error: string }

/**
 * Pre-send preview: resolve the audience to a real recipient + skip estimate via
 * the Wave-3 bulkPreflightCount (kind 'email-cohort', so it returns the
 * suppression estimate), then shape it for the banner. The count is live and
 * scope-clamped, never a placeholder.
 */
export async function previewComposeCohortAction(
  rawAudience: { kind?: string; viewId?: number; stage?: string },
): Promise<ComposePreviewResult> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }

  const parsed = parseComposeAudience(rawAudience)
  if (!parsed.ok) return { ok: false, error: parsed.error }

  let selection
  try {
    selection = audienceToSelection(parsed.audience)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Pick an audience to send to' }
  }

  const counts: BulkPreflightResult = await bulkPreflightCount(selection, 'email-cohort')
  if (!counts.ok) return { ok: false, error: counts.error }

  const preview = shapeComposePreview({
    total: counts.total,
    suppressedEstimate: counts.suppressedEstimate,
  })
  return { ok: true, ...preview }
}

// ── Dispatch (send now) ──────────────────────────────────────────────────────

export type DispatchComposeInput = {
  audience: { kind?: string; viewId?: number; stage?: string }
  content: ComposeContentInput
}

/**
 * Send NOW: validate content through the voice gate, map the audience to the
 * canonical selection, and hand off to the Wave-3 bulkEmailCohortAction. The
 * cohort runs through the chunked worker with the per-recipient suppression
 * chokepoint and one email_events 'sent' row per delivered contact.
 */
export async function dispatchComposeCohortAction(
  input: DispatchComposeInput,
): Promise<BulkEnqueueResult> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }

  const voice = validateComposeContent(input.content)
  if (!voice.ok) return { ok: false, error: voice.error }

  const parsed = parseComposeAudience(input.audience)
  if (!parsed.ok) return { ok: false, error: parsed.error }

  let selection
  try {
    selection = audienceToSelection(parsed.audience)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Pick an audience to send to' }
  }

  return bulkEmailCohortAction(selection, {
    templateId: input.content.templateId,
    subject: input.content.subject,
    body: input.content.body,
  })
}

// ── Schedule (send later) ────────────────────────────────────────────────────

export type ScheduleComposeInput = DispatchComposeInput & {
  /** ISO-8601 instant the send should fire at (must be in the future). */
  scheduledAt: string
}

export type ScheduleComposeResult = { ok: true; id: number } | { ok: false; error: string }

/**
 * Schedule a cohort send for later. Validates content + audience exactly like the
 * immediate dispatch, then FREEZES the resolved selection ({ids} or {ast}) + the
 * caller's broker scope + actor email into crm_scheduled_sends. The
 * crm-scheduled-sends cron later enqueues the frozen selection through
 * enqueueBulkJob (kind 'email-cohort') — the identical worker path, no second send
 * path. Freezing the scope at schedule time means a later RBAC change can never
 * widen the cohort the scheduled job touches.
 */
export async function scheduleComposeCohortAction(
  input: ScheduleComposeInput,
): Promise<ScheduleComposeResult> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }

  const voice = validateComposeContent(input.content)
  if (!voice.ok) return { ok: false, error: voice.error }

  const parsed = parseComposeAudience(input.audience)
  if (!parsed.ok) return { ok: false, error: parsed.error }

  const when = normalizeScheduledAt(input.scheduledAt, Date.now())
  if (!when.ok) return { ok: false, error: when.error }

  // Map to the canonical selection, then FREEZE it to {ids}|{ast} (the same shape
  // the worker consumes). resolveBulkSelection loads a saved view's stored AST so
  // the scheduled job resolves the audience live at fire time, scope-clamped.
  let selection
  try {
    selection = audienceToSelection(parsed.audience)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Pick an audience to send to' }
  }

  let frozenSelection
  try {
    frozenSelection = await resolveBulkSelection(selection)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Invalid audience' }
  }

  // Normalize the cohort params exactly like bulkEmailCohortAction does, so the
  // stored params are the same shape the worker's handler reads.
  const templateIdRaw = (input.content.templateId ?? '').trim()
  const subject = (input.content.subject ?? '').trim()
  const body = input.content.body ?? ''
  const parsedTid = templateIdRaw ? parseInt(templateIdRaw, 10) : NaN
  const templateId: number | null =
    Number.isFinite(parsedTid) && parsedTid > 0 ? parsedTid : null
  const params = { templateId, subject: subject || null, body: body || null }

  const brokerScope = scopeBroker(access)
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('crm_scheduled_sends')
    .insert({
      kind: 'email-cohort',
      selection: frozenSelection,
      params,
      actor_email: access.email,
      broker_scope: brokerScope,
      scheduled_at: when.iso,
      status: 'scheduled',
    })
    .select('id')
    .single()

  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Could not schedule the send' }
  }
  return { ok: true, id: Number((data as { id: number }).id) }
}
