/**
 * CMA request intake notifications — the broker "new request" email and the
 * lead "we got it" confirmation, extracted from lib/cma-request.ts (file-size
 * budget split, 2026-07-17). Fire-and-forget senders: createCmaRequest calls
 * both without awaiting so the LP submit stays fast.
 *
 * Suppression posture: the broker notification is INTERNAL (no lead
 * recipient — allowlisted in scripts/email-send-gated-baseline.json); the
 * lead confirmation is gated by isSuppressedByEmail on BOTH transports
 * (Gmail send-as-matt and the Resend fallback), fail-closed.
 */

import { sendEmail } from '@/lib/resend'
import { formatPublishedPhone } from '@/lib/cma/format-phone'
import { sendGmailMessage } from '@/lib/gmail-draft'
import { isSuppressedByEmail } from '@/lib/crm/suppressions'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export async function sendBrokerNotification(params: {
  brokerEmail: string | null
  brokerName: string | null
  cmaSlug: string
  subjectAddress: string
  leadName: string | null
  leadEmail: string
  leadPhone: string | null
  leadTimeline: string | null
}): Promise<void> {
  if (!params.brokerEmail) return
  const firstName = params.brokerName?.split(/\s+/)[0] ?? 'team'
  const leadDisplay = params.leadName ?? params.leadEmail
  const queueUrl = `${SITE_URL}/admin/cmas`
  const subject = `New CMA request for ${params.subjectAddress}`
  const text = [
    `Hi ${firstName},`,
    '',
    `New seller lead just submitted the home-value form:`,
    '',
    `  Property:  ${params.subjectAddress}`,
    `  Client:    ${leadDisplay}`,
    `  Email:     ${params.leadEmail}`,
    params.leadPhone ? `  Phone:     ${params.leadPhone}` : null,
    params.leadTimeline ? `  Timeline:  ${params.leadTimeline}` : null,
    '',
    `The request is queued in /admin/cmas (slug: ${params.cmaSlug}).`,
    `The CMA builds automatically within about 30 minutes and lands there as a`,
    `draft for review. Approve it, then send it to the lead from the review page.`,
    '',
    `Open the queue: ${queueUrl}`,
    '',
    `Ryan Realty automation`,
  ]
    .filter((line) => line !== null)
    .join('\n')

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;font-size:15px;line-height:1.55;color:#102742;max-width:560px;margin:0 auto;padding:24px;">
  <p>Hi ${firstName},</p>
  <p>New seller lead just submitted the home-value form:</p>
  <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0;">
    <tr><td style="padding:4px 0;color:#5b6473;width:90px;">Property:</td><td style="padding:4px 0;font-weight:600;">${escapeHtml(params.subjectAddress)}</td></tr>
    <tr><td style="padding:4px 0;color:#5b6473;">Client:</td><td style="padding:4px 0;">${escapeHtml(leadDisplay)}</td></tr>
    <tr><td style="padding:4px 0;color:#5b6473;">Email:</td><td style="padding:4px 0;"><a href="mailto:${escapeHtml(params.leadEmail)}">${escapeHtml(params.leadEmail)}</a></td></tr>
    ${params.leadPhone ? `<tr><td style="padding:4px 0;color:#5b6473;">Phone:</td><td style="padding:4px 0;"><a href="tel:${escapeHtml(params.leadPhone)}">${escapeHtml(params.leadPhone)}</a></td></tr>` : ''}
    ${params.leadTimeline ? `<tr><td style="padding:4px 0;color:#5b6473;">Timeline:</td><td style="padding:4px 0;">${escapeHtml(params.leadTimeline)}</td></tr>` : ''}
  </table>
  <p>The request is queued in <strong>/admin/cmas</strong> (slug: <code>${escapeHtml(params.cmaSlug)}</code>). The CMA builds automatically within about 30 minutes and lands there as a draft. Approve it on the review page, then send it to the lead.</p>
  <p><a href="${queueUrl}" style="display:inline-block;background:#102742;color:#faf8f4;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600;">Open the CMA queue</a></p>
  <p style="margin-top:24px;color:#5b6473;font-size:13px;">Ryan Realty automation</p>
</div>
`.trim()

  await sendEmail({
    to: params.brokerEmail,
    subject,
    text,
    html,
    replyTo: params.leadEmail,
  })
}

export async function sendLeadConfirmation(params: {
  leadEmail: string
  leadName: string | null
  subjectAddress: string
  brokerName: string | null
  /** Assigned broker's @ryan-realty.com mailbox — sender + reply-to. Matt fallback. */
  brokerEmail?: string | null
  /** Assigned broker's PUBLISHABLE line (E.164 twilio_number). Matt fallback. */
  brokerPhone?: string | null
}): Promise<void> {
  // Suppression chokepoint (fails closed). A lead who opted out of email never
  // gets the confirmation by EITHER path (Gmail send-as-matt or Resend
  // fallback). No crm_person_id here, so gate by email.
  const sup = await isSuppressedByEmail(params.leadEmail, 'email')
  if (sup.suppressed) return

  const firstName = params.leadName?.split(/\s+/)[0] ?? 'there'
  const brokerFirst = params.brokerName?.split(/\s+/)[0] ?? 'one of our brokers'
  // The assigned broker signs and sends (locked directive, Matt 2026-08-04:
  // "CMAs sign as the lead's assigned broker — their mailbox sends via Gmail
  // DWD; Matt fallback"). Supersedes the 2026-06-05 send-as-Matt-always note
  // below for the assigned-broker case; the mechanics are unchanged.
  const signName = params.brokerName?.trim() || 'Matt Ryan'
  const signEmail =
    params.brokerEmail?.trim().toLowerCase().endsWith('@ryan-realty.com')
      ? (params.brokerEmail as string).trim()
      : 'matt@ryan-realty.com'
  const signPhone = formatPublishedPhone(params.brokerPhone) ?? '541.703.3095'
  const signPhoneHref = (params.brokerPhone ?? '+15417033095').replace(/[^\d+]/g, '')
  const subject = `Your home value request for ${params.subjectAddress}`
  const text = [
    `Hi ${firstName},`,
    '',
    `Thanks for requesting a Comparative Market Analysis for ${params.subjectAddress}.`,
    '',
    `${brokerFirst} from Ryan Realty will pull recent comparable sales,`,
    `apply the right adjustments for your property, and email you a`,
    `personalized analysis within the next business day.`,
    '',
    `If you have anything you'd like us to know upfront, like recent`,
    `improvements, timing, or specific questions, just reply to this email.`,
    '',
    signName,
    `Ryan Realty`,
    signPhone,
    `https://ryan-realty.com`,
  ].join('\n')

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;font-size:15px;line-height:1.6;color:#102742;max-width:560px;margin:0 auto;padding:24px;">
  <p>Hi ${escapeHtml(firstName)},</p>
  <p>Thanks for requesting a Comparative Market Analysis for <strong>${escapeHtml(params.subjectAddress)}</strong>.</p>
  <p>${escapeHtml(brokerFirst)} from Ryan Realty will pull recent comparable sales, apply the right adjustments for your property, and email you a personalized analysis within the next business day.</p>
  <p>If you have anything you'd like us to know upfront, like recent improvements, timing, or specific questions, just reply to this email.</p>
  <p style="margin-top:32px;color:#5b6473;font-size:13px;">
    ${escapeHtml(signName)}<br/>
    Ryan Realty<br/>
    <a href="tel:${escapeHtml(signPhoneHref)}" style="color:#5b6473;">${escapeHtml(signPhone)}</a><br/>
    <a href="https://ryan-realty.com" style="color:#5b6473;">ryan-realty.com</a>
  </p>
</div>
`.trim()

  // Send from Matt's real Google Workspace mailbox (matt@ryan-realty.com) via
  // domain-wide-delegation impersonation — genuinely his address, lands in his
  // Sent folder, and replies thread straight to his inbox. No Resend-verified
  // sending domain required. (Matt 2026-06-05: "email is matt@ryan-realty.com" —
  // not the noreply, not the mail. subdomain.)
  const gmailRes = await sendGmailMessage({
    impersonateAs: signEmail,
    to: params.leadEmail,
    subject,
    bodyText: text,
    bodyHtml: html,
    replyTo: signEmail,
  })
  if (!gmailRes.ok) {
    // Suppression chokepoint (fails closed) — re-checked in this scope so the
    // Resend fallback to the lead is gated independently of the early return.
    if ((await isSuppressedByEmail(params.leadEmail, 'email')).suppressed) return
    // Graceful fallback so the acknowledgment never silently fails: send via
    // Resend from the verified mail.ryan-realty.com subdomain (display name still
    // reads "Matt Ryan", replies still route to his real inbox).
    console.warn(
      `[cma-request] Gmail send-as-matt failed (${gmailRes.error ?? 'unknown'}); falling back to Resend`,
    )
    await sendEmail({
      to: params.leadEmail,
      from: `${signName} <${signEmail.replace('@ryan-realty.com', '@mail.ryan-realty.com')}>`,
      subject,
      text,
      html,
      replyTo: signEmail,
    })
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
