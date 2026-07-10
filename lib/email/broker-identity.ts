/**
 * brokerSendIdentity — the From/Reply-To identity for lead-facing Resend sends.
 *
 * Lead-facing automated mail (listing alerts, market reports, the CMA/BPO
 * Resend fallback) used to go out as a bare `noreply@mail.ryan-realty.com`
 * with no display name and no reply-to. Two failures in one:
 *
 *   1. Replies vanished — noreply@ is not a monitored mailbox, so a lead who
 *      hit reply on a listing alert never reached their broker.
 *   2. Gmail's category classifier reads "no human display name + noreply
 *      local part" as machine bulk: 60 days of production sends from this
 *      identity sat in the Updates tab with zero Primary placements
 *      (measured 2026-07-10 against matt@ryan-realty.com via the Gmail API).
 *
 * This helper resolves the subscription's assigned broker to a named sender.
 * The From address stays on the verified Resend domain (mail.ryan-realty.com
 * — SPF/DKIM alignment is per-domain, so any local part is fully
 * authenticated); replies route to the broker's real Workspace mailbox where
 * the CRM Gmail sync already logs them to the timeline.
 *
 * Accepts the short broker keys the CRM uses ('matt' | 'paul' | 'rebecca'),
 * the full roster slugs ('matthew-ryan', ...), or a broker mailbox address
 * ('paul@ryan-realty.com' — the CMA path only holds the email). Anything else
 * falls back to Matt, same default as the send engines.
 */

import { BROKERS } from '@/lib/brand/contact'

const SEND_DOMAIN = 'mail.ryan-realty.com'

export type BrokerSendIdentity = {
  /** RFC 5322 From with display name, e.g. `"Matt Ryan · Ryan Realty" <matt@mail.ryan-realty.com>`. */
  from: string
  /** The broker's real, monitored mailbox. */
  replyTo: string
}

export function brokerSendIdentity(brokerKeyOrSlug: string | null | undefined): BrokerSendIdentity {
  const wanted = (brokerKeyOrSlug ?? '').trim().toLowerCase()
  const broker =
    BROKERS[wanted as keyof typeof BROKERS] ??
    Object.values(BROKERS).find((b) => b.slug === wanted || b.email === wanted) ??
    BROKERS.matt

  const local = broker.email.split('@')[0]
  return {
    from: `"${broker.nameShort} · Ryan Realty" <${local}@${SEND_DOMAIN}>`,
    replyTo: broker.email,
  }
}
