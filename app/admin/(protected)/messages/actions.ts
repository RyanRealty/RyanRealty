'use server'

/**
 * Messages compose — governed SMS with this surface's auth + revalidate.
 * Quiet-hours override is only set when the composer marks the send as a
 * deliberate 1:1 tap (the UI already says so).
 */
import { revalidatePath } from 'next/cache'
import { checkAdminAction } from '@/lib/admin/require-admin'
import { sendCrmSmsAction } from '@/app/actions/crm'
import { requirePersonInScope } from '@/app/actions/crm'
import { refuseMessagesSend } from '@/lib/crm/messages-send-auth'

export async function sendMessagesSmsAction(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await checkAdminAction('inbox.send')
  const denied = refuseMessagesSend(auth)
  if (denied || !auth.ok) return denied ?? { ok: false, error: 'Unauthorized' }

  const personId = Number(formData.get('personId'))
  if (!Number.isFinite(personId) || personId <= 0) {
    return { ok: false, error: 'Pick a contact first.' }
  }
  const scoped = await requirePersonInScope(personId, {
    email: auth.ctx.email,
    role: auth.ctx.role,
    brokerSlug: auth.ctx.brokerSlug,
  })
  if (!scoped.ok) return { ok: false, error: scoped.error }

  const result = await sendCrmSmsAction(formData)
  revalidatePath('/admin/messages')
  revalidatePath('/admin/messages/new')
  if (!result.ok) return { ok: false, error: result.error }
  return { ok: true }
}
