/**
 * Broker Price Opinion delivery rail — the ONLY way a built BPO reaches a
 * contact. Mirrors lib/cma/send.ts:
 *
 *   sendBpoToLead() — an explicit, button-triggered CRM send from the signing
 *   broker's own mailbox (Gmail DWD), with automatic Resend fallback. PDF
 *   attached, FUB BCC'd, open/click instrumented, suppression checked (fails
 *   closed), logged as email_out on the contact's timeline.
 *
 * Client-safe by default: the internal Offer strategy is stripped from the
 * emailed PDF unless the caller passes includeOfferStrategy (a BPO going to
 * your own buyer client). Requires the BPO to be finalized.
 */

import {
  getCmaBrokerBySlugOrEmail,
  findCrmPersonIdByEmail,
  logCmaTimelineEvent,
} from '@/lib/data'
import { getBpoAdminRowBySlug, updateBpoRowFieldsBySlug } from '@/lib/data/bpo/reads'
import { brokerSendIdentity } from '@/lib/email/broker-identity'
import { getContactSendTarget } from '@/lib/data/crm/getContactSendTarget'
import { stripOfferStrategy } from '@/lib/bpo/render'
import { htmlToPdfBuffer } from '@/lib/pdf/html-to-pdf'
import { wrapBrandedEmail, brandedTextFooter, escapeHtml, type ShellBroker } from '@/lib/email/shell'
import { attributeOutbound } from '@/lib/crm/attributed-links'
import { isSuppressed } from '@/lib/crm/suppressions'
import { CRM_BROKER_BY_EMAIL } from '@/lib/crm/constants'
import { sendEmail } from '@/lib/resend'
import { sendGmailMessage } from '@/lib/gmail-draft'
import { formatPriceExact } from '@/lib/format/money'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const FUB_BCC = process.env.FUB_BCC_ADDRESS?.trim() || 'ryan.realty@followupboss.me'
const MAX_PDF_BYTES = 25 * 1024 * 1024
const usd = formatPriceExact

export interface SendBpoResult {
  ok: boolean
  error?: string
  transport?: 'gmail' | 'resend'
  mailbox?: string | null
  personId?: number | null
}

function buildBody(opts: {
  slug: string
  subjectAddress: string
  clientName: string | null
  opinionValue: number | null
  valueLow: number | null
  valueHigh: number | null
  broker: ShellBroker
  brokerPhone: string | null
}): { html: string; text: string; subject: string } {
  const firstName = (opts.clientName ?? '').trim().split(/\s+/)[0] || 'there'
  const brokerFirst = opts.broker.firstName
  const viewUrl = `${SITE_URL}/bpo/${opts.slug}`
  const hasNumbers = opts.opinionValue != null
  const subject = `Our price opinion for ${opts.subjectAddress}`

  const numbersHtml = hasNumbers
    ? `<p style="margin:0 0 16px 0;">The short version. Weighing the comparable sales, the market right now, and the home's listing history, our opinion of value is <strong>${usd(opts.opinionValue)}</strong>${
        opts.valueLow != null && opts.valueHigh != null ? `, within a range of <strong>${usd(opts.valueLow)} to ${usd(opts.valueHigh)}</strong>` : ''
      }.</p>`
    : ''
  const bodyHtml = `
<div style="padding:32px 34px 8px;">
  <p style="margin:0 0 16px 0;">Hi ${escapeHtml(firstName)},</p>
  <p style="margin:0 0 16px 0;">Here is our broker price opinion for <strong>${escapeHtml(opts.subjectAddress)}</strong>. The full report is attached as a PDF, and you can read it online.</p>
  ${numbersHtml}
  <p style="margin:0 0 16px 0;">It walks through the comparable sales, the market conditions, and how the property's listing history shapes the number. Happy to talk any of it through.</p>
  <p style="margin:0 0 24px 0;"><a href="${viewUrl}" style="display:inline-block;background:#102742;color:#faf8f4;font-size:13px;font-weight:700;letter-spacing:.08em;text-decoration:none;padding:14px 32px;">READ THE OPINION &rarr;</a></p>
  <p style="margin:0 0 8px 0;">${escapeHtml(brokerFirst)}<br/>Ryan Realty${opts.brokerPhone ? `<br/>${escapeHtml(opts.brokerPhone)}` : ''}</p>
</div>`

  const numbersText = hasNumbers
    ? `The short version. Weighing the comparable sales, the market right now, and the home's listing history, our opinion of value is ${usd(opts.opinionValue)}${opts.valueLow != null && opts.valueHigh != null ? `, within a range of ${usd(opts.valueLow)} to ${usd(opts.valueHigh)}` : ''}.\n\n`
    : ''
  const text = `Hi ${firstName},

Here is our broker price opinion for ${opts.subjectAddress}. The full report is attached as a PDF, and you can read it online: ${viewUrl}

${numbersText}It walks through the comparable sales, the market conditions, and how the property's listing history shapes the number. Happy to talk any of it through.

${brokerFirst}
Ryan Realty${opts.brokerPhone ? `\n${opts.brokerPhone}` : ''}${brandedTextFooter()}`

  const html = wrapBrandedEmail({
    bodyHtml,
    previewText: `Our price opinion for ${opts.subjectAddress}.`,
    mastheadLine: 'BROKER PRICE OPINION',
    heroUrl: null,
    senderBroker: opts.broker,
    unsubscribeUrl: null,
    audienceLine: `You are receiving this because a price opinion was prepared for ${opts.subjectAddress}.`,
  })
  return { html, text, subject }
}

export async function sendBpoToLead(opts: {
  personId: number
  slug: string
  includeOfferStrategy?: boolean
}): Promise<SendBpoResult> {
  const slug = opts.slug.trim().toLowerCase()
  const row = await getBpoAdminRowBySlug(slug)
  if (!row) return { ok: false, error: 'Broker price opinion not found' }
  const status = String(row.status ?? '')
  if (status !== 'final') {
    return { ok: false, error: `This opinion is not finalized yet (status ${status}). Finalize it before sending.` }
  }
  const fullHtml = row.html_content as string | null
  if (!fullHtml) return { ok: false, error: 'This opinion has no built document to send.' }

  const target = await getContactSendTarget(opts.personId)
  if (!target?.email) {
    return { ok: false, error: 'No email on file for this contact. Add one before sending.' }
  }

  // Suppression chokepoint (fails closed).
  const sup = await isSuppressed(opts.personId, 'email')
  if (sup.suppressed) {
    return { ok: false, error: `This contact has opted out of email (${sup.reasons.join(', ')}).` }
  }

  // Client-safe unless the caller opts into the internal offer strategy.
  const docHtml = opts.includeOfferStrategy ? fullHtml : stripOfferStrategy(fullHtml)
  let pdf: Buffer
  try {
    pdf = await htmlToPdfBuffer(docHtml)
  } catch (e) {
    return { ok: false, error: `PDF render failed: ${e instanceof Error ? e.message : String(e)}` }
  }
  if (pdf.byteLength > MAX_PDF_BYTES) {
    return { ok: false, error: 'The rendered PDF exceeds the 25 MB attachment cap.' }
  }

  const brokerRaw = await getCmaBrokerBySlugOrEmail({ slug: (row.broker_slug as string | null) ?? null })
  const brokerEmail = (brokerRaw?.email as string | null) ?? 'matt@ryan-realty.com'
  const brokerName = (brokerRaw?.display_name as string) ?? 'Matt Ryan'
  const brokerPhone = (brokerRaw?.phone as string | null) ?? null
  const brokerPhoto = (brokerRaw?.photo_url as string | null) ?? null
  const shellBroker: ShellBroker = {
    name: brokerName,
    firstName: brokerName.split(/\s+/)[0]!,
    title: (brokerRaw?.title as string) ?? 'Owner & Principal Broker',
    phone: brokerPhone,
    email: brokerEmail,
    headshotUrl: brokerPhoto
      ? brokerPhoto.startsWith('http')
        ? brokerPhoto
        : `${SITE_URL}${brokerPhoto}`
      : `${SITE_URL}/images/brokers/ryan-matt.png`,
    isOwner: ((row.broker_slug as string | null) ?? '') === 'matthew-ryan',
  }

  const body = buildBody({
    slug,
    subjectAddress: (row.subject_address as string) ?? slug,
    clientName: target.name,
    opinionValue: (row.opinion_value as number | null) ?? null,
    valueLow: (row.value_low as number | null) ?? null,
    valueHigh: (row.value_high as number | null) ?? null,
    broker: shellBroker,
    brokerPhone,
  })

  const crmBrokerSlug = CRM_BROKER_BY_EMAIL[brokerEmail.toLowerCase()] ?? 'matt'
  const personId = (await findCrmPersonIdByEmail(target.email)) ?? opts.personId
  const trackedHtml = attributeOutbound(body.html, {
    brokerSlug: crmBrokerSlug,
    personId,
    emailKey: `bpo:${slug}`,
    label: body.subject,
  })

  const brokerMailbox = /@ryan-realty\.com$/i.test(brokerEmail) ? brokerEmail : 'matt@ryan-realty.com'
  const attachName = `broker-price-opinion-${slug.replace(/^bpo-/, '')}.pdf`
  const gmailRes = await sendGmailMessage({
    to: target.email,
    subject: body.subject,
    bodyHtml: trackedHtml,
    bodyText: body.text,
    bcc: FUB_BCC,
    impersonateAs: brokerMailbox,
    attachments: [{ filename: attachName, content: pdf, mimeType: 'application/pdf' }],
  })
  const transport: 'gmail' | 'resend' = gmailRes.ok ? 'gmail' : 'resend'
  if (!gmailRes.ok) {
    console.error(`[sendBpoToLead] Gmail send from ${brokerMailbox} failed (${gmailRes.error ?? 'unknown'}); falling back to Resend`)
  }
  // Named broker from (never the bare noreply@ default) so the fallback rail
  // matches the Gmail rail's identity — the lead sees the same sender either way.
  const fallback = gmailRes.ok
    ? null
    : await sendEmail({
        to: target.email,
        from: brokerSendIdentity(crmBrokerSlug).from,
        subject: body.subject,
        html: trackedHtml,
        text: body.text,
        replyTo: brokerEmail,
        attachments: [{ filename: attachName, content: pdf }],
      })
  if (fallback?.error) {
    return { ok: false, error: `Email send failed on both rails (Gmail: ${gmailRes.ok ? '' : gmailRes.error ?? 'unknown'}; Resend: ${fallback.error})` }
  }

  const sentAt = new Date().toISOString()
  await updateBpoRowFieldsBySlug(slug, {
    last_sent_at: sentAt,
    sent_count: ((row.sent_count as number | null) ?? 0) + 1,
  })
  await logCmaTimelineEvent(opts.personId, {
    kind: 'email_out',
    title: body.subject,
    body: `Broker price opinion sent to ${target.email} for ${(row.subject_address as string) ?? slug}${opts.includeOfferStrategy ? ' (with offer strategy)' : ''}.`,
    broker: crmBrokerSlug,
    dedupeKey: `bpo:sent:${slug}:${sentAt.slice(0, 10)}`,
    payload: { slug, transport, includeOfferStrategy: Boolean(opts.includeOfferStrategy) },
  })

  return { ok: true, transport, mailbox: transport === 'gmail' ? brokerMailbox : null, personId }
}
