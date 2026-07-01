// @no-parity -- internal admin surface, no public mockup contract
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import { getCrmCompanySettings } from '@/lib/data/crm/getCrmCompanySettings'
import { SettingsSubpageShell } from '@/components/admin/crm/settings/SettingsSubpageShell'
import { CompanySettingsForm } from '@/components/admin/crm/settings/CompanySettingsForm'

export const metadata = { title: 'Company settings | CRM admin' }
export const dynamic = 'force-dynamic'

/**
 * /admin/crm/settings/company -- FUB Company Settings parity (spec §1).
 *
 * Renders the full §1 Company Settings form: basic brokerage identity, virtual
 * phone config (fallback number + recording toggles), office hours (display),
 * subdomain (display), business insights (production goal), and block list
 * navigation. The Save button commits inline-editable fields via
 * updateCompanySettingsAction; sections that have their own management flows
 * (office hours, subdomain, weekly recipients, block list) are shown read-only
 * here per spec §1.9.
 *
 * Access: superuser only -- same guard as every other CRM settings sub-page.
 * Data: getCrmCompanySettings (unstable_cache, 'crm-company-settings' tag,
 *       falls back to canonical Ryan Realty defaults if table is empty).
 */
export default async function CompanySettingsPage() {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')
  if (access.role !== 'superuser') redirect('/admin/access-denied')

  const settings = await getCrmCompanySettings()

  return (
    <SettingsSubpageShell
      title="Company settings"
      description="Account-level brokerage identity, virtual phone configuration, office hours, business goals, and compliance controls. Changes here affect all team members."
    >
      <CompanySettingsForm settings={settings} />
    </SettingsSubpageShell>
  )
}
