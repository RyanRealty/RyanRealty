import 'server-only'

/**
 * buildMergeContext — assembles the MergeContext every send path passes to
 * renderCrmMerge, from REAL data (never hardcoded values):
 *
 *   agent   — the contact's assigned broker (brokers table via getCrmBrokers)
 *   sender  — the broker actually sending (may differ from the assigned agent)
 *   company — crm_company_settings (name + formatted office address)
 *   lender  — the contact's lender_name split into first/last (email/phone
 *             unknown → those tokens stay literal)
 *   leadSource — the contact's source string
 *
 * Broker phone resolves to the broker's CRM Twilio line first (the number the
 * telephony layer tracks + forwards), falling back to the profile phone.
 * %agent_website% resolves to the public site — attributeSiteLinks stamps the
 * broker's ?agent= attribution on it at send time.
 *
 * All reads go through cached DAL functions (getCrmBrokers, getBrokerTelephony,
 * getCrmCompanySettings) so calling this per-recipient in a loop stays cheap.
 */
import type { MergeContext, MergePartyInfo } from '@/lib/crm/merge'
import { splitName } from '@/lib/crm/merge'
import { getCrmBrokers } from '@/lib/data/crm/getCrmBrokers'
import { getBrokerTelephony } from '@/lib/data/crm/getBrokerTelephony'
import { getCrmCompanySettings } from '@/lib/data/crm/getCrmCompanySettings'

const SITE_URL = 'https://ryan-realty.com'

type PersonForContext = {
  assigned_broker?: string | null
  lender_name?: string | null
  source?: string | null
} | null

/** Broker slug → MergePartyInfo from the roster + telephony + company name. */
function brokerParty(
  slug: string | null | undefined,
  brokers: Array<{ slug: string; name: string; email: string | null; phone: string | null; title: string | null }>,
  telephonyBySlug: Partial<Record<string, { twilioNumber: string | null; forwardToCell: string | null }>>,
  companyName: string | null,
): MergePartyInfo | null {
  const s = (slug ?? '').trim()
  if (!s) return null
  const b = brokers.find((x) => x.slug === s)
  if (!b) return null
  const { first, last } = splitName(b.name)
  const tel = telephonyBySlug[s]
  return {
    firstName: first,
    lastName: last,
    email: b.email ?? null,
    phone: tel?.twilioNumber ?? b.phone ?? null,
    title: b.title ?? null,
    brokerage: companyName,
    website: SITE_URL,
  }
}

/**
 * Build the merge context for a send. `person` supplies the assigned agent,
 * lender name, and lead source; `senderSlug` is the acting broker (falls back
 * to the assigned agent when null — e.g. cron-driven automated sends).
 */
export async function buildMergeContext(opts: {
  person?: PersonForContext
  senderSlug?: string | null
}): Promise<MergeContext> {
  const [brokers, telephony, company] = await Promise.all([
    getCrmBrokers(),
    getBrokerTelephony(),
    getCrmCompanySettings(),
  ])

  const companyName = company?.company_name || null
  const companyAddress = company
    ? [
        [company.address_line_1, company.address_line_2].filter(Boolean).join(' '),
        company.city,
        [company.state, company.zipcode].filter(Boolean).join(' '),
      ]
        .filter(Boolean)
        .join(', ') || null
    : null

  const agentSlug = opts.person?.assigned_broker ?? null
  const senderSlug = opts.senderSlug ?? agentSlug

  const agent = brokerParty(agentSlug, brokers, telephony.bySlug, companyName)
  const sender = senderSlug === agentSlug ? agent : brokerParty(senderSlug, brokers, telephony.bySlug, companyName)

  const lenderName = (opts.person?.lender_name ?? '').trim()
  const lenderSplit = splitName(lenderName)
  const lender: MergePartyInfo | null = lenderName
    ? { firstName: lenderSplit.first, lastName: lenderSplit.last }
    : null

  return {
    agent,
    // A send with no assigned agent still resolves %agent_*% to the sender —
    // the broker actually reaching out IS the agent from the contact's view.
    ...(agent ? {} : { agent: sender }),
    sender,
    company: { name: companyName, address: companyAddress },
    lender,
    leadSource: { name: opts.person?.source ?? null, campaign: null },
    timeZone: company?.time_zone || 'America/Los_Angeles',
    // The send-time clock — stamped here (server) so renderCrmMerge stays
    // pure and hydration-safe in client previews.
    now: new Date(),
  }
}
