import { REPLY_INTENT_LABELS, type ReplyClassification } from '@/lib/crm/reply-intent'
import { buildSuggestedReplyLink } from '@/components/admin/crm/composer-preload'

/**
 * W5.3 — the crm_timeline note for a classified inbound EMAIL reply.
 *
 * Pure (no DB, no network) so the wiring is unit-testable: the caller
 * (lib/crm/gmail.ts syncMailboxWindow) owns the upsert. This is the email-channel
 * twin of the Twilio inbound-SMS classifier note — the difference that MUST hold
 * is the channel: the suggested reply rides a ?reply=&replyChannel=email deep
 * link so the broker taps the CRM link and the EMAIL composer opens pre-filled
 * (never sends — the send stays G50-suppression-gated).
 */

/** Idempotency key for one classified inbound email (per message, per person). */
export function emailIntentDedupeKey(messageKey: string, personId: number): string {
  return `gmail-intent:${messageKey}:p${personId}`
}

export function buildEmailIntentNote(args: {
  personId: number
  messageKey: string
  subject: string | null
  intel: ReplyClassification
}): Record<string, unknown> {
  const { personId, messageKey, subject, intel } = args
  const replyLink = buildSuggestedReplyLink(
    `https://ryan-realty.com/admin/crm/${personId}`,
    intel.recommendedReply
      ? { channel: 'email', body: intel.recommendedReply, subject: subject ? `Re: ${subject.replace(/^re:\s*/i, '')}` : null }
      : null,
  )
  return {
    person_id: personId,
    kind: 'system',
    title: `Email reply classified: ${REPLY_INTENT_LABELS[intel.intent]}`,
    body: intel.recommendedReply ? `Suggested reply: ${intel.recommendedReply}` : null,
    payload: {
      intent: intel.intent,
      confidence: intel.confidence,
      recommendedReply: intel.recommendedReply,
      classifierSource: intel.source,
      ...(intel.model ? { model: intel.model } : {}),
      channel: 'email',
      replyLink,
    },
    source: 'gmail',
    dedupe_key: emailIntentDedupeKey(messageKey, personId),
  }
}
