/**
 * "Email me the link" on the CMA door (Matt 2026-10-07).
 *
 * The door's only way in used to be Google. An owner who reads mail at MSN,
 * Outlook or iCloud, or who opened the bare link on a second device, had no
 * way through. This is the second way: type the email, and when it is one we
 * already have for this home the report's private link goes to that inbox,
 * from the broker's own mailbox, through the governed send (hard-stop and
 * suppression still refuse). The click lands with the signed `_pid` token,
 * which is the same recipient pass the original CMA email gives.
 *
 * It is a same-minute system answer to the visitor's own request (CLAUDE.md
 * §1, Matt 2026-09-07), not a broker send. The page says the same thing
 * whether or not the email matched, so the form never tells a stranger which
 * address owns a home.
 */

import { CMA_DOC_ORIGIN } from '@/lib/cma/doc-links'

/** At most one link email per address per home per window, however often the form is sent. */
export const CMA_LINK_WINDOW_MS = 8 * 60 * 60 * 1000

const EMAIL_RE = /^[^\s@<>"]{1,64}@[^\s@<>"]{1,190}\.[a-z]{2,}$/i

export function normalizeLinkEmail(raw: unknown): string | null {
  const e = String(raw ?? '').trim().toLowerCase()
  if (!e || e.length > 254 || !EMAIL_RE.test(e)) return null
  return e
}

/** True when `email` is one we already hold for this document (client, person, or the phone-only claim). */
export function isKnownCmaEmail(
  email: string,
  identity: { clientEmail: string | null; personEmails: string[]; claimedBy: string | null },
): boolean {
  const want = email.trim().toLowerCase()
  if (!want) return false
  return [identity.clientEmail, ...identity.personEmails, identity.claimedBy].some(
    (e) => (e ?? '').trim().toLowerCase() === want,
  )
}

/**
 * Idempotency key for the governed send: one link email per address per home
 * per window. Keyed on the address so asking for a second email on file (the
 * owner's own after a spouse's) is not swallowed by the first.
 */
export function cmaLinkIdempotencyKey(slug: string, email: string, nowMs: number): string {
  return `cma-link:${slug}:${email.trim().toLowerCase()}:${Math.floor(nowMs / CMA_LINK_WINDOW_MS)}`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * The link email. The report link is a short linked phrase on the production
 * origin; the send path signs `_pid` onto it and wraps it for click tracking.
 */
export function composeCmaLinkEmail(params: { slug: string; address: string | null }): {
  subject: string
  html: string
  reportUrl: string
} {
  const street = (params.address ?? '').split(',')[0]?.trim() || null
  const reportUrl = `${CMA_DOC_ORIGIN}/cma/${encodeURIComponent(params.slug)}?utm_source=cma&utm_medium=email&utm_campaign=${encodeURIComponent(params.slug)}&utm_content=private-link`
  const home = street ? escapeHtml(street) : 'your home'
  const subject = street ? `Your private link to the ${street} report` : 'Your private link to your report'
  const html = [
    `<p style="margin:0 0 16px 0;">Here is your private link to the report on ${home}.</p>`,
    `<p style="margin:0 0 16px 0;"><a href="${reportUrl}" style="color:#102742;font-weight:600;">Open your report</a></p>`,
    `<p style="margin:0 0 16px 0;">It opens on any phone or computer without signing in. Anyone who has this email can open it too, so please keep it to yourself.</p>`,
    `<p style="margin:0 0 16px 0;">Questions about any of the numbers? Reply here and I will walk you through them.</p>`,
  ].join('')
  return { subject, html, reportUrl }
}
