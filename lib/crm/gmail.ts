/**
 * CRM Gmail layer — the email backbone of the in-house CRM (blueprint §5.2).
 *
 * Uses the existing Google service account with domain-wide delegation
 * (verified 2026-06-09: gmail.readonly + gmail.send for all three broker
 * mailboxes). Three jobs:
 *
 *   1. syncMailbox(): walk a mailbox window (backfill or incremental), match
 *      messages to CRM contacts by address, write full-content email_in /
 *      email_out rows to crm_timeline.
 *   2. sendCrmEmail(): send as a broker from their own mailbox (lands in
 *      their Sent folder; real reply chain).
 *
 * FUB's API never exposed email bodies — Gmail is the actual system of record,
 * so this recovers MORE history than FUB could ever return.
 */

import { createHash } from 'node:crypto'
import { google, type gmail_v1 } from 'googleapis'
import { createServiceClient } from '@/lib/supabase/service'
import { CRM_BROKER_BY_EMAIL, type CrmBrokerSlug } from '@/lib/crm/constants'
import { composeOutboundHtml, prepareOutboundEmailBody, type EmailBodyFormat } from '@/lib/crm/email-body'

// System/notification senders that must never create timeline entries — their
// mail is platform noise (FUB missed-call alerts, surveys, port updates), not
// a communication from a contact.
const BLOCKED_SENDER_DOMAINS = new Set(['followupboss.com'])

export const CRM_MAILBOXES: Array<{ email: string; slug: CrmBrokerSlug }> = [
  { email: 'matt@ryan-realty.com', slug: 'matt' },
  { email: 'rebeccapeterson@ryan-realty.com', slug: 'rebecca' },
  { email: 'paul@ryan-realty.com', slug: 'paul' },
]

function getKey(): { clientEmail: string; privateKey: string } | null {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL?.trim()
  let privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? ''
  privateKey = privateKey.replace(/\\n/g, '\n').replace(/^"|"$/g, '')
  if (!clientEmail || !privateKey) return null
  return { clientEmail, privateKey }
}

export function getGmailFor(subject: string, scopes: string[]): gmail_v1.Gmail | null {
  const key = getKey()
  if (!key) return null
  const jwt = new google.auth.JWT({
    email: key.clientEmail,
    key: key.privateKey,
    scopes,
    subject,
  })
  return google.gmail({ version: 'v1', auth: jwt })
}

const READONLY = ['https://www.googleapis.com/auth/gmail.readonly']
const SEND = ['https://www.googleapis.com/auth/gmail.send']

// ── address → person matching ─────────────────────────────────────────────

const SELF_DOMAINS = new Set(['ryan-realty.com', 'mail.ryan-realty.com', 'followupboss.me'])

export async function loadEmailPersonMap(): Promise<Map<string, number>> {
  const sb = createServiceClient()
  const map = new Map<string, number>()
  let from = 0
  for (;;) {
    const { data, error } = await sb
      .from('crm_contact_points')
      .select('person_id,value')
      .eq('kind', 'email')
      .range(from, from + 999)
    if (error) throw new Error('contact point map: ' + error.message)
    for (const r of data ?? []) {
      const v = String(r.value).toLowerCase()
      // exclude our own addresses so internal mail never maps to a contact
      if (!SELF_DOMAINS.has(v.split('@')[1] ?? '')) map.set(v, r.person_id)
    }
    if (!data || data.length < 1000) break
    from += 1000
  }
  return map
}

function parseAddresses(header: string | undefined): string[] {
  if (!header) return []
  return [...header.matchAll(/[\w.+-]+@[\w-]+\.[\w.-]+/g)].map((m) => m[0].toLowerCase())
}

function headerOf(msg: gmail_v1.Schema$Message, name: string): string | undefined {
  return msg.payload?.headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? undefined
}

function extractBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return ''
  const parts: string[] = []
  const walk = (p: gmail_v1.Schema$MessagePart, want: string) => {
    if (p.mimeType === want && p.body?.data) {
      parts.push(Buffer.from(p.body.data, 'base64url').toString('utf8'))
    }
    for (const child of p.parts ?? []) walk(child, want)
  }
  walk(payload, 'text/plain')
  if (!parts.length) {
    walk(payload, 'text/html')
    return parts.join('\n').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 8000)
  }
  return parts.join('\n').trim().slice(0, 8000)
}

// ── sync ───────────────────────────────────────────────────────────────────

export type MailboxSyncResult = {
  mailbox: string
  processed: number
  matched: number
  pagesUsed: number
  done: boolean
  cursorAdvancedTo: string | null
  error?: string
}

/**
 * Process one window of a mailbox. Cursor = gmail internalDate (ms) of the
 * newest fully-processed point, stored in crm_imports (source `gmail:<slug>`).
 * Backfill walks OLD→NEW pages of `after:` query; incremental uses the same
 * mechanism (after cursor). pageBudget bounds runtime per invocation.
 */
export async function syncMailboxWindow(params: {
  mailboxEmail: string
  brokerSlug: CrmBrokerSlug
  pageBudget?: number
  emailMap?: Map<string, number>
}): Promise<MailboxSyncResult> {
  const { mailboxEmail, brokerSlug } = params
  const pageBudget = params.pageBudget ?? 5
  const sb = createServiceClient()
  const gmail = getGmailFor(mailboxEmail, READONLY)
  if (!gmail) return { mailbox: mailboxEmail, processed: 0, matched: 0, pagesUsed: 0, done: true, cursorAdvancedTo: null, error: 'service account not configured' }

  const source = `gmail:${brokerSlug}`
  const { data: cursorRow } = await sb
    .from('crm_imports')
    .select('cursor')
    .eq('source', source)
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle()
  const cursor = (cursorRow?.cursor ?? {}) as { after_ms?: number; page_token?: string; max_internal_ms?: number }
  // default start: 2023-01-01 (account history horizon)
  const afterSec = Math.floor(Number(cursor.after_ms ?? Date.UTC(2023, 0, 1)) / 1000)

  const emailMap = params.emailMap ?? (await loadEmailPersonMap())

  let processed = 0
  let matched = 0
  let pagesUsed = 0
  // carry walk-wide max across resumed invocations (a long mailbox walk spans
  // many invocations; the page token below persists mid-walk progress)
  let maxInternal = Math.max(afterSec * 1000, Number(cursor.max_internal_ms ?? 0))
  let pageToken: string | undefined = cursor.page_token || undefined
  let done = false

  try {
    for (; pagesUsed < pageBudget; pagesUsed++) {
      const list = await gmail.users.messages.list({
        userId: 'me',
        q: `after:${afterSec} -in:spam -in:trash`,
        maxResults: 100,
        pageToken,
      })
      const ids = list.data.messages ?? []
      if (!ids.length) { done = true; break }

      const rows: Array<Record<string, unknown>> = []
      // metadata pass: concurrent chunks (quota: metadata.get = 5 units, 250 units/s/user)
      const metas: gmail_v1.Schema$Message[] = []
      const CHUNK = 8
      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = await Promise.all(
          ids.slice(i, i + CHUNK).map((m) =>
            gmail.users.messages.get({ userId: 'me', id: m.id!, format: 'metadata', metadataHeaders: ['From', 'To', 'Cc', 'Subject', 'Date', 'Message-ID'] }).then((r) => r.data),
          ),
        )
        metas.push(...chunk)
      }
      for (const meta of metas) {
        processed++
        const internal = Number(meta.internalDate ?? 0)
        if (internal > maxInternal) maxInternal = internal
        const from = parseAddresses(headerOf(meta, 'From'))
        if (from.length && from.every((a) => BLOCKED_SENDER_DOMAINS.has(a.split('@')[1] ?? ''))) continue
        const toCc = [...parseAddresses(headerOf(meta, 'To')), ...parseAddresses(headerOf(meta, 'Cc'))]
        const candidates = new Map<number, 'in' | 'out'>()
        for (const a of from) { const pid = emailMap.get(a); if (pid) candidates.set(pid, 'in') }
        for (const a of toCc) { const pid = emailMap.get(a); if (pid && !candidates.has(pid)) candidates.set(pid, 'out') }
        if (!candidates.size) continue

        // matched → fetch full body once
        const fullMsg = await gmail.users.messages.get({ userId: 'me', id: meta.id!, format: 'full' })
        const subject = headerOf(fullMsg.data, 'Subject') ?? null
        const body = extractBody(fullMsg.data.payload) || (fullMsg.data.snippet ?? null)
        // RFC822 Message-ID is stable across mailboxes — an email delivered to
        // two broker inboxes gets a different gmailId per mailbox but the same
        // Message-ID, so keying on it makes the second copy an upsert no-op.
        const rfcId = headerOf(fullMsg.data, 'Message-ID')
        const messageKey = rfcId ? `rfc:${createHash('sha1').update(rfcId.trim()).digest('hex').slice(0, 24)}` : fullMsg.data.id
        for (const [personId, dir] of candidates) {
          matched++
          rows.push({
            person_id: personId,
            ts: new Date(internal || Date.now()).toISOString(),
            kind: dir === 'in' ? 'email_in' : 'email_out',
            title: subject,
            body,
            payload: {
              gmailId: fullMsg.data.id,
              threadId: fullMsg.data.threadId,
              mailbox: mailboxEmail,
              snippet: fullMsg.data.snippet ?? null,
            },
            broker: brokerSlug,
            source: 'gmail',
            dedupe_key: `gmail:${messageKey}:p${personId}`,
          })
        }
      }
      if (rows.length) {
        // Sends from the app (sequence engine, manual 1:1) already logged the
        // send keyed gmail:<gmailId>:p<person>. The sync re-encounters the same
        // message in SENT under its Message-ID key, which would land a
        // near-twin row — drop any outbound row whose gmailId-keyed twin
        // already exists (near-twin audit 2026-06-12).
        const altKeyOf = (r: Record<string, unknown>) =>
          r.kind === 'email_out'
            ? `gmail:${(r.payload as { gmailId?: string | null }).gmailId}:p${r.person_id}`
            : null
        const altKeys = rows.map(altKeyOf).filter((k): k is string => !!k)
        let appLogged = new Set<string>()
        if (altKeys.length) {
          const { data: twins } = await sb.from('crm_timeline').select('dedupe_key').in('dedupe_key', altKeys)
          appLogged = new Set((twins ?? []).map((t) => t.dedupe_key as string))
        }
        const seen = new Map<string, Record<string, unknown>>()
        for (const r of rows) {
          const alt = altKeyOf(r)
          if (alt && appLogged.has(alt)) continue
          seen.set(r.dedupe_key as string, r)
        }
        if (seen.size) {
          const { error } = await sb.from('crm_timeline').upsert([...seen.values()], { onConflict: 'dedupe_key' })
          if (error) throw new Error('timeline upsert: ' + error.message)
        }
      }
      pageToken = list.data.nextPageToken ?? undefined
      if (!pageToken) { done = true; break }
    }
  } catch (e) {
    return { mailbox: mailboxEmail, processed, matched, pagesUsed, done: false, cursorAdvancedTo: null, error: e instanceof Error ? e.message : String(e) }
  }

  // Persist progress EVERY invocation: mid-walk runs save the Gmail page
  // token so the next invocation resumes where this one stopped (a 47K-message
  // mailbox spans many invocations); completed walks advance the time cursor
  // and clear the token.
  let cursorAdvancedTo: string | null = null
  if (done) {
    const advanced = maxInternal > afterSec * 1000
    await sb.from('crm_imports').insert({
      source,
      status: 'done',
      finished_at: new Date().toISOString(),
      counts: { processed, matched },
      cursor: { after_ms: advanced ? maxInternal : afterSec * 1000 },
    })
    if (advanced) cursorAdvancedTo = new Date(maxInternal).toISOString()
  } else if (pageToken) {
    await sb.from('crm_imports').insert({
      source,
      status: 'done',
      finished_at: new Date().toISOString(),
      counts: { processed, matched, midWalk: true },
      cursor: { after_ms: afterSec * 1000, page_token: pageToken, max_internal_ms: maxInternal },
    })
  }
  return { mailbox: mailboxEmail, processed, matched, pagesUsed, done, cursorAdvancedTo }
}

// ── send ───────────────────────────────────────────────────────────────────

export interface CrmEmailAttachment {
  filename: string
  content: Buffer
  /** e.g. 'application/pdf', 'image/jpeg' */
  mimeType: string
}

/** Wrap a base64 string at 76 chars per line (RFC 2045), mirroring lib/gmail-draft.ts. */
function wrap76(b64: string): string {
  return b64.replace(/.{1,76}/g, '$&\r\n').trimEnd()
}

/**
 * RFC 2047 encoded-word for non-ASCII header values. A raw UTF-8 subject like
 * "Re: 123 Main St — offer" mojibakes in every client (headers have no
 * charset), verified live 2026-07-09: "—" arrived as "Ã¢Â€Â”".
 */
function encodeHeaderValue(value: string): string {
  return /^[\x20-\x7e]*$/.test(value)
    ? value
    : `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`
}

export async function sendCrmEmail(params: {
  fromMailbox: string
  /** One address or the full To list (comma-joined into the header). */
  to: string | string[]
  /** Optional Cc list — visible to every recipient. */
  cc?: string[]
  /** Optional Bcc list — Gmail delivers to these and strips the header for others. */
  bcc?: string[]
  subject: string
  bodyText: string
  bodyHtml?: string | null
  /** Append the sending broker's HTML signature (client-facing sends only —
   *  internal alerts to broker mailboxes stay signature-free). */
  withSignature?: boolean
  /** When set, instrument the HTML with an open pixel + click-tracked links so
   *  opens/clicks log to the comms chain. Omit for internal/broker emails. */
  track?: { personId: number; emailKey: string; label?: string }
  attachments?: CrmEmailAttachment[]
  /** Composer's explicit Text/HTML choice. Omit ('auto') everywhere else. */
  bodyFormat?: EmailBodyFormat
}): Promise<{ ok: true; gmailId: string; plainBody: string } | { ok: false; error: string }> {
  const gmail = getGmailFor(params.fromMailbox, SEND)
  if (!gmail) return { ok: false, error: 'service account not configured' }

  const source = params.bodyHtml?.trim() || params.bodyText
  const bodyFormat: EmailBodyFormat = params.bodyHtml?.trim() ? 'html' : (params.bodyFormat ?? 'auto')
  let { html, plain } = prepareOutboundEmailBody(source, bodyFormat)

  if (params.withSignature) {
    const { getSignatureForMailbox } = await import('@/lib/crm/email-signature')
    const sig = await getSignatureForMailbox(params.fromMailbox)
    if (sig) {
      // Same composition as the composer preview (lib/crm/email-body.ts) —
      // plain-text bodies get wrapped so the HTML signature renders always.
      html = composeOutboundHtml(source, sig.html, bodyFormat)
      plain = plain + '\n' + sig.plain
    }
  }

  if (params.track && html) {
    const { instrumentEmailHtml } = await import('@/lib/email-tracking')
    html = instrumentEmailHtml(html, params.track)
  }

  const toList = Array.isArray(params.to) ? params.to : [params.to]
  if (toList.length === 0) return { ok: false, error: 'No recipient' }
  const hasAttachments = !!params.attachments && params.attachments.length > 0
  const headers = [
    `From: ${params.fromMailbox}`,
    `To: ${toList.join(', ')}`,
    ...(params.cc?.length ? [`Cc: ${params.cc.join(', ')}`] : []),
    // Gmail delivers to Bcc-header addresses and strips the header from what
    // every recipient receives (same contract lib/gmail-draft.ts relies on).
    ...(params.bcc?.length ? [`Bcc: ${params.bcc.join(', ')}`] : []),
    `Subject: ${encodeHeaderValue(params.subject)}`,
    'MIME-Version: 1.0',
  ]

  let bodyBlock: string
  let bodyContentType: string
  if (html) {
    const altBoundary = `rr_alt_${Date.now().toString(36)}`
    bodyContentType = `multipart/alternative; boundary="${altBoundary}"`
    bodyBlock = [
      `--${altBoundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      plain,
      `--${altBoundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      html,
      `--${altBoundary}--`,
    ].join('\r\n')
  } else {
    bodyContentType = 'text/plain; charset=UTF-8'
    bodyBlock = plain
  }

  let mime: string
  if (!hasAttachments) {
    mime = [...headers, `Content-Type: ${bodyContentType}`, '', bodyBlock].join('\r\n')
  } else {
    const mixedBoundary = `rr_mixed_${Date.now().toString(36)}`
    const parts = [
      ...headers,
      `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
      '',
      `--${mixedBoundary}`,
      `Content-Type: ${bodyContentType}`,
      '',
      bodyBlock,
    ]
    for (const a of params.attachments!) {
      parts.push(
        `--${mixedBoundary}`,
        `Content-Type: ${a.mimeType}; name="${a.filename}"`,
        'Content-Transfer-Encoding: base64',
        `Content-Disposition: attachment; filename="${a.filename}"`,
        '',
        wrap76(a.content.toString('base64')),
      )
    }
    parts.push(`--${mixedBoundary}--`)
    mime = parts.join('\r\n')
  }

  const raw = Buffer.from(mime).toString('base64url')
  try {
    const res = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } })
    return { ok: true, gmailId: res.data.id ?? '', plainBody: plain }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
