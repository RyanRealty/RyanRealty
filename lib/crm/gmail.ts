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

import { google, type gmail_v1 } from 'googleapis'
import { createServiceClient } from '@/lib/supabase/service'
import { CRM_BROKER_BY_EMAIL, type CrmBrokerSlug } from '@/lib/crm/constants'

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
  // default start: 2023-01-01 (account history horizon)
  const afterSec = Math.floor(Number((cursorRow?.cursor as { after_ms?: number })?.after_ms ?? Date.UTC(2023, 0, 1)) / 1000)

  const emailMap = params.emailMap ?? (await loadEmailPersonMap())

  let processed = 0
  let matched = 0
  let pagesUsed = 0
  let maxInternal = afterSec * 1000
  let pageToken: string | undefined
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
            gmail.users.messages.get({ userId: 'me', id: m.id!, format: 'metadata', metadataHeaders: ['From', 'To', 'Cc', 'Subject', 'Date'] }).then((r) => r.data),
          ),
        )
        metas.push(...chunk)
      }
      for (const meta of metas) {
        processed++
        const internal = Number(meta.internalDate ?? 0)
        if (internal > maxInternal) maxInternal = internal
        const from = parseAddresses(headerOf(meta, 'From'))
        const toCc = [...parseAddresses(headerOf(meta, 'To')), ...parseAddresses(headerOf(meta, 'Cc'))]
        const candidates = new Map<number, 'in' | 'out'>()
        for (const a of from) { const pid = emailMap.get(a); if (pid) candidates.set(pid, 'in') }
        for (const a of toCc) { const pid = emailMap.get(a); if (pid && !candidates.has(pid)) candidates.set(pid, 'out') }
        if (!candidates.size) continue

        // matched → fetch full body once
        const fullMsg = await gmail.users.messages.get({ userId: 'me', id: meta.id!, format: 'full' })
        const subject = headerOf(fullMsg.data, 'Subject') ?? null
        const body = extractBody(fullMsg.data.payload) || (fullMsg.data.snippet ?? null)
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
            dedupe_key: `gmail:${fullMsg.data.id}:p${personId}`,
          })
        }
      }
      if (rows.length) {
        const seen = new Map<string, Record<string, unknown>>()
        for (const r of rows) seen.set(r.dedupe_key as string, r)
        const { error } = await sb.from('crm_timeline').upsert([...seen.values()], { onConflict: 'dedupe_key' })
        if (error) throw new Error('timeline upsert: ' + error.message)
      }
      pageToken = list.data.nextPageToken ?? undefined
      if (!pageToken) { done = true; break }
    }
  } catch (e) {
    return { mailbox: mailboxEmail, processed, matched, pagesUsed, done: false, cursorAdvancedTo: null, error: e instanceof Error ? e.message : String(e) }
  }

  // Advance cursor ONLY when the window completed (otherwise re-walk from the
  // same point next run; dedupe keys make the overlap free).
  let cursorAdvancedTo: string | null = null
  if (done && maxInternal > afterSec * 1000) {
    await sb.from('crm_imports').insert({
      source,
      status: 'done',
      finished_at: new Date().toISOString(),
      counts: { processed, matched },
      cursor: { after_ms: maxInternal },
    })
    cursorAdvancedTo = new Date(maxInternal).toISOString()
  }
  return { mailbox: mailboxEmail, processed, matched, pagesUsed, done, cursorAdvancedTo }
}

// ── send ───────────────────────────────────────────────────────────────────

export async function sendCrmEmail(params: {
  fromMailbox: string
  to: string
  subject: string
  bodyText: string
}): Promise<{ ok: true; gmailId: string } | { ok: false; error: string }> {
  const gmail = getGmailFor(params.fromMailbox, SEND)
  if (!gmail) return { ok: false, error: 'service account not configured' }
  const raw = Buffer.from(
    [
      `From: ${params.fromMailbox}`,
      `To: ${params.to}`,
      `Subject: ${params.subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      '',
      params.bodyText,
    ].join('\r\n'),
  ).toString('base64url')
  try {
    const res = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } })
    return { ok: true, gmailId: res.data.id ?? '' }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
