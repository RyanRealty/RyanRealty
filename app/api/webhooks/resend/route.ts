import { NextRequest, NextResponse } from 'next/server'
import { recordNewsletterEvent } from '@/lib/data'
import { getPersonIdsByEmail } from '@/lib/data/crm/getPersonIdsByEmail'
import { addSuppression } from '@/lib/crm/suppressions'
import { createServiceClient } from '@/lib/supabase/service'
import { recordEmailEvent } from '@/lib/crm/email-events'
import { verifySvixSignature, isFreshTimestamp, classifyResendEvent, type ResendEventType } from '@/lib/crm/resend-webhook'

/** Resend event type -> crm_timeline kind. The lead page renders these on the
 *  conversation + engagement panel; without them email opens/clicks/bounces were
 *  invisible to the broker. */
const TIMELINE_KIND: Record<ResendEventType, string> = {
  delivered: 'email_delivered',
  opened: 'email_open',
  clicked: 'email_click',
  bounced: 'email_bounce',
  complained: 'email_complaint',
}
const TIMELINE_TITLE: Record<ResendEventType, string> = {
  delivered: 'Email delivered',
  opened: 'Email opened',
  clicked: 'Email link clicked',
  bounced: 'Email bounced',
  complained: 'Spam complaint',
}

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

  // Mirror the event onto each matched contact's conversation timeline so the
  // broker sees email engagement (opened/clicked/bounced/complained). Deduped
  // per (emailId, type, person[, url]) so an email shows "opened" once, not 50×.
  // The subject is stamped as payload.label so the lead page attributes the
  // open/click to the right sent email.
  if (event.type && emailId) {
    const kind = TIMELINE_KIND[event.type]
    const subject = typeof (payload.data as { subject?: unknown } | undefined)?.subject === 'string'
      ? (payload.data as { subject?: string }).subject ?? null
      : null
    const sb = createServiceClient()
    for (const email of event.recipients) {
      // Unified email_events store (Wave 1): one idempotent, normalized row per
      // lifecycle event — the single source of truth for all email reporting.
      // recordEmailEvent resolves the person + dedupes on (messageId+event+email).
      await recordEmailEvent({
        messageId: emailId,
        recipientEmail: email,
        sendType: 'other',
        event: payload.type ?? event.type,
        subject,
        occurredAt: event.isoTs,
        meta: event.clickUrl ? { clickUrl: event.clickUrl } : undefined,
      })
      const personIds = await getPersonIdsByEmail(email)
      for (const personId of personIds) {
        const urlKey = event.clickUrl ? `:${event.clickUrl.slice(0, 80)}` : ''
        await sb.from('crm_timeline').upsert(
          {
            person_id: personId,
            kind,
            title: TIMELINE_TITLE[event.type],
            source: 'resend',
            payload: { emailId, email, label: subject, url: event.clickUrl ?? null },
            dedupe_key: `resend:${emailId}:${event.type}${urlKey}:p${personId}`,
          },
          { onConflict: 'dedupe_key', ignoreDuplicates: true },
        )
      }
    }
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
