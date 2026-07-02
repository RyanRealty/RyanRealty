'use client'

/**
 * MobileTasksScreen — the §29 Screen C dedicated mobile Tasks list, < md.
 *
 * Regions per C.2: navy header ("Tasks" + filter button → the C.10 filter
 * bottom sheet), the white 3-tab sub-bar (Today's Tasks / Overdue with a
 * destructive count pill / Future), the bg-muted content area with the C.5
 * content-header row ("Clear My Overdue Tasks" on the Overdue tab, confirm
 * dialog with live count), date-group headers ("Tuesday, Jun 23 (3)" — DESC on
 * Overdue, ASC elsewhere, "No date" last per C.7), and the C.5 64px task rows
 * (checkbox · 32px contact avatar · contact link · type icon + description ·
 * assignee sub-label · due time · chevron). FAB → the shared D.3 create-task
 * sheet. Completion is optimistic per C.8 (strike → 500ms slide-out → server,
 * revert on error, badge decrements immediately).
 *
 * Sub-tabs + agent scope + Show Completed navigate via URL (?view/?agent/
 * ?completed — server refetch, scope enforced at the data layer); task-type
 * filtering is client-side over the loaded rows per C.10.
 */

import { useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, ChevronRight, Clock, PencilLine, Plus, SlidersHorizontal, UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { taskGroupLabel, time12 } from '@/lib/crm/calendar'
import { zonedDateKey, zonedMinutes } from '@/lib/format/date'
import { MobileTypeIcon, brokerDisplayName } from '@/components/admin/crm/mobile/task-type-icons'
import { CrmAvatar } from '@/components/admin/crm/mobile/CrmMobileKit'
import MobileTaskCreateSheet from '@/components/admin/crm/mobile/MobileTaskCreateSheet'
import type { TaskQueueRow, TaskQueueCounts, CrmTaskType } from '@/lib/data/crm/getTaskQueue'
import type { TaskActions } from '@/components/admin/crm/tasks/TasksView'

type Result = { ok: boolean; error?: string }
export type MobileTasksView = 'today' | 'overdue' | 'upcoming'

const ACTION_W = 88

const TAB_LABELS: Record<MobileTasksView, string> = {
  today: "Today's Tasks",
  overdue: 'Overdue',
  upcoming: 'Future',
}
const HEADER_TITLES: Record<MobileTasksView, string> = {
  today: "Today's Tasks",
  overdue: 'Overdue Tasks',
  upcoming: 'Future Tasks',
}

function tabHref(view: MobileTasksView, agent: string, showCompleted: boolean): string {
  const p = new URLSearchParams()
  p.set('view', view === 'upcoming' ? 'future' : view)
  if (agent !== 'me') p.set('agent', agent)
  if (showCompleted) p.set('completed', '1')
  return `/admin/crm/tasks?${p.toString()}`
}

// ── One §29 C.5 task row (swipe left = Complete/Delete, right = Reschedule) ──

function MobileTaskRow({
  task,
  isCompletedRow,
  currentBrokerSlug,
  onComplete,
  onDelete,
  onReschedule,
}: {
  task: TaskQueueRow
  isCompletedRow: boolean
  currentBrokerSlug: string
  onComplete: (t: TaskQueueRow) => void
  onDelete: (t: TaskQueueRow) => void
  onReschedule: (t: TaskQueueRow) => void
}) {
  const [dx, setDx] = useState(0)
  const touch = useRef<{ x: number; y: number; base: number } | null>(null)

  function onTouchStart(e: React.TouchEvent) {
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, base: dx }
  }
  function onTouchMove(e: React.TouchEvent) {
    if (!touch.current || isCompletedRow) return
    const ddx = e.touches[0].clientX - touch.current.x
    const ddy = e.touches[0].clientY - touch.current.y
    if (Math.abs(ddx) < 8 || Math.abs(ddy) > Math.abs(ddx)) return
    setDx(Math.max(-ACTION_W * 2, Math.min(ACTION_W, touch.current.base + ddx)))
  }
  function onTouchEnd() {
    setDx((v) => (v <= -ACTION_W ? -ACTION_W * 2 : v >= ACTION_W / 2 ? ACTION_W : 0))
    touch.current = null
  }

  const dueLabel = task.dueAt ? time12(zonedMinutes(task.dueAt)) : ''
  const assignee =
    task.assignedBroker === currentBrokerSlug ? 'Me' : brokerDisplayName(task.assignedBroker) ?? '—'

  return (
    <div className="relative overflow-hidden border-b border-border bg-card">
      {/* Behind-right (swipe left): Complete + Delete (C.9) */}
      {!isCompletedRow ? (
        <div className="absolute inset-y-0 right-0 flex" style={{ width: ACTION_W * 2 }}>
          <button type="button" onClick={() => { setDx(0); onComplete(task) }} className="w-[88px] bg-success text-[13px] font-semibold text-success-foreground">
            Complete
          </button>
          <button type="button" onClick={() => { setDx(0); onDelete(task) }} className="w-[88px] bg-destructive text-[13px] font-semibold text-destructive-foreground">
            Delete
          </button>
        </div>
      ) : null}
      {/* Behind-left (swipe right): Reschedule (C.9) */}
      {!isCompletedRow ? (
        <button
          type="button"
          onClick={() => { setDx(0); onReschedule(task) }}
          className="absolute inset-y-0 left-0 bg-primary text-[13px] font-semibold text-primary-foreground"
          style={{ width: ACTION_W }}
        >
          Resched.
        </button>
      ) : null}

      <div
        className="relative flex min-h-[64px] items-start gap-2.5 bg-card px-3 pt-2.5 pb-2 transition-transform"
        style={{ transform: `translateX(${dx}px)` }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Checkbox — 16×16, warning border (C.5) */}
        <button
          type="button"
          aria-label="Mark complete"
          disabled={isCompletedRow}
          onClick={() => onComplete(task)}
          className={cn(
            'mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border-[1.5px] border-warning',
            isCompletedRow ? 'bg-warning' : 'bg-card',
          )}
        >
          {isCompletedRow ? <Check className="h-3 w-3 text-white" strokeWidth={3} /> : null}
        </button>

        <CrmAvatar name={task.personName ?? '?'} size={32} className="mt-0.5" />

        <div className="min-w-0 flex-1">
          {task.personId ? (
            <Link href={`/admin/console/leads/${task.personId}`} className="block truncate text-[14px] font-medium text-primary">
              {task.personName ?? 'Contact'}
            </Link>
          ) : (
            <span className="block truncate text-[14px] font-medium text-foreground">{task.personName ?? '—'}</span>
          )}
          <span className="flex items-center gap-1.5">
            <MobileTypeIcon type={task.type} size={14} />
            <span className={cn('truncate text-[13px] text-foreground', isCompletedRow && 'text-muted-foreground line-through')}>
              {task.name}
            </span>
          </span>
          <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
            <UserRound className="h-3 w-3" aria-hidden /> {assignee}
          </span>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {dueLabel ? (
            <span className="flex items-center gap-1 text-[13px] text-muted-foreground">
              <Clock className="h-3 w-3" aria-hidden /> {dueLabel}
            </span>
          ) : null}
          <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
        </div>
      </div>
    </div>
  )
}

// ── The screen ────────────────────────────────────────────────────────────────

export default function MobileTasksScreen({
  rows,
  completedRows,
  counts,
  view,
  taskTypes,
  brokers,
  isSuperuser,
  currentBrokerSlug,
  agent,
  showCompleted,
  actions,
  clearOverdue,
  createAction,
  searchAction,
}: {
  rows: TaskQueueRow[]
  completedRows: TaskQueueRow[]
  counts: TaskQueueCounts
  view: MobileTasksView
  taskTypes: CrmTaskType[]
  brokers: Array<{ slug: string; name: string }>
  isSuperuser: boolean
  currentBrokerSlug: string
  agent: string
  showCompleted: boolean
  actions: TaskActions
  clearOverdue: () => Promise<{ ok: boolean; cleared?: number; error?: string }>
  createAction: (fd: FormData) => Promise<Result>
  searchAction: (q: string) => Promise<{ ok: boolean; results?: Array<{ id: number; name: string }>; error?: string }>
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [filterOpen, setFilterOpen] = useState(false)
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set())
  const [doneIds, setDoneIds] = useState<Set<number>>(new Set())
  const [goneIds, setGoneIds] = useState<Set<number>>(new Set())
  const [clearOpen, setClearOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [resched, setResched] = useState<TaskQueueRow | null>(null)
  const [reschedAt, setReschedAt] = useState('')
  const [error, setError] = useState<string | null>(null)

  const allTypes = taskTypes.filter((t) => t.isActive)

  // C.8 — optimistic completion: strike now, slide at 500ms, then the write.
  const complete = (task: TaskQueueRow) => {
    if (doneIds.has(task.id)) return
    setDoneIds((s) => new Set(s).add(task.id))
    setTimeout(() => {
      setGoneIds((s) => new Set(s).add(task.id))
      startTransition(async () => {
        const r = await actions.complete(task.id, task.personId)
        if (!r.ok) {
          setDoneIds((s) => { const n = new Set(s); n.delete(task.id); return n })
          setGoneIds((s) => { const n = new Set(s); n.delete(task.id); return n })
          setError(r.error ?? 'Could not complete task.')
        } else {
          router.refresh()
        }
      })
    }, 500)
  }

  const remove = (task: TaskQueueRow) => {
    setGoneIds((s) => new Set(s).add(task.id))
    startTransition(async () => {
      const r = await actions.remove(task.id)
      if (!r.ok) {
        setGoneIds((s) => { const n = new Set(s); n.delete(task.id); return n })
        setError(r.error ?? 'Could not delete task.')
      } else {
        router.refresh()
      }
    })
  }

  const submitReschedule = () => {
    if (!resched || !reschedAt) return
    const iso = new Date(reschedAt).toISOString()
    startTransition(async () => {
      const r = await actions.update({ id: resched.id, dueAt: iso })
      if (!r.ok) { setError(r.error ?? 'Could not reschedule.'); return }
      setResched(null)
      setReschedAt('')
      router.refresh()
    })
  }

  // Date grouping (C.5): DESC on Overdue, ASC elsewhere, "No date" last (C.7).
  const groups = useMemo(() => {
    const typeActive = (t: string | null) => typeFilter.size === 0 || (t != null && typeFilter.has(t))
    const live = rows.filter((t) => typeActive(t.type))
    const map = new Map<string, TaskQueueRow[]>()
    for (const t of live) {
      const key = t.dueAt ? zonedDateKey(t.dueAt) : 'nodate'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(t)
    }
    if (showCompleted) {
      for (const t of completedRows.filter((x) => typeActive(x.type))) {
        const key = t.dueAt ? zonedDateKey(t.dueAt) : 'nodate'
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(t)
      }
    }
    const dated = [...map.keys()].filter((k) => k !== 'nodate').sort()
    if (view === 'overdue') dated.reverse()
    const keys = map.has('nodate') ? [...dated, 'nodate'] : dated
    return keys.map((k) => ({
      key: k,
      label: k === 'nodate' ? `No due date (${map.get(k)!.length})` : `${taskGroupLabel(k)} (${map.get(k)!.length})`,
      tasks: map.get(k)!,
    }))
  }, [rows, completedRows, showCompleted, view, typeFilter])

  const completedIdSet = useMemo(() => new Set(completedRows.map((t) => t.id)), [completedRows])
  const overdueBadge = Math.max(0, counts.overdue - (view === 'overdue' ? doneIds.size : 0))
  const visibleCount = groups.reduce((n, g) => n + g.tasks.filter((t) => !goneIds.has(t.id)).length, 0)

  const filterHref = (patch: { completed?: boolean; agent?: string }) => {
    const p = new URLSearchParams()
    p.set('view', view === 'upcoming' ? 'future' : view)
    const a = patch.agent ?? agent
    if (a !== 'me') p.set('agent', a)
    if (patch.completed ?? showCompleted) p.set('completed', '1')
    return `/admin/crm/tasks?${p.toString()}`
  }

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col bg-muted">
      {/* ── C.3 nav header (navy) ── */}
      <div className="relative flex h-12 shrink-0 items-center justify-center bg-primary px-4">
        <span className="text-[18px] font-semibold text-white">Tasks</span>
        <button
          type="button"
          aria-label="Filters"
          onClick={() => setFilterOpen(true)}
          className="absolute right-4"
        >
          <SlidersHorizontal className="h-[22px] w-[22px] text-white" strokeWidth={1.8} />
        </button>
      </div>

      {/* ── C.4 sub-tab bar ── */}
      <div className="flex shrink-0 border-b border-border bg-card">
        {(['today', 'overdue', 'upcoming'] as const).map((v) => {
          const active = view === v
          return (
            <Link
              key={v}
              href={tabHref(v, agent, showCompleted)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex h-10 flex-1 items-center justify-center gap-1.5 border-b-2 px-3 text-[13px]',
                active ? 'border-primary font-semibold text-primary' : 'border-transparent font-medium text-muted-foreground',
              )}
            >
              {TAB_LABELS[v]}
              {v === 'overdue' && overdueBadge > 0 ? (
                <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-bold leading-none text-destructive-foreground">
                  {overdueBadge}
                </span>
              ) : null}
            </Link>
          )
        })}
      </div>

      {/* ── C.5 content ── */}
      <div className="flex-1 pb-28">
        {/* Content header row */}
        <div className="flex h-11 items-center justify-between bg-card px-4">
          <span className="flex items-center gap-1.5 text-[15px] font-semibold text-foreground">
            <Clock className="h-4 w-4 text-muted-foreground" aria-hidden />
            {HEADER_TITLES[view]}
          </span>
          {view === 'overdue' && overdueBadge > 0 ? (
            <button type="button" className="text-[14px] font-medium text-primary" onClick={() => setClearOpen(true)}>
              Clear My Overdue Tasks
            </button>
          ) : null}
        </div>

        {error ? <p className="bg-destructive/10 px-4 py-2 text-[13px] text-destructive">{error}</p> : null}

        {visibleCount === 0 ? (
          /* C.7 empty state */
          <div className="mx-4 mt-6 flex flex-col items-center rounded-xl bg-card p-8 text-center">
            <PencilLine className="mb-3 h-12 w-12 text-muted-foreground/50" aria-hidden />
            <p className="text-[16px] font-semibold text-muted-foreground">
              {view === 'today' ? 'No tasks due today' : view === 'overdue' ? 'No overdue tasks' : 'No future tasks'}
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground/75">Create a task to schedule a follow-up</p>
            <Button variant="outline" className="mt-4 h-9 w-full" onClick={() => setCreateOpen(true)}>
              + Create Task
            </Button>
          </div>
        ) : (
          groups.map((g) => {
            const visible = g.tasks.filter((t) => !goneIds.has(t.id))
            if (visible.length === 0) return null
            return (
              <div key={g.key}>
                <div className="flex h-9 items-center bg-muted px-4">
                  <span className="text-[13px] text-foreground">{g.label}</span>
                </div>
                {visible.map((t) => (
                  <MobileTaskRow
                    key={t.id}
                    task={t}
                    isCompletedRow={doneIds.has(t.id) || completedIdSet.has(t.id)}
                    currentBrokerSlug={currentBrokerSlug}
                    onComplete={complete}
                    onDelete={remove}
                    onReschedule={(task) => { setResched(task); setReschedAt('') }}
                  />
                ))}
              </div>
            )
          })
        )}
      </div>

      {/* ── FAB → the shared D.3 create-task sheet ── */}
      <button
        type="button"
        aria-label="New task"
        onClick={() => setCreateOpen(true)}
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg md:hidden"
        style={{ boxShadow: '0 4px 8px rgba(16,39,66,0.30)' }}
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* ── C.10 filter bottom sheet ── */}
      <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
        <SheetContent aria-describedby={undefined} side="bottom" className="gap-0 overflow-y-auto rounded-t-2xl p-0" style={{ maxHeight: '70dvh' }}>
          <SheetTitle className="px-4 pb-2 pt-4 text-[16px] font-semibold text-foreground">Filters</SheetTitle>

          <p className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Task type</p>
          <label className="flex min-h-[40px] items-center gap-3 px-4">
            <Checkbox
              checked={typeFilter.size === 0}
              onCheckedChange={() => setTypeFilter(new Set())}
            />
            <span className="text-[15px] text-foreground">All Types</span>
          </label>
          {allTypes.map((t) => {
            const checked = typeFilter.size === 0 || typeFilter.has(t.key)
            return (
              <label key={t.key} className="flex min-h-[40px] items-center gap-3 px-4">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) => {
                    setTypeFilter((prev) => {
                      const base = prev.size === 0 ? new Set(allTypes.map((x) => x.key)) : new Set(prev)
                      if (v) base.add(t.key)
                      else base.delete(t.key)
                      return base.size === allTypes.length ? new Set() : base
                    })
                  }}
                />
                <MobileTypeIcon type={t.key} size={16} />
                <span className="text-[15px] text-foreground">{t.label}</span>
              </label>
            )
          })}

          <p className="border-t border-border px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Visibility</p>
          <label className="flex min-h-[40px] items-center gap-3 px-4">
            <Checkbox
              checked={showCompleted}
              onCheckedChange={(v) => router.push(filterHref({ completed: Boolean(v) }))}
            />
            <span className="text-[15px] text-foreground">Show Completed</span>
          </label>

          {isSuperuser ? (
            <>
              <p className="border-t border-border px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Agent</p>
              {[{ slug: 'me', name: 'Me' }, { slug: 'all', name: 'All' }, ...brokers.filter((b) => b.slug !== currentBrokerSlug)].map((b) => (
                <button
                  key={b.slug}
                  type="button"
                  className="flex min-h-[44px] w-full items-center justify-between px-4 text-left"
                  onClick={() => { setFilterOpen(false); router.push(filterHref({ agent: b.slug })) }}
                >
                  <span className="text-[15px] text-foreground">{b.name}</span>
                  {agent === b.slug ? <Check className="h-[18px] w-[18px] text-primary" /> : null}
                </button>
              ))}
            </>
          ) : null}

          <div className="p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <Button className="h-11 w-full" onClick={() => setFilterOpen(false)}>Apply</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── C.5 Clear My Overdue confirm ── */}
      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all {overdueBadge} overdue tasks?</AlertDialogTitle>
            <AlertDialogDescription>
              This completes every overdue task assigned to you. It cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                startTransition(async () => {
                  const r = await clearOverdue()
                  if (!r.ok) setError(r.error ?? 'Could not clear overdue tasks.')
                  router.refresh()
                })
              }}
            >
              Clear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reschedule sheet (C.9 swipe-right) */}
      <Sheet open={resched != null} onOpenChange={(v) => { if (!v) { setResched(null); setReschedAt('') } }}>
        <SheetContent aria-describedby={undefined} side="bottom" className="gap-3 rounded-t-2xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <SheetTitle className="text-[16px] font-semibold text-foreground">Reschedule task</SheetTitle>
          <Label className="text-[12px] font-medium text-muted-foreground">New due date & time</Label>
          <Input type="datetime-local" value={reschedAt} onChange={(e) => setReschedAt(e.target.value)} className="h-11" />
          <Button type="button" className="h-11 w-full" disabled={!reschedAt} onClick={submitReschedule}>
            Save
          </Button>
        </SheetContent>
      </Sheet>

      {/* D.3 create-task sheet */}
      <MobileTaskCreateSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        taskTypes={taskTypes}
        createAction={createAction}
        searchAction={searchAction}
      />
    </div>
  )
}
