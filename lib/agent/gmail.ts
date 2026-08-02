/**
 * lib/agent/gmail.ts — R2.5 `email_search` + R2.6 attachment fetch, the
 * productized form of the script-proven patterns in
 * scripts/_ordway-gmail-hunt.mjs (rich q= search, full-format detail fetch)
 * and scripts/_ordway-gmail-download.mjs (attachments.get byte download).
 *
 * STRUCTURAL SCOPING (docs/plans/BROKER_SMS_AGENT_2026-07-31.md Amendment —
 * this is the load-bearing invariant, not a nicety): every function here
 * takes an AgentContext and impersonates ONLY `ctx.brokerEmail` via
 * lib/crm/gmail.ts's getGmailFor(). There is no "mailbox" parameter anywhere
 * in this module's public surface, so a tool call can never ask it to read a
 * different broker's mail — the agent structurally cannot see anyone else's
 * inbox, matching Edge-case ledger B2 ("It never reads across mailboxes —
 * structurally cannot").
 */

import { type gmail_v1 } from 'googleapis'
import { getGmailFor } from '@/lib/crm/gmail'
import type { AgentContext } from '@/lib/agent/types'

const READONLY_SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

/** Gmail's `q=` list() is capped here before the (slower) full-detail fetch. */
const LIST_MAX_RESULTS = 20
/** "top 8 matches" per the rung spec — full-format fetch is the expensive call. */
const DETAIL_FETCH_CAP = 8
/** Body-link extraction cap per candidate (rung spec: dedupe, cap 20). */
const MAX_LINKS = 20

export interface EmailAttachmentMeta {
  attachmentId: string
  filename: string
  mime: string
  sizeBytes: number
}

export interface EmailCandidate {
  messageId: string
  from: string
  subject: string
  date: string
  attachments: EmailAttachmentMeta[]
  links: string[]
}

export interface SearchBrokerEmailParams {
  /** Sender display name, name fragment, or domain — e.g. "Rich", "thegarnergroup.com". */
  senderHint?: string
  /** A phrase likely to appear in the subject or body. */
  textHint?: string
  /** Default 30, mirrors the R2.5 spec default. */
  newerThanDays?: number
  hasAttachment?: boolean
}

export interface SearchBrokerEmailResult {
  mailbox: string
  query: string
  candidates: EmailCandidate[]
}

function quoteTerm(term: string): string {
  const trimmed = term.trim()
  if (!trimmed) return ''
  // Gmail q= treats a bare multi-word term as an implicit AND of each word;
  // quoting keeps a name/phrase atomic ("the garner group" stays one term).
  return /\s/.test(trimmed) ? `"${trimmed.replace(/"/g, '')}"` : trimmed
}

/** Builds the Gmail `q=` string. Exported for the unit test + so callers can
 *  log/echo exactly what was searched (Edge-case ledger B2 — "the agent says
 *  exactly what it searched"). */
export function buildSearchQuery(opts: SearchBrokerEmailParams): string {
  const parts: string[] = []
  if (opts.senderHint?.trim()) parts.push(`from:${quoteTerm(opts.senderHint)}`)
  if (opts.textHint?.trim()) parts.push(quoteTerm(opts.textHint))
  const rawDays = opts.newerThanDays
  const days = Number.isFinite(rawDays) && (rawDays as number) > 0 ? Math.floor(rawDays as number) : 30
  parts.push(`newer_than:${days}d`)
  if (opts.hasAttachment) parts.push('has:attachment')
  parts.push('-in:spam')
  parts.push('-in:trash')
  return parts.join(' ')
}

function gmailForBroker(ctx: AgentContext): gmail_v1.Gmail {
  const gmail = getGmailFor(ctx.brokerEmail, READONLY_SCOPES)
  if (!gmail) {
    throw new Error(
      'lib/agent/gmail: Google service account not configured (GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY)',
    )
  }
  return gmail
}

function headerOf(msg: gmail_v1.Schema$Message, name: string): string {
  const target = name.toLowerCase()
  return msg.payload?.headers?.find((h) => h.name?.toLowerCase() === target)?.value ?? ''
}

function walkAttachments(part: gmail_v1.Schema$MessagePart | undefined, out: EmailAttachmentMeta[]): void {
  if (!part) return
  if (part.filename && part.filename.length > 0 && part.body?.attachmentId) {
    out.push({
      attachmentId: part.body.attachmentId,
      filename: part.filename,
      mime: part.mimeType ?? 'application/octet-stream',
      sizeBytes: part.body.size ?? 0,
    })
  }
  for (const child of part.parts ?? []) walkAttachments(child, out)
}

const URL_RE = /https?:\/\/[^\s<>"')\]]+/g

function walkLinks(part: gmail_v1.Schema$MessagePart | undefined, out: Set<string>): void {
  if (!part || out.size >= MAX_LINKS) return
  if (part.body?.data && (part.mimeType === 'text/plain' || part.mimeType === 'text/html')) {
    const text = Buffer.from(part.body.data, 'base64url').toString('utf8')
    for (const m of text.matchAll(URL_RE)) {
      if (out.size >= MAX_LINKS) break
      out.add(m[0].replace(/[.,;]+$/, ''))
    }
  }
  for (const child of part.parts ?? []) {
    if (out.size >= MAX_LINKS) return
    walkLinks(child, out)
  }
}

export interface MessageDetail {
  messageId: string
  from: string
  subject: string
  date: string
  attachments: EmailAttachmentMeta[]
  links: string[]
}

/**
 * Shared full-message fetch + extraction. Used both by searchBrokerEmail
 * (top matches) and by the fetch_assets tool (resolving an attachmentId the
 * model already saw via email_search back to its filename/mime before
 * downloading bytes).
 */
export async function getMessageDetail(ctx: AgentContext, messageId: string): Promise<MessageDetail> {
  const gmail = gmailForBroker(ctx)
  // 'full' format — metadata format hides everything below the top-level
  // body, including attachment filenames/attachmentIds (same lesson
  // scripts/_ordway-gmail-hunt.mjs:96 documents).
  const res = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' })
  const msg = res.data
  const attachments: EmailAttachmentMeta[] = []
  walkAttachments(msg.payload, attachments)
  const links = new Set<string>()
  walkLinks(msg.payload, links)
  return {
    messageId,
    from: headerOf(msg, 'from'),
    subject: headerOf(msg, 'subject'),
    date: headerOf(msg, 'date'),
    attachments,
    links: [...links],
  }
}

/**
 * R2.5 — Gmail q= search over the requesting broker's mailbox ONLY. Lists
 * up to LIST_MAX_RESULTS, then fetches full detail (attachments + body
 * links) for the top DETAIL_FETCH_CAP so the model has enough to confirm
 * back to the broker before any download happens (Edge-case ledger B1).
 */
export async function searchBrokerEmail(
  ctx: AgentContext,
  opts: SearchBrokerEmailParams,
): Promise<SearchBrokerEmailResult> {
  const gmail = gmailForBroker(ctx)
  const query = buildSearchQuery(opts)

  const list = await gmail.users.messages.list({ userId: 'me', q: query, maxResults: LIST_MAX_RESULTS })
  const ids = (list.data.messages ?? []).map((m) => m.id).filter((id): id is string => Boolean(id))

  const candidates: EmailCandidate[] = []
  for (const id of ids.slice(0, DETAIL_FETCH_CAP)) {
    try {
      candidates.push(await getMessageDetail(ctx, id))
    } catch (err) {
      console.error('[searchBrokerEmail] detail fetch failed', id, err instanceof Error ? err.message : err)
    }
  }

  return { mailbox: ctx.brokerEmail, query, candidates }
}

/**
 * R2.6 — attachment bytes via attachments.get, productizing
 * scripts/_ordway-gmail-download.mjs:105. `messageId`/`attachmentId` must
 * come from a prior searchBrokerEmail/getMessageDetail result for this same
 * broker — there is no path here that accepts a mailbox override.
 */
export async function fetchAttachment(ctx: AgentContext, messageId: string, attachmentId: string): Promise<Buffer> {
  const gmail = gmailForBroker(ctx)
  const res = await gmail.users.messages.attachments.get({ userId: 'me', messageId, id: attachmentId })
  const data = res.data.data
  if (!data) {
    throw new Error(`lib/agent/gmail: attachment ${attachmentId} on message ${messageId} returned no data`)
  }
  return Buffer.from(data, 'base64url')
}
