/**
 * One-click email-unsubscribe token (CONTACT360 Phase 9.3, RFC 8058).
 *
 * A signed, tamper-proof token that carries the crm_people id + the channel
 * ('email'). The unsubscribe endpoint verifies it and writes an email
 * suppression through the lib/crm/suppressions chokepoint — knowing the token
 * is the authorization (same model as lib/email-tracking.ts / the alerts
 * unsubscribe link). HMAC-SHA256 so the person id cannot be forged to opt
 * someone else out.
 */
import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'

const SECRET =
  process.env.EMAIL_TRACKING_SECRET ||
  process.env.CMA_PREVIEW_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'insecure-dev-secret'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export interface UnsubscribePayload {
  personId: number
  channel: 'email'
}

function mac(payload: string): string {
  return createHmac('sha256', SECRET).update(payload).digest('base64url')
}

export function signUnsubscribeToken(personId: number): string {
  const payload = Buffer.from(JSON.stringify({ p: personId, c: 'email' })).toString('base64url')
  return `${payload}.${mac(payload)}`
}

export function verifyUnsubscribeToken(token: string | null | undefined): UnsubscribePayload | null {
  const [payload, sig] = (token ?? '').split('.')
  if (!payload || !sig) return null
  const expected = mac(payload)
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  } catch {
    return null
  }
  try {
    const o = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { p?: unknown; c?: unknown }
    const personId = Number(o.p)
    if (!Number.isFinite(personId) || personId <= 0) return null
    if (o.c !== 'email') return null
    return { personId, channel: 'email' }
  } catch {
    return null
  }
}

/** The absolute one-click unsubscribe URL embedded in the List-Unsubscribe header + footer. */
export function buildUnsubscribeUrl(personId: number): string {
  return `${SITE_URL}/api/email/unsubscribe?t=${encodeURIComponent(signUnsubscribeToken(personId))}`
}
