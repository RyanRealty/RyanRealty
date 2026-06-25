// @no-parity — internal admin surface, no public mockup contract
import Link from 'next/link'
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
} from '@/app/actions/crm-tasks'
import { scopeBroker } from '@/lib/crm/scope'
import { getTaskQueue, getCrmTaskTypes, type TaskQueueView } from '@/lib/data/crm/getTaskQueue'
import { formatDateTime } from '@/lib/format/date'
import { Button } from '@/components/ui/button'
import { ConsoleSection } from '@/components/console/ConsoleSection'
import TaskQueue, { type TaskActions } from '@/components/admin/crm/tasks/TaskQueue'
import NewTaskDialog from '@/components/admin/crm/tasks/NewTaskDialog'

export const metadata = { title: 'Tasks | CRM | Admin' }
export const dynamic = 'force-dynamic'

const VIEWS: { key: TaskQueueView; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'completed', label: 'Completed' },
]

function isView(v: string | undefined): v is TaskQueueView {
  return v === 'today' || v === 'overdue' || v === 'upcoming' || v === 'completed'
}

export default async function CrmTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; type?: string }>
}) {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')

  const sp = await searchParams
  const view: TaskQueueView = isView(sp.view) ? sp.view : 'today'
  const typeFilter = sp.type && sp.type.trim() ? sp.type.trim() : null
  const brokerScope = scopeBroker(access)
  const canReassign = access.role === 'superuser'

  // A stable "now" computed server-side — never new Date() at render in a client.
  const now = new Date()
  const [{ rows, counts }, taskTypes] = await Promise.all([
    getTaskQueue({ brokerScope, view, type: typeFilter, now }),
    getCrmTaskTypes(),
  ])

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

  const actions: TaskActions = { complete: completeTask, bulkComplete, snooze, remove, update, reassign }

  return (
    <main className="mx-auto w-full max-w-4xl px-3 py-6 sm:px-6 sm:py-8">
      <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Tasks</h1>
          <p className="text-sm text-muted-foreground">Every task across the book, by when it is due.</p>
        </div>
        <NewTaskDialog taskTypes={taskTypes} createAction={createTask} />
      </div>

      {/* View tabs */}
      <div className="-mx-3 flex gap-2 overflow-x-auto no-scrollbar px-3 sm:mx-0 sm:flex-wrap sm:px-0">
        {VIEWS.map((v) => {
          const active = view === v.key
          const count = counts[v.key]
          return (
            <Button
              key={v.key}
              asChild
              size="sm"
              variant={active ? 'default' : 'outline'}
              className="h-10 shrink-0 gap-1.5 sm:h-9"
            >
              <Link href={`/admin/crm/tasks?view=${v.key}${typeFilter ? `&type=${encodeURIComponent(typeFilter)}` : ''}`}>
                {v.label}
                <span className="tabular-nums opacity-80">{count}</span>
              </Link>
            </Button>
          )
        })}
      </div>

      {/* Type filter */}
      {taskTypes.length > 0 ? (
        <div className="-mx-3 mt-3 flex gap-2 overflow-x-auto no-scrollbar px-3 sm:mx-0 sm:flex-wrap sm:px-0">
          <Button
            asChild
            size="sm"
            variant={!typeFilter ? 'secondary' : 'ghost'}
            className="h-9 shrink-0 sm:h-8"
          >
            <Link href={`/admin/crm/tasks?view=${view}`}>All types</Link>
          </Button>
          {taskTypes
            .filter((t) => t.isActive || t.key === typeFilter)
            .map((t) => (
              <Button
                key={t.key}
                asChild
                size="sm"
                variant={typeFilter === t.key ? 'secondary' : 'ghost'}
                className="h-9 shrink-0 sm:h-8"
              >
                <Link href={`/admin/crm/tasks?view=${view}&type=${encodeURIComponent(t.key)}`}>{t.label}</Link>
              </Button>
            ))}
        </div>
      ) : null}

      <ConsoleSection title="Task queue" className="mt-6">
        <TaskQueue
          rows={rows}
          view={view}
          taskTypes={taskTypes}
          canReassign={canReassign}
          actions={actions}
          formatDue={formatDateTime}
        />
      </ConsoleSection>
    </main>
  )
}
