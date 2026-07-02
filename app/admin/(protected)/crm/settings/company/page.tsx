// @no-parity -- internal admin surface, no public mockup contract
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import { getCrmCompanySettings } from '@/lib/data/crm/getCrmCompanySettings'
import { getCrmBlockedNumbers } from '@/lib/data/crm/getCrmBlockedNumbers'
import { getA2pCampaignStatus } from '@/lib/crm/twilio'
import { SettingsSubpageShell } from '@/components/admin/crm/settings/SettingsSubpageShell'
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
 * sub-page link with the live blocked-number count. The header's "View Business
 * Registration" badge/button shows the LIVE Twilio A2P campaign status.
 *
 * Access: superuser only -- same guard as every other CRM settings sub-page.
 * Data: getCrmCompanySettings (unstable_cache, 'crm-company-settings' tag) +
 *       getCrmBlockedNumbers + getA2pCampaignStatus (Twilio, 5-min TTL).
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
    <SettingsSubpageShell
      title="Company settings"
      description="Account-level brokerage identity, virtual phone configuration, office hours, business goals, and compliance controls. Changes here affect all team members."
    >
      <CompanySettingsForm
        settings={settings}
        a2pStatus={a2pStatus}
        blockedCount={blocked.length}
      />
    </SettingsSubpageShell>
  )
}
