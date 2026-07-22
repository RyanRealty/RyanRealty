/**
 * sendGovernedSms — the single compliance + persistence chokepoint for a 1:1
 * outbound SMS/MMS to a CRM person (admin rebuild §A4).
 *
 * Guard order (each stage unreachable when an earlier one refuses):
 *   hard-stop tags → channel suppression (fail closed) → quiet hours →
 *   idempotency → Twilio rail → crm_timeline + conversation shadow-write.
 *
 * The provider rail, merge rendering, link instrumentation, and timeline row
 * shape are the EXACT logic the CRM composer used inline (app/actions/crm.ts
 * sendCrmSmsAction per-recipient block, extracted 2026-07-21) — rows written
 * here are byte-identical to what that action wrote. Group carrier threads
 * (Twilio Conversations) and raw no-contact numbers stay in the composer;
 * they cannot be person-keyed and are baselined by G56.
 */

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { withSendIdempotency } from '@/lib/crm/idempotency'
import { getSendTarget } from '@/lib/data/crm/getSendTarget'
import { renderCrmMerge, attributeSiteLinks } from '@/lib/crm/merge'
import { buildMergeContext } from '@/lib/crm/merge-context'
import { sendSms, sendSmsViaMessagingService, brokerTwilioNumber } from '@/lib/crm/twilio'
import { instrumentSmsLinks } from '@/lib/data/crm/shortLinks'
import { recordConversationMessage } from '@/lib/crm/record-message'
import type { CrmBrokerSlug } from '@/lib/crm/constants'
import { checkSendGuards } from './guards'
import type { GovernedSmsRequest, GovernedSmsResult } from './types'

export async function sendGovernedSms(req: GovernedSmsRequest): Promise<GovernedSmsResult> {
  // Stages 1–3: hard-stop → suppression (fail closed) → quiet hours. A refused
  // person never reaches the idempotency ledger or the provider.
  const refused = await checkSendGuards(req.personId, 'sms', {
    overrideQuietHours: req.overrideQuietHours,
  })
  if (refused) return refused

  const doSend = async (): Promise<GovernedSmsResult> => {
    const target = await getSendTarget(req.personId)
    if (!target || !target.phone) {
      return { ok: false, error: 'No phone number on file', stage: 'recipient' }
    }
    const person = target.person
    const to = target.phone
    const slug: CrmBrokerSlug =
      req.initiator.broker ?? (person.assigned_broker as CrmBrokerSlug | null) ?? 'matt'

    // Merge tokens — a template body with %first% must never reach a client
    // literally. Same context resolution as every other send surface.
    const ctx = await buildMergeContext({ person, senderSlug: slug })
    const mergedBody = attributeSiteLinks(
      renderCrmMerge(req.payload.body, person, ctx),
      slug,
      person.fub_legacy_id as number | null,
    )

    // Send from the broker's OWN Twilio business line, else the A2P service.
    const fromNumber = await brokerTwilioNumber(slug)
    // Click tracking: rewrite links to /r/<code> trackers. The timeline row
    // keeps the readable mergedBody so the broker's thread stays legible.
    const trackedBody = await instrumentSmsLinks(mergedBody, { personId: req.personId, broker: slug })
    const mediaUrls = req.payload.mediaUrls
    const sent = fromNumber
      ? await sendSms({ from: fromNumber, to, body: trackedBody, mediaUrls })
      : await sendSmsViaMessagingService({ to, body: trackedBody, mediaUrls })
    if (!sent.ok) return { ok: false, error: sent.error, stage: 'provider' }

    const storedMedia = req.payload.storedMedia ?? []
    const sb = createServiceClient()
    await sb.from('crm_timeline').insert({
      person_id: req.personId, kind: 'sms_out', title: 'Text sent', body: mergedBody,
      payload: {
        twilioSid: sent.sid, to, hasMedia: Boolean(mediaUrls?.length),
        // Storage-backed refs so the thread re-renders the sent media forever
        // (signed URLs above are only for Twilio's fetch window).
        ...(storedMedia.length ? { media: storedMedia } : {}),
      },
      broker: slug, source: req.timelineSource ?? 'app', dedupe_key: `twilio:${sent.sid}:p${req.personId}`,
    })
    // Shadow-write into the conversation model (RC1). Non-fatal: the timeline
    // is still the source of truth until the inbox read path flips.
    try {
      await recordConversationMessage({
        sb, direction: 'out', channel: storedMedia.length ? 'mms' : 'sms', body: mergedBody,
        providerSid: sent.sid, sentBy: slug, primaryPersonId: req.personId, assignedBroker: slug,
        media: storedMedia.length ? storedMedia : [],
        participants: [{ personId: req.personId, address: to, displayName: person.name ?? null }],
      })
    } catch (e) { console.warn('[comms] conversation shadow-write (sms 1:1) failed', e) }
    return { ok: true, sid: sent.sid, to }
  }

  // Stage 4: idempotency — the existing key pattern (`sms:{personId}:{key}`,
  // scope 'sms'). A duplicate of a successful send replays the stored result;
  // a failed send releases the key so a retry re-sends.
  if (!req.idempotencyKey) return doSend()
  return withSendIdempotency<GovernedSmsResult>(
    { key: `sms:${req.personId}:${req.idempotencyKey}`, scope: 'sms', onInFlight: { ok: true } },
    doSend,
  )
}
