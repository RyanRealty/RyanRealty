/**
 * Newsletter facade over THE one branded email shell (lib/email/shell.ts).
 *
 * The frame markup (navy masthead → Old Mill hero → body → per-broker close →
 * CAN-SPAM footer) lives ONLY in wrapBrandedEmail so every client-facing email
 * reads as one system (Matt directive 2026-07-06). This module keeps the
 * newsletter-facing API stable for lib/newsletter/** — wrapNewsletterHtml,
 * newsletterTextFooter, SenderBroker — and pins the newsletter defaults
 * (issue line, subscriber audience line, the canonical hero).
 *
 * Gate G-NL-7 (scripts/check-newsletter-format.mjs) contract: the frame
 * invariants below are asserted against REAL rendered output in
 * newsletter-shell.test.ts, so a regression in the shared shell fails a test
 * before it ships a broken newsletter.
 */

import { BROKERAGE_POSTAL_ADDRESS } from '@/lib/email/prepare'
import { wrapBrandedEmail, type ShellBroker } from '@/lib/email/shell'

/** Per-recipient broker identity for the close block (§5/A6). All absolute HTTPS. */
export type SenderBroker = ShellBroker

/**
 * Frame invariants every rendered newsletter must contain (G-NL-7): dark-mode
 * meta, mobile-safe 640px sheet, 16px body floor, navy #102742 masthead with
 * the "Ryan Realty" wordmark, the canonical Old Mill hero, the per-broker
 * "TALK TO" close, and the CAN-SPAM Unsubscribe link. Verified against the
 * output of wrapNewsletterHtml in lib/email-templates/newsletter-shell.test.ts.
 */
export const NEWSLETTER_FRAME_INVARIANTS = [
  'name="color-scheme"',
  'max-width:640px',
  'font-size:16px',
  '#102742',
  '>Ryan Realty</td>',
  'hero-oldmill',
  'TALK TO',
  'Unsubscribe',
] as const

export function wrapNewsletterHtml(args: {
  bodyHtml: string
  previewText?: string | null
  unsubscribeUrl: string
  /** e.g. "THE BEND BRIEF · JUNE" — the masthead issue line. */
  issueLine?: string | null
  /** The recipient's broker for the close block. Omit for a generic brand close. */
  senderBroker?: SenderBroker | null
}): string {
  return wrapBrandedEmail({
    bodyHtml: args.bodyHtml,
    previewText: args.previewText,
    mastheadLine: args.issueLine ?? 'THE BEND BRIEF',
    // heroUrl omitted -> the shell's canonical Old Mill hero.
    senderBroker: args.senderBroker,
    unsubscribeUrl: args.unsubscribeUrl,
    audienceLine: "You're receiving this because you subscribed to Ryan Realty updates.",
  })
}

/** Plain-text fallback footer (links spelled out, CAN-SPAM postal line). */
export function newsletterTextFooter(unsubscribeUrl: string): string {
  return `\n\n--\n${BROKERAGE_POSTAL_ADDRESS} · ryan-realty.com\nUnsubscribe: ${unsubscribeUrl}`
}
