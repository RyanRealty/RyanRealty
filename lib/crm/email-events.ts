/**
 * Unified email-events writer — the single entry point every send/webhook/tracker
 * path calls to record one normalized, idempotent email event (blueprint §9
 * reporting). Reporting reads from the email_events table; nothing else needs to
 * know the shape of a Resend payload or a Gmail pixel hit.
 *
 * Layering (DAL boundary G1): this file holds the public API + the pure helpers
 * (buildDedupeKey, normalizeEvent). The actual table write + the email→person
 * resolve live in lib/data/crm/ (insertEmailEvent, getPersonIdsByEmail) so no
 * raw Supabase .from() call sits outside lib/data/.
 *
 * Idempotency: dedupe_key = messageId + event + recipient. A webhook redelivery
 * or a double pixel fire builds the SAME key and the DB collapses it to one row.
 * Fail-closed person resolve: an ambiguous email (more than one matching person)
 * resolves to null rather than guessing the wrong contact — the row still lands
 * keyed on recipient_email and can be re-linked later.
 */

import 'server-only'

// ── Types ────────────────────────────────────────────────────────────────────

/** The normalized lifecycle event taxonomy stored in email_events.event. */
export type EmailEvent =
  | 'sent'
  | 'delivered'
  | 'open'
  | 'click'
  | 'bounce'
  | 'complaint'
  | 'unsubscribe'

/** What kind of send produced the event (email_events.send_type). */
export type EmailSendType =
  | 'newsletter'
  | 'campaign'
  | 'cma'
  | 'market-report'
  | 'alert'
  | 'sequence'
  | 'one-off'
  | 'other'

export type RecordEmailEventInput = {
  /** Provider message id (Resend email_id, Gmail message id). */
  messageId?: string | null
  /**
   * Recipient address. Optional ONLY when a positive personId is supplied (the
   * Gmail open/click rail signs personId + emailKey into the pixel token but
   * never the recipient email). With a personId we resolve the recipient
   * best-effort from the person's primary email and anchor the dedupe key on the
   * person instead. Without a personId this is required — the event is keyed on
   * it when no person resolves.
   */
  recipientEmail?: string | null
  /** Pre-resolved crm_people id. When omitted, resolved fail-closed from the email. */
  personId?: number | null
  broker?: string | null
  sendType: EmailSendType
  /** Raw provider/internal event name. Normalized via normalizeEvent(). */
  event: string
  /** Per-send instrumentation key (matches the open/click tracker emailKey). */
  emailKey?: string | null
  subject?: string | null
  /** ISO timestamp or Date the event occurred. Defaults to now. */
  occurredAt?: string | Date | null
  meta?: Record<string, unknown>
}

export type RecordEmailEventResult =
  | { ok: true; inserted: boolean; event: EmailEvent; personId: number | null }
  | { ok: false; error: string }

// ── Pure helpers ─────────────────────────────────────────────────────────────

const EVENT_VALUES: readonly EmailEvent[] = [
  'sent',
  'delivered',
  'open',
  'click',
  'bounce',
  'complaint',
  'unsubscribe',
]

/**
 * Map a raw provider/internal event name to the normalized enum, or null when it
 * is not a reportable lifecycle event. Handles Resend's `email.*` names, Gmail
 * tracker names (`open`/`opened`, `click`/`clicked`), and already-normalized
 * values. Case-insensitive, whitespace-tolerant.
 */
export function normalizeEvent(raw: string | null | undefined): EmailEvent | null {
  if (!raw) return null
  // Strip a provider namespace (`email.opened` -> `opened`) and lowercase.
  const key = String(raw).trim().toLowerCase().replace(/^email\./, '')
  switch (key) {
    case 'sent':
    case 'send':
    case 'delivery':
      return 'sent'
    case 'delivered':
      return 'delivered'
    case 'open':
    case 'opened':
      return 'open'
    case 'click':
    case 'clicked':
      return 'click'
    case 'bounce':
    case 'bounced':
      return 'bounce'
    case 'complaint':
    case 'complained':
    case 'spam':
    case 'spamreport':
      return 'complaint'
    case 'unsubscribe':
    case 'unsubscribed':
    case 'optout':
    case 'opt-out':
      return 'unsubscribe'
    default:
      return (EVENT_VALUES as readonly string[]).includes(key) ? (key as EmailEvent) : null
  }
}

/**
 * Build the idempotency key for an event. Stable + deterministic: the same
 * (messageId, event, recipient) always produces the same key, so a redelivered
 * webhook or a double pixel fire is a DB no-op.
 *
 * Recipient is lowercased/trimmed so casing variants collapse. When no messageId
 * exists, the emailKey (per-send instrumentation key) anchors the dedupe instead
 * so a pixel-only open is still idempotent; with neither, the key falls back to
 * the bare event+recipient (best-effort de-dup for anonymous sends).
 *
 * The Gmail open/click rail has no recipient email in its signed token — only a
 * personId + emailKey. For that path the dedupe target is the PERSON (`p:<id>`)
 * rather than the email, so a pixel that fires many times still collapses to one
 * open row even though the recipient is unknown / resolved only best-effort.
 */
export function buildDedupeKey(opts: {
  messageId?: string | null
  emailKey?: string | null
  event: EmailEvent
  recipientEmail?: string | null
  personId?: number | null
}): string {
  const anchor = (opts.messageId || opts.emailKey || 'none').trim()
  const recipient = (opts.recipientEmail ?? '').trim().toLowerCase()
  // Prefer the recipient as the dedupe target; fall back to the person id when no
  // recipient is known (the Gmail tracker rail), so the key stays deterministic.
  const target =
    recipient || (typeof opts.personId === 'number' && Number.isFinite(opts.personId) ? `p:${opts.personId}` : '')
  return `${anchor}:${opts.event}:${target}`
}

/**
 * Infer the send type from an instrumentation emailKey's prefix. The tracker
 * rail signs an emailKey like `newsletter:...`, `cma:cma-62285-deer`, `seq:69:2`
 * into the open/click token; the prefix before the first colon tells us what
 * kind of send produced the event. Unknown / prefix-less keys fall back to
 * 'other'. Pure — exported for the unit test.
 */
export function sendTypeFromEmailKey(emailKey: string | null | undefined): EmailSendType {
  const prefix = String(emailKey ?? '').trim().toLowerCase().split(':')[0]
  switch (prefix) {
    case 'newsletter':
      return 'newsletter'
    case 'campaign':
      return 'campaign'
    case 'cma':
      return 'cma'
    case 'market-report':
    case 'market':
    case 'report':
      return 'market-report'
    // The alert send paths (app/actions/saved-search-alerts.ts) sign
    // `listing-alert:<rowId>:<runDate>` into the tracker token — both spellings
    // classify as 'alert' so opens/clicks report against the right send type.
    case 'alert':
    case 'listing-alert':
      return 'alert'
    case 'seq':
    case 'sequence':
      return 'sequence'
    case 'one-off':
    case 'oneoff':
    case 'manual':
      return 'one-off'
    default:
      return 'other'
  }
}

// ── Orchestration ────────────────────────────────────────────────────────────

/**
 * Resolve a recipient email to a single crm_people id, FAIL-CLOSED: returns null
 * when the email matches zero people OR more than one (ambiguous — a farm import
 * can put the same address on many rows). The caller stores the event keyed on
 * recipient_email regardless, so an unresolved/ambiguous address never drops the
 * event, it just leaves person_id null for later re-linking.
 */
export async function resolvePersonIdByEmail(email: string): Promise<number | null> {
  const norm = (email ?? '').trim().toLowerCase()
  if (!norm) return null
  const { getPersonIdsByEmail } = await import('@/lib/data/crm/getPersonIdsByEmail')
  const ids = await getPersonIdsByEmail(norm)
  // Exactly one match is unambiguous; zero or many fail closed to null.
  return ids.length === 1 ? ids[0] : null
}

/**
 * Record one normalized, idempotent email event. The single write path for every
 * send/webhook/tracker. Never throws — returns a result flag so a reporting-side
 * failure can never break a send or a webhook 200.
 */
export async function recordEmailEvent(
  input: RecordEmailEventInput,
): Promise<RecordEmailEventResult> {
  const event = normalizeEvent(input.event)
  if (!event) return { ok: false, error: `unrecognized event: ${input.event}` }

  const hasPersonId = typeof input.personId === 'number' && Number.isFinite(input.personId) && input.personId > 0
  let recipient = (input.recipientEmail ?? '').trim().toLowerCase()

  // A recipient is required UNLESS a positive personId is supplied (the Gmail
  // open/click rail signs personId + emailKey but not the recipient email). With
  // a personId we resolve the recipient best-effort from the person's primary
  // email so the row still carries an address when one is on file.
  if (!recipient && !hasPersonId) return { ok: false, error: 'recipientEmail or personId required' }

  // Resolve the person: a caller-supplied positive id wins; otherwise resolve
  // fail-closed from the recipient email.
  let personId: number | null = null
  if (hasPersonId) {
    personId = input.personId as number
    if (!recipient) {
      const { getPersonPrimaryEmail } = await import('@/lib/data/crm/getPersonPrimaryEmail')
      recipient = ((await getPersonPrimaryEmail(personId)) ?? '').trim().toLowerCase()
    }
  } else {
    personId = await resolvePersonIdByEmail(recipient)
  }

  const occurredAt = toIso(input.occurredAt)
  const dedupeKey = buildDedupeKey({
    messageId: input.messageId ?? null,
    emailKey: input.emailKey ?? null,
    event,
    recipientEmail: recipient,
    personId,
  })

  const { insertEmailEvent } = await import('@/lib/data/crm/insertEmailEvent')
  const res = await insertEmailEvent({
    message_id: input.messageId ?? null,
    recipient_email: recipient,
    person_id: personId,
    broker: input.broker ?? null,
    send_type: input.sendType,
    event,
    email_key: input.emailKey ?? null,
    subject: input.subject ?? null,
    occurred_at: occurredAt,
    meta: input.meta ?? {},
    dedupe_key: dedupeKey,
  })
  if (!res.ok) return { ok: false, error: res.error }
  return { ok: true, inserted: res.inserted, event, personId }
}

/** Coerce a Date/ISO string/nullish to an ISO string, defaulting to now. */
function toIso(v: string | Date | null | undefined): string {
  if (v instanceof Date) return v.toISOString()
  if (typeof v === 'string' && v.trim()) {
    const d = new Date(v)
    if (!Number.isNaN(d.getTime())) return d.toISOString()
  }
  return new Date().toISOString()
}
