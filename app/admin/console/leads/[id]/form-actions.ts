'use server'

/**
 * form-actions — the console lead page's server-action form wrappers, split
 * out of page.tsx for the file-size budget (G file-size-budget: split, never
 * re-baseline). Byte-identical logic: each wrapper runs the gated CRM action
 * and returns to the console route with a flash/error param.
 */

import { redirect } from 'next/navigation'
import {
  addCrmContactPointAction,
  addCrmNoteAction,
  addCrmTagAction,
  addCrmTaskAction,
  assignCrmBrokerAction,
  removeCrmTagAction,
  sendCrmEmailAction,
  sendCrmSmsAction,
  updateCrmStageAction,
} from '@/app/actions/crm'
import { adminAssignSavedSearchAction, adminDeleteSavedSearchAction } from '@/app/actions/newsletter'
import { startCmaForContactAction, sendCmaForContactAction } from '@/app/actions/contact-cma'
import { setReportSubscriptionAction } from '@/app/actions/crm-report-subscriptions'

const BASE = '/admin/console/leads'

export async function addNoteForm(personId: number, formData: FormData): Promise<void> {
  formData.set('personId', String(personId))
  const r = await addCrmNoteAction(formData)
  if (!r.ok) redirect(`${BASE}/${personId}?error=${encodeURIComponent(`Note not saved — ${r.error ?? 'unknown error'}`)}`)
  else redirect(`${BASE}/${personId}?flash=${encodeURIComponent('Note saved.')}`)
}
export async function updateStageForm(formData: FormData): Promise<void> {
  const r = await updateCrmStageAction(formData)
  if (!r.ok) console.error('[console] updateStage:', r.error)
}
export async function addTagForm(formData: FormData): Promise<void> {
  const r = await addCrmTagAction(formData)
  if (!r.ok) console.error('[console] addTag:', r.error)
}
export async function removeTagForm(formData: FormData): Promise<void> {
  const r = await removeCrmTagAction(formData)
  if (!r.ok) console.error('[console] removeTag:', r.error)
}
export async function addTaskForm(formData: FormData): Promise<void> {
  const r = await addCrmTaskAction(formData)
  if (!r.ok) console.error('[console] addTask:', r.error)
}
export async function assignBrokerForm(formData: FormData): Promise<void> {
  const r = await assignCrmBrokerAction(formData)
  if (!r.ok) console.error('[console] assignBroker:', r.error)
}
export async function addContactPointForm(formData: FormData): Promise<void> {
  const personId = Number(formData.get('personId'))
  const r = await addCrmContactPointAction(formData)
  if (!r.ok) redirect(`${BASE}/${personId}?error=${encodeURIComponent(`Not saved — ${r.error ?? 'unknown error'}`)}`)
}
export async function sendEmailForm(personId: number, formData: FormData): Promise<void> {
  formData.set('personId', String(personId))
  const r = await sendCrmEmailAction(formData)
  if (!r.ok) redirect(`${BASE}/${personId}?error=${encodeURIComponent(`Email not sent — ${r.error ?? 'unknown error'}`)}`)
}
export async function sendSmsForm(personId: number, formData: FormData): Promise<void> {
  formData.set('personId', String(personId))
  const r = await sendCrmSmsAction(formData)
  if (!r.ok) redirect(`${BASE}/${personId}?error=${encodeURIComponent(`Text not sent — ${r.error ?? 'unknown error'}`)}`)
}
// ── Home-driven next step (CRM record-card cutover) ──────────────────────────
export async function startCmaForm(personId: number): Promise<void> {
  const r = await startCmaForContactAction(personId)
  redirect(
    r.ok
      ? `${BASE}/${personId}?flash=${encodeURIComponent('CMA queued and building. Review it below, then send.')}`
      : `${BASE}/${personId}?error=${encodeURIComponent(`CMA not started — ${r.error}`)}`,
  )
}
export async function sendCmaForm(personId: number, formData: FormData): Promise<void> {
  const deliveryId = String(formData.get('deliveryId') ?? '')
  const r = await sendCmaForContactAction(deliveryId)
  redirect(
    r.ok
      ? `${BASE}/${personId}?flash=${encodeURIComponent('CMA sent.')}`
      : `${BASE}/${personId}?error=${encodeURIComponent(`CMA not sent — ${r.error}`)}`,
  )
}
export async function setReportSubsForm(personId: number, formData: FormData): Promise<void> {
  const isActive = String(formData.get('active') ?? '') === 'on'
  const frequency = String(formData.get('frequency') ?? 'monthly') as 'weekly' | 'monthly' | 'quarterly'
  const areas = formData.getAll('areas').map((a) => String(a)).filter(Boolean)
  const r = await setReportSubscriptionAction(personId, { areas, frequency, isActive })
  redirect(
    r.ok
      ? `${BASE}/${personId}?flash=${encodeURIComponent(r.message ?? 'Market reports updated.')}`
      : `${BASE}/${personId}?error=${encodeURIComponent(`Market reports not updated — ${r.error}`)}`,
  )
}
export async function assignSavedSearchForm(formData: FormData): Promise<void> {
  const personId = Number(formData.get('personId'))
  // Build the filters JSON from the simple inline fields before handing off.
  const filters: Record<string, unknown> = {}
  const city = String(formData.get('city') ?? '').trim()
  const minPrice = Number(formData.get('minPrice'))
  const maxPrice = Number(formData.get('maxPrice'))
  const minBeds = Number(formData.get('minBeds'))
  if (city) filters.city = city
  if (Number.isFinite(minPrice) && minPrice > 0) filters.minPrice = minPrice
  if (Number.isFinite(maxPrice) && maxPrice > 0) filters.maxPrice = maxPrice
  if (Number.isFinite(minBeds) && minBeds > 0) filters.beds = minBeds
  formData.set('filters', JSON.stringify(filters))
  const r = await adminAssignSavedSearchAction(formData)
  if (r.ok && Number.isFinite(personId) && personId > 0) {
    const { createServiceClient } = await import('@/lib/supabase/service')
    const { getCrmAccess } = await import('@/app/actions/crm')
    const [sb, access] = [createServiceClient(), await getCrmAccess()]
    const name = String(formData.get('name') ?? 'Saved search').trim() || 'Saved search'
    await sb.from('crm_timeline').insert({
      person_id: personId,
      kind: 'system',
      title: `Saved search "${name}" added by ${access?.email ?? 'broker'}`,
      source: 'app',
      broker: access?.brokerSlug ?? null,
    })
  }
  const msg = r.ok ? 'Saved search assigned' : `Not assigned — ${r.error ?? 'unknown error'}`
  redirect(`${BASE}/${personId}?flash=${encodeURIComponent(msg)}`)
}
export async function deleteSavedSearchForm(formData: FormData): Promise<void> {
  const personId = Number(formData.get('personId'))
  const id = String(formData.get('id') ?? '')
  const r = await adminDeleteSavedSearchAction(id)
  if (r.ok && Number.isFinite(personId) && personId > 0) {
    const { createServiceClient } = await import('@/lib/supabase/service')
    const { getCrmAccess } = await import('@/app/actions/crm')
    const [sb, access] = [createServiceClient(), await getCrmAccess()]
    await sb.from('crm_timeline').insert({
      person_id: personId,
      kind: 'system',
      title: `Saved search removed by ${access?.email ?? 'broker'}`,
      source: 'app',
      broker: access?.brokerSlug ?? null,
    })
  }
  redirect(`${BASE}/${personId}?flash=${encodeURIComponent('Saved search removed')}`)
}

