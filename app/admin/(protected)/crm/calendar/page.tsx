// @no-parity — internal admin surface, no public mockup contract
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import {
  createAppointmentAction,
  updateAppointmentAction,
  deleteAppointmentAction,
} from '@/app/actions/appointments'
import { scopeBroker } from '@/lib/crm/scope'
import {
  getAppointments,
  getAppointmentTypes,
  getAppointmentOutcomes,
} from '@/lib/data/crm/getAppointments'
import { createServiceClient } from '@/lib/supabase/service'
import { ConsoleSection } from '@/components/console/ConsoleSection'
import { CRM_BROKERS } from '@/lib/crm/constants'
import CalendarGrid from './CalendarGrid'
import type { ContactOption } from './AppointmentSheet'

export const metadata = { title: 'Calendar | CRM | Admin' }
export const dynamic = 'force-dynamic'

export default async function CrmCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')

  const isSuperuser  = access.role === 'superuser'
  const brokerScope  = scopeBroker(access)
  const currentSlug  = access.brokerSlug ?? 'matt'

  const now      = new Date()
  const todayIso = now.toISOString().slice(0, 10)

  // ── Resolve displayed month from ?month=YYYY-MM or fall back to today ──────
  const sp = await searchParams
  const rawMonth = sp.month ?? ''
  const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/
  const displayYM = MONTH_RE.test(rawMonth) ? rawMonth : todayIso.slice(0, 7)
  const [yearStr, monthStr] = displayYM.split('-')
  const year  = Number(yearStr)
  const month = Number(monthStr)
  const monthIso = `${displayYM}-01`

  // First + last day of the month
  const from = monthIso.slice(0, 7) + '-01'
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const to   = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  // Load data in parallel
  const [appointments, types, outcomes] = await Promise.all([
    getAppointments({ brokerScope, from, to }),
    getAppointmentTypes(),
    getAppointmentOutcomes(),
  ])

  // Contact list for the guest picker — cap at 500 names (the Select is not
  // a full search engine; contacts type to filter client-side).
  const sb = createServiceClient()
  const { data: contactRows } = await sb
    .from('crm_people')
    .select('id,name')
    .not('stage', 'in', '("Closed","Lost","Archive","Trash")')
    .order('name', { ascending: true })
    .limit(500)

  const contacts: ContactOption[] = (
    contactRows ?? []
  ).map((r: Record<string, unknown>) => ({
    id: r.id as number,
    name: r.name as string | null,
  }))

  // Count appts in the next 30 days (for the dashboard KPI)
  const next30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const upcomingCount = appointments.filter(
    (a) => a.startAt.slice(0, 10) >= todayIso && a.startAt.slice(0, 10) <= next30,
  ).length

  // ── Server-action wrappers ──────────────────────────────────────────────────

  async function create(fd: FormData): Promise<{ ok: boolean; error?: string; id?: number }> {
    'use server'
    return createAppointmentAction(fd)
  }

  async function update(id: number, fd: FormData): Promise<{ ok: boolean; error?: string }> {
    'use server'
    return updateAppointmentAction(id, fd)
  }

  async function del(id: number): Promise<{ ok: boolean; error?: string }> {
    'use server'
    return deleteAppointmentAction(id)
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-3 py-6 sm:px-6 sm:py-8">
      {/* Page header */}
      <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground md:text-2xl">Calendar</h1>
          <p className="hidden text-sm text-muted-foreground md:block">
            Appointments, closings, and follow-ups in one view.
          </p>
        </div>
        {upcomingCount > 0 && (
          <p className="text-sm text-muted-foreground">
            <span className="tabular-nums font-semibold text-foreground">{upcomingCount}</span>
            {' '}appointment{upcomingCount !== 1 ? 's' : ''} in the next 30 days
          </p>
        )}
      </div>

      <ConsoleSection title="Appointments">
        <CalendarGrid
          appointments={appointments}
          todayIso={todayIso}
          monthIso={monthIso}
          types={types}
          outcomes={outcomes}
          contacts={contacts}
          brokerSlugs={[...CRM_BROKERS]}
          currentBrokerSlug={currentSlug}
          isSuperuser={isSuperuser}
          createAction={create}
          updateAction={update}
          deleteAction={del}
        />
      </ConsoleSection>
    </main>
  )
}
