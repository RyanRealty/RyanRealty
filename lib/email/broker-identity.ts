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
import type { ShellBroker } from '@/lib/email/shell'

const SEND_DOMAIN = 'mail.ryan-realty.com'

/**
 * Absolute-HTTPS headshots (email can't load relative/app assets). The
 * transparent .png cutouts are canonical (design system): they drop cleanly
 * onto the navy close card with no white box. Same map the newsletter uses.
 */
const HEADSHOTS: Record<string, string> = {
  matt: 'https://ryan-realty.com/images/brokers/ryan-matt.png',
  paul: 'https://ryan-realty.com/images/brokers/stevenson-paul.png',
  rebecca: 'https://ryan-realty.com/images/brokers/peterson-rebecca.png',
}

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

/**
 * Resolve a broker key ('matt'), roster slug ('matthew-ryan'), or mailbox to
 * the branded close-card identity for wrapBrandedEmail. Falls back to Matt —
 * conversion-audit 2026-07-15 #14: no market-report send path passed
 * senderBroker, so the close card (the human face on the report) never
 * rendered in production. Pure — reads only the static BROKERS registry.
 */
export function shellBrokerFor(brokerKeyOrSlug: string | null | undefined): ShellBroker {
  const wanted = (brokerKeyOrSlug ?? '').trim().toLowerCase()
  const [key, broker] =
    (Object.entries(BROKERS) as Array<[string, (typeof BROKERS)[keyof typeof BROKERS]]>).find(
      ([k, b]) => k === wanted || b.slug === wanted || b.email === wanted,
    ) ?? (['matt', BROKERS.matt] as const)
  return {
    name: broker.nameShort,
    firstName: broker.nameShort.split(/\s+/)[0] || broker.nameShort,
    title: broker.title,
    phone: broker.phone,
    email: broker.email,
    headshotUrl: HEADSHOTS[key] ?? HEADSHOTS.matt!,
    isOwner: key === 'matt',
  }
}
