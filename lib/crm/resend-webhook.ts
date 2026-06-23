/**
 * Resend webhook verification + classification (CONTACT360 Phase 9.2).
 *
 * Resend signs webhooks with Svix. The signature is an HMAC-SHA256 over
 * `${svix-id}.${svix-timestamp}.${rawBody}` using the base64-decoded secret
 * (the part after the `whsec_` prefix), base64-encoded, presented in the
 * `svix-signature` header as a space-delimited list of `v1,<sig>` entries.
 *
 * The previous route did a naive `header !== secret` string compare, which can
 * NEVER match a real Svix signature — so every genuine bounce/complaint event
 * was rejected and nothing fed back into suppression. These pure helpers fix the
 * verification and classify which events must suppress the email channel.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'

/** Verify a Svix-signed webhook (HMAC only — the caller does the timestamp freshness check). */
export function verifySvixSignature(opts: {
  secret: string
  svixId: string
  svixTimestamp: string
  signatureHeader: string
  body: string
}): boolean {
  const { secret, svixId, svixTimestamp, signatureHeader, body } = opts
  if (!secret || !svixId || !svixTimestamp || !signatureHeader) return false

  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  if (secretBytes.length === 0) return false

  const signedContent = `${svixId}.${svixTimestamp}.${body}`
  const expected = Buffer.from(createHmac('sha256', secretBytes).update(signedContent).digest('base64'))

  // Header is a space-delimited list of `v1,<base64sig>`; any match passes.
  for (const part of signatureHeader.split(' ')) {
    const comma = part.indexOf(',')
    if (comma < 0) continue
    const version = part.slice(0, comma)
    const sig = part.slice(comma + 1)
    if (version !== 'v1' || !sig) continue
    const sigBuf = Buffer.from(sig)
    if (sigBuf.length === expected.length && timingSafeEqual(sigBuf, expected)) return true
  }
  return false
}

/** True when the svix timestamp is within `toleranceSec` of `nowMs` (replay guard). */
export function isFreshTimestamp(svixTimestamp: string, nowMs: number, toleranceSec = 300): boolean {
  const ts = Number(svixTimestamp)
  if (!Number.isFinite(ts)) return false
  return Math.abs(nowMs / 1000 - ts) <= toleranceSec
}

export type ResendEventType = 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained'

const EVENT_MAP: Record<string, ResendEventType> = {
  'email.delivered': 'delivered',
  'email.opened': 'opened',
  'email.clicked': 'clicked',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
}

export interface ClassifiedResendEvent {
  type: ResendEventType | null
  /** Lowercased recipient emails (from data.to). */
  recipients: string[]
  /** True only for a HARD bounce or a complaint — the cases that must suppress the email channel. */
  suppressEmail: boolean
  suppressReason: 'bounce' | 'complaint' | null
  clickUrl: string | null
  isoTs: string | null
}

type ResendPayload = {
  type?: string
  created_at?: string
  data?: {
    email_id?: string
    created_at?: string
    to?: string[] | string
    click?: { link?: string }
    bounce?: { type?: string; subType?: string }
  }
}

/**
 * Classify a parsed Resend payload. Suppression rule: a complaint ALWAYS
 * suppresses; a bounce suppresses unless it is explicitly Transient (soft bounce
 * = mailbox-full/greylisting, which should retry, not permanently suppress).
 */
export function classifyResendEvent(payload: ResendPayload): ClassifiedResendEvent {
  const type = EVENT_MAP[payload.type ?? ''] ?? null
  const rawTo = payload.data?.to
  const recipients = (Array.isArray(rawTo) ? rawTo : rawTo ? [rawTo] : [])
    .map((e) => String(e).trim().toLowerCase())
    .filter(Boolean)

  let suppressEmail = false
  let suppressReason: 'bounce' | 'complaint' | null = null
  if (type === 'complained') {
    suppressEmail = true
    suppressReason = 'complaint'
  } else if (type === 'bounced') {
    const bt = (payload.data?.bounce?.type ?? '').toLowerCase()
    const isSoft = bt === 'transient'
    if (!isSoft) {
      suppressEmail = true
      suppressReason = 'bounce'
    }
  }

  return {
    type,
    recipients,
    suppressEmail,
    suppressReason,
    clickUrl: type === 'clicked' ? payload.data?.click?.link ?? null : null,
    isoTs: payload.data?.created_at ?? payload.created_at ?? null,
  }
}
