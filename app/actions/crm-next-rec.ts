'use server'

/**
 * Broker-confirmed "recommended next step" for a contact.
 *
 * Split out of app/actions/crm.ts so ConsoleQuickAction (mounted on every
 * admin page via ConsoleShell) does not pull the CRM god-file into the
 * serverless function for lean routes like /admin/analytics/action-required.
 */

import { createServiceClient } from '@/lib/supabase/service'
import { getCrmAccess } from '@/lib/data/crm/getCrmAccess'

export type CrmNextRec = {
  enrollmentId: number
  sequenceName: string
  stepIndex: number
  channel: string
  subjectPreview: string | null
  bodyPreview: string
  unresolved: string[]
  holdReason: string | null
} | null

/** Resolve a step's subject/body for PREVIEW — mirrors the engine exactly: a
 *  templateKey overrides inline subject/body from crm_templates. Without this the
 *  preview (and every guard built on it) inspects an empty inline body while the
 *  engine sends the template — a broker could one-click-send text never seen. */
async function resolveStepContent(
  sb: ReturnType<typeof createServiceClient>,
  step: Record<string, unknown>,
): Promise<{ subject: string | null; body: string }> {
  let subject = step.subject != null ? String(step.subject) : null
  let body = String(step.body ?? '')
  const templateKey = step.templateKey != null ? String(step.templateKey) : ''
  if (templateKey) {
    const { data: tpl } = await sb.from('crm_templates').select('subject,body').eq('key', templateKey).maybeSingle()
    if (tpl) {
      if (tpl.subject != null) subject = tpl.subject
      if (tpl.body != null) body = tpl.body
    }
  }
  return { subject, body }
}

/** The broker-confirmed "recommended next step" for a contact, fully rendered
 *  exactly as the lead would receive it. Drives the color-coded next-step card
 *  + the in-app message preview. Returns null when nothing is waiting. */
export async function getNextRecommendation(personId: number): Promise<CrmNextRec> {
  const access = await getCrmAccess()
  if (!access) return null
  const sb = createServiceClient()
  const { data: en } = await sb
    .from('crm_sequence_enrollments')
    .select('id,step_index,status,crm_sequences!inner(name,steps)')
    .eq('person_id', personId)
    .eq('status', 'awaiting_broker_next')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!en) return null
  const seq = en.crm_sequences as unknown as { name: string; steps: Array<Record<string, unknown>> }
  const step = (seq.steps ?? [])[en.step_index as number] as Record<string, unknown> | undefined
  if (!step) return null
  const { data: person } = await sb
    .from('crm_people')
    .select('first_name,last_name,name,stage,source,lender_name,emails,phones,addresses,assigned_broker,custom')
    .eq('id', personId)
    .maybeSingle()
  const { renderCrmMerge, findUnresolvedMergeTokens, referencesCmaLink } = await import('@/lib/crm/merge')
  const { buildMergeContext } = await import('@/lib/crm/merge-context')
  const p = (person ?? {}) as { first_name?: string | null; name?: string | null; assigned_broker?: string | null; custom?: Record<string, unknown> }
  const mergeCtx = await buildMergeContext({ person: p, senderSlug: p.assigned_broker ?? null })
  const channel = String(step.channel ?? 'step')
  const isMessage = channel === 'email' || channel === 'sms'
  const resolved = await resolveStepContent(sb, step)
  const rawBody = resolved.body || String(step.taskName ?? '')
  const bodyPreview = renderCrmMerge(rawBody, p, mergeCtx)
  const subjectPreview = resolved.subject ? renderCrmMerge(resolved.subject, p, mergeCtx) : null
  const holdReason =
    referencesCmaLink(rawBody) && !((p.custom ?? {}) as Record<string, unknown>).cmaLink
      ? 'Holds until the CMA is built (the link is stamped at finalize)'
      : isMessage && !rawBody.trim()
        ? 'Message content is missing — check the template'
        : null
  return {
    enrollmentId: en.id as number,
    sequenceName: seq.name,
    stepIndex: en.step_index as number,
    channel,
    subjectPreview,
    bodyPreview,
    unresolved: findUnresolvedMergeTokens(`${subjectPreview ?? ''} ${bodyPreview}`),
    holdReason,
  }
}
