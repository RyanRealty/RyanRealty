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
  searchCrmContactsAction,
} from '@/app/actions/crm-tasks'
import { scopeBroker } from '@/lib/crm/scope'
import { getTaskQueue, getCrmTaskTypes, type TaskQueueView } from '@/lib/data/crm/getTaskQueue'
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
  searchParams: Promise<{ view?: string; type?: string; new?: string }>
}) {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')

  const sp = await searchParams
  const view: TaskQueueView = isView(sp.view) ? sp.view : 'today'
  const typeFilter = sp.type && sp.type.trim() ? sp.type.trim() : null
  const autoOpenNew = sp.new === '1'
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
  async function searchContact(q: string) {
    'use server'
    return searchCrmContactsAction(q)
  }

  const actions: TaskActions = { complete: completeTask, bulkComplete, snooze, remove, update, reassign }

  return (
    <main className="mx-auto w-full max-w-4xl px-3 py-6 sm:px-6 sm:py-8">
      <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground md:text-2xl">Tasks</h1>
          <p className="hidden text-sm text-muted-foreground md:block">Every task across the book, by when it is due.</p>
        </div>
        <NewTaskDialog
          taskTypes={taskTypes}
          createAction={createTask}
          searchAction={searchContact}
          autoOpen={autoOpenNew}
        />
      </div>

      {/* View tabs — desktop only; mobile uses CrmSegmented inside TaskQueue */}
      <div className="hidden md:block">
        {/* FUB-style underline tab bar */}
        <div className="-mx-3 overflow-x-auto no-scrollbar px-3 md:mx-0 md:px-0">
          <div className="flex border-b border-border">
            {VIEWS.map((v) => {
              const active = view === v.key
              const count = counts[v.key]
              return (
                <Link
                  key={v.key}
                  href={`/admin/crm/tasks?view=${v.key}${typeFilter ? `&type=${encodeURIComponent(typeFilter)}` : ''}`}
                  className={[
                    'relative flex shrink-0 items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors',
                    active
                      ? 'text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary'
                      : 'text-muted-foreground hover:text-foreground',
                  ].join(' ')}
                >
                  {v.label}
                  {count > 0 ? (
                    <span className={[
                      'tabular-nums text-xs',
                      active ? 'text-foreground' : 'text-muted-foreground',
                    ].join(' ')}>
                      {count}
                    </span>
                  ) : null}
                </Link>
              )
            })}
          </div>
        </div>

        {/* Type filter chip row */}
        {taskTypes.length > 0 ? (
          <div className="-mx-3 mt-2.5 overflow-x-auto no-scrollbar px-3 md:mx-0 md:px-0">
            <div className="flex flex-wrap gap-1.5">
              <Link
                href={`/admin/crm/tasks?view=${view}`}
                className={[
                  'inline-flex h-7 items-center rounded-full px-3 text-xs font-medium transition-colors',
                  !typeFilter
                    ? 'bg-secondary text-secondary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                ].join(' ')}
              >
                All types
              </Link>
              {taskTypes
                .filter((t) => t.isActive || t.key === typeFilter)
                .map((t) => (
                  <Link
                    key={t.key}
                    href={`/admin/crm/tasks?view=${view}&type=${encodeURIComponent(t.key)}`}
                    className={[
                      'inline-flex h-7 items-center rounded-full px-3 text-xs font-medium transition-colors',
                      typeFilter === t.key
                        ? 'bg-secondary text-secondary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    ].join(' ')}
                  >
                    {t.label}
                  </Link>
                ))}
            </div>
          </div>
        ) : null}
      </div>

      <ConsoleSection title="Task queue" className="mt-6">
        <TaskQueue
          rows={rows}
          view={view}
          taskTypes={taskTypes}
          canReassign={canReassign}
          actions={actions}
        />
      </ConsoleSection>
    </main>
  )
}
