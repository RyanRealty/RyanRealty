'use server'

/**
 * People (P9 roll:people / P11B B2) — server-action wrappers for the v2 person
 * entity page. Every wrapper delegates to the SAME gated CRM action the legacy
 * workspace uses (auth + broker scope + suppression + dual-write all live in
 * the underlying action), then revalidates the v2 person route. Errors land
 * back on the person page as a plain `error` param; silent success re-renders
 * in place.
 */
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createDealFromPersonAction } from '@/app/actions/tc-deal-people'
import { kickoffCmaForContactAction } from '@/app/actions/crm-cma-kickoff'
import {
  addCrmNoteAction,
  addCrmTagAction,
  addCrmTaskAction,
  assignCrmBrokerAction,
  completeCrmTaskAction,
  removeCrmTagAction,
  sendCrmEmailAction,
  sendCrmSmsAction,
  updateCrmStageAction,
} from '@/app/actions/crm'
import { updatePersonFieldAction } from '@/app/actions/crm-person-detail'
import { startBpoForContactAction } from '@/app/actions/contact-bpo'
import { saveDraftAction } from '@/app/actions/crm-inbox'

const BASE = '/admin/people'

function personPath(personId: number): string {
  return `${BASE}/${personId}`
}

function errorUrl(personId: number, message: string): string {
  return `${personPath(personId)}?error=${encodeURIComponent(message)}`
}

export async function kickoffCmaFromPerson(formData: FormData): Promise<void> {
  const personId = Number(formData.get('personId'))
  const address = String(formData.get('address') ?? '').trim()
  const idempotencyKey = String(formData.get('idempotencyKey') ?? '')
  const res = await kickoffCmaForContactAction({ personId, address, idempotencyKey })
  revalidatePath(personPath(personId))
  if (res.ok) redirect(`${personPath(personId)}?kicked=1`)
  redirect(`${personPath(personId)}?intent=cma&err=${encodeURIComponent(res.error ?? 'Kickoff failed')}`)
}

// ── Comms (G50 chokepoint composers post here) ──────────────────────────────

export async function sendSmsFromPerson(personId: number, formData: FormData): Promise<void> {
  formData.set('personId', String(personId))
  const r = await sendCrmSmsAction(formData)
  revalidatePath(personPath(personId))
  if (!r.ok) redirect(errorUrl(personId, `Text not sent — ${r.error ?? 'unknown error'}`))
}

export async function sendEmailFromPerson(personId: number, formData: FormData): Promise<void> {
  formData.set('personId', String(personId))
  const r = await sendCrmEmailAction(formData)
  revalidatePath(personPath(personId))
  if (!r.ok) redirect(errorUrl(personId, `Email not sent — ${r.error ?? 'unknown error'}`))
}

export async function saveEmailDraftFromPerson(personId: number, formData: FormData): Promise<void> {
  const r = await saveDraftAction(personId, 'email', formData)
  revalidatePath(personPath(personId))
  if (!r.ok) redirect(errorUrl(personId, `Draft not saved — ${r.error ?? 'unknown error'}`))
  redirect(`${personPath(personId)}?flash=${encodeURIComponent('Email draft saved.')}`)
}

export async function saveSmsDraftFromPerson(personId: number, formData: FormData): Promise<void> {
  const r = await saveDraftAction(personId, 'text', formData)
  revalidatePath(personPath(personId))
  if (!r.ok) redirect(errorUrl(personId, `Draft not saved — ${r.error ?? 'unknown error'}`))
  redirect(`${personPath(personId)}?flash=${encodeURIComponent('Text draft saved.')}`)
}

// ── Notes ───────────────────────────────────────────────────────────────────

export async function addNoteFromPerson(personId: number, formData: FormData): Promise<void> {
  formData.set('personId', String(personId))
  const r = await addCrmNoteAction(formData)
  revalidatePath(personPath(personId))
  if (!r.ok) redirect(errorUrl(personId, `Note not saved — ${r.error ?? 'unknown error'}`))
  redirect(`${personPath(personId)}?flash=${encodeURIComponent('Note saved.')}`)
}

// ── Field editors (stage · broker · source · tags) ──────────────────────────

export async function updateStageFromPerson(personId: number, formData: FormData): Promise<void> {
  formData.set('personId', String(personId))
  const r = await updateCrmStageAction(formData)
  revalidatePath(personPath(personId))
  if (!r.ok) redirect(errorUrl(personId, `Stage not updated — ${r.error ?? 'unknown error'}`))
}

export async function assignBrokerFromPerson(personId: number, formData: FormData): Promise<void> {
  formData.set('personId', String(personId))
  const r = await assignCrmBrokerAction(formData)
  revalidatePath(personPath(personId))
  if (!r.ok) redirect(errorUrl(personId, `Not reassigned — ${r.error ?? 'unknown error'}`))
}

export async function updateSourceFromPerson(personId: number, formData: FormData): Promise<void> {
  const value = String(formData.get('source') ?? '')
  const r = await updatePersonFieldAction(personId, 'source', value)
  revalidatePath(personPath(personId))
  if (!r.ok) redirect(errorUrl(personId, `Source not updated — ${r.error ?? 'unknown error'}`))
}

export async function addTagFromPerson(personId: number, formData: FormData): Promise<void> {
  formData.set('personId', String(personId))
  const r = await addCrmTagAction(formData)
  revalidatePath(personPath(personId))
  if (!r.ok) redirect(errorUrl(personId, `Tag not added — ${r.error ?? 'unknown error'}`))
}

export async function removeTagFromPerson(
  personId: number,
  tag: string,
  _formData?: FormData,
): Promise<void> {
  const fd = new FormData()
  fd.set('personId', String(personId))
  fd.set('tag', tag)
  const r = await removeCrmTagAction(fd)
  revalidatePath(personPath(personId))
  if (!r.ok) redirect(errorUrl(personId, `Tag not removed — ${r.error ?? 'unknown error'}`))
}

// ── Tasks ───────────────────────────────────────────────────────────────────

export async function addTaskFromPerson(personId: number, formData: FormData): Promise<void> {
  formData.set('personId', String(personId))
  const r = await addCrmTaskAction(formData)
  revalidatePath(personPath(personId))
  if (!r.ok) redirect(errorUrl(personId, `Task not added — ${r.error ?? 'unknown error'}`))
}

export async function completeTaskFromPerson(
  personId: number,
  taskId: number,
  _formData?: FormData,
): Promise<void> {
  const fd = new FormData()
  fd.set('taskId', String(taskId))
  fd.set('personId', String(personId))
  const r = await completeCrmTaskAction(fd)
  revalidatePath(personPath(personId))
  if (!r.ok) redirect(errorUrl(personId, `Task not completed — ${r.error ?? 'unknown error'}`))
}

// ── Send center (BPO build affordance) ──────────────────────────────────────

export async function startDealFromPerson(formData: FormData): Promise<void> {
  const personId = Number(formData.get('personId'))
  const res = await createDealFromPersonAction(formData)
  if (res.error || !res.propertyKey) {
    redirect(errorUrl(personId, res.error ?? 'Deal not created'))
  }
  redirect(`/admin/deals/${encodeURIComponent(res.propertyKey)}`)
}

export async function startBpoFromPerson(personId: number): Promise<void> {
  const r = await startBpoForContactAction(personId)
  revalidatePath(personPath(personId))
  redirect(
    r.ok
      ? `${personPath(personId)}?flash=${encodeURIComponent('Broker price opinion built. Review it under Valuations.')}`
      : errorUrl(personId, `Price opinion not started — ${r.error}`),
  )
}
