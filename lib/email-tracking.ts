/**
 * Email open + click tracking — universal, channel-agnostic.
 *
 * We instrument the email HTML we generate (CMA delivery, sequence/drip, alerts)
 * with a 1x1 open pixel and link-wrapped click redirects. Because the tracking
 * lives in the email body, it works no matter how the email is sent — a manual
 * Gmail send by the broker, our Resend transactional path, or a FUB action plan.
 *
 * Each open/click hits a tracking endpoint that writes a row to `crm_timeline`
 * (kind `email_open` / `email_click`), so the communications chain shows how many
 * times an email was opened and which links were clicked.
 *
 * Tokens are HMAC-SHA256 signed (same pattern as lib/cma-delivery-tokens.ts) so
 * the person id, the email key, and the click target cannot be forged or
 * tampered (the click URL is INSIDE the token, never a separate query param —
 * that closes the open-redirect hole).
 */
import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'

const SECRET =
  process.env.EMAIL_TRACKING_SECRET ||
  process.env.CMA_PREVIEW_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'insecure-dev-secret'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export interface EmailTrackContext {
  /** crm_people.id of the recipient. */
  personId: number
  /** Stable key for this email, e.g. `cma:cma-62285-deer` or `seq:69:2`. */
  emailKey: string
  /** Human label for the comms chain, usually the subject line. */
  label?: string
  /** Click target — only set on click tokens (signed in so it can't be tampered). */
  url?: string
}

function mac(payload: string): string {
  return createHmac('sha256', SECRET).update(payload).digest('base64url')
}

export function signEmailToken(ctx: EmailTrackContext): string {
  const payload = Buffer.from(
    JSON.stringify({ p: ctx.personId, k: ctx.emailKey, l: ctx.label ?? '', u: ctx.url ?? '' }),
  ).toString('base64url')
  return `${payload}.${mac(payload)}`
}

export function verifyEmailToken(token: string | null | undefined): EmailTrackContext | null {
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
    const o = JSON.parse(Buffer.from(payload, 'base64url').toString())
    const personId = Number(o.p)
    if (!Number.isFinite(personId)) return null
    return {
      personId,
      emailKey: String(o.k ?? ''),
      label: o.l ? String(o.l) : undefined,
      url: o.u ? String(o.u) : undefined,
    }
  } catch {
    return null
  }
}

/**
 * Compliance carve-out: unsubscribe / preference links are NEVER click-wrapped
 * (CRM_BUILD_MISSION "Email open + click tracking" §5 — no tracking on
 * unsubscribe/compliance links). Wrapping them would log an engagement "click"
 * for an opt-OUT and put a tracking hop in front of a CAN-SPAM mechanism.
 * Covers every unsubscribe rail in the codebase: /newsletter/unsubscribe,
 * /alerts/unsubscribe, /api/alerts/unsubscribe, /api/email/unsubscribe, and
 * generic ?unsubscribe= / list-unsubscribe shapes, plus the Oregon agency
 * disclosure pamphlet (a legally-required disclosure never gets a tracking hop
 * in front of it). Exported for the unit test.
 */
export function isComplianceLink(url: string): boolean {
  return /unsubscribe|email-preferences|opt[-_]?out|agency-disclosure/i.test(url)
}

/**
 * Instrument an HTML email body: wrap every http(s) link through the click
 * tracker and append the open pixel. Idempotent-ish (skips already-wrapped
 * links). Unsubscribe/compliance links stay plain. Returns the instrumented
 * HTML.
 */
export function instrumentEmailHtml(html: string, ctx: EmailTrackContext): string {
  const base = `${SITE_URL}/api/track/e`
  const pixelToken = signEmailToken({ personId: ctx.personId, emailKey: ctx.emailKey, label: ctx.label })

  const out = html.replace(/href="(https?:\/\/[^"]+)"/gi, (m, url: string) => {
    if (url.includes('/api/track/e/')) return m // already wrapped
    if (isComplianceLink(url)) return m // unsubscribe/compliance links stay plain
    const tok = signEmailToken({ personId: ctx.personId, emailKey: ctx.emailKey, label: ctx.label, url })
    return `href="${base}/click?t=${encodeURIComponent(tok)}"`
  })

  const pixel = `<img src="${base}/open?t=${encodeURIComponent(pixelToken)}" width="1" height="1" alt="" style="display:none;max-height:0;max-width:0;overflow:hidden;" />`
  return /<\/body>/i.test(out) ? out.replace(/<\/body>/i, `${pixel}</body>`) : out + pixel
}
