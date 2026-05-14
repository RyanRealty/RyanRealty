/**
 * marketing-brain: inbox-poll
 *
 * Top-level orchestrator for the cron poll path. Called every 2 minutes
 * by /api/cron/marketing-inbox-poll. Flow per invocation:
 *
 *   1. Auth Gmail with read + send scopes (DWD JWT).
 *   2. List unread messages in marketing@ryan-realty.com.
 *   3. For each:
 *      a. Skip if already in marketing_inbox_events (idempotent).
 *      b. Fetch full message, extract from / subject / body_text.
 *      c. Insert inbox_event row (status='received').
 *      d. Check allowlist. Rejected → status='killed' + optional reply.
 *      e. Parse via Haiku → set parsed_* fields, status='parsed'.
 *      f. Dispatch to producers → set action_row_id, status='dispatched'.
 *      g. Send confirmation reply → set replied_at, status='replied'.
 *      h. Mark Gmail message as read (remove UNREAD label).
 *   4. Return a summary report.
 *
 * Idempotency: gmail_message_id is UNIQUE in marketing_inbox_events, so a
 * duplicate poll (cron retries) cannot create duplicate rows. The
 * Gmail-side "mark as read" is the secondary safeguard.
 *
 * Auth degradation: if gmail.modify is not in the DWD allowlist yet, the
 * poll route returns a structured `auth_pending` response that surfaces
 * the admin fix path without crashing.
 */

import { google } from 'googleapis'
import type { JWT } from 'google-auth-library'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import {
  getReadAuth,
  getSendAuth,
  MARKETING_INBOX_USER,
} from './inbox-auth'
import { isSenderAllowed } from './inbox-allowlist'
import { parseInboxEmail } from './inbox-parser'
import { dispatchParsedEmail, type InboxEvent } from './inbox-dispatcher'
import { sendInboxReply, type ReplyContext } from './inbox-reply'

let _supabase: SupabaseClient | null = null

function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service-role credentials not configured')
  _supabase = createClient(url, key)
  return _supabase
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PollProcessedEvent {
  inbox_event_id: string
  gmail_message_id: string
  sender_email: string
  outcome:
    | 'replied'
    | 'dispatched'
    | 'rejected_sender'
    | 'failed'
    | 'reply_failed'
    | 'duplicate'
  action_row_id?: string
  action_type?: string
  reason: string
}

export interface PollReport {
  status: 'ok' | 'auth_pending' | 'error'
  fetched_at: string
  fetched_unread_count: number
  processed_events: PollProcessedEvent[]
  errors: string[]
  auth_hint?: string
  duration_ms: number
}

// ---------------------------------------------------------------------------
// Helpers — Gmail payload extraction
// ---------------------------------------------------------------------------

function decodeBase64Url(input: string): string {
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
}

function findHeader(headers: { name?: string | null; value?: string | null }[] | undefined, name: string): string {
  if (!headers) return ''
  const target = name.toLowerCase()
  for (const h of headers) {
    if ((h.name ?? '').toLowerCase() === target) return h.value ?? ''
  }
  return ''
}

function parseFromHeader(header: string): { email: string; name: string | null } {
  const trimmed = header.trim()
  const m = trimmed.match(/^\s*"?([^"<]+?)"?\s*<([^>]+)>\s*$/)
  if (m) {
    const name = m[1].trim()
    return { email: m[2].trim().toLowerCase(), name: name || null }
  }
  return { email: trimmed.toLowerCase(), name: null }
}

interface GmailPart {
  mimeType?: string | null
  body?: { data?: string | null; attachmentId?: string | null; size?: number | null } | null
  filename?: string | null
  parts?: GmailPart[]
}

function extractBodies(payload: GmailPart | undefined): { text: string; html: string; attachments: Array<{ filename: string; mime: string; size: number; gmail_attachment_id: string | null }> } {
  const out = { text: '', html: '', attachments: [] as Array<{ filename: string; mime: string; size: number; gmail_attachment_id: string | null }> }
  if (!payload) return out

  function walk(p: GmailPart): void {
    if (p.parts && p.parts.length > 0) {
      for (const child of p.parts) walk(child)
      return
    }
    const mime = (p.mimeType ?? '').toLowerCase()
    const filename = p.filename ?? ''
    const data = p.body?.data ?? ''
    const attachmentId = p.body?.attachmentId ?? null

    if (filename && (attachmentId || (p.body?.size ?? 0) > 0)) {
      out.attachments.push({
        filename,
        mime: p.mimeType ?? 'application/octet-stream',
        size: p.body?.size ?? 0,
        gmail_attachment_id: attachmentId,
      })
      return
    }

    if (!data) return

    if (mime.startsWith('text/plain') && !out.text) {
      out.text = decodeBase64Url(data)
    } else if (mime.startsWith('text/html') && !out.html) {
      out.html = decodeBase64Url(data)
    }
  }

  walk(payload)
  return out
}

function htmlToText(html: string): string {
  // Lightweight fallback when Gmail only sends text/html. Not a full
  // converter — strips tags, decodes a handful of common entities, and
  // collapses whitespace. The parser only needs the first 2000 chars
  // anyway, so this is good enough.
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

export interface PollOptions {
  /** Max messages to process in one cron tick. Default 10. */
  maxMessages?: number
  /** Gmail search query. Default 'is:unread in:inbox'. */
  query?: string
  /** If true, do not mark as read in Gmail (used in tests). */
  skipMarkAsRead?: boolean
  /** If true, do not send reply (used in tests). */
  skipReply?: boolean
}

export async function pollMarketingInbox(opts: PollOptions = {}): Promise<PollReport> {
  const start = Date.now()
  const fetched_at = new Date().toISOString()
  const errors: string[] = []
  const processed: PollProcessedEvent[] = []
  const maxMessages = opts.maxMessages ?? 10
  const query = opts.query ?? 'is:unread in:inbox'

  // Auth — read scope is required to list and fetch messages. Send scope
  // is required for the reply layer. We try a combined client first; if
  // gmail.modify is not yet in the DWD allowlist, fall back to send-only
  // so the reply layer still works (it does not need read).
  const readAuth = await getReadAuth()
  if (!readAuth.ok || !readAuth.client) {
    return {
      status: 'auth_pending',
      fetched_at,
      fetched_unread_count: 0,
      processed_events: [],
      errors: [`Read auth failed: ${readAuth.error ?? 'unknown'}`],
      auth_hint: readAuth.hint ?? 'See docs/handoffs/marketing-inbox-admin-setup.md',
      duration_ms: Date.now() - start,
    }
  }

  const sendAuth = await getSendAuth()
  if (!sendAuth.ok || !sendAuth.client) {
    errors.push(`Send auth failed (replies will be skipped): ${sendAuth.error ?? 'unknown'}`)
  }

  const gmail = google.gmail({ version: 'v1', auth: readAuth.client as JWT })
  const supabase = getSupabase()

  let unreadList: { id: string; threadId: string }[] = []
  try {
    const res = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: maxMessages,
    })
    unreadList = (res.data.messages ?? []).map((m) => ({
      id: m.id ?? '',
      threadId: m.threadId ?? '',
    }))
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    errors.push(`messages.list failed: ${msg}`)
    return {
      status: 'error',
      fetched_at,
      fetched_unread_count: 0,
      processed_events: [],
      errors,
      duration_ms: Date.now() - start,
    }
  }

  for (const item of unreadList) {
    try {
      const existing = await supabase
        .from('marketing_inbox_events')
        .select('id, status')
        .eq('gmail_message_id', item.id)
        .maybeSingle()

      if (existing.data) {
        processed.push({
          inbox_event_id: existing.data.id as string,
          gmail_message_id: item.id,
          sender_email: '',
          outcome: 'duplicate',
          reason: `Already processed with status=${existing.data.status}.`,
        })
        // Still mark Gmail-side as read to avoid re-fetching forever
        if (!opts.skipMarkAsRead) {
          await safeMarkAsRead(gmail, item.id, errors)
        }
        continue
      }

      const full = await gmail.users.messages.get({
        userId: 'me',
        id: item.id,
        format: 'full',
      })

      const payload = full.data.payload as GmailPart | undefined
      const headers = payload?.parts ? payload.parts.flatMap((p) => (p as any).headers ?? []) : (payload as any)?.headers ?? []
      // The above sometimes misses the top-level headers; prefer top-level explicitly:
      const topLevelHeaders = (payload as any)?.headers ?? []
      const rfc822MessageId = findHeader(topLevelHeaders, 'Message-ID') || findHeader(topLevelHeaders, 'Message-Id')
      const fromHeader = findHeader(topLevelHeaders, 'From')
      const subjectHeader = findHeader(topLevelHeaders, 'Subject')

      const { email: senderEmail, name: senderName } = parseFromHeader(fromHeader)
      const bodies = extractBodies(payload)
      const bodyText = bodies.text || (bodies.html ? htmlToText(bodies.html) : '')

      const insert = await supabase
        .from('marketing_inbox_events')
        .insert({
          gmail_message_id: item.id,
          gmail_thread_id: item.threadId,
          sender_email: senderEmail,
          sender_name: senderName,
          subject: subjectHeader || null,
          body_text: bodyText || null,
          body_html: bodies.html || null,
          attachments: bodies.attachments,
          status: 'received',
        })
        .select('id')
        .single()

      if (insert.error || !insert.data) {
        errors.push(`insert inbox event ${item.id}: ${insert.error?.message ?? 'no row'}`)
        continue
      }
      const inboxEventId = insert.data.id as string

      // Allowlist gate
      const allowlist = isSenderAllowed(senderEmail)
      if (!allowlist.allowed) {
        await supabase
          .from('marketing_inbox_events')
          .update({
            status: 'killed',
            kill_reason: allowlist.reason,
          })
          .eq('id', inboxEventId)

        if (allowlist.default_action === 'reject_and_alert' && sendAuth.ok && sendAuth.client && !opts.skipReply) {
          const replyCtx: ReplyContext = {
            to_email: senderEmail,
            to_name: senderName,
            original_subject: subjectHeader || null,
            thread_id: item.threadId,
            in_reply_to_message_id: rfc822MessageId,
            inbox_event_id: inboxEventId,
            kind: { kind: 'rejected_sender', reason: allowlist.reason },
          }
          await sendInboxReply(sendAuth.client as JWT, replyCtx)
        }

        if (!opts.skipMarkAsRead) await safeMarkAsRead(gmail, item.id, errors)

        processed.push({
          inbox_event_id: inboxEventId,
          gmail_message_id: item.id,
          sender_email: senderEmail,
          outcome: 'rejected_sender',
          reason: allowlist.reason,
        })
        continue
      }

      // Parse
      const parse = await parseInboxEmail({
        from: senderEmail,
        subject: subjectHeader || '',
        body_text: bodyText || '',
      })

      await supabase
        .from('marketing_inbox_events')
        .update({
          parsed_at: new Date().toISOString(),
          parsed_intent: parse.action_type,
          parsed_target: parse.target,
          parsed_payload: parse.payload,
          parser_confidence: parse.confidence,
          parser_model: parse.model,
          parser_rationale: parse.rationale,
          status: 'parsed',
        })
        .eq('id', inboxEventId)

      // Dispatch
      const dispatch = await dispatchParsedEmail(
        {
          id: inboxEventId,
          gmail_message_id: item.id,
          gmail_thread_id: item.threadId,
          sender_email: senderEmail,
          sender_name: senderName,
          subject: subjectHeader || null,
          body_text: bodyText || null,
        } as InboxEvent,
        parse,
      )

      await supabase
        .from('marketing_inbox_events')
        .update({
          action_row_id: dispatch.action_row_id,
          status: 'dispatched',
        })
        .eq('id', inboxEventId)

      // Reply
      let replyOutcome: 'replied' | 'dispatched' | 'reply_failed' = 'dispatched'
      if (sendAuth.ok && sendAuth.client && !opts.skipReply) {
        const replyCtx: ReplyContext = {
          to_email: senderEmail,
          to_name: senderName,
          original_subject: subjectHeader || null,
          thread_id: item.threadId,
          in_reply_to_message_id: rfc822MessageId,
          inbox_event_id: inboxEventId,
          kind:
            dispatch.dispatched_as === 'parsed_intent'
              ? {
                  kind: 'parsed_intent',
                  action_row_id: dispatch.action_row_id,
                  action_type: dispatch.action_type,
                  assigned_producer: dispatch.assigned_producer,
                }
              : {
                  kind: 'unknown_triage',
                  action_row_id: dispatch.action_row_id,
                  triage_reason: dispatch.reason,
                },
        }
        const out = await sendInboxReply(sendAuth.client as JWT, replyCtx)
        replyOutcome = out.status === 'sent' ? 'replied' : 'reply_failed'
      }

      if (!opts.skipMarkAsRead) await safeMarkAsRead(gmail, item.id, errors)

      processed.push({
        inbox_event_id: inboxEventId,
        gmail_message_id: item.id,
        sender_email: senderEmail,
        outcome: replyOutcome,
        action_row_id: dispatch.action_row_id,
        action_type: dispatch.action_type,
        reason: dispatch.reason,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`message ${item.id}: ${msg}`)
      processed.push({
        inbox_event_id: '',
        gmail_message_id: item.id,
        sender_email: '',
        outcome: 'failed',
        reason: msg,
      })
    }
  }

  return {
    status: 'ok',
    fetched_at,
    fetched_unread_count: unreadList.length,
    processed_events: processed,
    errors,
    duration_ms: Date.now() - start,
  }
}

async function safeMarkAsRead(
  gmail: ReturnType<typeof google.gmail>,
  messageId: string,
  errors: string[],
): Promise<void> {
  try {
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        removeLabelIds: ['UNREAD'],
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    errors.push(`mark as read ${messageId}: ${msg}`)
  }
}

export { MARKETING_INBOX_USER }
