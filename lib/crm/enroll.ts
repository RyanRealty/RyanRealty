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

/**
 * tag → FUB legacy plan id (the four master sequences). Order matters.
 *
 * This is now only the FAIL-SAFE fallback: the auto-enroll path reads the
 * UI-configurable crm_automation_rules table first (getCrmAutomationRules,
 * tag_added → enroll_sequence). If that table read fails or returns no matching
 * rule the const below still resolves a sequence, so a config-table outage never
 * silently stops new leads from enrolling. Adding/removing a "tag X → workflow Y"
 * trigger is a setting in the table, not an edit to this const.
 */
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
    .select('id,tags,source,created_at,fub_created_at,emails')
    .eq('id', personId)
    .maybeSingle()
  if (!person) return { enrolled: false, reason: 'person not found' }

  const createdAt = (person.fub_created_at ?? person.created_at) as string
  if (createdAt < ENROLLMENT_EPOCH) return { enrolled: false, reason: 'pre-epoch contact (historical book)' }

  // Outreach lists never auto-enroll: skip-traced expired/FSBO owners and
  // Farm/Import/Sphere rows are lists WE built, and their intent:* tags map
  // straight to the texting sequences — sends that are manual
  // approve-and-send by design (expired-listing-processor deliberately
  // dropped its autoEnrollPerson call for the same reason). Homeowners who
  // submitted OUR forms carry inbound -lp sources and pass this check.
  const { classifyLeadSource } = await import('@/lib/data/crm/leadSourceTaxonomy')
  if (classifyLeadSource((person.source as string | null) ?? null).outreachList) {
    return { enrolled: false, reason: 'outreach-list source (manual outreach only)' }
  }

  const tags = (person.tags as string[]) ?? []

  // hard-stop: never enroll
  const { data: hardStop, error: hardStopError } = await sb
    .from('crm_suppressions')
    .select('id')
    .eq('person_id', personId)
    .eq('channel', 'all')
    .limit(1)
  // fail CLOSED (audit p0.3): an unreadable compliance table must NOT enroll.
  if (hardStopError) return { enrolled: false, reason: 'hard-stop check failed: ' + hardStopError.message }
  if (hardStop?.length) return { enrolled: false, reason: 'hard-stopped' }

  // Resolve the target sequence id. PRIMARY path: the UI-configurable
  // crm_automation_rules table (tag_added → enroll_sequence). The first active
  // rule whose tag the person carries wins, taking the rules' position order. The
  // table read failing OR matching nothing FALLS BACK to the const above so a
  // config-table outage never silently stops new leads from enrolling.
  let sequenceId: number | null = null
  try {
    const { getActiveRulesForTrigger } = await import('@/lib/data/crm/getCrmAutomationRules')
    // Pull the matched enroll_sequence action for each tag the person carries,
    // then honour the rules' own position order so "first matching rule wins".
    const candidates: Array<{ position: number; sequenceId: number }> = []
    for (const tag of tags) {
      const matched = await getActiveRulesForTrigger('tag_added', tag)
      for (const r of matched) {
        if (r.actionType !== 'enroll_sequence') continue
        const id = Number(r.actionValue)
        if (Number.isInteger(id) && id > 0) candidates.push({ position: r.position, sequenceId: id })
      }
    }
    if (candidates.length) {
      candidates.sort((a, b) => a.position - b.position)
      sequenceId = candidates[0].sequenceId
    }
  } catch (e) {
    console.error('[autoEnrollPerson] automation-rules read failed, using fallback const', e)
  }

  // resolve the target sequence (must be active)
  type SeqRow = { id: number; name: string; status: string; fub_legacy_plan_id: number | null }
  let seq: SeqRow | null = null
  if (sequenceId !== null) {
    const { data } = await sb
      .from('crm_sequences')
      .select('id,name,status,fub_legacy_plan_id')
      .eq('id', sequenceId)
      .maybeSingle()
    seq = (data as SeqRow | null) ?? null
  } else {
    // FAIL-SAFE: the const fallback (table read failed or no rule matched).
    const rule = RULES.find((r) => tags.includes(r.tag))
    if (!rule) return { enrolled: false, reason: 'no rule matches tags' }
    const { data } = await sb
      .from('crm_sequences')
      .select('id,name,status,fub_legacy_plan_id')
      .eq('fub_legacy_plan_id', rule.fubPlanId)
      .maybeSingle()
    seq = (data as SeqRow | null) ?? null
  }
  if (!seq) return { enrolled: false, reason: 'target sequence not found' }
  if (seq.status !== 'active') return { enrolled: false, reason: `sequence "${seq.name}" is not active` }

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

  // Auto-fire the first touches (Matt directive 2026-06-13): touch 1 + 2 send
  // automatically (email-first, so a touch lands even with SMS A2P blocked).
  // Later steps are confirm:true and park as awaiting_broker_next for the broker
  // to confirm. The engine processes status='running' from next_run_at.
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
    title: `Enrolled in "${seq.name}" — first touch sending automatically`,
    source: 'auto-enroll',
  })
  return { enrolled: true, sequence: seq.name }
}

/**
 * Broker-driven enrollment: the broker explicitly picks a workflow from the
 * lead page. Unlike the auto-rule path this does NOT require a matching tag or
 * a post-epoch contact — the broker is deliberately choosing. Still fail-closed
 * on hard-stop, and never double-enrolls a still-live sequence.
 */
export async function manualEnrollPerson(personId: number, sequenceId: number, enrolledBy = 'broker'): Promise<AutoEnrollResult> {
  const sb = createServiceClient()
  if (!Number.isFinite(personId) || personId <= 0 || !Number.isFinite(sequenceId) || sequenceId <= 0) {
    return { enrolled: false, reason: 'invalid input' }
  }

  const { data: seq } = await sb
    .from('crm_sequences')
    .select('id,name,status')
    .eq('id', sequenceId)
    .maybeSingle()
  if (!seq) return { enrolled: false, reason: 'workflow not found' }
  if (seq.status !== 'active') return { enrolled: false, reason: 'that workflow is not active' }

  const { data: hardStop, error: hardStopError } = await sb
    .from('crm_suppressions')
    .select('id')
    .eq('person_id', personId)
    .eq('channel', 'all')
    .limit(1)
  // fail CLOSED (audit p0.3): an unreadable compliance table must NOT enroll.
  if (hardStopError) return { enrolled: false, reason: 'hard-stop check failed: ' + hardStopError.message }
  if (hardStop?.length) return { enrolled: false, reason: 'contact is hard-stopped' }

  // Never double-enroll into the SAME sequence while it is still live.
  const { data: existing } = await sb
    .from('crm_sequence_enrollments')
    .select('id')
    .eq('person_id', personId)
    .eq('sequence_id', sequenceId)
    .in('status', ['running', 'paused', 'awaiting_broker_next'])
    .limit(1)
  if (existing?.length) return { enrolled: false, reason: `already in ${seq.name}` }

  const { error } = await sb.from('crm_sequence_enrollments').insert({
    person_id: personId,
    sequence_id: sequenceId,
    status: 'running',
    next_run_at: new Date().toISOString(),
    enrolled_by: enrolledBy,
  })
  if (error) return { enrolled: false, reason: error.message }

  await sb.from('crm_timeline').insert({
    person_id: personId,
    kind: 'system',
    title: `Enrolled in "${seq.name}" by ${enrolledBy}`,
    source: 'manual-enroll',
  })
  return { enrolled: true, sequence: seq.name }
}

/** Active workflows a broker can hand-pick from the lead page. */
export async function listActiveSequences(): Promise<Array<{ id: number; name: string }>> {
  const sb = createServiceClient()
  const { data } = await sb
    .from('crm_sequences')
    .select('id,name')
    .eq('status', 'active')
    .order('name')
  return (data ?? []).map((s) => ({ id: s.id as number, name: s.name as string }))
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
    sb.from('crm_people').select('first_name,last_name,name,stage,source,lender_name,emails,phones,addresses,assigned_broker,custom').eq('id', personId).maybeSingle(),
  ])
  const step = (seq?.steps as Array<{ channel?: string; body?: string }> | null)?.[0]
  if (!step?.channel || !['sms', 'email'].includes(step.channel) || !step.body || !person) return null
  const { renderCrmMerge } = await import('@/lib/crm/merge')
  const { buildMergeContext } = await import('@/lib/crm/merge-context')
  // CMA may not be built yet at enroll time — swap the token for a readable
  // placeholder BEFORE merge (merge renders an empty string when no link yet).
  const hasCma = Boolean((person.custom as Record<string, unknown> | null)?.cmaLink)
  const raw = hasCma
    ? step.body
    : step.body.replace(/%cma_link%|\{\{cma_link\}\}/g, '[CMA link attaches when built]')
  const mergeCtx = await buildMergeContext({ person, senderSlug: person.assigned_broker ?? null })
  const body = renderCrmMerge(raw, person, mergeCtx).replace(/ {2,}/g, ' ').trim()
  return { channel: step.channel, body }
}

/** Resolve a FUB person id to the CRM mirror (mirroring first if needed), then auto-enroll. */
export async function autoEnrollByFubId(
  fubPersonId: number,
  opts?: { smsConsent?: boolean },
): Promise<AutoEnrollResult> {
  const sb = createServiceClient()
  let { data } = await sb.from('crm_people').select('id').eq('fub_legacy_id', fubPersonId).maybeSingle()
  if (!data) {
    // Post-FUB-cutover (2026-06-24): most lead-capture paths (LP forms, the
    // expired/FSBO/seller crons) now create a NATIVE crm_people row via
    // ensureNativeLead and pass its crm_people.id here — there is no
    // fub_legacy_id to resolve. Before mirroring (a FUB round-trip that is dead
    // in production), check whether the id IS already a native crm_people id.
    const { data: nativeRow } = await sb.from('crm_people').select('id').eq('id', fubPersonId).maybeSingle()
    if (nativeRow) {
      data = nativeRow
    } else {
      const { mirrorPersonFromFub } = await import('@/lib/crm/mirror')
      await mirrorPersonFromFub(fubPersonId)
      ;({ data } = await sb.from('crm_people').select('id').eq('fub_legacy_id', fubPersonId).maybeSingle())
    }
  }
  if (!data) return { enrolled: false, reason: 'mirror not available' }
  // Fail-closed SMS consent (A2P 10DLC / TCPA, Twilio ticket 27497858): a person
  // is text-eligible ONLY when they actively checked the SMS consent box on a
  // public lead form (the action passes smsConsent:true). Every other caller —
  // the expired-listing detection cron, the canonical lead-tagger, any import —
  // passes no consent and is suppressed on the sms channel by default. Email and
  // voice are never gated by this. Removing the suppression on explicit consent
  // covers a returning lead who opts in on a later submission.
  try {
    const { addSuppression, removeSuppression } = await import('@/lib/crm/suppressions')
    await removeSuppression({ personId: data.id, channel: 'sms', reason: 'no-sms-consent' })
    if (opts?.smsConsent !== true) {
      await addSuppression({ personId: data.id, channel: 'sms', reason: 'no-sms-consent', source: 'lead-form' })
    }
  } catch (e) {
    console.error('[autoEnrollByFubId] sms-consent suppression failed', e)
  }
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
      const tags = (p.tags ?? []) as string[]
      // High-intent signals a real inquiry leaves and a bare site sign-in does not:
      // a phone number, or an inquiry/source/channel tag from a form submission.
      const { data: phoneRows } = await sb
        .from('crm_contact_points')
        .select('id')
        .eq('person_id', p.id)
        .eq('kind', 'phone')
        .limit(1)
      const hasPhone = (phoneRows ?? []).length > 0
      const sourceStr = (p.source ?? '').trim().toLowerCase()
      const isSiteDomainSource = sourceStr === 'ryan-realty.com' || sourceStr.endsWith('.ryan-realty.com')
      const highIntent = tags.some(
        (t) =>
          t.startsWith('audience:') ||
          (t.startsWith('source:') && t.includes('-lp')) ||
          t.startsWith('intent:') ||
          t.startsWith('channel:fb-ads') ||
          t.startsWith('source:fb-ads'),
      )
      // A bare website sign-in (Google / SSO): source is the site itself, no
      // phone, and none of the inquiry tags a form submission applies. This is
      // someone browsing, NOT a lead who asked for anything.
      const isSiteSignin = isSiteDomainSource && !highIntent && !hasPhone
      if (isSiteSignin) {
        body = [
          `Website sign-in (browsing), low intent.`,
          `${p.name ?? 'Someone'} just signed in on ryan-realty.com. No phone, no message, no form submission. They are browsing, not an inquiry.`,
          `Open the lead: ryan-realty.com/admin/crm/${p.id}`,
        ].join('\n')
      } else if (result.enrolled) {
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
            ? `First ${preview.channel === 'sms' ? 'text' : 'email'} sending now: "${preview.body}"`
            : `Enrolled in "${result.sequence}". First touch sending now.`,
          `Open the lead: ryan-realty.com/admin/crm/${p.id}`,
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
