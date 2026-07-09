import 'server-only'

/**
 * Outbound MMS media helper. Twilio fetches media URLs at send time (within
 * seconds of accepting the message), so we reuse the existing private
 * `crm-files` bucket and mint a short-lived signed URL rather than standing
 * up a second, publicly-readable bucket for attachments that may include
 * client documents/photos.
 */

const MAX_MMS_FILE_BYTES = 5 * 1024 * 1024 // carrier-reasonable MMS payload cap
const ALLOWED_MMS_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf',
])
const SIGNED_URL_TTL_SECONDS = 900 // 15 min — comfortably past Twilio's fetch window

export type MmsUploadResult =
  | { ok: true; storagePath: string; signedUrl: string; contentType: string; sizeBytes: number }
  | { ok: false; error: string }

/**
 * Upload a File to crm-files/mms/<personId>/... and return a signed URL
 * Twilio can fetch immediately. Call this right before sendSms/
 * sendSmsViaMessagingService — the signed URL expires in 15 minutes.
 */
export async function uploadMmsMedia(params: {
  personId: number
  file: File
}): Promise<MmsUploadResult> {
  const { personId, file } = params
  if (!file || file.size === 0) return { ok: false, error: 'Empty file' }
  if (file.size > MAX_MMS_FILE_BYTES) {
    return { ok: false, error: `MMS attachments must be under ${MAX_MMS_FILE_BYTES / 1024 / 1024}MB` }
  }
  const contentType = file.type || 'application/octet-stream'
  if (!ALLOWED_MMS_TYPES.has(contentType)) {
    return { ok: false, error: `Unsupported MMS attachment type (${contentType}). Use JPEG, PNG, GIF, WEBP, or PDF.` }
  }

  const { createServiceClient } = await import('@/lib/supabase/service')
  const sb = createServiceClient()
  const path = `mms/person-${personId}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, '_')}`
  const { error: upErr } = await sb.storage.from('crm-files').upload(path, file, { contentType })
  if (upErr) return { ok: false, error: upErr.message }

  const signedUrl = await resolveMmsMediaUrl(path)
  if (!signedUrl) return { ok: false, error: 'Uploaded but failed to sign a fetchable URL' }

  return { ok: true, storagePath: path, signedUrl, contentType, sizeBytes: file.size }
}

/** Mint a fresh short-lived signed URL for a stored MMS attachment. */
export async function resolveMmsMediaUrl(storagePath: string): Promise<string | null> {
  const { createServiceClient } = await import('@/lib/supabase/service')
  const sb = createServiceClient()
  const { data, error } = await sb.storage.from('crm-files').createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS)
  if (error || !data?.signedUrl) return null
  return data.signedUrl
}
