/**
 * Signed links for the market-report email (Matt's decisions 2026-09-29):
 * "View this report online", "Manage your report", the report-scoped
 * Unsubscribe, and the RFC 8058 one-click endpoint the List-Unsubscribe header
 * points at. None of them needs a login: the signature IS the authorization,
 * the same model as the one-click unsubscribe token (lib/email/unsubscribe-token)
 * and the email click tracker (lib/email-tracking).
 *
 * Token: `<base64url(json)>.<base64url(hmac)>`. The MAC runs over a
 * domain-separated string (`rr-report-link:v1:<payload>`), so a report link
 * token can never be replayed as an unsubscribe token, a click token or a
 * person token, even though all four share the secret.
 *
 * Payload fields:
 *   p   crm_people.id the link belongs to
 *   s   crm_report_subscriptions.id (0 for a one-off report with no subscription)
 *   u   purpose: 'manage' (the preferences page), 'stop' (the one-click POST),
 *       'view' (one stored report)
 *   k   the send's email_key (which report the link came from; required for
 *       'view', and names the report an unsubscribe is recorded against)
 *   pv  1 on a broker preview: every action it reaches is a no-op, so a
 *       broker clicking Unsubscribe in their own preview can never stop the
 *       contact's reports
 *
 * Non-expiring, like the unsubscribe and click tokens already in inboxes: a
 * reader opens a months-old report and its links must still work (CAN-SPAM
 * requires the opt-out to keep working for at least 30 days after the send).
 * Rotating EMAIL_TRACKING_SECRET invalidates every link already sent.
 *
 * No URL built here carries an email address, a phone or a name.
 */
import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { emailSigningSecret } from '@/lib/email/signing-secret'

/**
 * Every report link goes to the canonical apex, whatever host this process
 * runs on (a preview deployment's NEXT_PUBLIC_SITE_URL is the Vercel alias).
 * A report is only ever mailed from production, where the tokens verify; a
 * mixed-domain link set also costs inbox trust (lib/email/deliverability.ts
 * "external-links"). Same rule as CMA_EMAIL_ORIGIN and BROKER_ALERT_ORIGIN.
 */
export const REPORT_LINK_ORIGIN = 'https://ryan-realty.com'
const SITE_URL = REPORT_LINK_ORIGIN

/** The no-login preferences page (lib/analytics/private-paths.ts lists it). */
export const REPORT_PREFERENCES_PATH = '/email-preferences'
/** The stored-report web view. */
export const REPORT_VIEW_PATH = '/email-preferences/report'
/** The RFC 8058 one-click endpoint the List-Unsubscribe header targets. */
export const REPORT_ONE_CLICK_PATH = '/api/email/report-unsubscribe'

export type ReportLinkPurpose = 'manage' | 'stop' | 'view'

const PURPOSES: ReadonlySet<string> = new Set<ReportLinkPurpose>(['manage', 'stop', 'view'])

export type ReportLinkPayload = {
  personId: number
  /** 0 when the report went out without a subscription (a one-off send). */
  subscriptionId: number
  purpose: ReportLinkPurpose
  /** The send's email_key. Required for 'view'. */
  emailKey: string | null
  /** A broker preview: nothing it reaches may change the contact's state. */
  preview: boolean
}

const DOMAIN = 'rr-report-link:v1:'

function mac(payload: string): string {
  return createHmac('sha256', emailSigningSecret('report-link-token'))
    .update(DOMAIN + payload)
    .digest('base64url')
}

function positiveInt(n: unknown): number | null {
  const v = typeof n === 'number' ? n : Number(n)
  return Number.isInteger(v) && v > 0 ? v : null
}

/** Sign a report link token. Throws on a payload that could never verify. */
export function signReportLinkToken(input: {
  personId: number
  subscriptionId?: number | null
  purpose: ReportLinkPurpose
  emailKey?: string | null
  preview?: boolean
}): string {
  const p = positiveInt(input.personId)
  if (p == null) throw new Error('signReportLinkToken: personId must be a positive integer')
  if (!PURPOSES.has(input.purpose)) throw new Error(`signReportLinkToken: unknown purpose ${String(input.purpose)}`)
  const k = (input.emailKey ?? '').trim()
  if (input.purpose === 'view' && !k) throw new Error('signReportLinkToken: a view link needs the send email_key')
  const body: Record<string, unknown> = {
    v: 1,
    p,
    s: positiveInt(input.subscriptionId) ?? 0,
    u: input.purpose,
  }
  if (k) body.k = k
  if (input.preview) body.pv = 1
  const payload = Buffer.from(JSON.stringify(body)).toString('base64url')
  return `${payload}.${mac(payload)}`
}

/**
 * Verify a token. Null when malformed, tampered, or naming nothing. Throws
 * MissingSigningSecretError in production when no real secret is configured
 * (lib/email/signing-secret.ts): a verify against the public development string
 * would accept forged tokens, so the caller's page fails closed instead.
 */
export function verifyReportLinkToken(token: string | null | undefined): ReportLinkPayload | null {
  const raw = (token ?? '').trim()
  const parts = raw.split('.')
  if (parts.length !== 2) return null
  const [payload, sig] = parts
  if (!payload || !sig) return null
  const expected = mac(payload)
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  } catch {
    return null
  }
  let o: Record<string, unknown>
  try {
    o = JSON.parse(Buffer.from(payload, 'base64url').toString()) as Record<string, unknown>
  } catch {
    return null
  }
  if (o.v !== 1) return null
  const personId = positiveInt(o.p)
  if (personId == null) return null
  const purpose = typeof o.u === 'string' && PURPOSES.has(o.u) ? (o.u as ReportLinkPurpose) : null
  if (!purpose) return null
  const subscriptionId = positiveInt(o.s) ?? 0
  const emailKey = typeof o.k === 'string' && o.k.trim() ? o.k.trim() : null
  if (purpose === 'view' && !emailKey) return null
  return { personId, subscriptionId, purpose, emailKey, preview: o.pv === 1 }
}

export type ReportLinkContext = {
  personId: number
  subscriptionId?: number | null
  emailKey?: string | null
  preview?: boolean
}

function withToken(path: string, token: string, extra?: string): string {
  return `${SITE_URL}${path}?t=${encodeURIComponent(token)}${extra ?? ''}`
}

/** "Manage your report": the no-login preferences page. */
export function reportManageUrl(ctx: ReportLinkContext): string {
  return withToken(REPORT_PREFERENCES_PATH, signReportLinkToken({ ...ctx, purpose: 'manage' }))
}

/**
 * The footer Unsubscribe: the same page, opened on the "Stop these reports"
 * question. A GET never stops anything (a mail scanner prefetches links), so
 * the stop is the button on that page.
 */
export function reportUnsubscribeUrl(ctx: ReportLinkContext): string {
  return withToken(REPORT_PREFERENCES_PATH, signReportLinkToken({ ...ctx, purpose: 'manage' }), '&stop=1')
}

/** "View this report online": the stored report, as sent. */
export function reportViewUrl(ctx: ReportLinkContext & { emailKey: string }): string {
  return withToken(REPORT_VIEW_PATH, signReportLinkToken({ ...ctx, purpose: 'view' }))
}

/** The RFC 8058 List-Unsubscribe target (POST List-Unsubscribe=One-Click). */
export function reportOneClickUrl(ctx: ReportLinkContext): string {
  return withToken(REPORT_ONE_CLICK_PATH, signReportLinkToken({ ...ctx, purpose: 'stop' }))
}

/** Every link one report carries, from one context. */
export function reportEmailLinks(ctx: ReportLinkContext & { emailKey: string }): {
  viewUrl: string
  manageUrl: string
  unsubscribeUrl: string
  oneClickUrl: string
} {
  return {
    viewUrl: reportViewUrl(ctx),
    manageUrl: reportManageUrl(ctx),
    unsubscribeUrl: reportUnsubscribeUrl(ctx),
    oneClickUrl: reportOneClickUrl(ctx),
  }
}
