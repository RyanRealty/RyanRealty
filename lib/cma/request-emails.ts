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
import { sendGovernedEmail } from '@/lib/comms/sendGovernedEmail'
import type { CrmBrokerSlug } from '@/lib/crm/constants'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'

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
  const { getPersonIdsByEmail } = await import('@/lib/data/crm/getPersonIdsByEmail')
  const ids = await getPersonIdsByEmail(params.leadEmail)
  const personId = ids.length === 1 ? ids[0] : null
  const gmailRes = await sendGmailMessage({
    impersonateAs: signEmail,
    to: params.leadEmail,
    subject,
    bodyText: text,
    bodyHtml: html,
    replyTo: signEmail,
    personId: personId ?? undefined,
    emailKey: personId != null ? `cma-request:${personId}` : undefined,
    brokerSlug: 'matt',
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
      personId: personId ?? undefined,
      emailKey: personId != null ? `cma-request:${personId}` : undefined,
      brokerSlug: 'matt',
    })
  }
}

/**
 * Same-minute confirmation for a valuation asked from a place page (SITE-01).
 *
 * Matt 2026-09-07: a confirmation to a visitor who just submitted their own request is
 * a system message, not a broker send, so it goes the moment the request lands. It
 * repeats what the page just showed them (verdict, pace, comparable count, each with
 * its date) and promises the written document. No dollar figure: that is the document.
 *
 * Routed through sendGovernedEmail (G56): hard-stop, suppression, idempotency, then the
 * assigned broker's Gmail with their signature appended. A visitor with no CRM person
 * (both capture paths failed) gets no confirmation; the written valuation still goes
 * through the CMA queue, and the caller logs which path this took.
 */
export async function sendPlaceValueConfirmation(params: {
  personId: number | null
  brokerCrmSlug: CrmBrokerSlug | null
  leadEmail: string
  leadName?: string | null
  subjectAddress: string
  placeName: string
  verdictLabel: string | null
  monthsOfSupply: number | null
  daysToPending: number | null
  /** 0..1 */
  cashShare: number | null
  compCount: number | null
  asOfLabel: string | null
  brokerName: string | null
  bookHref: string
}): Promise<{ ok: boolean; via: 'gmail' | 'skipped' | 'refused' | 'failed'; error?: string }> {
  if (params.personId == null) return { ok: false, via: 'skipped', error: 'no crm person for the lead' }

  const firstName = params.leadName?.trim().split(/\s+/)[0] || 'there'
  const signName = params.brokerName?.trim() || 'Matt Ryan'
  const brokerFirst = signName.split(/\s+/)[0]

  const facts: string[] = []
  if (params.verdictLabel && params.monthsOfSupply != null) {
    facts.push(`${params.placeName} is a ${params.verdictLabel} right now, with ${formatMonthsOfSupply(params.monthsOfSupply)} months of supply.`)
  }
  if (params.daysToPending != null) {
    facts.push(`Homes there go pending in a median ${Math.round(params.daysToPending)} days.`)
  }
  if (params.cashShare != null) {
    facts.push(`${(params.cashShare * 100).toFixed(0)}% of buyers paid cash over the last year.`)
  }
  if (params.compCount != null) {
    facts.push(
      `We found ${params.compCount} recent ${params.placeName} ${params.compCount === 1 ? 'sale' : 'sales'} comparable to your home, and the written valuation is built on ${params.compCount === 1 ? 'it' : 'them'}.`,
    )
  }
  const stamp = params.asOfLabel ? ` Market figures from the regional MLS, updated ${params.asOfLabel}.` : ''
  const factsText = facts.length ? facts.join(' ') + stamp : `The written valuation will carry the comparable sales for ${params.placeName}.`

  const subject = `Your ${params.subjectAddress} valuation is on its way`
  const bodyText = [
    `Hi ${firstName},`,
    '',
    `You asked what ${params.subjectAddress} would sell for. Here's what we can tell you right now, and the written valuation is on its way.`,
    '',
    factsText,
    '',
    `${brokerFirst} will send the full valuation, the number, the comparable sales, and what we'd list at, by the next business day. Want to talk it through sooner? Book a time: ${params.bookHref}`,
    '',
    `Reply to this email with anything we should know, like recent improvements or your timing.`,
  ].join('\n')

  const addressKey = params.subjectAddress.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const broker = params.brokerCrmSlug ?? 'matt'
  const res = await sendGovernedEmail({
    personId: params.personId,
    purpose: 'place-page:valuation-confirmation',
    idempotencyKey: `place-value:${addressKey}`,
    initiator: { kind: 'system', broker, source: 'place-page' },
    payload: {
      rail: 'gmail',
      to: [params.leadEmail],
      subject,
      bodyText,
      withSignature: true,
      track: { personId: params.personId, emailKey: `place-value:${params.personId}:${addressKey}`, label: subject, broker },
    },
  })
  if (res.ok) return { ok: true, via: 'gmail' }
  return { ok: false, via: res.stage === 'provider' ? 'failed' : 'refused', error: `${res.stage}: ${res.error}` }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
