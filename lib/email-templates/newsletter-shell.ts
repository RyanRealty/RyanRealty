/**
 * Branded HTML shell for newsletter sends. Lives in lib/email-templates/ (which
 * the design-token gate excludes) because email clients require inline hex, not
 * CSS variables. Wraps the admin-authored body_html in the Ryan Realty register
 * (navy #102742 header on cream #faf8f4) with a CAN-SPAM footer + a one-click
 * unsubscribe link. Keep this the ONLY place newsletter email markup lives.
 */

const NAVY = '#102742'
const CREAM = '#faf8f4'
const CHARCOAL = '#1a1a1a'
const MUTED = '#6b7280'
const FONT = "-apple-system, system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

export function wrapNewsletterHtml(args: {
  bodyHtml: string
  previewText?: string | null
  unsubscribeUrl: string
}): string {
  const preheader = (args.previewText ?? '').trim()
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:${CREAM};font-family:${FONT};">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};padding:24px 0;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e8e2d4;">
      <tr><td style="background:${NAVY};padding:20px 32px;">
        <span style="color:${CREAM};font-size:18px;font-weight:700;letter-spacing:0.04em;">RYAN REALTY</span>
      </td></tr>
      <tr><td style="padding:28px 32px;color:${CHARCOAL};font-size:16px;line-height:1.6;">
        ${args.bodyHtml}
      </td></tr>
      <tr><td style="padding:20px 32px 28px;border-top:1px solid #eee;color:${MUTED};font-size:12px;line-height:1.6;">
        Ryan Realty &middot; Bend, Oregon &middot; <a href="https://ryan-realty.com" style="color:${MUTED};">ryan-realty.com</a><br>
        You're receiving this because you subscribed to Ryan Realty updates.
        <a href="${args.unsubscribeUrl}" style="color:${MUTED};text-decoration:underline;">Unsubscribe</a>.
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
}

/** Plain-text fallback footer (links spelled out, CAN-SPAM postal line). */
export function newsletterTextFooter(unsubscribeUrl: string): string {
  return `\n\n—\nRyan Realty · Bend, Oregon · ryan-realty.com\nUnsubscribe: ${unsubscribeUrl}`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
