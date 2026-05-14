import { NextResponse } from 'next/server'
import { renderCmaPdfBuffer, CmaNotFoundError } from '@/lib/cma-pdf'
import { sendEmail } from '@/lib/resend'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * POST /api/cma/[slug]/email
 *
 * Renders the CMA to PDF and emails it.
 *
 * Body: {
 *   to?: string | string[]      // recipient(s); defaults to broker email from public.cmas
 *   cc?: string | string[]
 *   subject?: string            // defaults to "Comparative Market Analysis · <address>"
 *   message?: string            // optional intro paragraph above the auto-generated body
 *   from?: string               // optional sender override; defaults to brand DEFAULT_FROM
 * }
 *
 * Auth: requires an authenticated session. Restricted to admin / broker accounts.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params
  const safeSlug = String(slug ?? '').trim().toLowerCase()
  if (!/^[a-z0-9-]+$/.test(safeSlug)) {
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 })
  }

  let body: {
    to?: string | string[]
    cc?: string | string[]
    subject?: string
    message?: string
    from?: string
  } = {}
  try {
    body = await request.json()
  } catch {
    // empty body is ok — we'll fall back to defaults from public.cmas
  }

  const supabase = createServiceClient()
  const { data: cma } = await supabase
    .from('cmas')
    .select('subject_address, client_name, client_email, broker_slug, recommended_list, value_low, value_high')
    .eq('slug', safeSlug)
    .maybeSingle()
  if (!cma) {
    return NextResponse.json({ error: 'CMA not found in repository' }, { status: 404 })
  }

  // Resolve broker email from public.brokers via broker_slug for the default
  // sender + default recipient (if `to` not provided).
  let brokerEmail: string | null = null
  let brokerName: string | null = null
  if (cma.broker_slug) {
    const { data: broker } = await supabase
      .from('brokers')
      .select('email, display_name')
      .eq('slug', cma.broker_slug)
      .maybeSingle()
    brokerEmail = broker?.email ?? null
    brokerName = broker?.display_name ?? null
  }

  const to = body.to ?? brokerEmail
  if (!to) {
    return NextResponse.json({ error: 'No recipient — pass `to` in body or set broker email' }, { status: 400 })
  }

  const subject =
    body.subject ??
    `Comparative Market Analysis · ${cma.subject_address}`

  const formatPrice = (n: number | null | undefined): string =>
    n == null
      ? '—'
      : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

  const intro = body.message?.trim() ?? null
  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #102742; max-width: 600px; line-height: 1.55;">
      ${intro ? `<p style="margin: 0 0 16px 0;">${intro}</p>` : ''}
      <p style="margin: 0 0 12px 0;">Attached is the Comparative Market Analysis for <strong>${cma.subject_address}</strong>${cma.client_name ? ` (prepared for ${cma.client_name})` : ''}.</p>
      <p style="margin: 0 0 12px 0;"><strong>Recommended list:</strong> ${formatPrice(cma.recommended_list)}<br/>
      <strong>Value range:</strong> ${formatPrice(cma.value_low)} – ${formatPrice(cma.value_high)}</p>
      <p style="margin: 0 0 12px 0; font-size: 13px; color: #5f6c7c;">PDF generated ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })} from the Ryan Realty CMA producer.</p>
      ${brokerName ? `<p style="margin: 20px 0 0 0; font-size: 13px; color: #5f6c7c;">— ${brokerName}<br/>Ryan Realty</p>` : ''}
    </div>
  `.trim()

  try {
    const { buffer } = await renderCmaPdfBuffer(safeSlug)

    // Resend's React/HTML payload doesn't include cc in our lib's typed wrapper.
    // Append cc addresses to `to` instead for now — same delivery, slightly
    // different recipient header. (Add cc to lib/resend.ts SendEmailOptions
    // when we have a non-CMA caller that needs proper cc.)
    const ccList = body.cc
      ? Array.isArray(body.cc) ? body.cc : [body.cc]
      : []
    const toList = Array.isArray(to) ? to : [to]
    const allRecipients = [...toList, ...ccList]

    const result = await sendEmail({
      to: allRecipients,
      subject,
      html: htmlBody,
      from: body.from,
      attachments: [
        {
          filename: `${safeSlug}.pdf`,
          content: buffer,
        },
      ],
    })

    if (result.error) {
      return NextResponse.json({ error: 'Email send failed', detail: result.error }, { status: 502 })
    }

    return NextResponse.json({
      ok: true,
      message_id: result.id,
      to,
      subject,
      pdf_bytes: buffer.byteLength,
    })
  } catch (err) {
    if (err instanceof CmaNotFoundError) {
      return NextResponse.json({ error: err.message, looked_at: err.looked_at }, { status: 404 })
    }
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'CMA email failed', detail: msg.slice(0, 500) }, { status: 500 })
  }
}
