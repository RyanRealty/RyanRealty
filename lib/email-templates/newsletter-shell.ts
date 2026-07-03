/**
 * Branded HTML shell for newsletter sends. Lives in lib/email-templates/ (which
 * the design-token gate excludes) because email clients require inline hex, not
 * CSS variables. Renders the approved editorial frame from
 * design_system/ryan-realty/ui_kits/newsletter/email.html — a 640px cream/navy
 * layout: navy masthead (wordmark + issue line) → full-bleed Old Mill hero →
 * admin/producer-authored section body → per-broker close (the identity swap,
 * §5/A6) → CAN-SPAM footer with the postal address + one-click unsubscribe.
 *
 * Keep this the ONLY place newsletter email markup lives. Georgia stands in for
 * Amboqia (email-safe); production may bake headline images later. Enforced by
 * gate G-NL-7 (single column, ≤640px, color-scheme meta, ≥16px body, footer).
 */

import { BROKERAGE_POSTAL_ADDRESS } from '@/lib/email/prepare'

const NAVY = '#102742'
const CREAM = '#faf8f4'
const INK = '#26303c'
const MUTED = '#9aa0a8'
const SERIF = "Georgia, 'Times New Roman', serif"
const SANS = "-apple-system, system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
/** Canonical brand hero (Old Mill District) — verified reachable, absolute HTTPS. */
const HERO_URL = 'https://ryan-realty.com/images/lp/hero-oldmill.jpg'

/** Per-recipient broker identity for the close block (§5/A6). All absolute HTTPS. */
export type SenderBroker = {
  name: string
  firstName: string
  title: string | null
  phone: string | null
  email: string | null
  headshotUrl: string
  isOwner: boolean
}

export function wrapNewsletterHtml(args: {
  bodyHtml: string
  previewText?: string | null
  unsubscribeUrl: string
  /** e.g. "THE BEND BRIEF · JUNE" — the masthead issue line. */
  issueLine?: string | null
  /** The recipient's broker for the close block. Omit for a generic brand close. */
  senderBroker?: SenderBroker | null
}): string {
  const preheader = (args.previewText ?? '').trim()
  const issue = (args.issueLine ?? 'THE BEND BRIEF').toUpperCase()
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#e4e0d8;font-family:${SANS};">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e4e0d8;"><tr><td align="center">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:${CREAM};">

  <!-- MASTHEAD -->
  <tr><td style="background:${NAVY};padding:16px 32px;">
    <table width="100%"><tr>
      <td style="font-family:${SERIF};color:${CREAM};font-size:22px;font-weight:700;">Ryan Realty</td>
      <td align="right" style="color:#aab6c6;font-size:11px;letter-spacing:.18em;">${escapeHtml(issue)}</td>
    </tr></table>
  </td></tr>

  <!-- HERO -->
  <tr><td style="padding:0;"><img src="${HERO_URL}" alt="Old Mill District, Bend Oregon" width="640" style="display:block;width:100%;height:240px;object-fit:cover;"></td></tr>

  <!-- SECTION BODY (admin/producer authored) -->
  <tr><td style="padding:0;color:${INK};font-size:16px;line-height:1.6;">
    ${args.bodyHtml}
  </td></tr>

  ${args.senderBroker ? brokerClose(args.senderBroker) : ''}

  <!-- FOOTER -->
  <tr><td style="padding:26px 34px 32px;">
    <div style="color:${MUTED};font-size:12px;line-height:1.6;text-align:center;">
      ${escapeHtml(BROKERAGE_POSTAL_ADDRESS)} &middot; <a href="https://ryan-realty.com" style="color:${MUTED};">ryan-realty.com</a><br>
      You're receiving this because you subscribed to Ryan Realty updates.
      <a href="${args.unsubscribeUrl}" style="color:${MUTED};text-decoration:underline;">Unsubscribe</a>.
    </div>
  </td></tr>

</table>
</td></tr></table>
</body></html>`
}

/**
 * The per-broker close (§5/A6): a navy card with the broker's headshot, a
 * first-person note, their phone, and a "Talk to {first}" CTA. First-person copy
 * templated per broker so Rebecca/Paul never ship under Matt's words. Brand-voice
 * clean (no banned words, no em-dash).
 */
function brokerClose(b: SenderBroker): string {
  // Who they are, in one plain clause. No "I answer my own phone" / "I'll tell you
  // what I'd tell my own family" — that's tell-don't-show and category-naming (VOICE.md).
  const whoami = b.isOwner ? ', and I run Ryan Realty' : ''
  const phoneLine = b.phone
    ? ` call me at <a href="tel:${b.phone.replace(/[^\d+]/g, '')}" style="color:${CREAM};text-decoration:underline;">${escapeHtml(b.phone)}</a>`
    : ' get in touch'
  // Natural 2:3 portrait (800x1200 normalized), NOT a forced circle — object-fit is
  // unreliable across email clients and a cover-crop chops the face. A fixed-width
  // image with height:auto shows the full head-and-shoulders, no crop, no distortion.
  return `<tr><td style="padding:40px 34px 0;">
    <table width="100%" style="background:${NAVY};"><tr><td style="padding:28px;">
      <table width="100%"><tr>
        <td width="116" valign="top"><img src="${b.headshotUrl}" alt="${escapeHtml(b.name)}" width="100" height="150" style="width:100px;height:150px;border-radius:12px;display:block;background:#1c3350;"></td>
        <td width="16"></td>
        <td valign="top" style="color:#dbe2ec;font-size:16px;line-height:1.6;">
          <div style="font-family:${SERIF};color:${CREAM};font-size:22px;line-height:1.2;margin-bottom:10px;">Buying, selling, or just weighing it up.</div>
          I'm ${escapeHtml(b.name)}${whoami}. For a straight read on what your home is worth, or what your budget actually buys in this market,${phoneLine}.
        </td>
      </tr></table>
      <div style="text-align:center;margin-top:22px;">
        <a href="https://ryan-realty.com/contact" style="display:inline-block;background:${CREAM};color:${NAVY};font-size:13px;font-weight:700;letter-spacing:.08em;text-decoration:none;padding:14px 32px;">TALK TO ${escapeHtml(b.firstName.toUpperCase())} &rarr;</a>
      </div>
    </td></tr></table>
  </td></tr>`
}

/** Plain-text fallback footer (links spelled out, CAN-SPAM postal line). */
export function newsletterTextFooter(unsubscribeUrl: string): string {
  return `\n\n--\n${BROKERAGE_POSTAL_ADDRESS} · ryan-realty.com\nUnsubscribe: ${unsubscribeUrl}`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
