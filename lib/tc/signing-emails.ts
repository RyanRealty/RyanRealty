/**
 * TC signing emails — server-only. Brand-voice compliant (no em-dash, no
 * semicolons, no banned words, sentence case, you/your, one CTA). Navy on
 * cream, single prominent button, reply-to the sending broker.
 */
import { sendEmail } from '@/lib/resend'
import { EMAIL_FONT_STACK, EMAIL_NAVY, EMAIL_CREAM } from '@/lib/email/brand'

const NAVY = EMAIL_NAVY
const CREAM = EMAIL_CREAM

function shell(opts: { heading: string; bodyHtml: string; cta?: { label: string; url: string } }): string {
  const button = opts.cta
    ? `<tr><td style="padding:28px 0 8px;">
         <a href="${opts.cta.url}" style="display:inline-block;background:${NAVY};color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;padding:14px 28px;border-radius:10px;">${opts.cta.label}</a>
       </td></tr>`
    : ''
  return `<!doctype html><html><body style="margin:0;padding:0;background:${CREAM};font-family:${EMAIL_FONT_STACK};color:${NAVY};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid rgba(16,39,66,0.08);padding:32px;">
          <tr><td style="font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(16,39,66,0.6);font-weight:600;">Ryan Realty</td></tr>
          <tr><td style="font-size:22px;font-weight:700;padding-top:8px;line-height:1.25;">${opts.heading}</td></tr>
          <tr><td style="font-size:15px;line-height:1.6;color:rgba(16,39,66,0.85);padding-top:14px;">${opts.bodyHtml}</td></tr>
          ${button}
          <tr><td style="padding-top:28px;border-top:1px solid rgba(16,39,66,0.08);margin-top:24px;font-size:12px;color:rgba(16,39,66,0.55);line-height:1.6;">
            Ryan Realty · Bend · Oregon<br/>
            541.213.6706 · ryan-realty.com
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`
}

export async function sendSigningInvite(params: {
  to: string
  recipientName: string
  envelopeName: string
  propertyAddress: string
  signUrl: string
  replyTo?: string
  reminder?: boolean
}): Promise<{ id?: string; error?: string }> {
  const heading = params.reminder
    ? `A reminder to sign for ${params.propertyAddress}`
    : `Your signature is requested for ${params.propertyAddress}`
  const body = `
    <p style="margin:0 0 12px;">Hi ${escapeHtml(params.recipientName)},</p>
    <p style="margin:0 0 12px;">${params.reminder ? 'You have documents still waiting for your signature' : 'You have documents ready to sign'} for ${escapeHtml(params.propertyAddress)}.</p>
    <p style="margin:0;">Tap the button below to review and sign. You do not need an account or a password. The link is unique to you.</p>
  `
  return sendEmail({
    to: params.to,
    subject: params.reminder
      ? `Reminder: signature requested for ${params.propertyAddress}`
      : `Signature requested: ${params.propertyAddress}`,
    html: shell({ heading, bodyHtml: body, cta: { label: 'Review and sign', url: params.signUrl } }),
    replyTo: params.replyTo,
  })
}

export async function sendCompletionCopy(params: {
  to: string
  recipientName: string
  envelopeName: string
  propertyAddress: string
  pdf: Buffer
  pdfName: string
  replyTo?: string
}): Promise<{ id?: string; error?: string }> {
  const body = `
    <p style="margin:0 0 12px;">Hi ${escapeHtml(params.recipientName)},</p>
    <p style="margin:0 0 12px;">Every party has signed the documents for ${escapeHtml(params.propertyAddress)}. A completed copy is attached for your records.</p>
    <p style="margin:0;">The attached PDF includes a certificate of completion with the signing record.</p>
  `
  return sendEmail({
    to: params.to,
    subject: `Signed and complete: ${params.propertyAddress}`,
    html: shell({ heading: `Your signed documents for ${params.propertyAddress}`, bodyHtml: body }),
    replyTo: params.replyTo,
    attachments: [{ filename: params.pdfName, content: params.pdf }],
  })
}

export async function sendBrokerSignedNotice(params: {
  to: string
  envelopeName: string
  propertyAddress: string
  signerName: string
  remaining: number
  dealUrl: string
}): Promise<{ id?: string; error?: string }> {
  const heading =
    params.remaining > 0
      ? `${params.signerName} signed for ${params.propertyAddress}`
      : `All signatures complete for ${params.propertyAddress}`
  const body =
    params.remaining > 0
      ? `<p style="margin:0;">${escapeHtml(params.signerName)} just signed "${escapeHtml(params.envelopeName)}". ${params.remaining} signer${params.remaining === 1 ? '' : 's'} still pending.</p>`
      : `<p style="margin:0;">Everyone has signed "${escapeHtml(params.envelopeName)}". The sealed document is filed to the deal.</p>`
  return sendEmail({
    to: params.to,
    subject:
      params.remaining > 0
        ? `Signed: ${params.signerName} on ${params.propertyAddress}`
        : `Complete: ${params.propertyAddress} is fully signed`,
    html: shell({ heading, bodyHtml: body, cta: { label: 'Open the deal', url: params.dealUrl } }),
  })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
