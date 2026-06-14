/**
 * CMA finalization + delivery orchestrator.
 *
 * Called once the agent (or Matt via the admin queue) finalizes a CMA.
 * At that point the HTML exists at `public/cmas/<slug>/cma.html`.
 * This module handles everything AFTER the HTML:
 *
 *   1. Render the CMA to PDF via renderCmaPdfBuffer (respects the 25 MB cap).
 *   2. Create a Gmail DRAFT addressed to the lead (PDF attached, FUB BCC'd)
 *      via the existing createGmailDraft + DWD path so Matt reviews and sends
 *      from his real mailbox. Falls back to Resend → broker if DWD is down.
 *   3. Notify Matt via Resend that the CMA is ready for review, with the
 *      Gmail-draft confirmation and a link to the PDF.
 *
 * The Gmail-draft model ensures a human (Matt or the signing broker) reviews
 * the CMA before it reaches the lead — the document carries real pricing
 * numbers (CLAUDE.md §0 data-accuracy mandate).
 *
 * This function NEVER auto-sends to the lead.
 *
 * Trigger:  POST /api/cma/[slug]/finalize-deliver  (admin or cron-secret auth)
 *           or direct import: import { finalizeAndDeliverCma } from '@/lib/cma-deliver'
 *
 * Locked 2026-06-04.
 */

import { renderCmaPdfBuffer, CmaNotFoundError } from '@/lib/cma-pdf'
import { createGmailDraft } from '@/lib/gmail-draft'
import { instrumentEmailHtml } from '@/lib/email-tracking'
import { sendEmail } from '@/lib/resend'
import { createServiceClient } from '@/lib/supabase/service'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const FUB_BCC = process.env.FUB_BCC_ADDRESS?.trim() || 'ryan.realty@followupboss.me'
const MATT_ALERT_EMAIL = process.env.MATT_ALERT_EMAIL ?? 'matt@ryan-realty.com'
const ALERT_FROM = process.env.RESEND_FROM ?? 'alerts@mail.ryan-realty.com'
const MAX_PDF_BYTES = 25 * 1024 * 1024 // Gmail attachment cap

export interface FinalizeAndDeliverCmaParams {
  slug: string
  /**
   * Lead email address. If omitted, resolved from `public.cmas.client_email`.
   * Required if cmas row doesn't have client_email.
   */
  leadEmail?: string
  /**
   * Lead display name (used in the email greeting). Resolved from cmas if omitted.
   */
  leadName?: string | null
  /**
   * Broker slug to sign the email as. Resolved from cmas.broker_slug if omitted.
   */
  brokerSlug?: string | null
}

export interface FinalizeAndDeliverCmaResult {
  ok: boolean
  /** Gmail draft ID — set when the DWD path succeeded. */
  gmailDraftId?: string
  /** True when the Gmail DWD path failed and Resend was used to alert the broker instead. */
  fellBackToResend?: boolean
  /** True when the Matt-notify Resend email was sent successfully. */
  mattNotified?: boolean
  pdfBytes?: number
  error?: string
  /** Non-fatal warnings accumulated during the run. */
  warnings?: string[]
}

interface CmaRow {
  slug: string
  subject_address: string
  client_name: string | null
  client_email: string | null
  broker_slug: string | null
  broker_id: string | null
  recommended_list: number | null
  value_low: number | null
  value_high: number | null
}

interface BrokerRow {
  slug: string
  email: string | null
  display_name: string | null
}

function formatPrice(n: number | null | undefined): string {
  if (n == null) return ''
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Build the email body (HTML + plain text) addressed to the lead.
 * Mirrors the body in /api/cma/[slug]/gmail-draft/route.ts but lives here
 * so both the lib function and a direct route call produce identical copy.
 */
function buildLeadEmailBody(params: {
  firstName: string
  subjectAddress: string
  signOff: string
  valueLow: number | null
  valueHigh: number | null
  recommendedList: number | null
}): { html: string; text: string } {
  const hasNumbers =
    params.recommendedList != null &&
    params.valueLow != null &&
    params.valueHigh != null

  const numbersHtml = hasNumbers
    ? `<p style="margin:0 0 14px 0;">Here's the short version. Based on what's actually sold near you, your home lands in a range of <strong>${formatPrice(params.valueLow)} to ${formatPrice(params.valueHigh)}</strong>, and I'd price it around <strong>${formatPrice(params.recommendedList)}</strong>.</p>`
    : ''

  const numbersText = hasNumbers
    ? `Here's the short version. Based on what's actually sold near you, your home lands in a range of ${formatPrice(params.valueLow)} to ${formatPrice(params.valueHigh)}, and I'd price it around ${formatPrice(params.recommendedList)}.\n\n`
    : ''

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#102742;max-width:600px;line-height:1.6;">
  <p style="margin:0 0 14px 0;">Hi ${escapeHtml(params.firstName)},</p>
  <p style="margin:0 0 14px 0;">Thanks for reaching out. I put together a full market analysis for <strong>${escapeHtml(params.subjectAddress)}</strong>, and it's attached as a PDF.</p>
  ${numbersHtml}
  <p style="margin:0 0 14px 0;">The report walks through the comparable sales and where the Bend market sits right now. I'm happy to talk it through whenever works for you, no pressure.</p>
  <p style="margin:18px 0 0 0;">${escapeHtml(params.signOff)}<br/>Ryan Realty<br/>541.213.6706</p>
</div>
`.trim()

  const text = `Hi ${params.firstName},

Thanks for reaching out. I put together a full market analysis for ${params.subjectAddress}, and it's attached as a PDF.

${numbersText}The report walks through the comparable sales and where the Bend market sits right now. I'm happy to talk it through whenever works for you, no pressure.

${params.signOff}
Ryan Realty
541.213.6706`

  return { html, text }
}

/**
 * Finalize a built CMA and fire the Gmail draft + Matt notification.
 *
 * The CMA HTML must already exist at `public/cmas/<slug>/cma.html` before
 * calling this — the PDF renderer resolves from there. If the HTML is still
 * in `public/drafts/<slug>/cma.html` the render will succeed but the delivery
 * is technically a draft delivery; log a warning.
 *
 * This function is best-effort: every internal failure is caught, logged, and
 * surfaced in the return value rather than thrown. The caller never needs a
 * try/catch for anything other than truly unexpected catastrophic errors.
 */
export async function finalizeAndDeliverCma(
  params: FinalizeAndDeliverCmaParams,
): Promise<FinalizeAndDeliverCmaResult> {
  const warnings: string[] = []
  const safeSlug = params.slug.trim().toLowerCase()

  // ── 1. Resolve cma row from Supabase ──────────────────────────────────────
  let cma: CmaRow | null = null
  let broker: BrokerRow | null = null
  try {
    const { getCmaBySlug } = await import('@/lib/data')
    cma = ((await getCmaBySlug(safeSlug)) as CmaRow | null) ?? null
  } catch (e) {
    warnings.push(`Supabase cma lookup failed: ${e instanceof Error ? e.message : String(e)}`)
  }

  const subjectAddress =
    cma?.subject_address ?? safeSlug.replace(/^cma-/, '').replace(/-/g, ' ')
  const leadEmail = params.leadEmail ?? cma?.client_email ?? null
  const leadName = params.leadName ?? cma?.client_name ?? null
  const firstName = (leadName ?? '').trim().split(/\s+/)[0] || 'there'
  const brokerSlug = params.brokerSlug ?? cma?.broker_slug ?? null

  if (!leadEmail) {
    return {
      ok: false,
      warnings,
      error:
        'No lead email — public.cmas.client_email is empty and no leadEmail was passed',
    }
  }

  // ── 2. Resolve broker email + name ────────────────────────────────────────
  try {
    const supabase = createServiceClient()
    if (brokerSlug) {
      const { data } = await supabase
        .from('brokers')
        .select('slug, email, display_name')
        .eq('slug', brokerSlug)
        .maybeSingle()
      broker = (data as BrokerRow | null) ?? null
    }
  } catch (e) {
    warnings.push(`Broker lookup failed: ${e instanceof Error ? e.message : String(e)}`)
  }

  const brokerEmail =
    broker?.email && /@ryan-realty\.com$/i.test(broker.email)
      ? broker.email
      : 'matt@ryan-realty.com'
  const signOff = broker?.display_name ?? 'Matt Ryan'

  // ── 3. Render the PDF ─────────────────────────────────────────────────────
  let pdfBuffer: Buffer
  let finalized: boolean
  try {
    const result = await renderCmaPdfBuffer(safeSlug)
    pdfBuffer = result.buffer
    finalized = result.finalized
    if (!finalized) {
      warnings.push(
        `PDF resolved from public/drafts/ (not public/cmas/) — this is a draft-path delivery. Move to public/cmas/ first for a fully finalized delivery.`,
      )
    }
  } catch (e) {
    if (e instanceof CmaNotFoundError) {
      return { ok: false, warnings, error: `CMA HTML not found: ${e.message}` }
    }
    return {
      ok: false,
      warnings,
      error: `PDF render failed: ${e instanceof Error ? e.message : String(e)}`,
    }
  }

  if (pdfBuffer.byteLength > MAX_PDF_BYTES) {
    return {
      ok: false,
      warnings,
      pdfBytes: pdfBuffer.byteLength,
      error: `PDF exceeds 25 MB Gmail-attachment cap (${(pdfBuffer.byteLength / 1024 / 1024).toFixed(2)} MB). Reduce image sizes in the CMA HTML.`,
    }
  }

  // ── 3b. Stamp the now-LIVE CMA link onto the CRM person ───────────────────
  // The page exists at public/cmas/<slug>/cma.html only when finalized === true.
  // Stamping cmaLink here (not at request time) is what releases the sequence
  // engine's %cma_link% hold-gate, so the CMA-link touch sends a real, working
  // URL — never the empty placeholder it used to merge. Best-effort; never fatal.
  let recipientPersonId: number | null = null
  if (finalized && leadEmail) {
    try {
      const sb = createServiceClient()
      const { data: people } = await sb
        .from('crm_people')
        .select('id,custom')
        .contains('emails', [{ value: leadEmail }])
        .limit(1)
      const person = people?.[0]
      if (person) {
        recipientPersonId = person.id as number
        const custom = {
          ...((person.custom as Record<string, unknown>) ?? {}),
          cmaLink: `${SITE_URL}/cmas/${safeSlug}/cma.html`,
          cmaSlug: safeSlug,
        }
        await sb
          .from('crm_people')
          .update({ custom, updated_at: new Date().toISOString() })
          .eq('id', person.id)
      }
    } catch (e) {
      warnings.push(`cmaLink finalize-stamp failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // ── 4. Build the lead email body ──────────────────────────────────────────
  const emailSubject = `Your home value for ${subjectAddress}`
  const built = buildLeadEmailBody({
    firstName,
    subjectAddress,
    signOff,
    valueLow: cma?.value_low ?? null,
    valueHigh: cma?.value_high ?? null,
    recommendedList: cma?.recommended_list ?? null,
  })
  const bodyText = built.text
  // Instrument with the open pixel + click-tracked links so the comms chain
  // records opens/clicks no matter how this is sent (Gmail draft or Resend).
  let bodyHtml = built.html
  if (recipientPersonId) {
    bodyHtml = instrumentEmailHtml(bodyHtml, {
      personId: recipientPersonId,
      emailKey: `cma:${safeSlug}`,
      label: emailSubject,
    })
  }

  // ── 5. Gmail draft (primary path) ─────────────────────────────────────────
  let gmailDraftId: string | undefined
  let fellBackToResend = false

  const draftResult = await createGmailDraft({
    to: leadEmail,
    subject: emailSubject,
    bodyHtml,
    bodyText,
    bcc: FUB_BCC,
    impersonateAs: brokerEmail,
    attachments: [
      {
        filename: `${safeSlug}.pdf`,
        content: pdfBuffer,
        mimeType: 'application/pdf',
      },
    ],
  })

  if (draftResult.ok) {
    gmailDraftId = draftResult.draftId
  } else {
    // Gmail DWD unavailable — fall back to Resend → broker (NOT to the lead).
    // The broker receives the PDF and the failed-draft context so they can
    // forward it manually. This preserves the human-review gate.
    fellBackToResend = true
    warnings.push(
      `Gmail DWD draft failed: ${draftResult.error ?? 'unknown'}${draftResult.hint ? ` — ${draftResult.hint}` : ''}. Falling back to Resend → broker.`,
    )
    try {
      await sendEmail({
        to: brokerEmail,
        subject: `[Action needed] CMA built, Gmail draft failed — ${subjectAddress}`,
        html: `<p>The CMA for <strong>${escapeHtml(subjectAddress)}</strong> is built, but the Gmail draft could not be created (${escapeHtml(draftResult.error ?? 'unknown error')}). The PDF is attached. Review it and send to <strong>${escapeHtml(leadEmail)}</strong> manually.</p>`,
        attachments: [{ filename: `${safeSlug}.pdf`, content: pdfBuffer }],
      })
    } catch (fe) {
      warnings.push(
        `Resend broker fallback also failed: ${fe instanceof Error ? fe.message : String(fe)}`,
      )
    }
  }

  // ── 6. Notify Matt ────────────────────────────────────────────────────────
  const pdfLink = `${SITE_URL}/api/cma/${safeSlug}/pdf`
  const recommendedList = cma?.recommended_list

  const gmailLine = draftResult.ok
    ? `Gmail draft created in ${brokerEmail}'s Drafts (draftId: ${gmailDraftId ?? '—'}). BCC'd ${FUB_BCC} so FUB logs it on send.`
    : `Gmail draft FAILED (${draftResult.error ?? 'unknown error'}). PDF has been emailed directly to ${brokerEmail} via Resend for manual forward.`

  const mattHtml = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.55;color:#102742;max-width:560px;">
  <h2 style="font-size:18px;margin:0 0 8px 0;">CMA ready: ${escapeHtml(subjectAddress)}</h2>
  <table style="width:100%;border-collapse:collapse;font-size:14px;margin:12px 0;">
    <tr><td style="padding:3px 0;color:#5b6473;width:110px;">Lead:</td><td style="padding:3px 0;">${escapeHtml(leadName ?? leadEmail)}</td></tr>
    <tr><td style="padding:3px 0;color:#5b6473;">Email:</td><td style="padding:3px 0;">${escapeHtml(leadEmail)}</td></tr>
    <tr><td style="padding:3px 0;color:#5b6473;">Broker:</td><td style="padding:3px 0;">${escapeHtml(brokerEmail)}</td></tr>
    ${recommendedList != null ? `<tr><td style="padding:3px 0;color:#5b6473;">Rec. list:</td><td style="padding:3px 0;font-weight:600;">${formatPrice(recommendedList)}</td></tr>` : ''}
    ${cma?.value_low != null && cma?.value_high != null ? `<tr><td style="padding:3px 0;color:#5b6473;">Range:</td><td style="padding:3px 0;">${formatPrice(cma.value_low)} to ${formatPrice(cma.value_high)}</td></tr>` : ''}
  </table>
  <p style="margin:8px 0;">${escapeHtml(gmailLine)}</p>
  <p style="margin:12px 0;">
    <a href="${pdfLink}" style="display:inline-block;background:#102742;color:#faf8f4;padding:9px 16px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">View PDF →</a>
  </p>
  <p style="font-size:12px;color:#5b6473;margin-top:16px;">Sent by <code>lib/cma-deliver.ts</code> · finalizeAndDeliverCma()</p>
</div>
`.trim()

  const mattText = [
    `CMA ready: ${subjectAddress}`,
    '',
    `Lead:      ${leadName ?? leadEmail}`,
    `Email:     ${leadEmail}`,
    `Broker:    ${brokerEmail}`,
    recommendedList != null ? `Rec. list: ${formatPrice(recommendedList)}` : null,
    cma?.value_low != null && cma?.value_high != null
      ? `Range:     ${formatPrice(cma.value_low)} to ${formatPrice(cma.value_high)}`
      : null,
    '',
    gmailLine,
    '',
    `PDF: ${pdfLink}`,
  ]
    .filter((l) => l !== null)
    .join('\n')

  let mattNotified = false
  try {
    const mattResult = await sendEmail({
      to: MATT_ALERT_EMAIL,
      from: ALERT_FROM,
      subject: `CMA ready for review: ${safeSlug}`,
      html: mattHtml,
      text: mattText,
    })
    if (!mattResult.error) {
      mattNotified = true
    } else {
      warnings.push(`Matt notification failed: ${mattResult.error}`)
    }
  } catch (e) {
    warnings.push(
      `Matt notification threw: ${e instanceof Error ? e.message : String(e)}`,
    )
  }

  return {
    ok: true,
    gmailDraftId: gmailDraftId ?? undefined,
    fellBackToResend,
    mattNotified,
    pdfBytes: pdfBuffer.byteLength,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}
