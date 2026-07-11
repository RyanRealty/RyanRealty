/**
 * CMA delivery rail — the ONLY way a built CMA reaches a lead.
 *
 * One explicit, button-triggered path (never automatic):
 *   sendCmaToLead() — a real CRM send from the signing broker's own mailbox
 *   (Gmail DWD, same transport as the CRM composer), PDF attached, FUB BCC'd,
 *   open/click instrumented, suppression checked (fails closed), and logged
 *   as email_out on the contact's CRM timeline. Replies thread straight back
 *   into the broker's inbox (and the CRM via mailbox sync).
 *
 *   If the Gmail DWD send fails (auth/scope/outage), the send automatically
 *   falls back to Resend so the lead still gets the CMA — the timeline row
 *   records which transport carried it.
 *
 * Requires the cmas row to be finalized (Matt approved the draft).
 * The Gmail-DRAFT path was retired 2026-07-07 per Matt's directive: sends go
 * out through the CRM, not through a manual Gmail draft review.
 */

import {
  getCmaAdminRowBySlug,
  getCmaBrokerBySlugOrEmail,
  updateCmaRowFieldsBySlug,
  findCrmPersonIdByEmail,
  stampCmaLinkOnPerson,
  logCmaTimelineEvent,
} from '@/lib/data'
import { renderCmaPdfBuffer, CmaNotFoundError } from '@/lib/cma-pdf'
import { wrapBrandedEmail, brandedTextFooter, escapeHtml, type ShellBroker } from '@/lib/email/shell'
import { brokerSendIdentity } from '@/lib/email/broker-identity'
import { attributeOutbound } from '@/lib/crm/attributed-links'
import { isSuppressed, isSuppressedByEmail } from '@/lib/crm/suppressions'
import { CRM_BROKER_BY_EMAIL } from '@/lib/crm/constants'
import { sendEmail } from '@/lib/resend'
import { sendGmailMessage } from '@/lib/gmail-draft'
import { formatPriceExact } from '@/lib/format/money'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const FUB_BCC = process.env.FUB_BCC_ADDRESS?.trim() || 'ryan.realty@followupboss.me'
const MAX_PDF_BYTES = 25 * 1024 * 1024

const usd = formatPriceExact

interface CmaSendContext {
  slug: string
  subjectAddress: string
  clientName: string | null
  clientEmail: string
  brokerRow: {
    slug: string
    displayName: string
    title: string
    email: string | null
    phone: string | null
    photoUrl: string | null
  }
  valueLow: number | null
  valueHigh: number | null
  recommendedList: number | null
}

async function resolveSendContext(
  slug: string,
): Promise<{ ctx: CmaSendContext | null; error: string | null }> {
  const row = await getCmaAdminRowBySlug(slug)
  if (!row) return { ctx: null, error: 'CMA not found' }
  const status = String(row.status ?? '')
  if (status !== 'finalized' && status !== 'delivered') {
    return { ctx: null, error: `This CMA is not approved yet (status ${status}). Approve it before sending.` }
  }
  const clientEmail = (row.client_email as string | null)?.trim().toLowerCase() ?? null
  if (!clientEmail) {
    return { ctx: null, error: 'This CMA has no client email on file. Add one on the review page first.' }
  }
  const brokerSlug = (row.broker_slug as string | null) ?? null
  const brokerRaw = await getCmaBrokerBySlugOrEmail({ slug: brokerSlug })
  const brokerRow = {
    slug: (brokerRaw?.slug as string) ?? 'matthew-ryan',
    displayName: (brokerRaw?.display_name as string) ?? 'Matt Ryan',
    title: (brokerRaw?.title as string) ?? 'Owner & Principal Broker',
    email: (brokerRaw?.email as string | null) ?? 'matt@ryan-realty.com',
    phone: (brokerRaw?.phone as string | null) ?? null,
    photoUrl: (brokerRaw?.photo_url as string | null) ?? null,
  }
  return {
    ctx: {
      slug,
      subjectAddress: (row.subject_address as string) ?? slug,
      clientName: (row.client_name as string | null) ?? null,
      clientEmail,
      brokerRow,
      valueLow: (row.value_low as number | null) ?? null,
      valueHigh: (row.value_high as number | null) ?? null,
      recommendedList: (row.recommended_list as number | null) ?? null,
    },
    error: null,
  }
}

function buildLeadBody(ctx: CmaSendContext): { html: string; text: string; subject: string } {
  const firstName = (ctx.clientName ?? '').trim().split(/\s+/)[0] || 'there'
  const brokerFirst = ctx.brokerRow.displayName.split(/\s+/)[0]
  const viewUrl = `${SITE_URL}/cma/${ctx.slug}`
  const hasNumbers = ctx.recommendedList != null && ctx.valueLow != null && ctx.valueHigh != null
  const subject = `Your home value analysis for ${ctx.subjectAddress}`

  const numbersHtml = hasNumbers
    ? `<p style="margin:0 0 16px 0;">The short version. Based on what has actually sold near you, your home lands in a range of <strong>${usd(ctx.valueLow)} to ${usd(ctx.valueHigh)}</strong>, and I would price it around <strong>${usd(ctx.recommendedList)}</strong>.</p>`
    : ''
  const bodyHtml = `
<div style="padding:32px 34px 8px;">
  <p style="margin:0 0 16px 0;">Hi ${escapeHtml(firstName)},</p>
  <p style="margin:0 0 16px 0;">I put together a full market analysis for <strong>${escapeHtml(ctx.subjectAddress)}</strong>. The complete report is attached as a PDF, and you can also read it online.</p>
  ${numbersHtml}
  <p style="margin:0 0 16px 0;">The report walks through the comparable sales, the adjustments behind the number, and where the market sits right now. Happy to talk any of it through, no pressure.</p>
  <p style="margin:0 0 24px 0;"><a href="${viewUrl}" style="display:inline-block;background:#102742;color:#faf8f4;font-size:13px;font-weight:700;letter-spacing:.08em;text-decoration:none;padding:14px 32px;">READ THE FULL REPORT &rarr;</a></p>
  <p style="margin:0 0 8px 0;">${escapeHtml(brokerFirst)}<br/>Ryan Realty${ctx.brokerRow.phone ? `<br/>${escapeHtml(ctx.brokerRow.phone)}` : ''}</p>
</div>`

  const numbersText = hasNumbers
    ? `The short version. Based on what has actually sold near you, your home lands in a range of ${usd(ctx.valueLow)} to ${usd(ctx.valueHigh)}, and I would price it around ${usd(ctx.recommendedList)}.\n\n`
    : ''
  const text = `Hi ${firstName},

I put together a full market analysis for ${ctx.subjectAddress}. The complete report is attached as a PDF, and you can also read it online: ${viewUrl}

${numbersText}The report walks through the comparable sales, the adjustments behind the number, and where the market sits right now. Happy to talk any of it through, no pressure.

${brokerFirst}
Ryan Realty${ctx.brokerRow.phone ? `\n${ctx.brokerRow.phone}` : ''}${brandedTextFooter()}`

  const shellBroker: ShellBroker = {
    name: ctx.brokerRow.displayName,
    firstName: brokerFirst,
    title: ctx.brokerRow.title,
    phone: ctx.brokerRow.phone,
    email: ctx.brokerRow.email,
    headshotUrl: ctx.brokerRow.photoUrl
      ? ctx.brokerRow.photoUrl.startsWith('http')
        ? ctx.brokerRow.photoUrl
        : `${SITE_URL}${ctx.brokerRow.photoUrl}`
      : `${SITE_URL}/images/brokers/ryan-matt.png`,
    isOwner: ctx.brokerRow.slug === 'matthew-ryan',
  }
  const html = wrapBrandedEmail({
    bodyHtml,
    previewText: `Your market analysis for ${ctx.subjectAddress} is ready.`,
    mastheadLine: 'HOME VALUE ANALYSIS',
    heroUrl: null,
    senderBroker: shellBroker,
    unsubscribeUrl: null,
    audienceLine: `You are receiving this because a market analysis was requested for ${ctx.subjectAddress}.`,
  })
  return { html, text, subject }
}

export interface SendCmaToLeadResult {
  ok: boolean
  error?: string
  /** Which rail carried the email: the broker's own mailbox, or the Resend fallback. */
  transport?: 'gmail' | 'resend'
  /** The broker mailbox the email went out from (gmail transport only). */
  mailbox?: string | null
  gmailMessageId?: string
  resendId?: string
  personId?: number | null
}

/**
 * CRM send to the lead — from the signing broker's own mailbox (Gmail DWD),
 * with Resend as automatic fallback. Explicit-click only — never automatic.
 */
export async function sendCmaToLead(slug: string): Promise<SendCmaToLeadResult> {
  const { ctx, error } = await resolveSendContext(slug)
  if (!ctx) return { ok: false, error: error ?? 'CMA not sendable' }

  // Suppression chokepoint (fails closed).
  const personId = await findCrmPersonIdByEmail(ctx.clientEmail)
  const sup = personId
    ? await isSuppressed(personId, 'email')
    : await isSuppressedByEmail(ctx.clientEmail, 'email')
  if (sup.suppressed) {
    return { ok: false, error: `This contact has opted out of email (${sup.reasons.join(', ')}).` }
  }

  // PDF.
  let pdf: Buffer
  try {
    const rendered = await renderCmaPdfBuffer(slug)
    pdf = rendered.buffer
  } catch (e) {
    if (e instanceof CmaNotFoundError) return { ok: false, error: 'CMA document not found for PDF render' }
    return { ok: false, error: `PDF render failed: ${e instanceof Error ? e.message : String(e)}` }
  }
  if (pdf.byteLength > MAX_PDF_BYTES) {
    return { ok: false, error: 'The rendered PDF exceeds the 25 MB attachment cap.' }
  }

  const body = buildLeadBody(ctx)
  const crmBrokerSlug = CRM_BROKER_BY_EMAIL[(ctx.brokerRow.email ?? '').toLowerCase()] ?? 'matt'
  const trackedHtml = attributeOutbound(body.html, {
    brokerSlug: crmBrokerSlug,
    personId: personId ?? undefined,
    emailKey: `cma:${slug}`,
    label: body.subject,
  })

  // Primary rail: the signing broker's real mailbox (same DWD transport the
  // CRM composer uses). The lead gets a 1:1 email from matt@ryan-realty.com
  // (or the signing broker), FUB is BCC'd, and a reply threads straight back
  // into the broker's inbox — where the CRM mailbox sync picks it up.
  const brokerMailbox =
    ctx.brokerRow.email && /@ryan-realty\.com$/i.test(ctx.brokerRow.email)
      ? ctx.brokerRow.email
      : 'matt@ryan-realty.com'
  const gmailRes = await sendGmailMessage({
    to: ctx.clientEmail,
    subject: body.subject,
    bodyHtml: trackedHtml,
    bodyText: body.text,
    bcc: FUB_BCC,
    impersonateAs: brokerMailbox,
    attachments: [{ filename: `${slug}.pdf`, content: pdf, mimeType: 'application/pdf' }],
  })
  const transport: 'gmail' | 'resend' = gmailRes.ok ? 'gmail' : 'resend'
  const gmailMessageId = gmailRes.ok ? gmailRes.messageId : undefined
  if (!gmailRes.ok) {
    // Fallback rail: Resend. The lead still gets the CMA; the timeline row
    // records the degraded transport so the outage is visible.
    console.error(`[sendCmaToLead] Gmail send from ${brokerMailbox} failed (${gmailRes.error ?? 'unknown'}); falling back to Resend`)
  }
  // The suppression gate above covers this fallback too — same function scope.
  // Named broker from (never the bare noreply@ default) so the fallback rail
  // matches the Gmail rail's identity — the lead sees the same sender either way.
  const fallbackIdentity = brokerSendIdentity(ctx.brokerRow.email)
  const fallback = gmailRes.ok ? null : await sendEmail({
    to: ctx.clientEmail,
    from: fallbackIdentity.from,
    subject: body.subject,
    html: trackedHtml,
    text: body.text,
    replyTo: ctx.brokerRow.email ?? 'matt@ryan-realty.com',
    attachments: [{ filename: `${slug}.pdf`, content: pdf }],
  })
  if (fallback?.error) {
    return { ok: false, error: `Email send failed on both rails (Gmail: ${gmailRes.ok ? '' : gmailRes.error ?? 'unknown'}; Resend: ${fallback.error})` }
  }
  const resendId = fallback?.id

  const sentAt = new Date().toISOString()
  await updateCmaRowFieldsBySlug(slug, { status: 'delivered', delivered_at: sentAt })
  if (personId) {
    await stampCmaLinkOnPerson(personId, { cmaLink: `${SITE_URL}/cma/${slug}`, cmaSlug: slug })
    await logCmaTimelineEvent(personId, {
      kind: 'email_out',
      title: body.subject,
      body: `CMA sent to ${ctx.clientEmail} for ${ctx.subjectAddress}.`,
      broker: crmBrokerSlug,
      // Unique per send (full ISO timestamp, not the send DATE) so a legitimate
      // re-send is always logged as its own timeline row. A date-keyed dedupe
      // silently swallowed the second same-day send, hiding a real delivery.
      dedupeKey: `cma:sent:${slug}:${sentAt}`,
      payload: { slug, transport, mailbox: transport === 'gmail' ? brokerMailbox : null, gmailMessageId: gmailMessageId ?? null, resendId: resendId ?? null },
    })
  }
  return { ok: true, transport, mailbox: transport === 'gmail' ? brokerMailbox : null, gmailMessageId, resendId, personId }
}
