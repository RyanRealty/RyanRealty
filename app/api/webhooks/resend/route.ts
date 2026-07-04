import { NextRequest, NextResponse } from 'next/server'
import { recordNewsletterEvent, setSubscriberStatusByEmail } from '@/lib/data'
import { getRecipientByMessageId, recordLedgerEvent, ledgerEventFor } from '@/lib/data/newsletter/queue'
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
  unsubscribed: 'email_unsubscribe',
}
const TIMELINE_TITLE: Record<ResendEventType, string> = {
  delivered: 'Email delivered',
  opened: 'Email opened',
  clicked: 'Email link clicked',
  bounced: 'Email bounced',
  complained: 'Spam complaint',
  unsubscribed: 'Unsubscribed',
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

  if (!secret) {
    // Fail CLOSED everywhere, not just in prod. The old dev-allow branch let a
    // preview/staging deploy missing the secret accept a FORGED bounce/complaint
    // event, which silently suppresses a real client's email (or writes fake
    // engagement). A webhook that cannot verify must reject — set the secret to
    // test locally.
    console.error('[resend-webhook] RESEND_WEBHOOK_SECRET not set — rejecting (fail closed)')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
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

  // Resolve the newsletter recipient (broker + subscriber + newsletter) from the
  // Resend message id — powers per-broker analytics (H1) AND the engagement ledger.
  const recipient = emailId ? await getRecipientByMessageId(emailId) : null
  const eventBroker = recipient?.broker ?? null

  // T-8: Resend's native one-click unsubscribe. Flip the subscriber to
  // unsubscribed + log it — it's a status change, not an engagement event, so it
  // does NOT run through the stats/ledger/timeline-engagement paths below.
  if (event.type === 'unsubscribed') {
    const sb = createServiceClient()
    for (const email of event.recipients) {
      await setSubscriberStatusByEmail(email, 'unsubscribed')
      for (const personId of await getPersonIdsByEmail(email)) {
        await sb.from('crm_timeline').upsert(
          {
            person_id: personId,
            kind: TIMELINE_KIND.unsubscribed,
            title: TIMELINE_TITLE.unsubscribed,
            source: 'resend',
            broker: eventBroker,
            payload: { emailId, email },
            dedupe_key: `resend:${emailId}:unsubscribed:p${personId}`,
          },
          { onConflict: 'dedupe_key', ignoreDuplicates: true },
        )
      }
    }
    return NextResponse.json({ ok: true, unsubscribed: event.recipients.length })
  }

  // Append the deduped engagement ledger row (spec §3.1) — the source of truth for
  // open/click counts, recipient-scoped so a webhook redelivery can't inflate it.
  if (event.type && emailId && recipient) {
    const le = ledgerEventFor(event.type)
    if (le) {
      await recordLedgerEvent({
        newsletterId: recipient.newsletter_id,
        subscriberId: recipient.subscriber_id,
        email: recipient.email,
        resendMessageId: emailId,
        broker: eventBroker,
        event: le,
        url: event.clickUrl,
        occurredAt: event.isoTs,
      })
    }
  }

  // Newsletter stats (legacy recipient-row counters — kept for back-compat; the
  // ledger above is the deduped source of truth the admin reads).
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
        broker: eventBroker, // H1: per-broker engagement analytics
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
            broker: eventBroker, // H1: the broker sees this engagement on their timeline
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
    const subStatus = event.type === 'complained' ? 'complained' : 'bounced'
    for (const email of event.recipients) {
      // Keep the subscriber row honest (suppression already stops sends).
      await setSubscriberStatusByEmail(email, subStatus)
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
