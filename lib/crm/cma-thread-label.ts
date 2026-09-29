/**
 * CMA thread labels for synced Gmail rows. Pure: no I/O.
 *
 * A message is on a CMA thread for a person when EITHER
 *   (1) its Gmail threadId equals a non-null threadId on a CmaThreadRecord
 *       for that person, OR
 *   (2) the record has no threadId yet AND the counterparty address equals
 *       that CMA's clientEmail AND the subject is the CMA subject or a
 *       Re:/Fwd:/Fw: of it (repeated prefixes stripped, then case-insensitive
 *       trim compare).
 * If both thread ids are known and they differ, the message is NOT labelled,
 * even when the counterparty matches. A later email with the same person is
 * left alone unless the thread matches (or the subject fallback applies
 * because we never learned a thread id).
 *
 * Outbound whose subject equals the CMA subject and is not itself a reply
 * prefix is "CMA sent". Any other outbound on the thread is "CMA reply sent".
 * Inbound on the thread is "CMA reply received".
 */

export const CMA_LABEL_SENT = 'CMA sent'
export const CMA_LABEL_REPLY_IN = 'CMA reply received'
export const CMA_LABEL_REPLY_OUT = 'CMA reply sent'

export type CmaLabel = typeof CMA_LABEL_SENT | typeof CMA_LABEL_REPLY_IN | typeof CMA_LABEL_REPLY_OUT

const CMA_LABELS: ReadonlySet<string> = new Set([CMA_LABEL_SENT, CMA_LABEL_REPLY_IN, CMA_LABEL_REPLY_OUT])

export type CmaThreadRecord = {
  personId: number
  slug: string
  threadId: string | null
  subject: string | null
  clientEmail: string | null
}

export type CmaThreadLabel = {
  cmaSlug: string
  cmaLabel: CmaLabel
  threadId: string | null
}

const REPLY_PREFIX_RE = /^(?:re|fwd|fw)\s*:\s*/i

function isBlank(value: unknown): boolean {
  return value == null || (typeof value === 'string' && value.trim() === '')
}

function asStr(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function stripReplyPrefixes(subject: string | null | undefined): { base: string; isReply: boolean } {
  let s = (subject ?? '').trim()
  let isReply = false
  for (let i = 0; i < 6; i++) {
    const next = s.replace(REPLY_PREFIX_RE, '').trim()
    if (next === s) break
    isReply = true
    s = next
  }
  return { base: s, isReply }
}

function subjectsEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = stripReplyPrefixes(a).base.toLowerCase()
  const right = stripReplyPrefixes(b).base.toLowerCase()
  return left.length > 0 && left === right
}

function isReplyTo(messageSubject: string | null | undefined, cmaSubject: string | null | undefined): boolean {
  const msg = stripReplyPrefixes(messageSubject)
  return msg.isReply && subjectsEqual(messageSubject, cmaSubject)
}

type MatchHow = 'thread' | 'subject'

function matchHow(
  record: CmaThreadRecord,
  input: {
    personId: number
    threadId: string | null
    subject: string | null
    counterpartyEmails: string[]
  },
): MatchHow | null {
  if (record.personId !== input.personId) return null
  const msgThread = input.threadId?.trim() || null
  const recThread = record.threadId?.trim() || null
  if (msgThread && recThread) return msgThread === recThread ? 'thread' : null
  // A known CMA thread only matches that thread. Subject fallback is only
  // for a delivered CMA we never stored a thread id for.
  if (recThread) return null
  if (!subjectsEqual(input.subject, record.subject) && !isReplyTo(input.subject, record.subject)) return null
  const email = record.clientEmail?.trim().toLowerCase() || null
  if (!email) return null
  if (!input.counterpartyEmails.some((addr) => addr.trim().toLowerCase() === email)) return null
  return 'subject'
}

function isOriginalSend(subject: string | null, cmaSubject: string | null, direction: 'in' | 'out'): boolean {
  if (direction !== 'out') return false
  const msg = stripReplyPrefixes(subject)
  if (msg.isReply) return false
  return subjectsEqual(subject, cmaSubject)
}

export function labelSyncedCmaMessage(input: {
  personId: number
  direction: 'in' | 'out'
  threadId: string | null
  subject: string | null
  counterpartyEmails: string[]
  threads: readonly CmaThreadRecord[]
}): CmaThreadLabel | null {
  const hits: Array<{ record: CmaThreadRecord; how: MatchHow }> = []
  for (const record of input.threads) {
    const how = matchHow(record, input)
    if (how) hits.push({ record, how })
  }
  if (!hits.length) return null
  const threadHits = hits.filter((h) => h.how === 'thread')
  const pool = threadHits.length ? threadHits : hits
  let chosen = pool[0]!
  for (const hit of pool) {
    if (subjectsEqual(input.subject, hit.record.subject) || isReplyTo(input.subject, hit.record.subject)) {
      chosen = hit
      break
    }
  }
  const cmaLabel: CmaLabel =
    input.direction === 'in'
      ? CMA_LABEL_REPLY_IN
      : isOriginalSend(input.subject, chosen.record.subject, input.direction)
        ? CMA_LABEL_SENT
        : CMA_LABEL_REPLY_OUT
  return { cmaSlug: chosen.record.slug, cmaLabel, threadId: input.threadId?.trim() || null }
}

/** Stamp cmaSlug / cmaLabel. Does not clear a threadId the message already has. */
export function applyCmaLabelToPayload(
  payload: Record<string, unknown>,
  label: CmaThreadLabel | null,
): Record<string, unknown> {
  if (!label) return { ...payload }
  const next: Record<string, unknown> = { ...payload, cmaSlug: label.cmaSlug, cmaLabel: label.cmaLabel }
  if (isBlank(next.slug)) next.slug = label.cmaSlug
  if (isBlank(next.artifact)) next.artifact = 'cma'
  if (isBlank(next.threadId) && label.threadId) next.threadId = label.threadId
  return next
}

const PRESERVE_IF_INCOMING_EMPTY = [
  'cmaSlug',
  'cmaLabel',
  'slug',
  'artifact',
  'gmailMessageId',
  'transport',
  'resendId',
  'threadId',
] as const

/**
 * Sync upsert replaces the whole payload. Spread the stored row under the
 * incoming Gmail payload, then put CMA fields back when the incoming copy
 * left them blank so a later sync cannot wipe a send that already logged them.
 */
export function mergeSyncedGmailPayload(
  existing: Record<string, unknown> | null | undefined,
  incoming: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const prior = existing && typeof existing === 'object' ? existing : {}
  const nextIn = incoming && typeof incoming === 'object' ? incoming : {}
  const merged: Record<string, unknown> = { ...prior, ...nextIn }
  for (const key of PRESERVE_IF_INCOMING_EMPTY) {
    if (isBlank(merged[key]) && !isBlank(prior[key])) merged[key] = prior[key]
  }
  return merged
}

export function payloadForSyncedGmailMessage(input: {
  existing?: Record<string, unknown> | null
  gmailId: string | null
  threadId: string | null
  mailbox: string
  snippet: string | null
  personId: number
  direction: 'in' | 'out'
  subject: string | null
  counterpartyEmails: string[]
  threads: readonly CmaThreadRecord[]
}): Record<string, unknown> {
  const base: Record<string, unknown> = {
    gmailId: input.gmailId,
    threadId: input.threadId,
    mailbox: input.mailbox,
    snippet: input.snippet,
  }
  const label = labelSyncedCmaMessage({
    personId: input.personId,
    direction: input.direction,
    threadId: input.threadId,
    subject: input.subject,
    counterpartyEmails: input.counterpartyEmails,
    threads: input.threads,
  })
  const labeled = applyCmaLabelToPayload(base, label)
  return input.existing ? mergeSyncedGmailPayload(input.existing, labeled) : labeled
}

export function cmaTimelineChipLabel(payload: Record<string, unknown> | null | undefined): string | null {
  const label = payload?.cmaLabel
  return typeof label === 'string' && CMA_LABELS.has(label) ? label : null
}

export type CmaThreadSourceRows = {
  emailEvents?: ReadonlyArray<{
    person_id?: unknown
    recipient_email?: unknown
    subject?: unknown
    email_key?: unknown
    meta?: unknown
  }>
  timeline?: ReadonlyArray<{
    person_id?: unknown
    title?: unknown
    payload?: unknown
  }>
  cmas?: ReadonlyArray<{
    person_id?: unknown
    slug?: unknown
    client_email?: unknown
  }>
}

function asPersonId(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN
  return Number.isInteger(n) && n > 0 ? n : null
}

function asObj(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function asEmail(value: unknown): string | null {
  const s = asStr(value)
  return s ? s.toLowerCase() : null
}

/** `cma:<slug>` email_key. meta.slug wins when the caller passes it separately. */
function slugFromEmailKey(emailKey: string | null): string | null {
  if (!emailKey) return null
  const match = /^cma:(.+)$/i.exec(emailKey.trim())
  const slug = match?.[1]?.trim() ?? ''
  return slug || null
}

type Acc = CmaThreadRecord

function fill(
  map: Map<string, Acc>,
  bit: { personId: number | null; slug: string | null; threadId?: string | null; subject?: string | null; clientEmail?: string | null },
): void {
  if (!bit.personId || !bit.slug) return
  const key = `${bit.personId}:${bit.slug}`
  const cur = map.get(key)
  if (!cur) {
    map.set(key, {
      personId: bit.personId,
      slug: bit.slug,
      threadId: bit.threadId ?? null,
      subject: bit.subject ?? null,
      clientEmail: bit.clientEmail ?? null,
    })
    return
  }
  if (!cur.threadId && bit.threadId) cur.threadId = bit.threadId
  if (!cur.subject && bit.subject) cur.subject = bit.subject
  if (!cur.clientEmail && bit.clientEmail) cur.clientEmail = bit.clientEmail
}

/**
 * Fold email_events, CMA timeline rows, and delivered cmas into one record
 * per (person, slug). First non-empty field wins. Pass events, then timeline,
 * then cmas so the send event's thread id beats a later empty source.
 */
export function assembleCmaThreadRecords(src: CmaThreadSourceRows): CmaThreadRecord[] {
  const map = new Map<string, Acc>()
  for (const row of src.emailEvents ?? []) {
    const meta = asObj(row.meta) ?? {}
    fill(map, {
      personId: asPersonId(row.person_id),
      slug: asStr(meta.slug) ?? slugFromEmailKey(asStr(row.email_key)),
      threadId: asStr(meta.gmailThreadId) ?? asStr(meta.threadId),
      subject: asStr(row.subject),
      clientEmail: asEmail(row.recipient_email),
    })
  }
  for (const row of src.timeline ?? []) {
    const payload = asObj(row.payload)
    if (!payload || payload.artifact !== 'cma') continue
    fill(map, {
      personId: asPersonId(row.person_id),
      slug: asStr(payload.cmaSlug) ?? asStr(payload.slug),
      threadId: asStr(payload.threadId),
      subject: asStr(row.title),
    })
  }
  for (const row of src.cmas ?? []) {
    fill(map, {
      personId: asPersonId(row.person_id),
      slug: asStr(row.slug),
      clientEmail: asEmail(row.client_email),
    })
  }
  return [...map.values()]
}
