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
  /**
   * The RFC 8058 target for the List-Unsubscribe header when it is not the
   * footer link: an endpoint that stops the list on a
   * `List-Unsubscribe=One-Click` POST. The market report points its header at
   * its report-scoped one-click endpoint while its footer link opens the
   * preferences page (Matt 2026-09-29). Defaults to the unsubscribe URL.
   */
  oneClickUnsubscribeUrl?: string
  /**
   * 'append' (default): append the CAN-SPAM footer to both parts, as every
   * caller always has. 'from-body': the body already carries it (the branded
   * shell footer and a text footer with the postal address and the
   * unsubscribe link), so do not print a second one. prepare still checks:
   * a part missing the address or the unsubscribe link gets the footer
   * appended anyway, so an email without either can never be built.
   */
  footer?: 'append' | 'from-body'
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

/**
 * The HTML already carries a CAN-SPAM footer: the postal address and, when
 * there is one, the unsubscribe link (as an href). Pure, exported for tests.
 */
export function htmlCarriesFooter(html: string, unsubUrl: string | undefined): boolean {
  if (!html.includes(escapeHtml(BROKERAGE_POSTAL_ADDRESS)) && !html.includes(BROKERAGE_POSTAL_ADDRESS)) return false
  return !unsubUrl || html.includes(`href="${unsubUrl}"`)
}

/** The plain text already carries the postal address and the unsubscribe URL. Pure. */
export function textCarriesFooter(text: string, unsubUrl: string | undefined): boolean {
  if (!text.includes(BROKERAGE_POSTAL_ADDRESS)) return false
  return !unsubUrl || text.includes(unsubUrl)
}

export function prepareDeliverableEmail(input: PrepareEmailInput): PreparedEmail {
  const unsubUrl =
    input.unsubscribeUrl ?? (input.personId ? buildUnsubscribeUrl(input.personId) : undefined)

  // No "You are receiving this email from Ryan Realty" narration — the reader
  // knows why they're reading it, and the From header already names the
  // sender. Matches the branded shell's own footer (lib/email/shell.ts):
  // name the thing (address, unsubscribe), never narrate the transaction.
  const footerHtml = unsubUrl
    ? `<hr style="border:none;border-top:1px solid #e6e2da;margin:24px 0 12px"><p style="font-size:12px;color:#667085;line-height:1.5">${escapeHtml(BROKERAGE_POSTAL_ADDRESS)} &middot; <a href="${unsubUrl}" style="color:#667085">Unsubscribe</a>.</p>`
    : `<hr style="border:none;border-top:1px solid #e6e2da;margin:24px 0 12px"><p style="font-size:12px;color:#667085;line-height:1.5">${escapeHtml(BROKERAGE_POSTAL_ADDRESS)}</p>`

  const footerText = unsubUrl
    ? `\n\n--\n${BROKERAGE_POSTAL_ADDRESS}\nUnsubscribe: ${unsubUrl}`
    : `\n\n--\n${BROKERAGE_POSTAL_ADDRESS}`

  const baseText = (input.text ?? '').trim() || htmlToPlainText(input.html)
  const fromBody = input.footer === 'from-body'
  const html = fromBody && htmlCarriesFooter(input.html, unsubUrl) ? input.html : input.html + footerHtml
  const text = fromBody && textCarriesFooter(baseText, unsubUrl) ? baseText : baseText + footerText

  const headers: Record<string, string> = {}
  const oneClick = (input.oneClickUnsubscribeUrl ?? '').trim() || unsubUrl
  if (oneClick) {
    headers['List-Unsubscribe'] = `<${oneClick}>`
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
