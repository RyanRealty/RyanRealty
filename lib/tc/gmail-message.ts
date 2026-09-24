/**
 * Read a Gmail API message into the facts the mail rules decide on.
 * Pure. No I/O. Keys match lib/crm/gmail.ts so a message filed by either path
 * dedupes against the other: `rfc:<sha1(Message-ID)[0..24]>`.
 */
import { createHash } from 'node:crypto'
import type { gmail_v1 } from 'googleapis'

/** Headers the index asks Gmail for on the cheap metadata read. */
export const INDEX_METADATA_HEADERS = [
  'From',
  'To',
  'Cc',
  'Subject',
  'Date',
  'Message-ID',
  'In-Reply-To',
  'References',
  'List-Unsubscribe',
  'List-Id',
  'Precedence',
  'Auto-Submitted',
  'X-Autoreply',
  'X-Auto-Response-Suppress',
  'Content-Type',
] as const

type Headers = gmail_v1.Schema$MessagePartHeader[] | null | undefined

export function header(headers: Headers, name: string): string | null {
  const want = name.toLowerCase()
  return headers?.find((h) => h.name?.toLowerCase() === want)?.value ?? null
}

export type NamedAddress = { name: string; email: string }

/** "Pat Agent <pat@x.com>, other@y.com" → [{Pat Agent, pat@x.com}, {'', other@y.com}]. */
export function parseAddressList(raw: string | null | undefined): NamedAddress[] {
  if (!raw?.trim()) return []
  const out: NamedAddress[] = []
  const seen = new Set<string>()
  // Split on commas outside quotes.
  const parts: string[] = []
  let cur = ''
  let quoted = false
  for (const ch of raw) {
    if (ch === '"') quoted = !quoted
    if (ch === ',' && !quoted) {
      parts.push(cur)
      cur = ''
    } else cur += ch
  }
  if (cur.trim()) parts.push(cur)
  for (const part of parts) {
    const angle = part.match(/<\s*([^<>\s]+@[^<>\s]+)\s*>/)
    const email = (angle?.[1] ?? part.match(/[\w.+'-]+@[\w-]+(?:\.[\w-]+)+/)?.[0] ?? '').trim().toLowerCase()
    if (!email.includes('@') || seen.has(email)) continue
    seen.add(email)
    const name = angle ? part.slice(0, part.indexOf('<')).replace(/["\\]/g, '').trim() : ''
    out.push({ name, email })
  }
  return out
}

function sha24(s: string): string {
  return createHash('sha1').update(s.trim()).digest('hex').slice(0, 24)
}

/** Same key the CRM sync writes, so tc_events dedupe `mail:<key>` lines up. */
export function messageKeyFor(rfcMessageId: string | null, gmailId: string): string {
  return rfcMessageId?.trim() ? `rfc:${sha24(rfcMessageId)}` : `gmail:${gmailId}`
}

function messageIds(raw: string | null): string[] {
  if (!raw) return []
  return [...raw.matchAll(/<[^<>\s]+>/g)].map((m) => m[0])
}

/**
 * One key per conversation across every mailbox: the root of References, else
 * In-Reply-To, else the message itself. Gmail thread ids differ per mailbox;
 * this does not.
 */
export function threadKeyFor(headers: Headers, gmailThreadId: string | null | undefined): string {
  const root = messageIds(header(headers, 'References'))[0] ?? messageIds(header(headers, 'In-Reply-To'))[0]
  if (root) return `thr:${sha24(root)}`
  const own = header(headers, 'Message-ID')
  if (own?.trim()) return `thr:${sha24(own)}`
  return `gthr:${gmailThreadId ?? 'none'}`
}

/** List mail, mail robots, and auto-replies. */
export function bulkSignals(headers: Headers): { bulk: boolean; autoReply: boolean } {
  const precedence = (header(headers, 'Precedence') ?? '').toLowerCase()
  const autoSubmitted = (header(headers, 'Auto-Submitted') ?? '').toLowerCase()
  const autoReply =
    /auto-replied/.test(autoSubmitted) ||
    !!header(headers, 'X-Autoreply') ||
    /\b(?:oof|autoreply)\b/i.test(header(headers, 'X-Auto-Response-Suppress') ?? '')
  const bulk =
    !!header(headers, 'List-Unsubscribe') ||
    !!header(headers, 'List-Id') ||
    /^(?:bulk|list|junk)$/.test(precedence) ||
    (autoSubmitted !== '' && autoSubmitted !== 'no' && !autoReply)
  return { bulk, autoReply }
}

export function looksMultipartMixed(headers: Headers): boolean {
  return /multipart\/mixed/i.test(header(headers, 'Content-Type') ?? '')
}

/** text/plain first; HTML stripped only when there is no plain part. */
export function extractBody(payload: gmail_v1.Schema$MessagePart | undefined, max = 12_000): string {
  if (!payload) return ''
  const parts: string[] = []
  const walk = (p: gmail_v1.Schema$MessagePart, want: string) => {
    if (p.mimeType === want && p.body?.data && !p.filename) {
      parts.push(Buffer.from(p.body.data, 'base64url').toString('utf8'))
    }
    for (const child of p.parts ?? []) walk(child, want)
  }
  walk(payload, 'text/plain')
  if (parts.length) return parts.join('\n').trim().slice(0, max)
  walk(payload, 'text/html')
  return parts
    .join('\n')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .trim()
    .slice(0, max)
}

export type AttachmentRef = { filename: string; attachmentId: string; mimeType: string; size: number }

/** Every PDF part, in order. Callers cap how many they download. */
export function pdfParts(payload: gmail_v1.Schema$MessagePart | undefined): AttachmentRef[] {
  const out: AttachmentRef[] = []
  const walk = (p?: gmail_v1.Schema$MessagePart) => {
    if (!p) return
    const name = p.filename || ''
    const mime = (p.mimeType || '').toLowerCase()
    const id = p.body?.attachmentId
    if (id && (mime.includes('pdf') || name.toLowerCase().endsWith('.pdf'))) {
      out.push({ filename: name || 'attachment.pdf', attachmentId: id, mimeType: 'application/pdf', size: p.body?.size ?? 0 })
    }
    for (const child of p.parts ?? []) walk(child)
  }
  walk(payload)
  return out
}

export function sentAtOf(msg: gmail_v1.Schema$Message): string {
  const internal = Number(msg.internalDate ?? 0)
  if (internal > 0) return new Date(internal).toISOString()
  const d = Date.parse(header(msg.payload?.headers, 'Date') ?? '')
  return new Date(Number.isFinite(d) ? d : Date.now()).toISOString()
}
