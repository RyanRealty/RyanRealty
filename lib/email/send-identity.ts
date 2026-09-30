import 'server-only'
import { getCrmBrokers } from '@/lib/data/crm/getCrmBrokers'
import {
  brokerSendIdentity,
  companyMailboxIdentity,
  isRegistryBroker,
  type BrokerSendIdentity,
} from '@/lib/email/broker-identity'

const COMPANY_DOMAIN = '@ryan-realty.com'

/**
 * sendIdentityFor — who client mail goes out as, for the broker who is
 * sending it. A registry broker gets their named identity; any other company
 * mailbox (a broker onboarded since, or admin@) sends as itself, named from
 * public.brokers when the roster has it, with replies to that mailbox. Only a
 * missing or outside sender falls back to the brokerage (Matt). Never a bare
 * noreply@: with a broker Reply-To that landed in Gmail spam (measured
 * 2026-09-30, lib/tc/signing-emails.test.ts).
 */
export async function sendIdentityFor(sender: string | null | undefined): Promise<BrokerSendIdentity> {
  const wanted = (sender ?? '').trim().toLowerCase()
  if (isRegistryBroker(wanted)) return brokerSendIdentity(wanted)
  if (wanted.endsWith(COMPANY_DOMAIN) && wanted.length > COMPANY_DOMAIN.length) {
    const roster = await getCrmBrokers()
    const name = roster.find((b) => (b.email ?? '').trim().toLowerCase() === wanted)?.name
    return companyMailboxIdentity(wanted, name)
  }
  return brokerSendIdentity(null)
}
