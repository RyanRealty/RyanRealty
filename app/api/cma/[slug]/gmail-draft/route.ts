import { NextResponse } from 'next/server'
import { renderCmaPdfBuffer, CmaNotFoundError } from '@/lib/cma-pdf'
import { createGmailDraft } from '@/lib/gmail-draft'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * POST /api/cma/[slug]/gmail-draft
 *
 * Renders the finalized CMA to PDF and creates a DRAFT in the signing broker's
 * Gmail (default matt@ryan-realty.com) addressed to the lead, with the PDF
 * attached and the FUB email-logging address BCC'd. The broker reviews the draft
 * in Gmail and sends it personally — so a human signs off on the one document
 * (real pricing numbers, CLAUDE.md §0) that most affects winning the listing, and
 * FUB logs the email under the lead the moment it's sent.
 *
 * Mirrors /api/cma/[slug]/email (the Resend path) but produces a reviewable draft
 * instead of an auto-send. Falls back gracefully (ok:false) if the Gmail scope is
 * unavailable, so callers can use the Resend path instead.
 *
 * Body: { to?, subject?, impersonateAs? } — all optional; defaults pulled from public.cmas.
 */

const FUB_BCC = process.env.FUB_BCC_ADDRESS?.trim() || 'ryan.realty@followupboss.me'

interface DraftPayload {
  to?: string
  subject?: string
  impersonateAs?: string
}

interface CmaRow {
  subject_address: string
  client_name: string | null
  client_email: string | null
  broker_slug: string | null
  recommended_list: number | null
  value_low: number | null
  value_high: number | null
}

function formatPrice(n: number | null | undefined): string {
  return n == null
    ? ''
    : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

async function handleDraft(slug: string, body: DraftPayload) {
  const safeSlug = String(slug ?? '').trim().toLowerCase()
  if (!/^[a-z0-9-]+$/.test(safeSlug)) {
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 })
  }

  let cma: CmaRow | null = null
  let brokerEmail: string | null = null
  let brokerName: string | null = null
  try {
    const supabase = createServiceClient()
    const { getCmaBySlug } = await import('@/lib/data')
    cma = ((await getCmaBySlug(safeSlug)) as CmaRow | null) ?? null
    if (cma?.broker_slug) {
      const { data: broker } = await supabase
        .from('brokers')
        .select('email, display_name')
        .eq('slug', cma.broker_slug)
        .maybeSingle()
      brokerEmail = (broker as { email?: string | null })?.email ?? null
      brokerName = (broker as { display_name?: string | null })?.display_name ?? null
    }
  } catch (e) {
    console.warn('[cma-gmail-draft] Supabase lookup failed', e instanceof Error ? e.message : e)
  }

  const subjectAddress = cma?.subject_address ?? safeSlug.replace(/^cma-/, '').replace(/-/g, ' ')
  const firstName = (cma?.client_name ?? '').trim().split(/\s+/)[0] || 'there'

  // Recipient is the LEAD. The draft lands in the broker's Drafts for review.
  const to = body.to ?? cma?.client_email ?? null
  if (!to) {
    return NextResponse.json(
      { error: 'No lead recipient — public.cmas.client_email is empty and no `to` was passed' },
      { status: 400 },
    )
  }

  // Impersonate the signing broker if they're on the ryan-realty.com domain
  // (DWD covers all domain users); otherwise fall back to Matt per the
  // all-leads-to-Matt routing directive.
  const impersonateAs =
    body.impersonateAs?.trim() ||
    (brokerEmail && /@ryan-realty\.com$/i.test(brokerEmail) ? brokerEmail : 'matt@ryan-realty.com')

  const subject = body.subject ?? `Your home value for ${subjectAddress}`
  const signOff = brokerName ?? 'Matt Ryan'

  const hasNumbers = cma?.recommended_list != null && cma?.value_low != null && cma?.value_high != null
  const numbersHtml = hasNumbers
    ? `<p style="margin:0 0 14px 0;">Here's the short version. Based on what's actually sold near you, your home lands in a range of <strong>${formatPrice(cma!.value_low)} to ${formatPrice(cma!.value_high)}</strong>, and I'd price it around <strong>${formatPrice(cma!.recommended_list)}</strong>.</p>`
    : ''
  const numbersText = hasNumbers
    ? `Here's the short version. Based on what's actually sold near you, your home lands in a range of ${formatPrice(cma!.value_low)} to ${formatPrice(cma!.value_high)}, and I'd price it around ${formatPrice(cma!.recommended_list)}.\n\n`
    : ''

  const bodyHtml = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#102742;max-width:600px;line-height:1.6;">
      <p style="margin:0 0 14px 0;">Hi ${firstName},</p>
      <p style="margin:0 0 14px 0;">Thanks for reaching out. I put together a full market analysis for <strong>${subjectAddress}</strong>, and it's attached as a PDF.</p>
      ${numbersHtml}
      <p style="margin:0 0 14px 0;">The report walks through the comparable sales and where the Bend market sits right now. I'm happy to talk it through whenever works for you, no pressure.</p>
      <p style="margin:18px 0 0 0;">${signOff}<br/>Ryan Realty<br/>541.213.6706</p>
    </div>
  `.trim()

  const bodyText = `Hi ${firstName},

Thanks for reaching out. I put together a full market analysis for ${subjectAddress}, and it's attached as a PDF.

${numbersText}The report walks through the comparable sales and where the Bend market sits right now. I'm happy to talk it through whenever works for you, no pressure.

${signOff}
Ryan Realty
541.213.6706`

  try {
    const { buffer } = await renderCmaPdfBuffer(safeSlug)
    const MAX_PDF_BYTES = 25 * 1024 * 1024
    if (buffer.byteLength > MAX_PDF_BYTES) {
      return NextResponse.json(
        { error: 'PDF exceeds 25 MB Gmail-attachment cap', bytes: buffer.byteLength },
        { status: 413 },
      )
    }

    const res = await createGmailDraft({
      to: String(to),
      subject,
      bodyHtml,
      bodyText,
      bcc: FUB_BCC,
      impersonateAs,
      attachments: [{ filename: `${safeSlug}.pdf`, content: buffer, mimeType: 'application/pdf' }],
    })

    if (!res.ok) {
      return NextResponse.json(
        { error: 'Gmail draft creation failed', detail: res.error, hint: res.hint },
        { status: 502 },
      )
    }

    return NextResponse.json({
      ok: true,
      draft_id: res.draftId,
      to,
      impersonate_as: impersonateAs,
      bcc: FUB_BCC,
      subject,
      pdf_bytes: buffer.byteLength,
    })
  } catch (err) {
    if (err instanceof CmaNotFoundError) {
      return NextResponse.json({ error: err.message, looked_at: err.looked_at }, { status: 404 })
    }
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'CMA Gmail draft failed', detail: msg.slice(0, 500) }, { status: 500 })
  }
}

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params
  let body: DraftPayload = {}
  try {
    body = await request.json()
  } catch {
    // empty body is fine — defaults come from public.cmas
  }
  return handleDraft(slug, body)
}

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params
  const sp = new URL(request.url).searchParams
  return handleDraft(slug, {
    to: sp.get('to') ?? undefined,
    subject: sp.get('subject') ?? undefined,
    impersonateAs: sp.get('impersonateAs') ?? undefined,
  })
}
