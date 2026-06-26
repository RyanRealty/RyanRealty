// @no-parity — internal admin surface, no public mockup contract

/**
 * /admin/crm/settings/appointments — CRUD for appointment types + outcomes.
 * Superuser-only. Data fetched server-side; client UI in AppointmentSettingsClient.
 */

import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import { getAppointmentTypes, getAppointmentOutcomes } from '@/lib/data/crm/getAppointments'
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

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Appointment settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage appointment types and outcome labels used across the calendar.
        </p>
      </div>
      <AppointmentSettingsClient types={types} outcomes={outcomes} />
    </main>
  )
}
