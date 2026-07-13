import 'server-only'

/**
 * Server side of CRM outbound attachments (email + MMS).
 *
 * Attachments never ride the form POST (Vercel caps request bodies at ~4.5MB
 * — see lib/crm/attachment-limits.ts). Flow:
 *
 *   1. Composer asks createCrmAttachmentUploadAction (app/actions/crm.ts) for
 *      a signed upload URL → this module validates + mints it.
 *   2. Browser PUTs the file straight to the private `crm-files` bucket.
 *   3. The send action receives storage paths, downloads the bytes here
 *      (email MIME / group-MMS MCS upload) or mints short-lived signed URLs
 *      (1:1 MMS — Twilio fetches within seconds), and records the paths on
 *      the crm_timeline payload so the thread can re-render the attachment
 *      forever (served by /api/admin/crm/attachment).
 */

import { createServiceClient } from '@/lib/supabase/service'
import {
  attachmentPathFor,
  validateAttachmentFile,
  type CrmAttachmentChannel,
  type CrmAttachmentRef,
} from '@/lib/crm/attachment-limits'

const BUCKET = 'crm-files'
/** Twilio fetches MMS media within seconds; 15 min is comfortable. */
const SEND_SIGNED_URL_TTL_SECONDS = 900

export type AttachmentUploadGrant = {
  path: string
  /** Full PUT target (token included) — the browser uploads the raw file body here. */
  signedUrl: string
  token: string
}

/** Validate + mint a signed upload URL for one composer attachment. */
export async function createAttachmentUploadUrl(params: {
  channel: CrmAttachmentChannel
  personId: number
  filename: string
  contentType: string
  sizeBytes: number
}): Promise<{ ok: true; grant: AttachmentUploadGrant } | { ok: false; error: string }> {
  const check = validateAttachmentFile(params.channel, {
    name: params.filename,
    sizeBytes: params.sizeBytes,
    contentType: params.contentType,
  })
  if (!check.ok) return check

  const sb = createServiceClient()
  const path = attachmentPathFor(params.channel, params.personId, params.filename, Date.now())
  const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(path)
  if (error || !data?.signedUrl) {
    return { ok: false, error: error?.message ?? 'Could not create upload URL' }
  }
  return { ok: true, grant: { path: data.path ?? path, signedUrl: data.signedUrl, token: data.token } }
}

/** Download stored attachment bytes (email MIME build, group-MMS MCS upload). */
export async function downloadAttachment(path: string): Promise<{ ok: true; content: Buffer } | { ok: false; error: string }> {
  const sb = createServiceClient()
  const { data, error } = await sb.storage.from(BUCKET).download(path)
  if (error || !data) return { ok: false, error: error?.message ?? `Attachment missing: ${path}` }
  return { ok: true, content: Buffer.from(await data.arrayBuffer()) }
}

/** Fresh short-lived signed URLs for Twilio to fetch 1:1 MMS media. */
export async function signAttachmentUrls(refs: CrmAttachmentRef[]): Promise<{ ok: true; urls: string[] } | { ok: false; error: string }> {
  const sb = createServiceClient()
  const urls: string[] = []
  for (const ref of refs) {
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(ref.path, SEND_SIGNED_URL_TTL_SECONDS)
    if (error || !data?.signedUrl) return { ok: false, error: error?.message ?? `Could not sign ${ref.name}` }
    urls.push(data.signedUrl)
  }
  return { ok: true, urls }
}

/** Signed read URL for the admin attachment-serving route. */
export async function signAttachmentReadUrl(path: string, ttlSeconds = 300): Promise<string | null> {
  const sb = createServiceClient()
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, ttlSeconds)
  if (error || !data?.signedUrl) return null
  return data.signedUrl
}

/** Download stored refs into the Gmail MIME attachment shape. */
export async function loadEmailAttachments(
  refs: CrmAttachmentRef[],
): Promise<{ ok: true; attachments?: Array<{ filename: string; content: Buffer; mimeType: string }> } | { ok: false; error: string }> {
  if (!refs.length) return { ok: true, attachments: undefined }
  const attachments: Array<{ filename: string; content: Buffer; mimeType: string }> = []
  for (const ref of refs) {
    const dl = await downloadAttachment(ref.path)
    if (!dl.ok) return { ok: false, error: `Attachment ${ref.name}: ${dl.error}` }
    attachments.push({ filename: ref.name, content: dl.content, mimeType: ref.contentType })
  }
  return { ok: true, attachments }
}

/** Download stored refs into the group-MMS (Twilio MCS) media shape. */
export async function loadGroupMedia(
  refs: CrmAttachmentRef[],
): Promise<{ ok: true; media?: Array<{ content: Buffer; contentType: string; filename?: string }> } | { ok: false; error: string }> {
  if (!refs.length) return { ok: true, media: undefined }
  const media: Array<{ content: Buffer; contentType: string; filename?: string }> = []
  for (const ref of refs) {
    const dl = await downloadAttachment(ref.path)
    if (!dl.ok) return { ok: false, error: `Attachment ${ref.name}: ${dl.error}` }
    media.push({ content: dl.content, contentType: ref.contentType, filename: ref.name })
  }
  return { ok: true, media }
}
