/**
 * CRM outbound-attachment limits + validators, shared by the composers
 * (client-side pre-checks), the upload server action, and the send actions.
 *
 * Pure module — safe in client bundles. Server-only pieces (signed upload
 * URLs, downloads) live in lib/crm/attachments.ts.
 *
 * Why attachments upload client-direct to Supabase Storage instead of riding
 * the form POST: Next server actions cap the request body (4MB configured) and
 * Vercel hard-caps request payloads at ~4.5MB, so a File posted through the
 * form can never carry a 10MB PDF in production. The composer uploads each
 * file to the private `crm-files` bucket via a signed upload URL, then the
 * form posts only the storage paths.
 */

export type CrmAttachmentChannel = 'email' | 'mms'

/** One uploaded attachment as the composer posts it (JSON in the `attachments` field). */
export type CrmAttachmentRef = {
  /** Storage path inside the `crm-files` bucket, e.g. `email/person-42/1720540000000-flyer.pdf`. */
  path: string
  /** Original filename shown to the recipient. */
  name: string
  sizeBytes: number
  contentType: string
}

export const EMAIL_ATTACHMENT_LIMITS = {
  /** Per-file cap. */
  maxFileBytes: 10 * 1024 * 1024,
  /** Total per send — Gmail rejects messages over 25MB *after* base64 (+33%). */
  maxTotalBytes: 18 * 1024 * 1024,
  maxFiles: 10,
} as const

export const MMS_ATTACHMENT_LIMITS = {
  /** Twilio accepts up to 5MB total message media. */
  maxFileBytes: 5 * 1024 * 1024,
  maxTotalBytes: 5 * 1024 * 1024,
  /** Twilio allows up to 10 media per message. */
  maxFiles: 10,
} as const

/** MMS media types carriers reliably deliver. */
export const ALLOWED_MMS_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf',
])

export const MMS_ACCEPT_ATTR = 'image/jpeg,image/png,image/gif,image/webp,application/pdf'

/** Email attachments: block executables/scripts, allow docs + media. */
const BLOCKED_EMAIL_TYPES = new Set([
  'application/x-msdownload', 'application/x-sh', 'application/x-executable',
  'application/x-dosexec', 'application/java-archive', 'application/x-bat',
])
const BLOCKED_EMAIL_EXTENSIONS = /\.(exe|bat|cmd|sh|js|jar|msi|scr|com|pif|vbs|ps1)$/i

export function limitsFor(channel: CrmAttachmentChannel) {
  return channel === 'email' ? EMAIL_ATTACHMENT_LIMITS : MMS_ATTACHMENT_LIMITS
}

/** Per-file validation, shared by the composer pre-check and the upload action. */
export function validateAttachmentFile(
  channel: CrmAttachmentChannel,
  file: { name: string; sizeBytes: number; contentType: string },
): { ok: true } | { ok: false; error: string } {
  const limits = limitsFor(channel)
  if (file.sizeBytes <= 0) return { ok: false, error: `${file.name}: empty file` }
  if (file.sizeBytes > limits.maxFileBytes) {
    return { ok: false, error: `${file.name} is over the ${Math.round(limits.maxFileBytes / 1024 / 1024)}MB per-file limit` }
  }
  if (channel === 'mms') {
    if (!ALLOWED_MMS_TYPES.has(file.contentType)) {
      return { ok: false, error: `${file.name}: texts support JPEG, PNG, GIF, WEBP, or PDF only` }
    }
  } else {
    if (BLOCKED_EMAIL_TYPES.has(file.contentType) || BLOCKED_EMAIL_EXTENSIONS.test(file.name)) {
      return { ok: false, error: `${file.name}: this file type can't be emailed` }
    }
  }
  return { ok: true }
}

/** Storage path for a new outbound attachment. Timestamp-prefixed → no collisions. */
export function attachmentPathFor(channel: CrmAttachmentChannel, personId: number, filename: string, nowMs: number): string {
  const safe = filename.replace(/[^\w.\-]/g, '_').slice(-120)
  return `${channel}/person-${personId}/${nowMs}-${safe}`
}

const PATH_RE = /^(email|mms)\/person-(\d+)\/\d+-[\w.\-]+$/

/**
 * A posted attachment path must be a well-formed crm-files outbound path that
 * belongs to THIS person + channel — a client can't reference another
 * contact's files (or an arbitrary bucket object) by editing the hidden field.
 */
export function isValidAttachmentPath(channel: CrmAttachmentChannel, personId: number, path: string): boolean {
  const m = PATH_RE.exec(path)
  return !!m && m[1] === channel && Number(m[2]) === personId
}

/** Path check for the serving route (any person — access is scoped separately). */
export function parseAttachmentPath(path: string): { channel: CrmAttachmentChannel; personId: number } | null {
  const m = PATH_RE.exec(path)
  if (!m) return null
  return { channel: m[1] as CrmAttachmentChannel, personId: Number(m[2]) }
}

/**
 * Parse + validate the composer's `attachments` JSON field. Enforces path
 * ownership, per-file limits, count, and total size. Empty/missing → [].
 */
export function parseAttachmentRefs(
  raw: string | null | undefined,
  channel: CrmAttachmentChannel,
  personId: number,
): { ok: true; items: CrmAttachmentRef[] } | { ok: false; error: string } {
  const text = (raw ?? '').trim()
  if (!text) return { ok: true, items: [] }
  let arr: unknown
  try {
    arr = JSON.parse(text)
  } catch {
    return { ok: false, error: 'Malformed attachments field' }
  }
  if (!Array.isArray(arr)) return { ok: false, error: 'Malformed attachments field' }
  const limits = limitsFor(channel)
  if (arr.length > limits.maxFiles) return { ok: false, error: `At most ${limits.maxFiles} attachments per send` }
  const items: CrmAttachmentRef[] = []
  let total = 0
  for (const entry of arr) {
    const e = entry as Partial<CrmAttachmentRef>
    if (typeof e.path !== 'string' || typeof e.name !== 'string' || typeof e.sizeBytes !== 'number' || typeof e.contentType !== 'string') {
      return { ok: false, error: 'Malformed attachment entry' }
    }
    if (!isValidAttachmentPath(channel, personId, e.path)) {
      return { ok: false, error: 'Attachment does not belong to this contact' }
    }
    const fileCheck = validateAttachmentFile(channel, { name: e.name, sizeBytes: e.sizeBytes, contentType: e.contentType })
    if (!fileCheck.ok) return fileCheck
    total += e.sizeBytes
    items.push({ path: e.path, name: e.name, sizeBytes: e.sizeBytes, contentType: e.contentType })
  }
  if (total > limits.maxTotalBytes) {
    return { ok: false, error: `Attachments total ${Math.round(total / 1024 / 1024)}MB — the limit per send is ${Math.round(limits.maxTotalBytes / 1024 / 1024)}MB` }
  }
  return { ok: true, items }
}
