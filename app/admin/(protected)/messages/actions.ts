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

async function sendBrokerSelfCompose(
  formData: FormData,
  brokerSlug: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const body = String(formData.get('body') ?? '').trim()
  if (!body) return { ok: false, error: 'Write the text first.' }
  const { resolveActingBrokerPhone, sendWhitelistedBrokerSms } = await import(
    '@/lib/crm/broker-self-sms'
  )
  const dest = await resolveActingBrokerPhone(brokerSlug ?? 'matt')
  if (!dest.ok) return dest
  const sent = await sendWhitelistedBrokerSms({ to: dest.to, body })
  if (!sent.ok) return sent
  revalidatePath('/admin/messages')
  revalidatePath('/admin/messages/new')
  return { ok: true }
}

export async function sendComposeAction(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await checkAdminAction('inbox.send')
  const denied = refuseMessagesSend(auth)
  if (denied || !auth.ok) return denied ?? { ok: false, error: 'Unauthorized' }

  if (String(formData.get('brokerSelf') ?? '') === '1') {
    return sendBrokerSelfCompose(formData, auth.ctx.brokerSlug)
  }

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
  const extraScopes = await Promise.all(
    extras.map((extra) =>
      requirePersonInScope(extra, {
        email: auth.ctx.email,
        role: auth.ctx.role,
        brokerSlug: auth.ctx.brokerSlug,
      }),
    ),
  )
  for (const extraScope of extraScopes) {
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

export async function attachLibraryItemAction(input: {
  personId: number
  channel: 'email' | 'mms'
  kind: 'disclosure' | 'cma' | 'vcard'
  cmaSlug?: string
}): Promise<{ ok: true; ref: { path: string; name: string; sizeBytes: number; contentType: string } } | { ok: false; error: string }> {
  const auth = await checkAdminAction('inbox.send')
  const denied = refuseMessagesSend(auth)
  if (denied || !auth.ok) return denied ?? { ok: false, error: 'Unauthorized' }
  const personId = Number(input.personId)
  if (!Number.isFinite(personId) || personId <= 0) return { ok: false, error: 'Add someone first.' }
  const scoped = await requirePersonInScope(personId, {
    email: auth.ctx.email,
    role: auth.ctx.role,
    brokerSlug: auth.ctx.brokerSlug,
  })
  if (!scoped.ok) return { ok: false, error: scoped.error }
  const { stageLibraryAttachment } = await import('@/lib/crm/library-attachments')
  return stageLibraryAttachment({
    personId,
    channel: input.channel === 'mms' ? 'mms' : 'email',
    kind: input.kind,
    cmaSlug: input.cmaSlug,
    brokerSlug: auth.ctx.brokerSlug,
    brokerEmail: auth.ctx.email,
  })
}

export async function getBrokerSelfComposePreviewAction(cmaSlug?: string): Promise<{
  name: string
  phone: string | null
  email: string | null
  body: string
  subject: string
}> {
  const auth = await checkAdminAction('inbox.send')
  if (!auth.ok) {
    return { name: 'Me', phone: null, email: null, body: '', subject: '' }
  }
  const { resolveActingBrokerPhone } = await import('@/lib/crm/broker-self-sms')
  const dest = await resolveActingBrokerPhone(auth.ctx.brokerSlug ?? 'matt')
  const slug = String(cmaSlug ?? '').trim().toLowerCase()
  let body = ''
  if (slug) {
    const { getCmaAdminRowBySlug } = await import('@/lib/data/cma/documents')
    const { cmaBrokerSelfTextBody } = await import('@/lib/crm/cma-broker-self-text')
    const row = await getCmaAdminRowBySlug(slug)
    body = cmaBrokerSelfTextBody({
      slug,
      subjectAddress: typeof row?.subject_address === 'string' ? row.subject_address : null,
    })
  }
  return {
    name: 'Me',
    phone: dest.ok ? dest.to : null,
    email: auth.ctx.email,
    body,
    subject: slug ? `CMA draft ${slug}` : '',
  }
}
