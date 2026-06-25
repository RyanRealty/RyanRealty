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
  /** Recipient address. Required — the event is keyed on it when no person resolves. */
  recipientEmail: string
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
 */
export function buildDedupeKey(opts: {
  messageId?: string | null
  emailKey?: string | null
  event: EmailEvent
  recipientEmail: string
}): string {
  const anchor = (opts.messageId || opts.emailKey || 'none').trim()
  const recipient = opts.recipientEmail.trim().toLowerCase()
  return `${anchor}:${opts.event}:${recipient}`
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
  const recipient = (input.recipientEmail ?? '').trim().toLowerCase()
  if (!recipient) return { ok: false, error: 'recipientEmail required' }

  const event = normalizeEvent(input.event)
  if (!event) return { ok: false, error: `unrecognized event: ${input.event}` }

  // Resolve the person fail-closed unless the caller already supplied one.
  let personId: number | null = null
  if (typeof input.personId === 'number' && Number.isFinite(input.personId)) {
    personId = input.personId
  } else {
    personId = await resolvePersonIdByEmail(recipient)
  }

  const occurredAt = toIso(input.occurredAt)
  const dedupeKey = buildDedupeKey({
    messageId: input.messageId ?? null,
    emailKey: input.emailKey ?? null,
    event,
    recipientEmail: recipient,
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
