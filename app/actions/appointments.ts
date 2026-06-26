'use server'

/**
 * Appointment server actions — create + update for /admin/crm/calendar.
 *
 * Access: any admin (broker or superuser). The broker_slug is pinned to the
 * caller's own CRM slug; a superuser may set it to any broker via the form.
 * start_at < end_at is validated before write (mirrors the DB CHECK constraint).
 *
 * GCal integration: write crm_appointments first. If GOOGLE_SERVICE_ACCOUNT_JSON
 * + DWD are configured, attempt a GCal insert and store the returned event id.
 * GCal failure is non-fatal — the appointment still persists locally and
 * invite_sent remains false. The caller can retry via a dedicated
 * "send invitation" button in future.
 */

import { revalidatePath, revalidateTag } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { getCrmAccess } from '@/app/actions/crm'
import { scopeBroker } from '@/lib/crm/scope'
import { CRM_BROKERS, type CrmBrokerSlug } from '@/lib/crm/constants'
import {
  CRM_APPOINTMENT_TYPES_TAG,
  CRM_APPOINTMENT_OUTCOMES_TAG,
} from '@/lib/data/crm/getAppointments'

type ActionResult = { ok: true; id?: number } | { ok: false; error: string }

// ── Helpers ──────────────────────────────────────────────────────────────────

function isBrokerSlug(v: string): v is CrmBrokerSlug {
  return (CRM_BROKERS as readonly string[]).includes(v)
}

/**
 * Coerce a datetime-local string (YYYY-MM-DDTHH:mm) to an ISO 8601 string
 * with seconds and the explicit Z so Postgres stores it as UTC.
 * Browsers emit "2026-07-04T09:00" from datetime-local inputs; Postgres needs
 * a full timestamptz. We treat the value as UTC (server is UTC, admins are
 * Pacific time but the calendar displays UTC labels — consistent with how
 * Google Calendar / FUB handle it for a single-timezone brokerage).
 */
function toTimestamptz(raw: string): string {
  if (!raw) throw new Error('Timestamp is required')
  // Already has seconds or timezone suffix — leave it alone.
  if (raw.length >= 19 && (raw.includes('Z') || raw.includes('+'))) return raw
  // Pad seconds if missing (YYYY-MM-DDTHH:mm → YYYY-MM-DDTHH:mm:00)
  const padded = raw.length === 16 ? `${raw}:00` : raw
  return `${padded}Z`
}

// ── createAppointmentAction ───────────────────────────────────────────────────

export async function createAppointmentAction(formData: FormData): Promise<ActionResult> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Not authorized' }

  const title       = (formData.get('title') as string | null)?.trim()
  const startRaw    = formData.get('startAt') as string | null
  const endRaw      = formData.get('endAt')   as string | null
  const allDay      = formData.get('allDay')  === 'true'
  const location    = (formData.get('location')    as string | null)?.trim() || null
  const description = (formData.get('description') as string | null)?.trim() || null
  const typeIdRaw   = formData.get('typeId')    as string | null
  const outcomeIdRaw = formData.get('outcomeId') as string | null
  const personIdRaw  = formData.get('personId')  as string | null
  const brokerSlugRaw = formData.get('brokerSlug') as string | null
  const guestIdsRaw  = formData.get('guestPersonIds') as string | null

  if (!title) return { ok: false, error: 'Title is required' }
  if (!startRaw) return { ok: false, error: 'Start date/time is required' }
  if (!endRaw)   return { ok: false, error: 'End date/time is required' }

  let startAt: string
  let endAt: string
  try {
    startAt = toTimestamptz(startRaw)
    endAt   = toTimestamptz(endRaw)
  } catch {
    return { ok: false, error: 'Invalid date/time format' }
  }

  if (startAt > endAt) return { ok: false, error: 'Start must be before end' }

  // Determine broker_slug: superuser may override; others use own slug.
  let brokerSlug: string
  if (access.role === 'superuser' && brokerSlugRaw && isBrokerSlug(brokerSlugRaw)) {
    brokerSlug = brokerSlugRaw
  } else {
    const ownSlug = scopeBroker(access)
    if (!ownSlug && access.role !== 'superuser') {
      return { ok: false, error: 'Could not resolve your broker slug' }
    }
    brokerSlug = ownSlug ?? 'matt'
  }

  const typeId    = typeIdRaw    ? parseInt(typeIdRaw, 10)    || null : null
  const outcomeId = outcomeIdRaw ? parseInt(outcomeIdRaw, 10) || null : null
  const personId  = personIdRaw  ? parseInt(personIdRaw, 10)  || null : null

  // Guest person ids — comma-separated or JSON array
  let guestPersonIds: number[] = []
  if (guestIdsRaw) {
    try {
      const parsed = JSON.parse(guestIdsRaw)
      if (Array.isArray(parsed)) guestPersonIds = parsed.map(Number).filter(Boolean)
    } catch {
      // fallback: comma-separated
      guestPersonIds = guestIdsRaw.split(',').map((s) => parseInt(s.trim(), 10)).filter(Boolean)
    }
  }

  const sb = createServiceClient()
  const { data, error } = await sb
    .from('crm_appointments')
    .insert({
      title,
      start_at: startAt,
      end_at: endAt,
      all_day: allDay,
      location,
      description,
      type_id: typeId,
      outcome_id: outcomeId,
      person_id: personId,
      broker_slug: brokerSlug,
      guest_person_ids: guestPersonIds,
      invite_sent: false,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[createAppointmentAction]', error.message)
    return { ok: false, error: 'Could not save appointment' }
  }

  revalidatePath('/admin/crm/calendar')
  revalidatePath('/admin')

  return { ok: true, id: data?.id ?? undefined }
}

// ── updateAppointmentAction ───────────────────────────────────────────────────

export async function updateAppointmentAction(
  id: number,
  formData: FormData,
): Promise<ActionResult> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Not authorized' }

  const sb = createServiceClient()

  // Ownership check: load the existing row first.
  const { data: existing, error: fetchErr } = await sb
    .from('crm_appointments')
    .select('id,broker_slug')
    .eq('id', id)
    .maybeSingle()

  if (fetchErr || !existing) return { ok: false, error: 'Appointment not found' }

  const ownSlug = scopeBroker(access)
  if (ownSlug && existing.broker_slug !== ownSlug) {
    return { ok: false, error: 'Not authorized to edit this appointment' }
  }

  const title       = (formData.get('title') as string | null)?.trim()
  const startRaw    = formData.get('startAt') as string | null
  const endRaw      = formData.get('endAt')   as string | null
  const allDay      = formData.get('allDay')  === 'true'
  const location    = (formData.get('location')    as string | null)?.trim() || null
  const description = (formData.get('description') as string | null)?.trim() || null
  const typeIdRaw   = formData.get('typeId')    as string | null
  const outcomeIdRaw = formData.get('outcomeId') as string | null
  const personIdRaw  = formData.get('personId')  as string | null
  const guestIdsRaw  = formData.get('guestPersonIds') as string | null

  if (!title) return { ok: false, error: 'Title is required' }
  if (!startRaw || !endRaw) return { ok: false, error: 'Start and end are required' }

  let startAt: string
  let endAt: string
  try {
    startAt = toTimestamptz(startRaw)
    endAt   = toTimestamptz(endRaw)
  } catch {
    return { ok: false, error: 'Invalid date/time format' }
  }

  if (startAt > endAt) return { ok: false, error: 'Start must be before end' }

  const typeId    = typeIdRaw    ? parseInt(typeIdRaw, 10)    || null : null
  const outcomeId = outcomeIdRaw ? parseInt(outcomeIdRaw, 10) || null : null
  const personId  = personIdRaw  ? parseInt(personIdRaw, 10)  || null : null

  let guestPersonIds: number[] = []
  if (guestIdsRaw) {
    try {
      const parsed = JSON.parse(guestIdsRaw)
      if (Array.isArray(parsed)) guestPersonIds = parsed.map(Number).filter(Boolean)
    } catch {
      guestPersonIds = guestIdsRaw.split(',').map((s) => parseInt(s.trim(), 10)).filter(Boolean)
    }
  }

  const { error } = await sb
    .from('crm_appointments')
    .update({
      title,
      start_at: startAt,
      end_at: endAt,
      all_day: allDay,
      location,
      description,
      type_id: typeId,
      outcome_id: outcomeId,
      person_id: personId,
      guest_person_ids: guestPersonIds,
    })
    .eq('id', id)

  if (error) {
    console.error('[updateAppointmentAction]', error.message)
    return { ok: false, error: 'Could not update appointment' }
  }

  revalidatePath('/admin/crm/calendar')
  revalidatePath('/admin')

  return { ok: true }
}

// ── deleteAppointmentAction ───────────────────────────────────────────────────

export async function deleteAppointmentAction(id: number): Promise<ActionResult> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Not authorized' }

  const sb = createServiceClient()

  const { data: existing, error: fetchErr } = await sb
    .from('crm_appointments')
    .select('id,broker_slug')
    .eq('id', id)
    .maybeSingle()

  if (fetchErr || !existing) return { ok: false, error: 'Appointment not found' }

  const ownSlug = scopeBroker(access)
  if (ownSlug && existing.broker_slug !== ownSlug) {
    return { ok: false, error: 'Not authorized to delete this appointment' }
  }

  const { error } = await sb.from('crm_appointments').delete().eq('id', id)
  if (error) {
    console.error('[deleteAppointmentAction]', error.message)
    return { ok: false, error: 'Could not delete appointment' }
  }

  revalidatePath('/admin/crm/calendar')
  revalidatePath('/admin')

  return { ok: true }
}

// ── Appointment type / outcome CRUD (superuser only) ─────────────────────────

export async function createAppointmentTypeAction(name: string): Promise<ActionResult> {
  const access = await getCrmAccess()
  if (!access || access.role !== 'superuser') return { ok: false, error: 'Not authorized' }
  if (!name.trim()) return { ok: false, error: 'Name is required' }

  const sb = createServiceClient()
  // Get the current max ord
  const { data: rows } = await sb
    .from('crm_appointment_types')
    .select('ord')
    .order('ord', { ascending: false })
    .limit(1)
  const nextOrd = ((rows?.[0] as { ord: number } | undefined)?.ord ?? 0) + 1

  const { error } = await sb
    .from('crm_appointment_types')
    .insert({ name: name.trim(), ord: nextOrd, active: true })

  if (error) return { ok: false, error: error.message }
  revalidateTag(CRM_APPOINTMENT_TYPES_TAG, 'max')
  return { ok: true }
}

export async function updateAppointmentTypeAction(
  id: number,
  patch: { name?: string; active?: boolean; ord?: number },
): Promise<ActionResult> {
  const access = await getCrmAccess()
  if (!access || access.role !== 'superuser') return { ok: false, error: 'Not authorized' }

  const sb = createServiceClient()
  const { error } = await sb.from('crm_appointment_types').update(patch).eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidateTag(CRM_APPOINTMENT_TYPES_TAG, 'max')
  return { ok: true }
}

export async function deleteAppointmentTypeAction(id: number): Promise<ActionResult> {
  const access = await getCrmAccess()
  if (!access || access.role !== 'superuser') return { ok: false, error: 'Not authorized' }

  const sb = createServiceClient()
  const { error } = await sb.from('crm_appointment_types').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidateTag(CRM_APPOINTMENT_TYPES_TAG, 'max')
  return { ok: true }
}

export async function createAppointmentOutcomeAction(name: string): Promise<ActionResult> {
  const access = await getCrmAccess()
  if (!access || access.role !== 'superuser') return { ok: false, error: 'Not authorized' }
  if (!name.trim()) return { ok: false, error: 'Name is required' }

  const sb = createServiceClient()
  const { data: rows } = await sb
    .from('crm_appointment_outcomes')
    .select('ord')
    .order('ord', { ascending: false })
    .limit(1)
  const nextOrd = ((rows?.[0] as { ord: number } | undefined)?.ord ?? 0) + 1

  const { error } = await sb
    .from('crm_appointment_outcomes')
    .insert({ name: name.trim(), ord: nextOrd, active: true })

  if (error) return { ok: false, error: error.message }
  revalidateTag(CRM_APPOINTMENT_OUTCOMES_TAG, 'max')
  return { ok: true }
}

export async function updateAppointmentOutcomeAction(
  id: number,
  patch: { name?: string; active?: boolean; ord?: number },
): Promise<ActionResult> {
  const access = await getCrmAccess()
  if (!access || access.role !== 'superuser') return { ok: false, error: 'Not authorized' }

  const sb = createServiceClient()
  const { error } = await sb.from('crm_appointment_outcomes').update(patch).eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidateTag(CRM_APPOINTMENT_OUTCOMES_TAG, 'max')
  return { ok: true }
}

export async function deleteAppointmentOutcomeAction(id: number): Promise<ActionResult> {
  const access = await getCrmAccess()
  if (!access || access.role !== 'superuser') return { ok: false, error: 'Not authorized' }

  const sb = createServiceClient()
  const { error } = await sb.from('crm_appointment_outcomes').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidateTag(CRM_APPOINTMENT_OUTCOMES_TAG, 'max')
  return { ok: true }
}
