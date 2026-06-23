import { NextRequest, NextResponse } from 'next/server'
import { recordNewsletterEvent } from '@/lib/data'
import { getPersonIdsByEmail } from '@/lib/data/crm/getPersonIdsByEmail'
import { addSuppression } from '@/lib/crm/suppressions'
import { verifySvixSignature, isFreshTimestamp, classifyResendEvent } from '@/lib/crm/resend-webhook'

/**
 * Resend webhook: delivered, opened, clicked, bounced, complained, unsubscribed.
 *
 * (1) Verify the Svix signature properly (HMAC, not the old string-compare that
 *     rejected every real event). (2) Record the event against newsletter_recipients
 *     for the per-broker delivery/open/click stats. (3) On a HARD bounce or a
 *     complaint, suppress the EMAIL channel for the recipient across all sibling
 *     crm_people rows — so we stop emailing a dead/complaining address (CAN-SPAM +
 *     sender reputation). Writing a suppression only ever STOPS sends, never enables.
 */
export async function POST(request: NextRequest) {
  const raw = await request.text()
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim()
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production'

  if (!secret) {
    if (isProd) {
      console.error('[resend-webhook] RESEND_WEBHOOK_SECRET not set in production — rejecting')
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
    }
    console.warn('[resend-webhook] RESEND_WEBHOOK_SECRET not set — allowing in dev')
  } else {
    const svixId = request.headers.get('svix-id') ?? ''
    const svixTimestamp = request.headers.get('svix-timestamp') ?? ''
    const signatureHeader = request.headers.get('svix-signature') ?? ''
    const ok =
      verifySvixSignature({ secret, svixId, svixTimestamp, signatureHeader, body: raw }) &&
      isFreshTimestamp(svixTimestamp, Date.now())
    if (!ok) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  }

  let payload: Parameters<typeof classifyResendEvent>[0]
  try {
    payload = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const event = classifyResendEvent(payload)
  const emailId = payload.data?.email_id

  // Newsletter stats (existing behavior).
  if (event.type && emailId) {
    await recordNewsletterEvent({
      resendMessageId: emailId,
      type: event.type,
      url: event.clickUrl,
      isoTs: event.isoTs,
    })
  }

  // CRM suppression on hard bounce / complaint.
  if (event.suppressEmail && event.suppressReason) {
    for (const email of event.recipients) {
      const personIds = await getPersonIdsByEmail(email)
      for (const personId of personIds) {
        await addSuppression({
          personId,
          channel: 'email',
          reason: event.suppressReason,
          source: 'resend-webhook',
          value: email,
        })
      }
    }
  }

  return NextResponse.json({ ok: true })
}
