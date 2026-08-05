/**
 * getBrokerActionQueue — every lead with a broker-confirmed sequence step
 * waiting, scoped by the CALLER-resolved access (P9 roll:today: moved from
 * app/actions/crm.ts so pages read it through lib/data per
 * ci:page-action-imports; the actions wrapper still serves existing callers).
 */
import { createServiceClient } from '@/lib/supabase/service'

export type BrokerActionItem = {
  enrollmentId: number
  personId: number
  personName: string
  firstName: string | null
  sequenceName: string
  channel: string
  subjectPreview: string | null
  preview: string
  /** Merge tokens that did not resolve — the one-click send is blocked while any remain. */
  unresolved: string[]
  holdReason: string | null
}

/** Every lead with a broker-confirmed step waiting, scoped to the signed-in
 *  broker — the "what needs you" queue for the dashboard. Each item carries the
 *  enrollment id + a fully rendered preview so the dashboard can confirm-and-send
 *  the exact message in one click (and refuse to when it would send broken text). */
export async function getBrokerActionQueue(access: { brokerSlug: string | null }): Promise<BrokerActionItem[]> {
  const sb = createServiceClient()
  let q = sb
    .from('crm_sequence_enrollments')
    .select('id,person_id,step_index,crm_people!inner(name,first_name,last_name,stage,source,lender_name,custom,assigned_broker,emails,phones,addresses),crm_sequences!inner(name,steps)')
    .eq('status', 'awaiting_broker_next')
    .order('updated_at', { ascending: true })
    .limit(100)
  if (access.brokerSlug) q = q.eq('crm_people.assigned_broker', access.brokerSlug)
  const { data } = await q
  const rows = data ?? []
  const { renderCrmMerge, referencesCmaLink, findUnresolvedMergeTokens } = await import('@/lib/crm/merge')
  const { buildMergeContext } = await import('@/lib/crm/merge-context')

  // Batch the template lookups: ONE .in() query for every distinct templateKey
  // across the fetched rows. The old version awaited resolveStepContent per
  // enrollment, a sequential crm_templates round trip per row (N+1, up to 100)
  // inside the broker-dashboard's first Promise.all, directly extending TTFB.
  const stepFor = (r: (typeof rows)[number]): Record<string, unknown> | undefined => {
    const seq = r.crm_sequences as unknown as { steps: Array<Record<string, unknown>> }
    return (seq.steps ?? [])[r.step_index as number] as Record<string, unknown> | undefined
  }
  const templateKeys = [
    ...new Set(
      rows
        .map((r) => {
          const step = stepFor(r)
          return step?.templateKey != null ? String(step.templateKey) : ''
        })
        .filter(Boolean),
    ),
  ]
  const templateByKey = new Map<string, { subject: string | null; body: string | null }>()
  if (templateKeys.length) {
    const { data: tpls } = await sb.from('crm_templates').select('key,subject,body').in('key', templateKeys)
    for (const t of tpls ?? []) {
      templateByKey.set(String(t.key), {
        subject: (t.subject ?? null) as string | null,
        body: (t.body ?? null) as string | null,
      })
    }
  }
  // Same override semantics as resolveStepContent: a templateKey's stored
  // subject/body replace the inline ones so the preview + every guard match
  // what the engine sends. The remaining per-row await (buildMergeContext)
  // reads only cached DAL functions, so the loop stays cheap.
  const resolveFromBatch = (step: Record<string, unknown>): { subject: string | null; body: string } => {
    let subject = step.subject != null ? String(step.subject) : null
    let body = String(step.body ?? '')
    const templateKey = step.templateKey != null ? String(step.templateKey) : ''
    const tpl = templateKey ? templateByKey.get(templateKey) : undefined
    if (tpl) {
      if (tpl.subject != null) subject = tpl.subject
      if (tpl.body != null) body = tpl.body
    }
    return { subject, body }
  }

  const out: BrokerActionItem[] = []
  for (const r of rows) {
    const person = r.crm_people as unknown as {
      name?: string | null; first_name?: string | null; assigned_broker?: string | null
      custom?: Record<string, unknown>
      emails?: Array<{ value?: string }> | null
    }
    const seq = r.crm_sequences as unknown as { name: string; steps: Array<Record<string, unknown>> }
    const step = (seq.steps ?? [])[r.step_index as number] as Record<string, unknown> | undefined
    if (!step) continue
    const channel = String(step.channel ?? 'step')
    const isMessage = channel === 'email' || channel === 'sms'
    // Resolve templateKey so the preview + every guard match what the engine sends.
    const resolved = resolveFromBatch(step)
    const rawBody = resolved.body || String(step.taskName ?? '')
    const mergeCtx = await buildMergeContext({ person, senderSlug: person.assigned_broker ?? null })
    const preview = renderCrmMerge(rawBody, person, mergeCtx)
    const subjectPreview = resolved.subject ? renderCrmMerge(resolved.subject, person, mergeCtx) : null
    const cmaPending = referencesCmaLink(rawBody) && !((person.custom ?? {}) as Record<string, unknown>).cmaLink
    // email has NO contact-points fallback in the engine, so empty emails[] is a
    // guaranteed non-delivery — surface it rather than show a Send that no-ops.
    const noEmail = channel === 'email' && !(Array.isArray(person.emails) && person.emails.some((e) => e?.value))
    const holdReason = cmaPending
      ? 'Waiting on the CMA'
      : isMessage && !rawBody.trim()
        ? 'Message not ready — check the template'
        : noEmail
          ? 'No email on file'
          : null
    out.push({
      enrollmentId: r.id as number,
      personId: r.person_id as number,
      personName: person.name ?? 'Unknown',
      firstName: person.first_name ?? null,
      sequenceName: seq.name,
      channel,
      subjectPreview: subjectPreview ? subjectPreview.slice(0, 120) : null,
      preview: preview.slice(0, 140),
      unresolved: findUnresolvedMergeTokens(`${subjectPreview ?? ''} ${preview}`),
      holdReason,
    })
  }
  return out
}
