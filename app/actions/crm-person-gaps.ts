'use server'

/**
 * CRM person-detail parity gap actions -- delivery order #6 (paragraph 07):
 *
 *   1. Collaborators: addCrmCollaboratorAction / removeCrmCollaboratorAction
 *   2. Merge/dedup:   searchPeopleForMergeAction / mergeCrmContactAction
 *
 * Action-plan pause/resume/stop are already in app/actions/crm.ts
 * (pauseEnrollmentAction, resumeEnrollmentAction, dismissEnrollmentAction).
 *
 * Destructive operations (merge) write a system timeline entry on the survivor
 * so the action is permanently auditable, matching the FUB Change Log pattern.
 *
 * Deferred from the merge:
 *   - Field-level picker (which name/email/phone wins -- survivor always wins here)
 *   - crm_deals re-pointing (no person_id FK on crm_deals yet)
 *   - Hard-delete (soft-delete only for reversibility via the Trash stage)
 *   - Unmerge (not supported per FUB spec paragraphs 7a/4.2)
 */

import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { getCrmAccess, requirePersonInScope } from '@/app/actions/crm'
import { scopeBroker } from '@/lib/crm/scope'
import { CRM_BROKERS, CRM_BROKER_DISPLAY, type CrmBrokerSlug } from '@/lib/crm/constants'

export type CrmPersonGapResult = { ok: true } | { ok: false; error: string }

const BASE = '/admin/console/leads'

// ---- Collaborators ----------------------------------------------------------

/**
 * Add a broker as a collaborator on a contact. The assigned_broker is excluded
 * (they already own the record). Idempotent -- safe to call if already added.
 */
export async function addCrmCollaboratorAction(
  personId: number,
  brokerSlug: string,
): Promise<CrmPersonGapResult> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }
  const scope = await requirePersonInScope(personId, access)
  if (!scope.ok) return scope

  if (!CRM_BROKERS.includes(brokerSlug as CrmBrokerSlug)) {
    return { ok: false, error: `Unknown broker slug: ${brokerSlug}` }
  }

  const sb = createServiceClient()

  // Guard: don't add the assigned broker as a collaborator
  const { data: person } = await sb
    .from('crm_people')
    .select('assigned_broker')
    .eq('id', personId)
    .single()

  if ((person as { assigned_broker?: string | null } | null)?.assigned_broker === brokerSlug) {
    const display = CRM_BROKER_DISPLAY[brokerSlug as CrmBrokerSlug] ?? brokerSlug
    return { ok: false, error: `${display} is already the assigned broker.` }
  }

  const { error } = await sb.from('crm_people_collaborators').upsert(
    { person_id: personId, broker_slug: brokerSlug, added_by: access.email },
    { onConflict: 'person_id,broker_slug' },
  )

  if (error) return { ok: false, error: error.message }

  await sb.from('crm_timeline').insert({
    person_id: personId,
    kind: 'system',
    title: `${CRM_BROKER_DISPLAY[brokerSlug as CrmBrokerSlug] ?? brokerSlug} added as collaborator by ${access.email}`,
    source: 'app',
    broker: access.brokerSlug ?? null,
  })

  return { ok: true }
}

/**
 * Remove a broker from a contact's collaborator list.
 */
export async function removeCrmCollaboratorAction(
  personId: number,
  brokerSlug: string,
): Promise<CrmPersonGapResult> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }
  const scope = await requirePersonInScope(personId, access)
  if (!scope.ok) return scope

  const sb = createServiceClient()
  const { error } = await sb
    .from('crm_people_collaborators')
    .delete()
    .eq('person_id', personId)
    .eq('broker_slug', brokerSlug)

  if (error) return { ok: false, error: error.message }

  await sb.from('crm_timeline').insert({
    person_id: personId,
    kind: 'system',
    title: `${CRM_BROKER_DISPLAY[brokerSlug as CrmBrokerSlug] ?? brokerSlug} removed as collaborator by ${access.email}`,
    source: 'app',
    broker: access.brokerSlug ?? null,
  })

  return { ok: true }
}

// ---- Merge: candidate search ------------------------------------------------

export type MergeCandidate = {
  id: number
  name: string | null
  email: string | null
  phone: string | null
  stage: string
}

/**
 * Search existing contacts by name to find a merge candidate.
 * Returns up to 20 results, excluding the current contact and deleted contacts.
 * Called directly from the MergeContactDialog client component via useTransition.
 */
export async function searchPeopleForMergeAction(
  query: string,
  excludeId: number,
): Promise<MergeCandidate[]> {
  const access = await getCrmAccess()
  if (!access) return []

  const q = query.trim()
  if (q.length < 2) return []

  const sb = createServiceClient()

  // Scope the candidate list to the caller's own book — a restricted broker must
  // not enumerate (or merge into) another broker's contacts. Superuser (null) sees all.
  const slug = scopeBroker(access)
  let qb = sb
    .from('crm_people')
    .select('id, name, emails, phones, stage')
    .neq('id', excludeId)
    .eq('deleted', false)
    .ilike('name', `%${q}%`)
  if (slug) qb = qb.eq('assigned_broker', slug)
  const { data } = await qb.order('name', { ascending: true }).limit(20)

  if (!data) return []

  return data.map((row) => {
    const emails = Array.isArray(row.emails) ? (row.emails as Array<{ value?: string }>) : []
    const phones = Array.isArray(row.phones) ? (row.phones as Array<{ value?: string }>) : []
    return {
      id: Number(row.id),
      name: row.name ?? null,
      email: emails[0]?.value ?? null,
      phone: phones[0]?.value ?? null,
      stage: String(row.stage ?? 'Lead'),
    }
  })
}

/**
 * Inbox unknown-caller "or update an existing person" (spec §08 §9.2, AC-19):
 * merge the placeholder unknown-caller record INTO an existing contact. The
 * existing contact survives; the placeholder's timeline (the calls/texts that
 * created the thread) moves onto it; the placeholder is soft-deleted. Returns a
 * result instead of redirecting so the inline inbox panel can refresh in place.
 */
export async function linkUnknownCallerToPersonAction(
  existingPersonId: number,
  placeholderPersonId: number,
): Promise<CrmPersonGapResult> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }
  const survivorId = Number(existingPersonId)
  const mergedId = Number(placeholderPersonId)
  if (!Number.isFinite(survivorId) || survivorId <= 0 || !Number.isFinite(mergedId) || mergedId <= 0) {
    return { ok: false, error: 'Both contacts are required' }
  }
  if (survivorId === mergedId) return { ok: false, error: 'Cannot link a contact to itself' }
  // Both sides must be in the caller's scope — merge moves timeline/tasks across
  // records, so a restricted broker must own each end.
  const survivorScope = await requirePersonInScope(survivorId, access)
  if (!survivorScope.ok) return survivorScope
  const mergedScope = await requirePersonInScope(mergedId, access)
  if (!mergedScope.ok) return mergedScope

  const sb = createServiceClient()
  const [{ data: survivor }, { data: merged }] = await Promise.all([
    sb.from('crm_people').select('id, name').eq('id', survivorId).eq('deleted', false).maybeSingle(),
    sb.from('crm_people').select('id, name').eq('id', mergedId).eq('deleted', false).maybeSingle(),
  ])
  if (!survivor) return { ok: false, error: 'Existing contact not found' }
  if (!merged) return { ok: false, error: 'Caller record not found or already merged' }

  const mergedName = (merged as { name?: string | null }).name ?? `Contact #${mergedId}`
  await mergePairInternal(sb, access, survivorId, mergedId, mergedName)
  return { ok: true }
}

// ---- Merge: execute ---------------------------------------------------------

/**
 * Safe minimal contact merge (FormData -- used as a Next.js form action from the
 * MergeContactDialog client component).
 *
 * Survivor keeps all its own fields. The duplicate's timeline, tasks, and
 * sequence enrollments move to the survivor. The duplicate is soft-deleted
 * (stage=Trash, deleted=true) -- NOT hard-deleted, for reversibility.
 *
 * What is deferred:
 *   Field-level picker (survivor wins on all fields here).
 *   crm_deals re-pointing (no person_id FK on crm_deals in current schema).
 *   Hard-delete / permanent removal.
 *   Unmerge (not supported; logged in the audit trail).
 */
export async function mergeCrmContactAction(formData: FormData): Promise<void> {
  const survivorId = Number(formData.get('survivorId'))
  const mergedId = Number(formData.get('mergedId'))

  function errRedirect(msg: string): never {
    redirect(`${BASE}/${survivorId}?error=${encodeURIComponent(msg)}`)
  }

  const access = await getCrmAccess()
  if (!access) errRedirect('Not authorized.')

  if (!Number.isFinite(survivorId) || !Number.isFinite(mergedId)) {
    errRedirect('Invalid contact IDs.')
  }
  if (survivorId === mergedId) {
    errRedirect('Cannot merge a contact with itself.')
  }
  // Both sides must be in the caller's scope (superuser passes unconditionally).
  const survivorScope = await requirePersonInScope(survivorId, access)
  if (!survivorScope.ok) errRedirect(survivorScope.error)
  const mergedScope = await requirePersonInScope(mergedId, access)
  if (!mergedScope.ok) errRedirect(mergedScope.error)

  const sb = createServiceClient()

  const [{ data: survivor }, { data: merged }] = await Promise.all([
    sb.from('crm_people').select('id, name').eq('id', survivorId).eq('deleted', false).maybeSingle(),
    sb.from('crm_people').select('id, name').eq('id', mergedId).eq('deleted', false).maybeSingle(),
  ])

  if (!survivor) errRedirect('Surviving contact not found.')
  if (!merged) errRedirect('Contact to merge not found or already deleted.')

  const mergedName =
    (merged as { name?: string | null } | null)?.name ?? `Contact #${mergedId}`

  await mergePairInternal(sb, access!, survivorId, mergedId, mergedName)

  redirect(
    `${BASE}/${survivorId}?flash=${encodeURIComponent(`Merged with "${mergedName}". The duplicate has been archived.`)}`,
  )
}

/**
 * The merge steps shared by the single-pair form action and the §14.3 bulk
 * "Merge People" action. Survivor keeps its fields; the duplicate's timeline,
 * tasks, enrollments, relationships, and collaborators move; the duplicate is
 * soft-deleted (stage=Trash, deleted=true) with a permanent audit row.
 */
async function mergePairInternal(
  sb: ReturnType<typeof createServiceClient>,
  access: { email: string; brokerSlug: string | null },
  survivorId: number,
  mergedId: number,
  mergedName: string,
): Promise<void> {
  // 1. Timeline
  await sb.from('crm_timeline').update({ person_id: survivorId }).eq('person_id', mergedId)

  // 2. Tasks
  await sb.from('crm_tasks').update({ person_id: survivorId }).eq('person_id', mergedId)

  // 3. Sequence enrollments: re-point or stop (if survivor already enrolled)
  const LIVE = ['running', 'paused', 'paused_reply', 'awaiting_broker', 'awaiting_broker_next']
  const [{ data: mergedE }, { data: survivorE }] = await Promise.all([
    sb
      .from('crm_sequence_enrollments')
      .select('id, sequence_id')
      .eq('person_id', mergedId)
      .in('status', LIVE),
    sb
      .from('crm_sequence_enrollments')
      .select('sequence_id')
      .eq('person_id', survivorId)
      .in('status', LIVE),
  ])

  if (mergedE && mergedE.length > 0) {
    const survivorSeqs = new Set((survivorE ?? []).map((e) => Number(e.sequence_id)))
    const toRepoint: number[] = []
    const toStop: number[] = []
    for (const e of mergedE) {
      if (survivorSeqs.has(Number(e.sequence_id))) {
        toStop.push(Number(e.id))
      } else {
        toRepoint.push(Number(e.id))
      }
    }
    await Promise.all([
      toRepoint.length > 0
        ? sb.from('crm_sequence_enrollments').update({ person_id: survivorId }).in('id', toRepoint)
        : Promise.resolve(),
      toStop.length > 0
        ? sb.from('crm_sequence_enrollments').update({ status: 'stopped' }).in('id', toStop)
        : Promise.resolve(),
    ])
  }

  // 4. Relationships (both directions)
  await Promise.all([
    sb.from('crm_relationships').update({ person_id: survivorId }).eq('person_id', mergedId),
    sb
      .from('crm_relationships')
      .update({ related_person_id: survivorId })
      .eq('related_person_id', mergedId),
  ])

  // 5. Collaborators (upsert to skip conflicts)
  const { data: mergedCollabs } = await sb
    .from('crm_people_collaborators')
    .select('broker_slug, added_by')
    .eq('person_id', mergedId)
  for (const c of mergedCollabs ?? []) {
    await sb.from('crm_people_collaborators').upsert(
      {
        person_id: survivorId,
        broker_slug: c.broker_slug,
        added_by: (c as { added_by?: string }).added_by ?? 'merge',
      },
      { onConflict: 'person_id,broker_slug' },
    )
  }

  // 6. Soft-delete the duplicate
  await sb
    .from('crm_people')
    .update({ stage: 'Trash', deleted: true, updated_at: new Date().toISOString() })
    .eq('id', mergedId)

  // 7. Permanent audit trail on survivor
  await sb.from('crm_timeline').insert({
    person_id: survivorId,
    kind: 'system',
    title: `Merged with "${mergedName}" (ID ${mergedId}) by ${access.email}. Duplicate archived to Trash. Unmerge not supported.`,
    source: 'app',
    broker: access.brokerSlug ?? null,
  })
}

/**
 * §14.3 #8 "Merge People" bulk action: consolidate up to 10 selected duplicates
 * into one survivor. FUB hard limit of 10 replicated. Runs the same merge steps
 * as the single-pair action per duplicate; returns a result instead of
 * redirecting so the bulk bar can show the outcome inline.
 */
export async function bulkMergePeopleAction(input: {
  survivorId: number
  mergedIds: number[]
}): Promise<{ ok: true; merged: number } | { ok: false; error: string }> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Not authorized.' }

  const survivorId = Number(input.survivorId)
  const mergedIds = Array.from(new Set((input.mergedIds ?? []).map(Number))).filter(
    (n) => Number.isInteger(n) && n > 0 && n !== survivorId,
  )
  if (!Number.isInteger(survivorId) || survivorId <= 0) {
    return { ok: false, error: 'Pick the surviving contact.' }
  }
  if (mergedIds.length === 0) return { ok: false, error: 'Select at least one duplicate to merge.' }
  if (mergedIds.length > 9) {
    return { ok: false, error: 'Merge is capped at 10 contacts at once.' }
  }

  const survivorScope = await requirePersonInScope(survivorId, access)
  if (!survivorScope.ok) return survivorScope

  const sb = createServiceClient()
  const { data: survivor } = await sb
    .from('crm_people')
    .select('id, name')
    .eq('id', survivorId)
    .eq('deleted', false)
    .maybeSingle()
  if (!survivor) return { ok: false, error: 'Surviving contact not found.' }

  let merged = 0
  for (const mergedId of mergedIds) {
    // Skip any duplicate outside the caller's scope rather than pulling another
    // broker's contact into the survivor.
    const dupScope = await requirePersonInScope(mergedId, access)
    if (!dupScope.ok) continue
    const { data: dup } = await sb
      .from('crm_people')
      .select('id, name')
      .eq('id', mergedId)
      .eq('deleted', false)
      .maybeSingle()
    if (!dup) continue
    const mergedName = (dup as { name?: string | null }).name ?? `Contact #${mergedId}`
    await mergePairInternal(sb, access, survivorId, mergedId, mergedName)
    merged++
  }
  if (merged === 0) return { ok: false, error: 'No mergeable contacts found (already deleted?).' }
  return { ok: true, merged }
}
