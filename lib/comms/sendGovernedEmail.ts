/**
 * sendGovernedEmail — the single compliance + persistence chokepoint for an
 * outbound email to a CRM person (admin rebuild §A4).
 *
 * Guard order (each stage unreachable when an earlier one refuses):
 *   hard-stop tags → channel suppression (fail closed) → idempotency →
 *   rail send → crm_timeline + conversation shadow-write.
 *
 * Two rails, both pre-existing:
 *   - 'gmail'  — sendCrmEmail via the broker's own mailbox (DWD). 1:1 broker
 *     sends. Extracted verbatim from sendCrmEmailAction's performSend
 *     (app/actions/crm.ts, 2026-07-21) — timeline rows are byte-identical.
 *   - 'resend' — prepareDeliverableEmail (CAN-SPAM footer, List-Unsubscribe,
 *     deliverability report) + lib/resend sendEmail. Automated/deliverable
 *     sends by system initiators.
 *
 * Recipient RESOLUTION (To/Cc/Bcc sweep, resolveEmailRecipients) stays with
 * the conversation layer — per §A4 it resolves participants, then calls this
 * per send. This layer re-checks the primary person's consent record itself,
 * fail-closed, so no caller can reach a provider unchecked.
 */

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { withSendIdempotency } from '@/lib/crm/idempotency'
import { isSuppressed } from '@/lib/crm/suppressions'
import { CRM_MAILBOXES, sendCrmEmail } from '@/lib/crm/gmail'
import { recordConversationMessage } from '@/lib/crm/record-message'
import { prepareDeliverableEmail } from '@/lib/email/prepare'
import { sendEmail } from '@/lib/resend'
import { checkSendGuards } from './guards'
import { recordEmailEvent, sendTypeFromEmailKey } from '@/lib/crm/email-events'
import type {
  GovernedEmailRequest,
  GovernedEmailResult,
  GovernedGmailPayload,
  GovernedResendPayload,
} from './types'

async function recordSentEvents(
  req: GovernedEmailRequest,
  providerId: string | undefined,
): Promise<void> {
  if (req.recordSentEvent === false || !providerId) return
  try {
    const broker = req.initiator.broker ?? null
    if (req.payload.rail === 'gmail') {
      const payload = req.payload
      const sendType = sendTypeFromEmailKey(payload.track?.emailKey)
      const emails = [...payload.to, ...(payload.cc ?? []), ...(payload.bcc ?? [])]
      const seen = new Set<string>()
      for (const raw of emails) {
        const email = raw.trim().toLowerCase()
        if (!email || seen.has(email)) continue
        seen.add(email)
        await recordEmailEvent({
          messageId: providerId,
          recipientEmail: email,
          personId: email === (payload.to[0] ?? '').trim().toLowerCase() ? req.personId : null,
          broker,
          sendType,
          event: 'sent',
          emailKey: payload.track?.emailKey ?? null,
          subject: payload.subject,
        })
      }
      return
    }
    await recordEmailEvent({
      messageId: providerId,
      recipientEmail: req.payload.to,
      personId: req.personId,
      broker,
      sendType: 'other',
      event: 'sent',
      subject: req.payload.subject,
    })
  } catch (e) {
    console.warn('[comms] email_events sent write failed', e)
  }
}

async function sendViaGmail(
  req: GovernedEmailRequest,
  payload: GovernedGmailPayload,
): Promise<GovernedEmailResult> {
  const actingSlug = req.initiator.broker ?? 'matt'
  const mailbox = CRM_MAILBOXES.find((m) => m.slug === actingSlug) ?? CRM_MAILBOXES[0]
  const sent = await sendCrmEmail({
    fromMailbox: mailbox.email, to: payload.to, cc: payload.cc, bcc: payload.bcc,
    subject: payload.subject, bodyText: payload.bodyText,
    withSignature: payload.withSignature ?? true,
    attachments: payload.attachments, bodyFormat: payload.bodyFormat,
    track: payload.track,
  })
  if (!sent.ok) return { ok: false, error: sent.error, stage: 'provider' }

  // Timeline: the primary contact always gets the row; every OTHER recipient
  // that is a CRM contact (spouse on Cc, co-buyer on To) gets one too, so the
  // send shows in each of their conversation threads.
  const extraPersonIds = payload.extraPersonIds ?? []
  const timelinePayload = {
    gmailId: sent.gmailId,
    to: payload.to.length === 1 ? payload.to[0] : payload.to,
    mailbox: mailbox.email,
    ...(payload.cc?.length ? { cc: payload.cc } : {}),
    ...(payload.bcc?.length ? { bcc: payload.bcc } : {}),
    // Storage-backed refs so the thread renders the sent files forever
    // (served by /api/admin/crm/attachment).
    ...(payload.attachmentRefs?.length ? { attachments: payload.attachmentRefs } : {}),
  }
  const sb = createServiceClient()
  await sb.from('crm_timeline').insert(
    [req.personId, ...extraPersonIds].map((pid) => ({
      person_id: pid, kind: 'email_out', title: payload.subject, body: sent.plainBody,
      payload: timelinePayload,
      broker: mailbox.slug, source: 'app', dedupe_key: `gmail:${sent.gmailId}:p${pid}`,
    })),
  )
  // Shadow-write into the conversation model (RC1) on the primary contact's
  // thread, channel=email. Non-fatal. (Cc/Bcc-as-group email threading is a
  // follow-up refinement — the timeline still logs each recipient.)
  try {
    await recordConversationMessage({
      sb, direction: 'out', channel: 'email', body: sent.plainBody, subject: payload.subject,
      providerSid: sent.gmailId, sentBy: mailbox.slug, primaryPersonId: req.personId,
      assignedBroker: mailbox.slug,
      participants: [
        { personId: req.personId, address: payload.to[0] ?? payload.primaryAddress ?? String(req.personId) },
      ],
    })
  } catch (e) { console.warn('[comms] conversation shadow-write (email) failed', e) }
  await recordSentEvents(req, sent.gmailId)
  return { ok: true, providerId: sent.gmailId }
}

async function sendViaResend(
  req: GovernedEmailRequest,
  payload: GovernedResendPayload,
): Promise<GovernedEmailResult> {
  // Belt-and-suspenders: re-check the consent record in the SAME function as
  // the provider call (sendGovernedEmail already ran the full guard sequence
  // at entry). Fail closed — also what ci:email-send-gated asserts statically.
  const gate = await isSuppressed(req.personId, 'email')
  if (gate.suppressed) {
    return { ok: false, error: `Blocked by suppression (${gate.reasons.join(', ')})`, stage: 'suppression' }
  }

  // Inbox-placement preflight — CAN-SPAM footer + postal address, RFC 8058
  // one-click unsubscribe headers, deliverability report. The one rail every
  // automated email must ride (lib/email/prepare contract).
  const prepared = prepareDeliverableEmail({
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
    personId: req.personId,
    unsubscribeUrl: payload.unsubscribeUrl,
  })
  const res = await sendEmail({
    to: payload.to,
    subject: prepared.subject,
    html: prepared.html,
    text: prepared.text,
    headers: prepared.headers,
    from: payload.from,
    replyTo: payload.replyTo,
    attachments: payload.attachments,
  })
  if (res.error || !res.id) {
    return { ok: false, error: res.error ?? 'Email send failed', stage: 'provider' }
  }

  const sb = createServiceClient()
  await sb.from('crm_timeline').insert({
    person_id: req.personId, kind: 'email_out',
    title: payload.timelineTitle ?? payload.subject, body: prepared.text,
    payload: { resendId: res.id, to: payload.to, purpose: req.purpose },
    broker: req.initiator.broker ?? null,
    source: req.initiator.kind === 'system' ? 'automation' : 'app',
    dedupe_key: `resend:${res.id}:p${req.personId}`,
  })
  void import('@/lib/crm/first-broker-action')
    .then(({ stampFirstBrokerActionIfEmpty }) =>
      stampFirstBrokerActionIfEmpty(sb, req.personId, {
        kind: 'email_out',
        broker: req.initiator.broker ?? null,
      }),
    )
    .catch(() => {})
  try {
    await recordConversationMessage({
      sb, direction: 'out', channel: 'email', body: prepared.text, subject: payload.subject,
      providerSid: res.id, sentBy: req.initiator.broker ?? null, primaryPersonId: req.personId,
      assignedBroker: req.initiator.broker ?? null,
      participants: [{ personId: req.personId, address: payload.to }],
    })
  } catch (e) { console.warn('[comms] conversation shadow-write (resend email) failed', e) }
  await recordSentEvents(req, res.id)
  return { ok: true, providerId: res.id }
}

export async function sendGovernedEmail(req: GovernedEmailRequest): Promise<GovernedEmailResult> {
  // Stages 1–2: hard-stop → channel suppression, fail closed. A refused person
  // never reaches the idempotency ledger or a provider.
  const refused = await checkSendGuards(req.personId, 'email')
  if (refused) return refused

  const doSend = (): Promise<GovernedEmailResult> =>
    req.payload.rail === 'gmail' ? sendViaGmail(req, req.payload) : sendViaResend(req, req.payload)

  // Stage 3: idempotency — the existing key pattern (`email:{personId}:{key}`,
  // scope 'email'). A duplicate of a successful send replays the stored result;
  // a failed send releases the key so a retry re-sends.
  if (!req.idempotencyKey) return doSend()
  return withSendIdempotency<GovernedEmailResult>(
    { key: `email:${req.personId}:${req.idempotencyKey}`, scope: 'email', onInFlight: { ok: true } },
    doSend,
  )
}
