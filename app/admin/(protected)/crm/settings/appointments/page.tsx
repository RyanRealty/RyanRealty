// @no-parity — internal admin surface, no public mockup contract

/**
 * /admin/crm/settings/appointments — CRUD for appointment types + outcomes.
 * Superuser-only. Data fetched server-side; client UI in AppointmentSettingsClient.
 * Migrated to the v2 admin language (11C) — same guard, same DAL reads.
 */

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import { getAppointmentTypes, getAppointmentOutcomes } from '@/lib/data/crm/getAppointments'
import { VerdictLine } from '@/components/admin/v2'
import AppointmentSettingsClient from './AppointmentSettingsClient'

export const metadata = { title: 'Appointment settings | CRM | Admin' }
export const dynamic = 'force-dynamic'

export default async function AppointmentSettingsPage() {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')
  if (access.role !== 'superuser') redirect('/admin/access-denied')

  const [types, outcomes] = await Promise.all([
    getAppointmentTypes(),
    getAppointmentOutcomes(),
  ])

  const activeTypes = types.filter((t) => t.active).length
  const activeOutcomes = outcomes.filter((o) => o.active).length

  return (
    <div className="av2-scope" style={{ maxWidth: 760, margin: '0 auto', padding: 16 }}>
      <p style={{ margin: '0 0 8px', fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
        <Link href="/admin/crm/settings" style={{ color: 'var(--a-text-2)' }}>
          CRM settings
        </Link>
      </p>

      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={activeTypes === 0 || activeOutcomes === 0 ? 'attention' : 'ok'}>
          <b>
            {activeTypes} appointment type{activeTypes === 1 ? '' : 's'} and {activeOutcomes} outcome
            {activeOutcomes === 1 ? '' : 's'} in the calendar pickers.
          </b>{' '}
          {activeTypes === 0 || activeOutcomes === 0
            ? 'An empty list leaves the picker blank.'
            : 'Turn one off to retire it without losing history.'}
        </VerdictLine>
      </div>

      <AppointmentSettingsClient types={types} outcomes={outcomes} />
    </div>
  )
}
