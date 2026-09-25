/**
 * Scan each sending broker's mailbox for bounce notices and infer Gmail
 * delivery. Gmail DWD gives no delivery webhook, so this is the receipt rail
 * for CMA (and other) sends that left through the broker's mailbox.
 *
 * Idempotent: bounce and inferred-delivered writes go through recordEmailEvent
 * (unique dedupe_key). Timeline upserts on the same key. A second tick is a
 * no-op for notices already recorded.
 */

import 'server-only'

import type { gmail_v1 } from 'googleapis'
import { getGmailFor } from '@/lib/crm/gmail'
import { getCrmMailboxes } from '@/lib/data/brokers/directory'
import {
  getEmailKeyFlags,
  insertEmailBounceTimeline,
  listWatchedSentEvents,
  type WatchedSentRow,
} from '@/lib/data/crm/gmailBounceWatch'
import { matchSentToBounce, parseBounceNotice, type BounceNotice } from '@/lib/crm/gmail-bounce-notice'
import { recordEmailEvent, type EmailSendType } from '@/lib/crm/email-events'
import { addSuppression } from '@/lib/crm/suppressions'

const READONLY = ['https://www.googleapis.com/auth/gmail.readonly']
const BOUNCE_QUERY =
  '(from:mailer-daemon OR from:postmaster OR subject:"Delivery Status Notification" OR subject:Undeliverable) newer_than:3d'
const LOOKBACK_MS = 8 * 24 * 60 * 60 * 1000
const DELIVERED_AFTER_MS = 24 * 60 * 60 * 1000

export type BounceWatchResult = {
  ok: boolean
  mailboxes: number
  notices: number
  matched: number
  bounced: number
  suppressed: number
  inferredDelivered: number
  errors: string[]
}

function headerOf(msg: gmail_v1.Schema$Message, name: string): string | undefined {
  return msg.payload?.headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? undefined
}

function extractText(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return ''
  const parts: string[] = []
  const walk = (p: gmail_v1.Schema$MessagePart, want: string) => {
    if (p.mimeType === want && p.body?.data) {
      parts.push(Buffer.from(p.body.data, 'base64url').toString('utf8'))
    }
    for (const child of p.parts ?? []) walk(child, want)
  }
  walk(payload, 'text/plain')
  if (parts.length === 0) walk(payload, 'text/html')
  return parts.join('\n')
}

async function listBounceNotices(
  gmail: gmail_v1.Gmail,
): Promise<Array<{ threadId: string | null; notice: BounceNotice }>> {
  const out: Array<{ threadId: string | null; notice: BounceNotice }> = []
  let pageToken: string | undefined
  for (let page = 0; page < 4; page++) {
    const listed = await gmail.users.messages.list({
      userId: 'me',
      q: BOUNCE_QUERY,
      maxResults: 50,
      pageToken,
    })
    const ids = (listed.data.messages ?? []).map((m) => m.id).filter((id): id is string => !!id)
    for (const id of ids) {
      const got = await gmail.users.messages.get({
        userId: 'me',
        id,
        format: 'full',
      })
      const msg = got.data
      const notice = parseBounceNotice({
        from: headerOf(msg, 'From') ?? '',
        subject: headerOf(msg, 'Subject') ?? '',
        inReplyTo: headerOf(msg, 'In-Reply-To') ?? '',
        references: headerOf(msg, 'References') ?? '',
        text: extractText(msg.payload),
      })
      if (!notice.isBounce) continue
      out.push({ threadId: msg.threadId ?? null, notice })
    }
    pageToken = listed.data.nextPageToken ?? undefined
    if (!pageToken || ids.length === 0) break
  }
  return out
}

async function recordBounce(sent: WatchedSentRow, notice: BounceNotice): Promise<boolean> {
  const rec = await recordEmailEvent({
    messageId: sent.message_id,
    recipientEmail: sent.recipient_email,
    personId: sent.person_id,
    broker: sent.broker,
    sendType: (sent.send_type as EmailSendType) || 'cma',
    event: 'bounce',
    emailKey: sent.email_key,
    subject: sent.subject,
    meta: {
      source: 'gmail-dsn',
      hard: notice.hard,
      status: notice.status,
      diagnostic: notice.diagnostic,
      failedRecipients: notice.failedRecipients,
    },
  })
  if (!rec.ok) {
    console.warn('[gmail-bounce-watch] bounce event failed:', rec.error)
    return false
  }
  const personId = rec.personId ?? sent.person_id
  if (personId && personId > 0) {
    await insertEmailBounceTimeline({
      personId,
      title: 'Email bounced',
      body: notice.diagnostic ?? `Delivery failed for ${sent.recipient_email}.`,
      broker: sent.broker,
      dedupeKey: `gmail-dsn:${sent.message_id ?? sent.email_key ?? 'none'}:bounce:p${personId}`,
      payload: {
        emailId: sent.message_id,
        email: sent.recipient_email,
        emailKey: sent.email_key,
        hard: notice.hard,
        status: notice.status,
        diagnostic: notice.diagnostic,
      },
    })
    if (notice.hard) {
      await addSuppression({
        personId,
        channel: 'email',
        reason: notice.diagnostic ?? `Gmail DSN ${notice.status ?? '5.x.x'} for ${sent.recipient_email}`,
        source: 'gmail-dsn',
        value: sent.recipient_email,
      })
    }
  }
  return rec.inserted
}

async function inferDelivered(sent: WatchedSentRow): Promise<boolean> {
  const rec = await recordEmailEvent({
    messageId: sent.message_id,
    recipientEmail: sent.recipient_email,
    personId: sent.person_id,
    broker: sent.broker,
    sendType: (sent.send_type as EmailSendType) || 'cma',
    event: 'delivered',
    emailKey: sent.email_key,
    subject: sent.subject,
    meta: { inferred: true, source: 'gmail-bounce-watch' },
  })
  if (!rec.ok) {
    console.warn('[gmail-bounce-watch] inferred delivered failed:', rec.error)
    return false
  }
  return rec.inserted
}

export async function runGmailBounceWatch(): Promise<BounceWatchResult> {
  const errors: string[] = []
  const sinceIso = new Date(Date.now() - LOOKBACK_MS).toISOString()
  const sents = await listWatchedSentEvents(sinceIso)
  const flags = await getEmailKeyFlags(
    sents.map((s) => s.email_key).filter((k): k is string => !!k),
  )

  let notices = 0
  let matched = 0
  let bounced = 0
  let suppressed = 0

  const mailboxes = await getCrmMailboxes()
  for (const mb of mailboxes) {
    const gmail = getGmailFor(mb.email, READONLY)
    if (!gmail) {
      errors.push(`${mb.email}: no Gmail client (service account missing)`)
      continue
    }
    try {
      const found = await listBounceNotices(gmail)
      notices += found.length
      for (const item of found) {
        const sent = matchSentToBounce(sents, item)
        if (!sent) continue
        matched++
        const key = sent.email_key ?? ''
        const already = key ? flags.get(key)?.bounced : false
        if (already) continue
        const wrote = await recordBounce(sent, item.notice)
        if (wrote) {
          bounced++
          if (item.notice.hard) suppressed++
          if (key) {
            const next = flags.get(key) ?? { bounced: false, delivered: false, opened: false, clicked: false }
            next.bounced = true
            flags.set(key, next)
          }
        }
      }
    } catch (e) {
      errors.push(`${mb.email}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  let inferredDelivered = 0
  const now = Date.now()
  for (const sent of sents) {
    const key = sent.email_key ?? ''
    if (!key) continue
    const f = flags.get(key) ?? { bounced: false, delivered: false, opened: false, clicked: false }
    if (f.bounced || f.delivered) continue
    const sentAt = Date.parse(sent.occurred_at)
    const aged = Number.isFinite(sentAt) && now - sentAt >= DELIVERED_AFTER_MS
    if (!aged && !f.opened && !f.clicked) continue
    const wrote = await inferDelivered(sent)
    if (wrote) {
      inferredDelivered++
      f.delivered = true
      flags.set(key, f)
    }
  }

  return {
    ok: errors.length === 0,
    mailboxes: mailboxes.length,
    notices,
    matched,
    bounced,
    suppressed,
    inferredDelivered,
    errors,
  }
}
