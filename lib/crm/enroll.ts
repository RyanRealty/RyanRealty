/**
 * Auto-enrollment rules — no lead gets manually assigned to a workflow
 * (Matt directive 2026-06-09).
 *
 * A new lead's tags decide its sequence; first matching rule wins. Hard
 * guards: only people created AFTER the epoch (the 18K historical book is
 * never mass-enrolled), one master sequence per person, hard-stopped contacts
 * never enroll.
 */

import { createServiceClient } from '@/lib/supabase/service'

/** People created before this moment are never auto-enrolled. */
export const ENROLLMENT_EPOCH = '2026-06-10T00:00:00Z'

/** tag → FUB legacy plan id (the four master sequences). Order matters. */
const RULES: Array<{ tag: string; fubPlanId: number }> = [
  { tag: 'intent:expired-listing', fubPlanId: 71 },
  { tag: 'intent:fsbo', fubPlanId: 72 },
  { tag: 'audience:seller', fubPlanId: 69 },
  { tag: 'audience:buyer', fubPlanId: 70 },
]

const MASTER_PLAN_IDS = RULES.map((r) => r.fubPlanId)

export type AutoEnrollResult =
  | { enrolled: true; sequence: string }
  | { enrolled: false; reason: string }

export async function autoEnrollPerson(personId: number): Promise<AutoEnrollResult> {
  const sb = createServiceClient()
  const { data: person } = await sb
    .from('crm_people')
    .select('id,tags,created_at,fub_created_at,emails')
    .eq('id', personId)
    .maybeSingle()
  if (!person) return { enrolled: false, reason: 'person not found' }

  const createdAt = (person.fub_created_at ?? person.created_at) as string
  if (createdAt < ENROLLMENT_EPOCH) return { enrolled: false, reason: 'pre-epoch contact (historical book)' }

  const tags = (person.tags as string[]) ?? []
  const rule = RULES.find((r) => tags.includes(r.tag))
  if (!rule) return { enrolled: false, reason: 'no rule matches tags' }

  // hard-stop: never enroll
  const { data: hardStop } = await sb
    .from('crm_suppressions')
    .select('id')
    .eq('person_id', personId)
    .eq('channel', 'all')
    .limit(1)
  if (hardStop?.length) return { enrolled: false, reason: 'hard-stopped' }

  // resolve the target sequence (must be active)
  const { data: seq } = await sb
    .from('crm_sequences')
    .select('id,name,status,fub_legacy_plan_id')
    .eq('fub_legacy_plan_id', rule.fubPlanId)
    .maybeSingle()
  if (!seq || seq.status !== 'active') return { enrolled: false, reason: `sequence for plan ${rule.fubPlanId} not active` }

  // one master sequence per person, ever (any status)
  const { data: masterSeqs } = await sb
    .from('crm_sequences')
    .select('id')
    .in('fub_legacy_plan_id', MASTER_PLAN_IDS)
  const masterIds = (masterSeqs ?? []).map((s) => s.id)
  const { data: existing } = await sb
    .from('crm_sequence_enrollments')
    .select('id')
    .eq('person_id', personId)
    .in('sequence_id', masterIds)
    .limit(1)
  if (existing?.length) return { enrolled: false, reason: 'already enrolled in a master sequence' }

  // Broker-approval gate (Matt directive 2026-06-12): the workflow does NOT
  // start until the assigned broker approves the prepared first touch. The
  // sequence engine only processes status='running', so this row waits.
  const { error } = await sb.from('crm_sequence_enrollments').insert({
    person_id: personId,
    sequence_id: seq.id,
    status: 'awaiting_broker',
    next_run_at: null,
    enrolled_by: 'auto-rule',
  })
  if (error) return { enrolled: false, reason: error.message }

  await sb.from('crm_timeline').insert({
    person_id: personId,
    kind: 'system',
    title: `Enrolled in "${seq.name}" — waiting on broker approval of the first touch`,
    source: 'auto-enroll',
  })
  return { enrolled: true, sequence: seq.name }
}

/** Render the prepared first touch of a sequence for a person (for the broker
 *  approval ask). Returns null when step 0 is not a message step. */
export async function renderFirstTouchPreview(
  sequenceId: number,
  personId: number,
): Promise<{ channel: string; body: string } | null> {
  const sb = createServiceClient()
  const [{ data: seq }, { data: person }] = await Promise.all([
    sb.from('crm_sequences').select('steps').eq('id', sequenceId).maybeSingle(),
    sb.from('crm_people').select('first_name,name,custom').eq('id', personId).maybeSingle(),
  ])
  const step = (seq?.steps as Array<{ channel?: string; body?: string }> | null)?.[0]
  if (!step?.channel || !['sms', 'email'].includes(step.channel) || !step.body || !person) return null
  const { renderCrmMerge } = await import('@/lib/crm/merge')
  // CMA may not be built yet at enroll time — swap the token for a readable
  // placeholder BEFORE merge (merge renders an empty string when no link yet).
  const hasCma = Boolean((person.custom as Record<string, unknown> | null)?.cmaLink)
  const raw = hasCma
    ? step.body
    : step.body.replace(/%cma_link%|\{\{cma_link\}\}/g, '[CMA link attaches when built]')
  const body = renderCrmMerge(raw, person).replace(/ {2,}/g, ' ').trim()
  return { channel: step.channel, body }
}

/** Resolve a FUB person id to the CRM mirror (mirroring first if needed), then auto-enroll. */
export async function autoEnrollByFubId(fubPersonId: number): Promise<AutoEnrollResult> {
  const sb = createServiceClient()
  let { data } = await sb.from('crm_people').select('id').eq('fub_legacy_id', fubPersonId).maybeSingle()
  if (!data) {
    const { mirrorPersonFromFub } = await import('@/lib/crm/mirror')
    await mirrorPersonFromFub(fubPersonId)
    ;({ data } = await sb.from('crm_people').select('id').eq('fub_legacy_id', fubPersonId).maybeSingle())
  }
  if (!data) return { enrolled: false, reason: 'mirror not available' }
  const result = await autoEnrollPerson(data.id)
  // Instant broker text for site-originated leads (dedupe inside the queue —
  // the 15-min auto-enroll cron will hit the same key and no-op).
  try {
    const { data: p } = await sb
      .from('crm_people')
      .select('id,name,source,stage,assigned_broker,tags,fub_created_at')
      .eq('id', data.id)
      .maybeSingle()
    if (p && new Date(p.fub_created_at ?? 0) >= new Date(ENROLLMENT_EPOCH) && !(p.tags ?? []).includes('compliance:hard-stop')) {
      const { queueBrokerAlert, newLeadAlertBody } = await import('@/lib/crm/broker-alerts')
      // Approval ask (Matt directive 2026-06-12): the alert carries the
      // prepared first touch so the broker can approve and start the workflow.
      let body: string
      if (result.enrolled) {
        const tags = (p.tags ?? []) as string[]
        const leadType = tags.includes('intent:expired-listing')
          ? 'expired seller'
          : tags.includes('audience:seller')
            ? 'seller'
            : tags.includes('audience:buyer')
              ? 'buyer'
              : 'lead'
        const { data: en } = await sb
          .from('crm_sequence_enrollments')
          .select('sequence_id')
          .eq('person_id', p.id)
          .eq('status', 'awaiting_broker')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        const preview = en ? await renderFirstTouchPreview(en.sequence_id, p.id) : null
        body = [
          `New ${leadType} lead: ${p.name ?? 'Unknown'}${p.source ? ` (${p.source})` : ''}`,
          preview
            ? `Prepared first ${preview.channel === 'sms' ? 'text' : 'email'}: "${preview.body}"`
            : `Enrolled in "${result.sequence}".`,
          'Want me to send it and start the workflow?',
          `Approve or edit: ryan-realty.com/admin/crm/approvals`,
        ].join('\n')
      } else {
        body = newLeadAlertBody({
          name: p.name,
          source: p.source,
          stage: p.stage,
          personId: p.id,
          detail: null,
        })
      }
      await queueBrokerAlert({
        broker: p.assigned_broker,
        personId: p.id,
        kind: 'new-lead',
        body,
      })
    }
  } catch { /* alert must never break enrollment */ }
  return result
}
