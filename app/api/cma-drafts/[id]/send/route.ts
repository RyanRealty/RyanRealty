/**
 * Send the drafted CMA email to the lead.
 *
 * POST /api/cma-drafts/<id>/send
 *   body: { token: string }
 *
 * Verifies the HMAC token, pulls the drafted email + signed PDF URL from
 * Supabase Storage, sends via Resend with the PDF attached, then writes a
 * FUB Note recording the comms. Marks the cma_deliveries row 'sent'.
 *
 * Idempotent: a row already in 'sent' returns { ok: true } without resending.
 */

import { NextResponse } from 'next/server'

import { createServiceClient } from '@/lib/supabase/service'
import { sendEmail } from '@/lib/resend'
import { addPersonNote } from '@/lib/followupboss'
import { verifyDeliveryToken } from '@/lib/cma-delivery-tokens'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STORAGE_BUCKET = 'cma-deliveries'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  let body: { token?: string } = {}
  try {
    body = (await req.json()) as { token?: string }
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const verification = verifyDeliveryToken(id, body.token ?? null)
  if (!verification.ok) {
    return NextResponse.json(
      { error: `token ${verification.reason}` },
      { status: 401 }
    )
  }

  const sb = createServiceClient()
  const { data: row, error } = await sb
    .from('cma_deliveries')
    .select(
      'id, status, lead_email, lead_name, raw_address, fub_person_id, pdf_storage_path, email_subject, email_body_html, email_body_text, assigned_broker_email, assigned_broker_name, cma_estimated_value'
    )
    .eq('id', id)
    .maybeSingle()
  if (error || !row) {
    return NextResponse.json(
      { error: 'delivery not found' },
      { status: 404 }
    )
  }

  if (row.status === 'sent') {
    return NextResponse.json({ ok: true, already_sent: true })
  }
  if (row.status !== 'ready') {
    return NextResponse.json(
      { error: `delivery not ready (status: ${row.status})` },
      { status: 409 }
    )
  }
  if (!row.email_body_html || !row.email_subject || !row.pdf_storage_path) {
    return NextResponse.json(
      { error: 'delivery missing drafted email or PDF' },
      { status: 422 }
    )
  }

  // Pull the PDF buffer from Storage to attach to the email.
  const { data: pdfBlob, error: dlError } = await sb.storage
    .from(STORAGE_BUCKET)
    .download(row.pdf_storage_path as string)
  if (dlError || !pdfBlob) {
    return NextResponse.json(
      { error: `PDF download failed: ${dlError?.message ?? 'no data'}` },
      { status: 500 }
    )
  }
  const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer())

  // Send.
  const result = await sendEmail({
    to: row.lead_email as string,
    subject: row.email_subject as string,
    html: row.email_body_html as string,
    text: (row.email_body_text as string) ?? undefined,
    replyTo:
      (row.assigned_broker_email as string | null) ?? 'matt@ryan-realty.com',
    attachments: [
      { filename: 'home-valuation.pdf', content: pdfBuffer },
    ],
  })
  if (result.error) {
    return NextResponse.json(
      { error: `email send failed: ${result.error}` },
      { status: 500 }
    )
  }

  // Mark sent.
  const sentAt = new Date().toISOString()
  await sb
    .from('cma_deliveries')
    .update({
      status: 'sent',
      sent_email_resend_id: result.id ?? null,
      sent_at: sentAt,
    })
    .eq('id', id)

  // FUB note (best-effort; don't fail the send if FUB hiccups).
  const personId = row.fub_person_id as number | null
  if (personId) {
    const v = row.cma_estimated_value as number | null
    const valueText =
      typeof v === 'number' && v > 0
        ? v.toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0,
          })
        : '—'
    const noteBody = [
      `Auto-CMA sent to ${row.lead_email}.`,
      `Address: ${row.raw_address}`,
      `Estimated value: ${valueText}`,
      `Email subject: ${row.email_subject}`,
      `Sent by: ${row.assigned_broker_name ?? 'Ryan Realty'}`,
      `Delivery id: ${id}`,
    ].join('\n')
    void addPersonNote(personId, noteBody).catch((e) => {
      console.warn('[cma-send] FUB note failed:', e)
    })
  }

  return NextResponse.json({ ok: true, sent_at: sentAt, resend_id: result.id })
}
