/**
 * Signed person tokens: the one way a link WE send names its recipient.
 *
 * THE LOOP (docs/TRACKING_POLICY.md, "The known-contact identity loop"). Every
 * outbound link to ryan-realty.com that goes to a known contact carries
 * `?_pid=<token>`. When that browser lands, /api/visitors/track verifies the
 * token and stamps the whole browser session, and every anonymous session on
 * the same durable rr_vid, with the contact's crm_people.id. That is how a
 * contact who clicks an email, a text, a CMA or a personal link the broker
 * pasted into a Facebook DM shows up by name on /admin/visitors/live and on
 * their CRM record.
 *
 * WHY SIGNED (2026-09-23, P7). Until today the param carried the raw
 * crm_people.id (`?_pid=64115`). Ids are sequential, so anyone could type
 * `?_pid=<any number>` and be recorded as that contact: their browsing lands
 * on the contact's record, broker alerts fire about them, and the CMA document
 * gate (lib/cma/serve-document.ts) served a client's private valuation to any
 * visitor who guessed the owner's id, because CMA slugs are the street address.
 * A token is `<id>.<channel>.<hmac>`: forging one needs the server secret.
 *
 * Format: `64115.sms.Qk3p...` (22-char base64url HMAC-SHA256 prefix, 128 bits).
 * Never carries an email or a phone. Non-expiring, like the email click tokens
 * already in inboxes: a saved-search alert is clicked months after it is sent.
 *
 * Secret: the same chain lib/email-tracking.ts signs click tokens with, domain
 * separated by the `rr-identity:v1:` prefix so a click token can never be
 * replayed as an identity token or the reverse. Rotating EMAIL_TRACKING_SECRET
 * invalidates every token already sent; do not rotate it casually.
 */
import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'

/** The URL param that carries the token. Kept as `_pid` so strip-identity and
 *  every reader that already removes it from stored URLs keep working. */
export const IDENTITY_LINK_PARAM = '_pid'
/** Retired: the vendor CRM's legacy id. Never stamped any more; stripped on sight. */
export const LEGACY_IDENTITY_PARAM = '_fuid'

/**
 * Which sender minted the token. Lands in visitor_sessions.identified_via as
 * `tracked_link:<channel>` so the activity view can say how a person arrived.
 */
export const LINK_CHANNELS = [
  'email', // broker composer, governed email, one-off admin email
  'sequence', // CRM sequence engine (email + SMS steps)
  'newsletter',
  'alert', // saved-search / listing alerts
  'report', // market report emails
  'document', // CMA / BPO documents and the links inside them
  'sms', // composer / governed SMS, short-link redirect
  'prospecting',
  'personal', // a broker copied the contact's personal link (DM, Gmail, text from a phone)
  'cookie', // the rr_pid first-party cookie value
] as const
export type LinkChannel = (typeof LINK_CHANNELS)[number]

const CHANNEL_SET = new Set<string>(LINK_CHANNELS)

const TOKEN_RE = /^([1-9]\d{0,11})\.([a-z]{2,12})\.([A-Za-z0-9_-]{22})$/
const LEGACY_RAW_RE = /^[1-9]\d{0,11}$/

function resolveSecret(): string {
  const secret =
    process.env.EMAIL_TRACKING_SECRET ||
    process.env.CMA_PREVIEW_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'insecure-dev-secret'
  // Same posture as lib/email-tracking.ts assertTrackingSecret: a token signed
  // with the public dev fallback is forgeable, so production refuses it.
  if (secret === 'insecure-dev-secret' && process.env.NODE_ENV === 'production') {
    throw new Error('[identity] refusing to sign or verify person tokens with the insecure dev secret in production')
  }
  return secret
}

function mac(personId: number, channel: string): string {
  return createHmac('sha256', resolveSecret())
    .update(`rr-identity:v1:${personId}:${channel}`)
    .digest('base64url')
    .slice(0, 22)
}

function validPersonId(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n > 0 && n < 1e12
}

/** Mint the token for one contact. Throws on a bad id or channel (programmer error). */
export function signPersonLinkToken(personId: number, channel: LinkChannel): string {
  if (!validPersonId(personId)) throw new Error(`[identity] bad person id: ${String(personId)}`)
  if (!CHANNEL_SET.has(channel)) throw new Error(`[identity] unknown channel: ${String(channel)}`)
  return `${personId}.${channel}.${mac(personId, channel)}`
}

export type VerifiedPersonToken = { personId: number; channel: LinkChannel }

/**
 * Verify a token. Returns null for anything that is not a well-formed token
 * signed by this server, INCLUDING a bare legacy id (`64115`): an unsigned id
 * identifies nobody. Never throws on input.
 */
export function verifyPersonLinkToken(value: unknown): VerifiedPersonToken | null {
  if (typeof value !== 'string') return null
  const m = TOKEN_RE.exec(value.trim())
  if (!m) return null
  const personId = Number(m[1])
  const channel = m[2]
  if (!validPersonId(personId) || !CHANNEL_SET.has(channel)) return null
  let expected: string
  try {
    expected = mac(personId, channel)
  } catch {
    return null
  }
  const a = Buffer.from(m[3])
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  return { personId, channel: channel as LinkChannel }
}

/** Shape check only (no signature check): does this look like a minted token? */
export function looksLikePersonToken(value: unknown): boolean {
  return typeof value === 'string' && TOKEN_RE.test(value.trim())
}

/** A bare legacy id as the pre-2026-09-23 links carried it. Never trusted. */
export function isLegacyRawPersonId(value: unknown): boolean {
  return typeof value === 'string' && LEGACY_RAW_RE.test(value.trim())
}

/** identified_via label for a session a token identified. */
export function identifiedViaForChannel(channel: LinkChannel): `tracked_link:${LinkChannel}` {
  return `tracked_link:${channel}`
}
