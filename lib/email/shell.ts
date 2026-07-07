/**
 * THE one branded HTML email shell (brutalist navy/cream editorial frame).
 *
 * Every client-facing email — newsletter, listing alert, market report, CMA
 * delivery, welcome — wraps its body with `wrapBrandedEmail` so all outbound
 * mail reads as one system (Matt directive 2026-07-06). The frame is the
 * approved newsletter shell generalized: navy masthead (serif wordmark +
 * uppercase issue line) → optional full-bleed hero → body → optional broker
 * close card → footer (postal address + audience line + unsubscribe).
 *
 * Lives in lib/email/ (design-token gate excludes email markup — clients need
 * inline hex, not CSS vars). Georgia stands in for Amboqia (email-safe serif).
 * Constraints: single column, 640px max, color-scheme light, ≥16px body.
 */

import { BROKERAGE_POSTAL_ADDRESS } from '@/lib/email/prepare'
import {
  EMAIL_NAVY,
  EMAIL_CREAM,
  EMAIL_INK,
  EMAIL_MUTED,
  EMAIL_CANVAS,
  EMAIL_SERIF,
  EMAIL_FONT_STACK,
} from '@/lib/email/brand'

const INK = EMAIL_INK
const MUTED = EMAIL_MUTED
const CANVAS = EMAIL_CANVAS
const SERIF = EMAIL_SERIF
const SANS = EMAIL_FONT_STACK

/** Canonical brand hero (Old Mill District) — verified reachable, absolute HTTPS. */
export const BRAND_HERO_URL = 'https://ryan-realty.com/images/lp/hero-oldmill.jpg'

/** Per-recipient broker identity for the close card. All URLs absolute HTTPS. */
export type ShellBroker = {
  name: string
  firstName: string
  title: string | null
  phone: string | null
  email: string | null
  headshotUrl: string
  isOwner: boolean
}

export type EmailShellArgs = {
  /** Inner content. Sections should pad themselves (the shell adds no body padding). */
  bodyHtml: string
  /** Inbox preview snippet (hidden preheader). */
  previewText?: string | null
  /** Uppercase masthead issue line, e.g. "MARKET REPORT · JULY". Defaults to the brand line. */
  mastheadLine?: string | null
  /** Full-bleed hero image URL. Pass null to omit, undefined for the brand default. */
  heroUrl?: string | null
  heroAlt?: string
  /** Broker close card (identity swap). Omit for a frameless/transactional close. */
  senderBroker?: ShellBroker | null
  /** Unsubscribe/manage-preferences URL. Omit ONLY for transactional mail (e.g. CMA delivery). */
  unsubscribeUrl?: string | null
  /** Optional "Manage preferences" URL rendered next to Unsubscribe. */
  manageUrl?: string | null
  /** Footer sentence explaining why the recipient got this email. */
  audienceLine?: string | null
}

export function wrapBrandedEmail(args: EmailShellArgs): string {
  const preheader = (args.previewText ?? '').trim()
  const masthead = (args.mastheadLine ?? 'BEND · OREGON').toUpperCase()
  const heroUrl = args.heroUrl === undefined ? BRAND_HERO_URL : args.heroUrl
  const audience =
    (args.audienceLine ?? '').trim() ||
    "You're receiving this because you asked for updates from Ryan Realty."
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:${CANVAS};font-family:${SANS};">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CANVAS};"><tr><td align="center">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:${EMAIL_CREAM};">

  <!-- MASTHEAD -->
  <tr><td style="background:${EMAIL_NAVY};padding:16px 32px;">
    <table width="100%"><tr>
      <td style="font-family:${SERIF};color:${EMAIL_CREAM};font-size:22px;font-weight:700;">Ryan Realty</td>
      <td align="right" style="color:#aab6c6;font-size:11px;letter-spacing:.18em;">${escapeHtml(masthead)}</td>
    </tr></table>
  </td></tr>

  ${heroUrl ? `<!-- HERO -->
  <tr><td style="padding:0;"><img src="${heroUrl}" alt="${escapeHtml(args.heroAlt ?? 'Old Mill District, Bend Oregon')}" width="640" style="display:block;width:100%;height:240px;object-fit:cover;"></td></tr>` : ''}

  <!-- BODY -->
  <tr><td style="padding:0;color:${INK};font-size:16px;line-height:1.6;">
    ${args.bodyHtml}
  </td></tr>

  ${args.senderBroker ? brokerClose(args.senderBroker) : ''}

  <!-- FOOTER -->
  <tr><td style="padding:26px 34px 32px;">
    <div style="color:${MUTED};font-size:12px;line-height:1.6;text-align:center;">
      ${escapeHtml(BROKERAGE_POSTAL_ADDRESS)} &middot; <a href="https://ryan-realty.com" style="color:${MUTED};">ryan-realty.com</a><br>
      ${escapeHtml(audience)}${args.manageUrl ? `
      <a href="${args.manageUrl}" style="color:${MUTED};text-decoration:underline;">Manage preferences</a>${args.unsubscribeUrl ? ' &middot;' : '.'}` : ''}${args.unsubscribeUrl ? `
      <a href="${args.unsubscribeUrl}" style="color:${MUTED};text-decoration:underline;">Unsubscribe</a>.` : ''}
    </div>
  </td></tr>

</table>
</td></tr></table>
</body></html>`
}

/**
 * The per-broker close card: navy panel with the broker's headshot, a
 * first-person note, their phone, and a "Talk to {first}" CTA. First-person
 * copy templated per broker so Rebecca/Paul never ship under Matt's words.
 */
function brokerClose(b: ShellBroker): string {
  const whoami = b.isOwner ? ', and I run Ryan Realty' : ''
  const phoneLine = b.phone
    ? ` call me at <a href="tel:${b.phone.replace(/[^\d+]/g, '')}" style="color:${EMAIL_CREAM};text-decoration:underline;">${escapeHtml(b.phone)}</a>`
    : ' get in touch'
  // Natural 2:3 portrait (800x1200 normalized), NOT a forced circle — object-fit
  // is unreliable across email clients and a cover-crop chops the face.
  return `<tr><td style="padding:40px 34px 0;">
    <table width="100%" style="background:${EMAIL_NAVY};"><tr><td style="padding:28px;">
      <table width="100%"><tr>
        <td width="116" valign="top"><img src="${b.headshotUrl}" alt="${escapeHtml(b.name)}" width="100" height="150" style="width:100px;height:150px;border-radius:12px;display:block;background:#1c3350;"></td>
        <td width="16"></td>
        <td valign="top" style="color:#dbe2ec;font-size:16px;line-height:1.6;">
          <div style="font-family:${SERIF};color:${EMAIL_CREAM};font-size:22px;line-height:1.2;margin-bottom:10px;">Buying, selling, or just weighing it up.</div>
          I'm ${escapeHtml(b.name)}${whoami}. For a straight read on what your home is worth, or what your budget actually buys in this market,${phoneLine}.
        </td>
      </tr></table>
      <div style="text-align:center;margin-top:22px;">
        <a href="https://ryan-realty.com/contact" style="display:inline-block;background:${EMAIL_CREAM};color:${EMAIL_NAVY};font-size:13px;font-weight:700;letter-spacing:.08em;text-decoration:none;padding:14px 32px;">TALK TO ${escapeHtml(b.firstName.toUpperCase())} &rarr;</a>
      </div>
    </td></tr></table>
  </td></tr>`
}

/** Plain-text fallback footer (links spelled out, CAN-SPAM postal line). */
export function brandedTextFooter(unsubscribeUrl?: string | null): string {
  const unsub = unsubscribeUrl ? `\nUnsubscribe: ${unsubscribeUrl}` : ''
  return `\n\n--\n${BROKERAGE_POSTAL_ADDRESS} · ryan-realty.com${unsub}`
}

export function escapeHtml(s: string): string {
  // Escape quotes too: escaped values land in attribute contexts (alt="${...}").
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
