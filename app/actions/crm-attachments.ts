'use server'

/**
 * Composer attachment upload grants (split from app/actions/crm.ts — file-size
 * budget). The browser PUTs files straight to the private crm-files bucket
 * (form POSTs cap at ~4.5MB on Vercel, so files never ride the send action);
 * the send actions then receive only storage paths and re-validate ownership.
 */

import { requireCrmAccess, requirePersonInScope } from '@/app/actions/crm'
import { createAttachmentUploadUrl } from '@/lib/crm/attachments'

export async function createCrmAttachmentUploadAction(input: {
  personId: number
  channel: 'email' | 'mms'
  filename: string
  contentType: string
  sizeBytes: number
}): Promise<
  | { ok: true; path: string; signedUrl: string; token: string }
  | { ok: false; error: string }
> {
  const access = await requireCrmAccess()
  if (!access.ok) return access
  const personId = Number(input.personId)
  if (!Number.isFinite(personId) || personId <= 0) return { ok: false, error: 'Bad person id' }
  const scoped = await requirePersonInScope(personId, access.access)
  if (!scoped.ok) return scoped
  const res = await createAttachmentUploadUrl({
    channel: input.channel === 'mms' ? 'mms' : 'email',
    personId,
    filename: String(input.filename ?? 'file'),
    contentType: String(input.contentType ?? 'application/octet-stream'),
    sizeBytes: Number(input.sizeBytes ?? 0),
  })
  if (!res.ok) return res
  return { ok: true, path: res.grant.path, signedUrl: res.grant.signedUrl, token: res.grant.token }
}
