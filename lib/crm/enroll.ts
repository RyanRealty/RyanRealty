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

  const { error } = await sb.from('crm_sequence_enrollments').insert({
    person_id: personId,
    sequence_id: seq.id,
    status: 'running',
    next_run_at: new Date().toISOString(),
    enrolled_by: 'auto-rule',
  })
  if (error) return { enrolled: false, reason: error.message }

  await sb.from('crm_timeline').insert({
    person_id: personId,
    kind: 'system',
    title: `Auto-enrolled in "${seq.name}"`,
    source: 'auto-enroll',
  })
  return { enrolled: true, sequence: seq.name }
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
  return autoEnrollPerson(data.id)
}
