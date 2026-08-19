'use server'

/**
 * Messages compose — one surface, governed send rails.
 */
import { revalidatePath } from 'next/cache'
import { checkAdminAction } from '@/lib/admin/require-admin'
import { sendCrmEmailAction, sendCrmSmsAction, requirePersonInScope } from '@/app/actions/crm'
import { saveDraftAction, discardDraftAction } from '@/app/actions/crm-inbox'
import { searchCrmPeople } from '@/lib/data/crm/searchCrmPeople'
import { scopeBroker } from '@/lib/crm/scope'
import { refuseMessagesSend } from '@/lib/crm/messages-send-auth'
import type { ComposePersonChip } from '@/lib/crm/compose-group'

export async function searchComposePeopleAction(q: string): Promise<ComposePersonChip[]> {
  const auth = await checkAdminAction('inbox.send')
  if (!auth.ok) return []
  const term = q.trim()
  if (term.length < 2) return []
  const hits = await searchCrmPeople({
    q: term,
    brokerScope: scopeBroker(auth.ctx),
    limit: 8,
  })
  return hits.map((h) => ({
    id: h.id,
    name: h.name ?? 'Unknown contact',
    phone: h.phones?.[0]?.value ?? null,
    email: h.emails?.[0]?.value ?? null,
  }))
}

export async function sendComposeAction(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await checkAdminAction('inbox.send')
  const denied = refuseMessagesSend(auth)
  if (denied || !auth.ok) return denied ?? { ok: false, error: 'Unauthorized' }

  const personId = Number(formData.get('personId'))
  if (!Number.isFinite(personId) || personId <= 0) {
    return { ok: false, error: 'Add someone first.' }
  }
  const scoped = await requirePersonInScope(personId, {
    email: auth.ctx.email,
    role: auth.ctx.role,
    brokerSlug: auth.ctx.brokerSlug,
  })
  if (!scoped.ok) return { ok: false, error: scoped.error }

  const extras = String(formData.get('recipientIds') ?? '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0 && n !== personId)
  for (const extra of extras) {
    const extraScope = await requirePersonInScope(extra, {
      email: auth.ctx.email,
      role: auth.ctx.role,
      brokerSlug: auth.ctx.brokerSlug,
    })
    if (!extraScope.ok) return { ok: false, error: extraScope.error }
  }

  const channel = String(formData.get('channel') ?? 'text')
  const result =
    channel === 'email' ? await sendCrmEmailAction(formData) : await sendCrmSmsAction(formData)
  if (!result.ok) return { ok: false, error: result.error }

  await discardDraftAction(personId, channel === 'email' ? 'email' : 'text')
  revalidatePath('/admin/messages')
  revalidatePath('/admin/messages/new')
  return { ok: true }
}

export async function saveComposeDraftAction(
  personId: number,
  channel: 'text' | 'email',
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await checkAdminAction('inbox.send')
  const denied = refuseMessagesSend(auth)
  if (denied || !auth.ok) return denied ?? { ok: false, error: 'Unauthorized' }
  return saveDraftAction(personId, channel, formData)
}

export async function sendMessagesSmsAction(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!formData.get('channel')) formData.set('channel', 'text')
  return sendComposeAction(formData)
}
