// @no-parity — internal admin surface, no public mockup contract
// (the §09 tasks surface is covered by ci:crm-screen-parity via the
// tasks-calendar-desktop registry entry — docs/fub-crm-spec/crm-screens.json)

/**
 * /admin/crm/tasks — the §09 Part 1 Tasks module
 * (spec: docs/fub-crm-spec/09-tasks-and-calendar.md).
 *
 * Desktop (md+) renders TasksView: Today's Tasks | Overdue (N) | Future
 * sub-tabs, the How-Tasks-work / Filters ▾ / Me ▾ toolbar, and the two-panel
 * body (§1.2). Default landing is Overdue when overdue tasks exist, otherwise
 * Today (§1.1). < md keeps the existing TaskQueue agenda until the M6 mobile
 * slice (§29).
 *
 * Scope: the agent dropdown is superuser-only (§1.4.3); everyone else is
 * pinned to their own broker slug AT THE DATA LAYER via getTaskQueue.
 */

import { redirect } from 'next/navigation'
import {
  getCrmAccess,
  addCrmTaskAction,
  completeCrmTaskAction,
} from '@/app/actions/crm'
import {
  updateCrmTaskAction,
  reassignCrmTaskAction,
  snoozeCrmTaskAction,
  deleteCrmTaskAction,
  bulkCompleteTasksAction,
  clearMyOverdueTasksAction,
  searchCrmContactsAction,
} from '@/app/actions/crm-tasks'
import { scopeBroker } from '@/lib/crm/scope'
import { getTaskQueue, getCrmTaskTypes, type TaskQueueView } from '@/lib/data/crm/getTaskQueue'
import { getCrmBrokers } from '@/lib/data/crm/getCrmBrokers'
import { zonedDateKey } from '@/lib/format/date'
import { CRM_BROKERS } from '@/lib/crm/constants'
import { ConsoleSection } from '@/components/console/ConsoleSection'
import TaskQueue, { type TaskActions } from '@/components/admin/crm/tasks/TaskQueue'
import TasksView, { type TasksDesktopView } from '@/components/admin/crm/tasks/TasksView'
import NewTaskDialog from '@/components/admin/crm/tasks/NewTaskDialog'

export const metadata = { title: 'Tasks | CRM | Admin' }
export const dynamic = 'force-dynamic'

function parseView(v: string | undefined): TaskQueueView | null {
  if (v === 'today' || v === 'overdue' || v === 'upcoming' || v === 'completed') return v
  if (v === 'future') return 'upcoming' // §1.1 route segment name
  return null
}

export default async function CrmTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; agent?: string; completed?: string; new?: string }>
}) {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')

  const sp = await searchParams
  const isSuperuser = access.role === 'superuser'
  const currentSlug = access.brokerSlug ?? 'matt'
  const autoOpenNew = sp.new === '1'
  const showCompleted = sp.completed === '1'
  const canReassign = isSuperuser

  // §1.4.3 — agent scope. Default "Me"; superuser may widen to All / a broker.
  const agent = isSuperuser && sp.agent && (sp.agent === 'all' || (CRM_BROKERS as readonly string[]).includes(sp.agent))
    ? sp.agent
    : 'me'
  const brokerScope = isSuperuser
    ? (agent === 'all' ? null : agent === 'me' ? currentSlug : agent)
    : scopeBroker(access)

  // A stable "now" computed server-side — never new Date() at render in a client.
  const now = new Date()
  const todayKey = zonedDateKey(now)

  // §1.1 default landing: Overdue when overdue > 0, else Today.
  const requested = parseView(sp.view)
  let view: TaskQueueView = requested ?? 'overdue'
  const mainView: TaskQueueView = view === 'completed' ? 'upcoming' : view
  let main = await getTaskQueue({ brokerScope, view: mainView, now })
  if (!requested && main.counts.overdue === 0) {
    view = 'today'
    main = await getTaskQueue({ brokerScope, view: 'today', now })
  }

  const needCompleted = showCompleted || view === 'completed'
  const [completedRes, taskTypes, brokers] = await Promise.all([
    needCompleted
      ? getTaskQueue({ brokerScope, view: 'completed', now })
      : Promise.resolve(null),
    getCrmTaskTypes(),
    getCrmBrokers(),
  ])

  const brokerOptions = brokers
    .filter((b) => b.crmActive)
    .map((b) => ({ slug: b.slug, name: b.name }))

  // ── Server-action wrappers (uniform { ok, error } for the client) ──────────
  async function completeTask(taskId: number, personId: number | null): Promise<{ ok: boolean; error?: string }> {
    'use server'
    const fd = new FormData()
    fd.set('taskId', String(taskId))
    if (personId) fd.set('personId', String(personId))
    const r = await completeCrmTaskAction(fd)
    return r.ok ? { ok: true } : { ok: false, error: r.error }
  }
  async function bulkComplete(ids: number[]): Promise<{ ok: boolean; error?: string }> {
    'use server'
    const r = await bulkCompleteTasksAction(ids)
    return r.ok ? { ok: true } : { ok: false, error: r.error }
  }
  async function snooze(id: number, days: number): Promise<{ ok: boolean; error?: string }> {
    'use server'
    const r = await snoozeCrmTaskAction(id, days)
    return r.ok ? { ok: true } : { ok: false, error: r.error }
  }
  async function remove(id: number): Promise<{ ok: boolean; error?: string }> {
    'use server'
    const r = await deleteCrmTaskAction(id)
    return r.ok ? { ok: true } : { ok: false, error: r.error }
  }
  async function update(input: {
    id: number
    name?: string
    type?: string
    dueAt?: string | null
  }): Promise<{ ok: boolean; error?: string }> {
    'use server'
    const r = await updateCrmTaskAction(input)
    return r.ok ? { ok: true } : { ok: false, error: r.error }
  }
  async function reassign(id: number, broker: string): Promise<{ ok: boolean; error?: string }> {
    'use server'
    const r = await reassignCrmTaskAction(id, broker)
    return r.ok ? { ok: true } : { ok: false, error: r.error }
  }
  async function createTask(formData: FormData): Promise<{ ok: boolean; error?: string }> {
    'use server'
    const r = await addCrmTaskAction(formData)
    return r.ok ? { ok: true } : { ok: false, error: r.error }
  }
  async function searchContact(q: string) {
    'use server'
    return searchCrmContactsAction(q)
  }
  async function clearOverdue(): Promise<{ ok: boolean; cleared?: number; error?: string }> {
    'use server'
    const r = await clearMyOverdueTasksAction()
    return r.ok ? { ok: true, cleared: r.cleared } : { ok: false, error: r.error }
  }

  const actions: TaskActions = { complete: completeTask, bulkComplete, snooze, remove, update, reassign }

  const desktopView: TasksDesktopView = view === 'completed' ? 'upcoming' : (view as TasksDesktopView)

  return (
    <main className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-4 sm:py-5">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground md:text-2xl">Tasks</h1>
          <p className="hidden text-sm text-muted-foreground md:block">
            Every task across the book, by when it is due.
          </p>
        </div>
        <NewTaskDialog
          taskTypes={taskTypes}
          createAction={createTask}
          searchAction={searchContact}
          autoOpen={autoOpenNew}
        />
      </div>

      {/* ── Desktop: the §09 Part 1 module ── */}
      <div className="hidden md:block">
        <TasksView
          rows={view === 'completed' ? [] : main.rows}
          completedRows={completedRes?.rows ?? []}
          counts={main.counts}
          view={desktopView}
          taskTypes={taskTypes}
          brokers={brokerOptions}
          isSuperuser={isSuperuser}
          currentBrokerSlug={currentSlug}
          agent={agent}
          todayKey={todayKey}
          showCompleted={needCompleted}
          actions={actions}
          clearOverdue={clearOverdue}
        />
      </div>

      {/* ── Mobile (< md): existing agenda until the M6 §29 slice ── */}
      <div className="md:hidden">
        <ConsoleSection title="Task queue">
          <TaskQueue
            rows={view === 'completed' ? (completedRes?.rows ?? []) : main.rows}
            view={view}
            taskTypes={taskTypes}
            canReassign={canReassign}
            actions={actions}
          />
        </ConsoleSection>
      </div>
    </main>
  )
}
