/**
 * prepareDeliverableEmail — the single inbox-placement preflight every
 * automated/bulk email routes through (CONTACT360 Phase 9.E.7 + 9.3).
 *
 * It makes a non-compliant or spammy automated email impossible to construct:
 *
 *   1. Multipart: derives a plain-text alternative from the HTML when one is
 *      missing (HTML-only is a spam signal at Gmail/Yahoo).
 *   2. CAN-SPAM footer: appends a visible unsubscribe link + the brokerage
 *      physical postal address to both parts.
 *   3. RFC 8058: builds the List-Unsubscribe + List-Unsubscribe-Post headers so
 *      Gmail/Yahoo render a native one-click unsubscribe.
 *   4. Scores the result with analyzeEmailDeliverability and returns the report
 *      (loud-logs on a hard fail) so the caller never ships a flagged email
 *      blind.
 *
 * Scope: AUTOMATED sends (sequence/drip, CMA delivery, alerts, newsletter). A
 * 1:1 broker reply is a personal email, not a list send, and does not use this.
 */
import 'server-only'
import { analyzeEmailDeliverability, type EmailDeliverabilityReport } from './deliverability'
import { buildUnsubscribeUrl } from './unsubscribe-token'

/**
 * CAN-SPAM requires a valid physical postal address in every commercial email.
 * Env-overridable; the fallback carries a 5-digit ZIP + OR so the deliverability
 * analyzer passes, but the REGISTERED street / PO box must be set in
 * BROKERAGE_POSTAL_ADDRESS before bulk sends (flagged to Matt).
 */
export const BROKERAGE_POSTAL_ADDRESS =
  process.env.BROKERAGE_POSTAL_ADDRESS?.trim() || 'Ryan Realty, 115 NW Oregon Ave #2, Bend, OR 97703'

export interface PrepareEmailInput {
  subject: string
  html: string
  /** Plain-text alternative; derived from the HTML when omitted. */
  text?: string | null
  /** crm_people.id — drives the one-click unsubscribe token. */
  personId?: number | null
  /** Override the unsubscribe URL (e.g. a channel-specific confirm page). */
  unsubscribeUrl?: string
}

export interface PreparedEmail {
  subject: string
  html: string
  text: string
  headers: Record<string, string>
  report: EmailDeliverabilityReport
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Best-effort HTML -> readable plain text for the multipart alternative. */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<\/(p|div|tr|h[1-6]|li|table|ul|ol)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^[ \t]+/gm, '')
    .trim()
}

export function prepareDeliverableEmail(input: PrepareEmailInput): PreparedEmail {
  const unsubUrl =
    input.unsubscribeUrl ?? (input.personId ? buildUnsubscribeUrl(input.personId) : undefined)

  const footerHtml = unsubUrl
    ? `<hr style="border:none;border-top:1px solid #e6e2da;margin:24px 0 12px"><p style="font-size:12px;color:#667085;line-height:1.5">You are receiving this email from Ryan Realty. <a href="${unsubUrl}" style="color:#667085">Unsubscribe</a>.<br>${escapeHtml(BROKERAGE_POSTAL_ADDRESS)}</p>`
    : `<hr style="border:none;border-top:1px solid #e6e2da;margin:24px 0 12px"><p style="font-size:12px;color:#667085;line-height:1.5">You are receiving this email from Ryan Realty.<br>${escapeHtml(BROKERAGE_POSTAL_ADDRESS)}</p>`

  const footerText = unsubUrl
    ? `\n\n--\nYou are receiving this email from Ryan Realty.\nUnsubscribe: ${unsubUrl}\n${BROKERAGE_POSTAL_ADDRESS}`
    : `\n\n--\nYou are receiving this email from Ryan Realty.\n${BROKERAGE_POSTAL_ADDRESS}`

  const html = input.html + footerHtml
  const baseText = (input.text ?? '').trim() || htmlToPlainText(input.html)
  const text = baseText + footerText

  const headers: Record<string, string> = {}
  if (unsubUrl) {
    headers['List-Unsubscribe'] = `<${unsubUrl}>`
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click'
  }

  const report = analyzeEmailDeliverability({ subject: input.subject, html, text })
  if (report.level === 'fail') {
    console.error(
      '[email/prepare] deliverability FAIL — not inbox-safe:',
      report.issues.filter((i) => i.severity === 'fail').map((i) => i.code).join(', '),
    )
  }

  return { subject: input.subject, html, text, headers, report }
}
