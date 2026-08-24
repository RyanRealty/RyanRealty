// @no-parity — internal admin surface, no public mockup contract
// (gated instead by ci:crm-screen-parity — docs/crm-spec/crm-screens.json
// "tasks-calendar-desktop")

/**
 * /admin/crm/calendar — the §09 Calendar module
 * (spec: docs/crm-spec/09-tasks-and-calendar.md Part 2).
 *
 * Desktop (md+) renders the §2.2 two-column CalendarView: mini month cal +
 * Schedule|Filters sidebar over the Day/Week/Month grid (Day is the §2.1
 * default). Event sources: appointments (navy), open tasks with a due date
 * (amber — §1.10), deal closings (green — §2.5.3 taxonomy re-skinned).
 * < md keeps the existing MobileCalendar until the M6 mobile slice (§29).
 *
 * Time conventions (preserved from the existing backend):
 *   appointments = wall-clock stored as UTC → wall* parsing;
 *   tasks = true instants → zoned* (America/Los_Angeles) day + minutes.
 * Broker scope is enforced AT THE DATA LAYER (getAppointments /
 * getCalendarExtras take brokerScope); the "Everyone ▾" agent filter is
 * superuser-only (§2.15).
 *
 * < md renders the §29 Screen A mobile Calendar (mob-08) via
 * MobileCalendarScreen — registry entry mobile-calendar-tasks in
 * docs/crm-spec/crm-screens.json (ci:crm-screen-parity).
 *
 * 11C: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * Presentation only — CalendarView and MobileCalendarScreen are mounted
 * unchanged with the same props and the same server actions.
 *
 * Carried over verbatim: requireAdminPage('calendar.use'), the getCrmAccess
 * guard + redirect, the §2.1 Day default and isViewMode allowlist, the ?date=
 * / legacy ?month=YYYY-MM resolution and its todayKey fallback, the §2.15
 * superuser-only agent rule and the brokerScope it derives, apptEvents with its
 * wall-clock parsing and 62-day multi-day cap, the amber open-task mapping via
 * zonedDateKey/zonedMinutes, the closing mapping's `close_date.slice(0, 10)`,
 * the month∪week fetch window and the scheduleNeedsFetch second read, the
 * today/tomorrow schedule filter, appointmentsById, the guest-name resolution,
 * the crmActive broker filter, and all seven server-action wrappers.
 *
 * Dates: nothing swapped, and one swap was actively rejected. `close_date` is a
 * bare date and is read with a string slice — routing it through formatDate
 * would parse it as UTC, re-project to America/Los_Angeles and move the printed
 * closing back one calendar day. zonedDateKey stays on the true instants
 * (crm_tasks.due_at), wall* stays on the wall-clock appointment columns.
 *
 * Shape changed, data did not: the page's own <main> is GONE — ConsoleShell
 * owns the single landmark and this page rendered a second one; the mobile
 * full-bleed offsets now cancel only the shell padding; max-w-7xl became an
 * inline maxWidth of the same 1280px; and the desktop branch leads with one
 * verdict line counting scheduleEvents on todayKey — the exact rows the
 * Schedule pane draws under "Today". Appointment writes revalidate this path
 * and call router.refresh(), so that count re-renders with the data.
 */

import { redirect } from 'next/navigation'
import { requireAdminPage } from '@/lib/admin/require-admin'
import { getCrmAccess, addCrmTaskAction, completeCrmTaskAction } from '@/app/actions/crm'
import {
  createAppointmentAction,
  updateAppointmentAction,
  deleteAppointmentAction,
} from '@/app/actions/appointments'
import {
  searchCrmContactsAction,
  updateCrmTaskAction,
  deleteCrmTaskAction,
} from '@/app/actions/crm-tasks'
import { scopeBroker } from '@/lib/crm/scope'
import {
  getAppointments,
  getAppointmentTypes,
  getAppointmentOutcomes,
  getCalendarExtras,
  getCalendarContactOptions,
  getPersonNamesByIds,
  type AppointmentRow,
} from '@/lib/data/crm/getAppointments'
import { listFileDeadlineTasks } from '@/lib/data/tc/task-reads'
import { getCrmBrokers } from '@/lib/data/crm/getCrmBrokers'
import {
  isDateKey,
  monthGrid,
  shiftDays,
  time12,
  wallDateKey,
  wallMinutes,
  weekRange,
  type CalEvent,
} from '@/lib/crm/calendar'
import { zonedDateKey, zonedMinutes } from '@/lib/format/date'
import { getCrmTaskTypes } from '@/lib/data/crm/getTaskQueue'
import { VerdictLine } from '@/components/admin/v2'
import CalendarView, { type CalendarViewMode } from '@/components/admin/crm/calendar/CalendarView'
import MobileCalendarScreen from '@/components/admin/crm/calendar/mobile/MobileCalendarScreen'
import { CRM_BROKERS, CRM_BROKER_DISPLAY } from '@/lib/crm/constants'

export const metadata = { title: 'Calendar | CRM | Admin' }
export const dynamic = 'force-dynamic'

function isViewMode(v: string | undefined): v is CalendarViewMode {
  return v === 'day' || v === 'week' || v === 'month'
}

/** Map an appointment to per-day CalEvents (multi-day spans emit one per day). */
function apptEvents(a: AppointmentRow): CalEvent[] {
  const startKey = wallDateKey(a.startAt)
  const endKey = wallDateKey(a.endAt)
  const base = {
    kind: 'appointment' as const,
    title: a.title,
    personId: a.personId,
    personName: a.personName,
    broker: a.brokerSlug,
    apptId: a.id,
  }
  if (endKey <= startKey) {
    const startMin = a.allDay ? -1 : wallMinutes(a.startAt)
    return [{
      ...base,
      id: `appt:${a.id}`,
      dateKey: startKey,
      startMin,
      endMin: a.allDay ? -1 : wallMinutes(a.endAt),
      allDay: a.allDay,
      timeLabel: a.allDay ? '' : time12(startMin),
    }]
  }
  // Multi-day: render as an all-day block on each covered day (§2.5.3).
  const out: CalEvent[] = []
  for (let d = startKey, i = 0; d <= endKey && i < 62; d = shiftDays(d, 1), i++) {
    out.push({
      ...base,
      id: `appt:${a.id}:${d}`,
      dateKey: d,
      startMin: -1,
      endMin: -1,
      allDay: true,
      timeLabel: '',
    })
  }
  return out
}

async function loadEvents(brokerScope: string | null, from: string, to: string): Promise<{
  events: CalEvent[]
  appointments: AppointmentRow[]
}> {
  const [appointments, extras, fileDeadlines] = await Promise.all([
    getAppointments({ brokerScope, from, to }),
    getCalendarExtras({ brokerScope, from, to }),
    listFileDeadlineTasks({ from, to, brokerScope }),
  ])

  const events: CalEvent[] = appointments.flatMap(apptEvents)

  // Open tasks with a due date render in amber (§1.10). True instants → LA day.
  for (const t of extras.tasks) {
    if (t.completedAt) continue
    const dateKey = zonedDateKey(t.dueAt)
    if (!dateKey) continue
    const startMin = zonedMinutes(t.dueAt)
    events.push({
      id: `task:${t.id}`,
      kind: 'task',
      title: t.name,
      dateKey,
      startMin,
      endMin: startMin + 30,
      allDay: false,
      timeLabel: time12(startMin),
      personId: t.personId,
      personName: t.personName,
      broker: t.assignedBroker,
      apptId: null,
      taskType: t.type,
    })
  }

  for (const f of fileDeadlines) {
    events.push({
      id: `file:${f.id}`,
      kind: 'file',
      title: f.title,
      dateKey: f.dueDate,
      startMin: -1,
      endMin: -1,
      allDay: true,
      timeLabel: '',
      personId: null,
      personName: null,
      broker: f.brokerSlug,
      apptId: null,
      propertyKey: f.propertyKey,
    })
  }

  // Deal closings — all-day (close_date is a bare date).
  for (const d of extras.closings) {
    events.push({
      id: `deal:${d.id}`,
      kind: 'closing',
      title: `Closing: ${d.name}`,
      dateKey: d.closeDate.slice(0, 10),
      startMin: -1,
      endMin: -1,
      allDay: true,
      timeLabel: '',
      personId: null,
      personName: null,
      broker: d.assignedBroker,
      apptId: null,
    })
  }

  return { events, appointments }
}

export default async function CrmCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string; agent?: string; month?: string }>
}) {
  await requireAdminPage('calendar.use')
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')

  const isSuperuser = access.role === 'superuser'
  const ownScope = scopeBroker(access)
  const currentSlug = access.brokerSlug ?? 'matt'

  const sp = await searchParams
  const view: CalendarViewMode = isViewMode(sp.view) ? sp.view : 'day' // §2.1 default: Day
  const now = new Date()
  const todayKey = zonedDateKey(now)
  const tomorrowKey = shiftDays(todayKey, 1)
  // ?date drives the desktop view; the mobile branch's legacy ?month=YYYY-MM
  // still resolves so its nav keeps working.
  const dateKey = isDateKey(sp.date)
    ? sp.date
    : /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.month ?? '')
      ? `${sp.month}-01`
      : todayKey

  // Agent filter (§2.15): superuser may scope to one broker; everyone else is
  // pinned to their own slug at the data layer.
  const agent = isSuperuser && sp.agent && (CRM_BROKERS as readonly string[]).includes(sp.agent)
    ? sp.agent
    : 'all'
  const brokerScope = isSuperuser ? (agent === 'all' ? null : agent) : ownScope

  // One fetch window covering every active view: the month grid (incl.
  // overflow days) unioned with the focused week.
  const grid = monthGrid(dateKey)
  const week = weekRange(dateKey)
  const from = grid.from < week.from ? grid.from : week.from
  const to = grid.to > week.to ? grid.to : week.to

  const scheduleNeedsFetch = todayKey < from || tomorrowKey > to

  const [windowData, scheduleData, types, outcomes, brokers, contacts, taskTypes] = await Promise.all([
    loadEvents(brokerScope, from, to),
    scheduleNeedsFetch ? loadEvents(brokerScope, todayKey, tomorrowKey) : Promise.resolve(null),
    getAppointmentTypes(),
    getAppointmentOutcomes(),
    getCrmBrokers(),
    getCalendarContactOptions(),
    getCrmTaskTypes(),
  ])

  const { events, appointments } = windowData
  const scheduleEvents = (scheduleData?.events ?? events).filter(
    (e) => e.dateKey === todayKey || e.dateKey === tomorrowKey,
  )

  const appointmentsById: Record<number, AppointmentRow> = {}
  for (const a of appointments) appointmentsById[a.id] = a

  // Guest chips need names — resolve every referenced person id in one read.
  const guestIds = appointments.flatMap((a) => a.guestPersonIds ?? [])
  const guestNames = await getPersonNamesByIds(guestIds)

  const brokerOptions = brokers
    .filter((b) => b.crmActive)
    .map((b) => ({ slug: b.slug, name: b.name }))

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
  async function searchContacts(q: string): Promise<{ ok: boolean; results?: Array<{ id: number; name: string }>; error?: string }> {
    'use server'
    const r = await searchCrmContactsAction(q)
    return r.ok ? { ok: true, results: r.results } : { ok: false, error: r.error }
  }
  // §29 Screen A/C task quick actions (mobile) — the existing gated write paths.
  async function completeTask(taskId: number, personId: number | null): Promise<{ ok: boolean; error?: string }> {
    'use server'
    const fd = new FormData()
    fd.set('taskId', String(taskId))
    if (personId) fd.set('personId', String(personId))
    const r = await completeCrmTaskAction(fd)
    return r.ok ? { ok: true } : { ok: false, error: r.error }
  }
  async function deleteTask(taskId: number): Promise<{ ok: boolean; error?: string }> {
    'use server'
    const r = await deleteCrmTaskAction(taskId)
    return r.ok ? { ok: true } : { ok: false, error: r.error }
  }
  async function rescheduleTask(taskId: number, dueAtIso: string): Promise<{ ok: boolean; error?: string }> {
    'use server'
    const r = await updateCrmTaskAction({ id: taskId, dueAt: dueAtIso })
    return r.ok ? { ok: true } : { ok: false, error: r.error }
  }
  async function createTask(fd: FormData): Promise<{ ok: boolean; error?: string }> {
    'use server'
    const r = await addCrmTaskAction(fd)
    return r.ok ? { ok: true } : { ok: false, error: r.error }
  }

  // scheduleEvents IS the array CalendarView's Schedule pane draws; this is a
  // count of the rows it puts under "Today", not a claim about the day itself.
  const todayCount = scheduleEvents.filter((e) => e.dateKey === todayKey).length

  return (
    <div className="av2-scope" style={{ maxWidth: 1280, margin: '0 auto' }}>
      {/* ── Desktop: the §2.2 two-column calendar ──
             Phone is excluded: MobileCalendarScreen mounts full-bleed under a
             negative top margin and would overlap a line above it. */}
      <div className="mb-3 hidden md:block">
        <VerdictLine tone={todayCount > 0 ? 'ok' : 'attention'}>
          {todayCount > 0 ? (
            <>
              <b>
                {todayCount} {todayCount === 1 ? 'thing' : 'things'} on today&rsquo;s calendar.
              </b>
            </>
          ) : (
            /* The calendar readers fail soft — an unreadable table returns an
               empty list, not an error — so this says what the read returned
               and stops, rather than asserting the day is free. */
            <>
              <b>Today&rsquo;s calendar came back empty.</b>
            </>
          )}
        </VerdictLine>
      </div>

      <div className="hidden md:block">
        <CalendarView
          view={view}
          dateKey={dateKey}
          todayKey={todayKey}
          tomorrowKey={tomorrowKey}
          events={events}
          scheduleEvents={scheduleEvents}
          appointmentsById={appointmentsById}
          types={types}
          outcomes={outcomes}
          brokers={brokerOptions}
          currentBrokerSlug={currentSlug}
          isSuperuser={isSuperuser}
          agent={agent}
          guestNames={guestNames}
          searchContacts={searchContacts}
          createAction={create}
          updateAction={update}
          deleteAction={del}
        />
      </div>

      {/* ── Mobile (< md): the §29 Screen A calendar (mob-08) — full-bleed
          under the shell chrome (cancels shell px-4 pt-5 / sm:px-6 sm:pt-7;
          the page adds no padding of its own since the v2 migration). ── */}
      <div className="-mx-4 -mt-5 md:hidden sm:-mx-6 sm:-mt-7">
        <MobileCalendarScreen
          key={`${dateKey.slice(0, 7)}-01`}
          monthKey={`${dateKey.slice(0, 7)}-01`}
          todayKey={todayKey}
          events={events}
          appointments={appointments}
          types={types}
          outcomes={outcomes}
          contacts={contacts}
          brokerSlugs={[...CRM_BROKERS]}
          currentBrokerSlug={currentSlug}
          brokerName={CRM_BROKER_DISPLAY[currentSlug as keyof typeof CRM_BROKER_DISPLAY] ?? currentSlug}
          isSuperuser={isSuperuser}
          taskTypes={taskTypes}
          createAction={create}
          updateAction={update}
          deleteAction={del}
          completeTaskAction={completeTask}
          deleteTaskAction={deleteTask}
          rescheduleTaskAction={rescheduleTask}
          createTaskAction={createTask}
          searchContactsAction={searchContacts}
        />
      </div>
    </div>
  )
}
