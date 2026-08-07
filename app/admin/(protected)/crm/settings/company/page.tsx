// @no-parity -- internal admin surface, no public mockup contract
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import { getCrmCompanySettings } from '@/lib/data/crm/getCrmCompanySettings'
import { getCrmBlockedNumbers } from '@/lib/data/crm/getCrmBlockedNumbers'
import { getA2pCampaignStatus } from '@/lib/crm/twilio'
import { SectionHead, VerdictLine } from '@/components/admin/v2'
import { CompanySettingsForm } from '@/components/admin/crm/settings/company/CompanySettingsForm'

export const metadata = { title: 'Company settings | CRM admin' }
export const dynamic = 'force-dynamic'

/**
 * /admin/crm/settings/company -- FUB Company Settings parity (spec §15 / §1).
 *
 * Renders the full §1 Company Settings form: basic brokerage identity, virtual
 * phone config (Manage Settings link, fallback number, spam-label change modal,
 * recording master switch, locked-on legal disclosure + preview), the office
 * hours editor (enforced live by the inbound Twilio voice webhook), subdomain
 * change modal, business insights (click-to-edit production goal + weekly
 * report recipient chips wired to the real Monday digest), and the block-list
 * sub-page link with the live blocked-number count. The form header's "View
 * Business Registration" badge/button shows the LIVE Twilio A2P campaign status.
 *
 * Access: superuser only -- same guard as every other CRM settings sub-page.
 * Data: getCrmCompanySettings (unstable_cache, 'crm-company-settings' tag) +
 *       getCrmBlockedNumbers + getA2pCampaignStatus (Twilio, 5-min TTL).
 *
 * P11C: page scaffolding migrated to the LOCKED admin v2 language. The
 * CompanySettingsForm island still owns updateCompanySettingsAction verbatim.
 */
export default async function CompanySettingsPage() {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')
  if (access.role !== 'superuser') redirect('/admin/access-denied')

  const [settings, blocked, a2pStatus] = await Promise.all([
    getCrmCompanySettings(),
    getCrmBlockedNumbers(),
    getA2pCampaignStatus().catch(() => null),
  ])

  return (
    <div className="av2-scope" style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <nav style={{ margin: '0 0 10px', fontSize: 'var(--a-text-xs)' }}>
        <Link href="/admin/crm/settings" style={{ color: 'var(--a-accent)', textDecoration: 'none' }}>
          CRM settings
        </Link>
      </nav>

      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone="ok">
          <b>Account-level settings for the whole brokerage.</b> Identity, virtual phone, office
          hours, goals, and compliance controls. A change here reaches every team member.
        </VerdictLine>
      </div>

      <CompanySettingsForm settings={settings} a2pStatus={a2pStatus} blockedCount={blocked.length} />

      <SectionHead>Company doors</SectionHead>
      <ul className="av2-quietlist">
        <li className="av2-quiet">
          <Link
            href="/admin/crm/settings/company/registration"
            className="av2-quiet__name"
            style={{ textDecoration: 'none', color: 'var(--a-accent)', minWidth: 190 }}
          >
            Business registration
          </Link>
          <span style={{ color: 'var(--a-text-2)' }}>
            A2P 10DLC campaign status — carriers block outbound texting until it is registered.
          </span>
        </li>
        <li className="av2-quiet">
          <Link
            href="/admin/crm/settings/company/block-list"
            className="av2-quiet__name"
            style={{ textDecoration: 'none', color: 'var(--a-accent)', minWidth: 190 }}
          >
            Block list
          </Link>
          <span style={{ color: 'var(--a-text-2)' }}>
            {blocked.length.toLocaleString('en-US')}{' '}
            {blocked.length === 1 ? 'number' : 'numbers'} rejected at the Twilio webhook.
          </span>
        </li>
      </ul>
    </div>
  )
}
