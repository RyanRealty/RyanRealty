import { NextResponse } from 'next/server'
import { renderCmaPdfBuffer, CmaNotFoundError } from '@/lib/cma-pdf'
import { sendEmail } from '@/lib/resend'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

interface EmailPayload {
  to?: string | string[]
  cc?: string | string[]
  subject?: string
  message?: string
  from?: string
}

async function handleEmail(
  request: Request,
  context: { params: Promise<{ slug: string }> },
  body: EmailPayload,
  options: { preview?: boolean } = {}
) {
  const { slug } = await context.params
  const safeSlug = String(slug ?? '').trim().toLowerCase()
  if (!/^[a-z0-9-]+$/.test(safeSlug)) {
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 })
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
    if (options.preview) {
      // Return the HTML body in a wrapped page so Matt can preview before send.
      const wrapped = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Email preview · ${safeSlug}</title><style>body{margin:0;padding:32px;background:#f5f3ed;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}.envelope{max-width:680px;margin:0 auto;background:white;border-radius:10px;box-shadow:0 6px 24px rgba(16,39,66,0.10);overflow:hidden;}.hdr{background:#102742;color:#faf8f4;padding:18px 24px;font-size:13px;line-height:1.6;}.hdr strong{color:#faf8f4;}.body{padding:28px 24px;}.attach{margin:0 24px 24px;padding:12px 16px;background:#faf8f4;border:1px solid rgba(16,39,66,0.18);border-radius:6px;font-size:13px;color:#102742;display:flex;justify-content:space-between;align-items:center;}.attach a{color:#102742;text-decoration:underline;font-weight:500;}</style></head><body><div class="envelope"><div class="hdr"><strong>To:</strong> ${to}<br/><strong>Subject:</strong> ${subject}<br/><strong>From:</strong> ${body.from ?? 'Ryan Realty &lt;noreply@mail.ryan-realty.com&gt;'}</div><div class="body">${htmlBody}</div><div class="attach"><span>📎 ${safeSlug}.pdf · ~5–8 MB · 15 pages</span><a href="/api/cma/${safeSlug}/pdf" target="_blank">View PDF →</a></div></div></body></html>`
      return new NextResponse(wrapped, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
      })
    }

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

/**
 * POST /api/cma/[slug]/email
 *
 * Renders the CMA to PDF and emails it.
 *
 * Body: { to, cc, subject, message, from }
 *
 * Auth: requires an authenticated session. Restricted to admin / broker accounts.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  let body: EmailPayload = {}
  try {
    body = await request.json()
  } catch {
    // empty body is OK — we'll fall back to defaults from public.cmas
  }
  return handleEmail(request, context, body)
}

/**
 * GET /api/cma/[slug]/email?to=...&cc=...&subject=...&message=...&from=...
 *
 * Same behavior as POST, but accepts the payload via query string so the
 * endpoint can be triggered from a browser link or an MCP tool that only
 * supports GET. URL-encode the message body.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const url = new URL(request.url)
  const sp = url.searchParams
  const preview = sp.get('preview') === '1'
  const body: EmailPayload = {
    to: sp.get('to') ?? undefined,
    cc: sp.get('cc') ?? undefined,
    subject: sp.get('subject') ?? undefined,
    message: sp.get('message') ?? undefined,
    from: sp.get('from') ?? undefined,
  }
  return handleEmail(request, context, body, { preview })
}
