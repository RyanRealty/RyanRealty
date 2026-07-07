import 'server-only'

/**
 * Pixel/click → newsletter ledger hook (spec §5/H1, gate G-NL-10).
 *
 * The /api/track/e/open + /click routes already write crm_timeline +
 * email_events, but newsletter opens/clicks were NOT landing on
 * newsletter_recipient_events — the deduped ledger every newsletter stat
 * derives from. This module closes that gap: when a tracking token's emailKey
 * is `newsletter:<id>`, resolve the recipient from the token's person id and
 * append the ledger row. The recipient-scoped dedupe_key collapses a pixel that
 * fires on every render (and the same open arriving from the Resend webhook)
 * to ONE row per recipient-per-event-per-url.
 *
 * Non-blocking by contract: callers wrap this in try/catch — a ledger failure
 * must never break the pixel response or the click redirect.
 */

import { getRecipientForPerson } from '@/lib/data/newsletter/tracking'
import { recordLedgerEvent } from '@/lib/data/newsletter/queue'

/** Parse `newsletter:<uuid>` → the newsletter id, else null. Pure. */
export function parseNewsletterEmailKey(emailKey: string | null | undefined): string | null {
  const key = String(emailKey ?? '').trim()
  if (!key.toLowerCase().startsWith('newsletter:')) return null
  const id = key.slice('newsletter:'.length).trim()
  return id.length > 0 ? id : null
}

/**
 * Record one newsletter open/click on the ledger. No-op when the emailKey is
 * not a newsletter key or the person has no subscriber row (nothing to
 * attribute). The token's broker stamp wins; the frozen recipient broker is
 * the fallback (both trace to the same resolution at send time).
 */
export async function recordNewsletterEngagement(input: {
  personId: number
  emailKey: string | null | undefined
  broker?: string | null
  event: 'open' | 'click'
  url?: string | null
}): Promise<boolean> {
  const newsletterId = parseNewsletterEmailKey(input.emailKey)
  if (!newsletterId) return false

  const recipient = await getRecipientForPerson(newsletterId, input.personId)
  if (!recipient) return false

  await recordLedgerEvent({
    newsletterId,
    subscriberId: recipient.subscriber_id,
    email: recipient.email,
    resendMessageId: null,
    broker: input.broker ?? recipient.broker,
    event: input.event,
    url: input.event === 'click' ? (input.url ?? null) : null,
  })
  return true
}
