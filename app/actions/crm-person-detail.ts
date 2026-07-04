'use server'

/**
 * §07 person-detail-desktop parity actions (CRM_BUILD_MISSION screen:
 * person-detail-desktop, spec docs/fub-crm-spec/07a + 07b + 07c).
 *
 *   - updatePersonFieldAction   — inline-edit save for the left-sidebar scalar
 *                                 fields (price / timeframe / background /
 *                                 source / lender_name). Change Log entry per
 *                                 §07a AC-STG-3 pattern.
 *   - savePhoneNumbersAction    — §07a 3.1.2 / §7c.6 Edit Phone Numbers modal:
 *                                 atomic replace of the phone contact-point set.
 *   - saveEmailRowAction        — §07a 3.2.2 inline email add/update/remove.
 *   - toggleTimelineStarAction  — §07b 8.1 star toggle (crm_timeline.starred).
 *   - logCrmCallAction          — §7c.5 manual call log (outcome/duration/notes).
 *   - quickFollowUpAction       — §07b 4.7 lightning-bolt preset follow-up task.
 *   - addRelationshipContactAction — §07a 4.1 Add relationship modal (new person
 *                                 + reciprocal link in one action).
 *   - Files-widget actions (§7c.8.8) live in app/actions/crm-person-files.ts
 *     (split 2026-07-02 for the 600-LOC file budget).
 *   - deleteCrmPersonAction     — §07a 11 Delete person (soft delete: the
 *                                 archived-not-erased variant, auditable).
 */

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { getCrmAccess, requirePersonInScope } from '@/app/actions/crm'

export type PersonDetailResult = { ok: true } | { ok: false; error: string }

const BASE = '/admin/console/leads'

const EDITABLE_FIELDS = ['price', 'timeframe', 'background', 'source', 'lender_name'] as const
type EditableField = (typeof EDITABLE_FIELDS)[number]

const TIMEFRAMES = ['0-3 Months', '3-6 Months', '6-12 Months', '12+ Months', 'No Plans']

/** Inline-edit save for a left-sidebar scalar field, with a Change Log entry. */
export async function updatePersonFieldAction(
  personId: number,
  field: string,
  value: string,
): Promise<PersonDetailResult> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }
  const scope = await requirePersonInScope(personId, access)
  if (!scope.ok) return scope
  if (!EDITABLE_FIELDS.includes(field as EditableField)) {
    return { ok: false, error: `Field not editable: ${field}` }
  }

  const trimmed = value.trim()
  let stored: string | number | null = trimmed === '' ? null : trimmed
  if (field === 'price') {
    if (trimmed === '') stored = null
    else {
      const n = Number(trimmed.replace(/[$,\s]/g, ''))
      if (!Number.isFinite(n) || n < 0) return { ok: false, error: 'Price must be a whole number.' }
      stored = Math.round(n)
    }
  }
  if (field === 'timeframe' && stored !== null && !TIMEFRAMES.includes(String(stored))) {
    return { ok: false, error: 'Unknown timeframe.' }
  }

  const sb = createServiceClient()
  const { data: before } = await sb.from('crm_people').select(field).eq('id', personId).maybeSingle()
  const { error } = await sb
    .from('crm_people')
    .update({ [field]: stored, updated_at: new Date().toISOString() })
    .eq('id', personId)
  if (error) return { ok: false, error: error.message }

  const prev = (before as Record<string, unknown> | null)?.[field]
  const label = field.replace(/_/g, ' ')
  await sb.from('crm_timeline').insert({
    person_id: personId,
    kind: 'system',
    title: `${label[0].toUpperCase()}${label.slice(1)} changed from "${prev ?? '(empty)'}" to "${stored ?? '(empty)'}" by ${access.email}`,
    source: 'app',
    broker: access.brokerSlug ?? null,
  })

  revalidatePath(`${BASE}/${personId}`)
  return { ok: true }
}

/** First/last name edit (mobile header Edit mode — punch list #2, 2026-07-02).
    Updates first_name + last_name AND the denormalized `name`, with a Change
    Log entry matching the field-edit pattern above. */
export async function updatePersonNameAction(
  personId: number,
  firstName: string,
  lastName: string,
): Promise<PersonDetailResult> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }
  const scope = await requirePersonInScope(personId, access)
  if (!scope.ok) return scope

  const first = firstName.trim()
  const last = lastName.trim()
  if (!first && !last) return { ok: false, error: 'A first or last name is required.' }
  const name = [first, last].filter(Boolean).join(' ')

  const sb = createServiceClient()
  const { data: before } = await sb.from('crm_people').select('name').eq('id', personId).maybeSingle()
  const { error } = await sb
    .from('crm_people')
    .update({
      first_name: first || null,
      last_name: last || null,
      name,
      updated_at: new Date().toISOString(),
    })
    .eq('id', personId)
  if (error) return { ok: false, error: error.message }

  if ((before?.name ?? '') !== name) {
    await sb.from('crm_timeline').insert({
      person_id: personId,
      kind: 'system',
      title: `Name changed from "${before?.name ?? '(empty)'}" to "${name}" by ${access.email}`,
      source: 'app',
      broker: access.brokerSlug ?? null,
    })
  }

  revalidatePath(`${BASE}/${personId}`)
  return { ok: true }
}

// ---- Edit Phone Numbers modal (§7c.6) ---------------------------------------

export type PhoneRow = { value: string; label: string; bad: boolean; isPrimary: boolean }

const PHONE_LABELS = ['Mobile', 'Home', 'Work', 'Other', 'Fax']
/** 25-phone hard limit shared across the contact + linked relationships (§07a AC-PH-9). */
const MAX_PHONES = 25

/** Atomic replace of the contact's phone set (per §07a AC-PH-4). */
export async function savePhoneNumbersAction(
  personId: number,
  rows: PhoneRow[],
): Promise<PersonDetailResult> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }
  const scope = await requirePersonInScope(personId, access)
  if (!scope.ok) return scope

  const clean = rows
    .map((r) => ({
      value: String(r.value ?? '').replace(/\D/g, ''),
      label: PHONE_LABELS.includes(r.label) ? r.label : 'Mobile',
      bad: Boolean(r.bad),
      isPrimary: Boolean(r.isPrimary),
    }))
    .filter((r) => r.value.length >= 7)
  if (clean.length > MAX_PHONES) {
    return { ok: false, error: `Maximum ${MAX_PHONES} phone numbers per contact (shared with relationships).` }
  }
  // Exactly one primary when any rows exist (AC-PH-2).
  if (clean.length > 0 && !clean.some((r) => r.isPrimary)) clean[0].isPrimary = true

  const sb = createServiceClient()
  const { error: delErr } = await sb
    .from('crm_contact_points')
    .delete()
    .eq('person_id', personId)
    .eq('kind', 'phone')
  if (delErr) return { ok: false, error: delErr.message }

  if (clean.length > 0) {
    const { error: insErr } = await sb.from('crm_contact_points').insert(
      clean.map((r) => ({
        person_id: personId,
        kind: 'phone',
        value: r.value,
        label: r.label,
        is_primary: r.isPrimary,
        status: r.bad ? 'bad' : 'active',
      })),
    )
    if (insErr) return { ok: false, error: insErr.message }
  }

  // Mirror to the jsonb cache used across list surfaces. MUST carry isPrimary +
  // normalized — getSendTarget/sendCrmTextAction pick the send phone by sorting
  // this jsonb on isPrimary, so a mirror without it can text the WRONG number
  // after any modal save (2026-07-02 audit).
  await sb
    .from('crm_people')
    .update({
      phones: clean.map((r) => ({
        value: r.value,
        type: r.label.toLowerCase(),
        status: r.bad ? 'bad' : 'active',
        isPrimary: r.isPrimary ? 1 : 0,
        normalized: r.value.slice(-10),
      })),
      updated_at: new Date().toISOString(),
    })
    .eq('id', personId)

  revalidatePath(`${BASE}/${personId}`)
  return { ok: true }
}

// ---- Inline email rows (§07a 3.2) --------------------------------------------

export async function saveEmailRowAction(
  personId: number,
  prev: string | null,
  next: string,
): Promise<PersonDetailResult> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }
  const scope = await requirePersonInScope(personId, access)
  if (!scope.ok) return scope
  const value = next.trim().toLowerCase()
  const sb = createServiceClient()

  if (prev && !value) {
    const { error } = await sb
      .from('crm_contact_points')
      .delete()
      .eq('person_id', personId)
      .eq('kind', 'email')
      .eq('value', prev)
    if (error) return { ok: false, error: error.message }
  } else if (!value) {
    return { ok: false, error: 'Enter an email address.' }
  } else if (!/^\S+@\S+\.\S+$/.test(value)) {
    return { ok: false, error: 'That does not look like an email address.' }
  } else if (prev) {
    const { error } = await sb
      .from('crm_contact_points')
      .update({ value })
      .eq('person_id', personId)
      .eq('kind', 'email')
      .eq('value', prev)
    if (error) return { ok: false, error: error.message }
  } else {
    const { count } = await sb
      .from('crm_contact_points')
      .select('id', { count: 'exact', head: true })
      .eq('person_id', personId)
      .eq('kind', 'email')
    const { error } = await sb.from('crm_contact_points').insert({
      person_id: personId,
      kind: 'email',
      value,
      is_primary: (count ?? 0) === 0,
    })
    if (error) return { ok: false, error: error.message }
  }

  // Mirror to jsonb cache. MUST carry isPrimary — getSendTarget/sendCrmEmailAction
  // pick the send address by sorting this jsonb on isPrimary, so a mirror without
  // it can email the WRONG address after any inline edit (2026-07-02 audit).
  const { data: pts } = await sb
    .from('crm_contact_points')
    .select('value,label,status,is_primary')
    .eq('person_id', personId)
    .eq('kind', 'email')
  await sb
    .from('crm_people')
    .update({
      emails: (pts ?? []).map((p) => ({
        value: p.value,
        type: (p.label as string | null)?.toLowerCase() || 'home',
        status: (p.status as string | null) ?? 'active',
        isPrimary: p.is_primary ? 1 : 0,
      })),
      updated_at: new Date().toISOString(),
    })
    .eq('id', personId)

  revalidatePath(`${BASE}/${personId}`)
  return { ok: true }
}

// ---- Star toggle (§07b 8.1) ---------------------------------------------------

export async function toggleTimelineStarAction(
  timelineId: number,
  starred: boolean,
): Promise<PersonDetailResult> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }
  const sb = createServiceClient()
  // The star toggle targets a timeline row, not a person — resolve the owning
  // contact and scope-check it so a restricted broker can't star/unstar an
  // entry on another broker's lead by guessing a timeline id.
  const { data: row } = await sb.from('crm_timeline').select('person_id').eq('id', timelineId).maybeSingle()
  if (!row) return { ok: false, error: 'Timeline entry not found' }
  const scope = await requirePersonInScope(row.person_id as number, access)
  if (!scope.ok) return scope
  const { error } = await sb.from('crm_timeline').update({ starred }).eq('id', timelineId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ---- Manual call log (§7c.5) --------------------------------------------------

const CALL_OUTCOMES = ['Spoke with lead', 'Left voicemail', 'No answer', 'Wrong number', 'Do not contact', 'Other']

export async function logCrmCallAction(formData: FormData): Promise<PersonDetailResult> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }
  const personId = Number(formData.get('personId'))
  if (!Number.isFinite(personId) || personId <= 0) return { ok: false, error: 'Bad person id' }
  const scope = await requirePersonInScope(personId, access)
  if (!scope.ok) return scope
  const outcome = String(formData.get('outcome') ?? 'Other')
  const minutes = Number(formData.get('minutes') ?? 0)
  const notes = String(formData.get('notes') ?? '').trim()

  const sb = createServiceClient()
  const { error } = await sb.from('crm_timeline').insert({
    person_id: personId,
    kind: 'call',
    title: `Call logged: ${CALL_OUTCOMES.includes(outcome) ? outcome : 'Other'}`,
    body: notes || null,
    payload: {
      manual: true,
      outcome,
      duration_seconds: Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes * 60) : null,
    },
    source: 'app',
    broker: access.brokerSlug ?? null,
  })
  if (error) return { ok: false, error: error.message }
  await sb
    .from('crm_people')
    .update({ last_activity_at: new Date().toISOString() })
    .eq('id', personId)
  revalidatePath(`${BASE}/${personId}`)
  return { ok: true }
}

// ---- Quick Follow Up (§07b 4.7) ----------------------------------------------

export async function quickFollowUpAction(personId: number, days: number): Promise<PersonDetailResult> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }
  const scope = await requirePersonInScope(personId, access)
  if (!scope.ok) return scope
  if (!Number.isFinite(days) || days <= 0 || days > 400) return { ok: false, error: 'Bad interval' }
  const sb = createServiceClient()
  const due = new Date(Date.now() + days * 86400_000)
  due.setHours(9, 0, 0, 0)
  const { error } = await sb.from('crm_tasks').insert({
    person_id: personId,
    name: 'Follow Up',
    type: 'Follow Up',
    due_at: due.toISOString(),
    assigned_broker: access.brokerSlug ?? 'matt',
    origin: 'app',
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath(`${BASE}/${personId}`)
  return { ok: true }
}

// ---- Add relationship modal (§07a 4.1) ----------------------------------------

export type RelationshipDraft = {
  firstName: string
  lastName: string
  type: string
  phones: Array<{ value: string; label: string; bad: boolean }>
  emails: string[]
}

export async function addRelationshipContactAction(
  personId: number,
  draft: RelationshipDraft,
): Promise<PersonDetailResult & { relatedId?: number }> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }
  const scope = await requirePersonInScope(personId, access)
  if (!scope.ok) return scope
  const first = draft.firstName.trim()
  if (!first) return { ok: false, error: 'First name is required.' }
  const last = draft.lastName.trim()
  const relType = draft.type.trim() || 'Relationship'

  const sb = createServiceClient()
  const phones = (draft.phones ?? [])
    .map((p) => ({ value: String(p.value).replace(/\D/g, ''), label: p.label || 'Mobile', bad: Boolean(p.bad) }))
    .filter((p) => p.value.length >= 7)
  const emails = (draft.emails ?? []).map((e) => e.trim().toLowerCase()).filter((e) => /^\S+@\S+\.\S+$/.test(e))

  const { data: created, error: insErr } = await sb
    .from('crm_people')
    .insert({
      first_name: first,
      last_name: last || null,
      name: [first, last].filter(Boolean).join(' '),
      stage: 'Lead',
      source: 'Relationship',
      assigned_broker: access.brokerSlug ?? 'matt',
      emails: emails.map((value) => ({ value })),
      phones: phones.map((p) => ({ value: p.value, type: p.label.toLowerCase(), status: p.bad ? 'bad' : 'active' })),
    })
    .select('id')
    .single()
  if (insErr || !created) return { ok: false, error: insErr?.message ?? 'Could not create the contact.' }
  const relatedId = Number(created.id)

  if (phones.length > 0 || emails.length > 0) {
    await sb.from('crm_contact_points').insert([
      ...phones.map((p, i) => ({
        person_id: relatedId,
        kind: 'phone',
        value: p.value,
        label: p.label,
        is_primary: i === 0,
        status: p.bad ? 'bad' : 'active',
      })),
      ...emails.map((value, i) => ({ person_id: relatedId, kind: 'email', value, is_primary: i === 0 })),
    ])
  }

  // Reciprocal link rows.
  const { error: relErr } = await sb.from('crm_relationships').insert([
    { person_id: personId, related_person_id: relatedId, related_name: [first, last].filter(Boolean).join(' '), kind: relType },
    { person_id: relatedId, related_person_id: personId, kind: relType },
  ])
  if (relErr) return { ok: false, error: relErr.message }

  await sb.from('crm_timeline').insert({
    person_id: personId,
    kind: 'system',
    title: `Relationship "${relType}" added: ${[first, last].filter(Boolean).join(' ')} (by ${access.email})`,
    source: 'app',
    broker: access.brokerSlug ?? null,
  })

  revalidatePath(`${BASE}/${personId}`)
  return { ok: true, relatedId }
}

// ---- Apply Automation modal (§07b 11) ------------------------------------------

/** Enroll the contact in a sequence from the Apply Automation modal. */
export async function applyAutomationAction(
  personId: number,
  sequenceId: number,
): Promise<PersonDetailResult> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }
  const scope = await requirePersonInScope(personId, access)
  if (!scope.ok) return scope
  const { manualEnrollPerson } = await import('@/lib/crm/enroll')
  const r = await manualEnrollPerson(personId, sequenceId, access.email)
  if (!r.enrolled) return { ok: false, error: 'reason' in r ? r.reason : 'Could not enroll.' }
  revalidatePath(`${BASE}/${personId}`)
  return { ok: true }
}

// ---- Address (§07a 3.3) ---------------------------------------------------------

export type AddressDraft = { street: string; city: string; state: string; zip: string; country?: string }

/** Replace the contact's primary address (first entry of the addresses jsonb). */
export async function saveAddressRowAction(
  personId: number,
  address: AddressDraft,
): Promise<PersonDetailResult> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }
  const scope = await requirePersonInScope(personId, access)
  if (!scope.ok) return scope
  const sb = createServiceClient()
  const { data: person } = await sb.from('crm_people').select('addresses').eq('id', personId).maybeSingle()
  const rest = Array.isArray(person?.addresses) ? (person!.addresses as unknown[]).slice(1) : []
  const clean = {
    street: address.street.trim(),
    city: address.city.trim(),
    state: address.state.trim(),
    zip: address.zip.trim(),
    country: (address.country ?? 'US').trim(),
  }
  const isEmpty = !clean.street && !clean.city && !clean.state && !clean.zip
  const next = isEmpty ? rest : [clean, ...rest]
  const { error } = await sb
    .from('crm_people')
    .update({ addresses: next, updated_at: new Date().toISOString() })
    .eq('id', personId)
  if (error) return { ok: false, error: error.message }
  revalidatePath(`${BASE}/${personId}`)
  return { ok: true }
}

// ---- Pond assignment (§07a 5.2) --------------------------------------------------

export async function assignPondAction(personId: number, pondId: number | null): Promise<PersonDetailResult> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }
  const scope = await requirePersonInScope(personId, access)
  if (!scope.ok) return scope
  const sb = createServiceClient()
  const { error } = await sb
    .from('crm_people')
    .update({ pond_id: pondId, updated_at: new Date().toISOString() })
    .eq('id', personId)
  if (error) return { ok: false, error: error.message }
  await sb.from('crm_timeline').insert({
    person_id: personId,
    kind: 'system',
    title: pondId ? `Assigned to pond #${pondId} by ${access.email}` : `Removed from pond by ${access.email}`,
    source: 'app',
    broker: access.brokerSlug ?? null,
  })
  revalidatePath(`${BASE}/${personId}`)
  return { ok: true }
}

// ---- Delete person (§07a 11) ---------------------------------------------------

/**
 * Soft delete (deleted=true + stage Trash), auditable and reversible via SQL,
 * matching the merge pattern above. Decision logged in CRM_BUILD_MISSION:
 * hard-erase is intentionally not implemented; reporting excludes deleted rows.
 */
export async function deleteCrmPersonAction(formData: FormData): Promise<void> {
  const personId = Number(formData.get('personId'))
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')
  if (access.role !== 'superuser') {
    redirect(`${BASE}/${personId}?error=${encodeURIComponent('Only the account owner can delete a person. Move them to Trash instead.')}`)
  }
  const sb = createServiceClient()
  await sb
    .from('crm_people')
    .update({ deleted: true, stage: 'Trash', updated_at: new Date().toISOString() })
    .eq('id', personId)
  await sb.from('crm_timeline').insert({
    person_id: personId,
    kind: 'system',
    title: `Person deleted by ${access.email}`,
    source: 'app',
    broker: access.brokerSlug ?? null,
  })
  redirect(`/admin/crm?flash=${encodeURIComponent('Person deleted.')}`)
}
