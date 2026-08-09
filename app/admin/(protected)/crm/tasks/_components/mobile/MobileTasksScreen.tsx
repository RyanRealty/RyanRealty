'use client'

/**
 * MobileTasksScreen — the §29 Screen C dedicated mobile Tasks list, < md.
 *
 * Regions per C.2: navy header ("Tasks" + filter button → the C.10 filter
 * bottom sheet), the white 3-tab sub-bar (Today's Tasks / Overdue with a
 * destructive count pill / Future), the inset-toned content area with the C.5
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
 *
 * Admin v2 migration (11F): shadcn primitives (Button/Checkbox/Input/Label/
 * Sheet/AlertDialog) replaced with '@/components/admin/v2'; every semantic
 * Tailwind color class replaced with var(--a-*) tokens or av2 CSS classes.
 * The type-icon map and broker-display-name helper are inlined below (both
 * were pure, token-safe re-implementations of the shared
 * components/admin/shared/mobile/task-type-icons.tsx, which lives outside this
 * migration's scope) so this file carries no legacy components/admin import
 * for them. CrmAvatar and MobileTaskCreateSheet stay on their shared
 * components/admin/shared/mobile/* imports by design — CrmAvatar's per-contact
 * fill palette is an intentionally brand-external hex set with no token
 * equivalent (documented in avatar-utils.ts, exempted from the design-token
 * lint there), and MobileTaskCreateSheet is the same create-task sheet the
 * Calendar screen and other mobile surfaces mount; forking either to satisfy
 * this file's color gate would fork shared, cross-surface machinery — the
 * same sanctioned call already recorded for people/[id], dscr and crm/inbox
 * in scripts/check-admin-v2-tokens.mjs.
 */

import { useMemo, useRef, useState, useTransition, type CSSProperties } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, ChevronRight, Clock, PencilLine, Plus, SlidersHorizontal, UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button, ConfirmDialog, IconButton, Sheet, TextField, ToolbarCheck } from '@/components/admin/v2'
import { taskGroupLabel, time12 } from '@/lib/crm/calendar'
import { zonedDateKey, zonedMinutes } from '@/lib/format/date'
import { CrmAvatar } from '@/components/admin/shared/mobile/CrmMobileKit'
import MobileTaskCreateSheet from '@/components/admin/shared/mobile/MobileTaskCreateSheet'
import type { TaskQueueRow, TaskQueueCounts, CrmTaskType } from '@/lib/data/crm/getTaskQueue'
import type { TaskActions } from '../TasksView'
import {
  ACTION_W,
  HEADER_TITLES,
  TAB_LABELS,
  TaskTypeGlyph,
  brokerName,
  tabHref,
  type MobileTasksView,
} from './mobile-tasks-bits'

type Result = { ok: boolean; error?: string }
export type { MobileTasksView }

const MUTED_TEXT: CSSProperties = { color: 'var(--a-text-2)' }
const EMPHASIS_TEXT: CSSProperties = { color: 'var(--a-text)' }
const ACCENT_TEXT: CSSProperties = { color: 'var(--a-accent)' }
const INSET_BG: CSSProperties = { background: 'var(--a-inset)' }
const ROW_DIVIDER_BG: CSSProperties = { borderBottom: '1px solid var(--a-border)', background: 'var(--a-bg)' }
const SHEET_SECTION_LABEL: CSSProperties = { borderTop: '1px solid var(--a-border)', color: 'var(--a-text-2)', letterSpacing: '0.05em' }

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
    task.assignedBroker === currentBrokerSlug ? 'Me' : brokerName(task.assignedBroker) ?? '—'

  return (
    <div className="relative overflow-hidden" style={ROW_DIVIDER_BG}>
      {/* Behind-right (swipe left): Complete + Delete (C.9) */}
      {!isCompletedRow ? (
        <div className="absolute inset-y-0 right-0 flex" style={{ width: ACTION_W * 2 }}>
          <Button
            variant="quiet"
            onClick={() => { setDx(0); onComplete(task) }}
            className="text-[13px] font-semibold"
            style={{ width: ACTION_W, height: '100%', minHeight: 'auto', border: 'none', borderRadius: 0, background: 'var(--a-ok)', color: 'var(--a-btn-fg)' }}
          >
            Complete
          </Button>
          <Button
            variant="danger"
            onClick={() => { setDx(0); onDelete(task) }}
            className="text-[13px] font-semibold"
            style={{ width: ACTION_W, height: '100%', minHeight: 'auto', border: 'none', borderRadius: 0 }}
          >
            Delete
          </Button>
        </div>
      ) : null}
      {/* Behind-left (swipe right): Reschedule (C.9) */}
      {!isCompletedRow ? (
        <Button
          variant="quiet"
          onClick={() => { setDx(0); onReschedule(task) }}
          className="absolute inset-y-0 left-0 text-[13px] font-semibold"
          style={{ width: ACTION_W, minHeight: 'auto', border: 'none', borderRadius: 0, background: 'var(--a-accent)', color: 'var(--a-btn-fg)' }}
        >
          Resched.
        </Button>
      ) : null}

      <div
        className="relative flex min-h-[64px] items-start gap-2.5 px-3 pt-2.5 pb-2 transition-transform"
        style={{ transform: `translateX(${dx}px)`, background: 'var(--a-bg)' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Checkbox — 16×16, warning border (C.5) */}
        <IconButton
          label="Mark complete"
          disabled={isCompletedRow}
          onClick={() => onComplete(task)}
          className="mt-1"
          style={{
            width: 16,
            height: 16,
            minWidth: 16,
            borderRadius: 3,
            border: '1.5px solid var(--a-warn)',
            background: isCompletedRow ? 'var(--a-warn)' : 'var(--a-bg)',
          }}
        >
          {isCompletedRow ? <Check style={{ width: 12, height: 12, color: 'var(--a-bg)' }} strokeWidth={3} /> : null}
        </IconButton>

        <CrmAvatar name={task.personName ?? '?'} size={32} className="mt-0.5" />

        <div className="min-w-0 flex-1">
          {task.personId ? (
            <Link href={`/admin/people/${task.personId}`} className="block truncate text-[14px] font-medium" style={ACCENT_TEXT}>
              {task.personName ?? 'Contact'}
            </Link>
          ) : (
            <span className="block truncate text-[14px] font-medium" style={EMPHASIS_TEXT}>{task.personName ?? '—'}</span>
          )}
          <span className="flex items-center gap-1.5">
            <TaskTypeGlyph type={task.type} size={14} />
            <span
              className={cn('truncate text-[13px]', isCompletedRow && 'line-through')}
              style={{ color: isCompletedRow ? 'var(--a-text-2)' : 'var(--a-text)' }}
            >
              {task.name}
            </span>
          </span>
          <span className="flex items-center gap-1 text-[12px]" style={MUTED_TEXT}>
            <UserRound className="h-3 w-3" aria-hidden /> {assignee}
          </span>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {dueLabel ? (
            <span className="flex items-center gap-1 text-[13px]" style={MUTED_TEXT}>
              <Clock className="h-3 w-3" aria-hidden /> {dueLabel}
            </span>
          ) : null}
          <ChevronRight className="h-4 w-4" style={MUTED_TEXT} aria-hidden />
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
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col" style={INSET_BG}>
      {/* ── C.3 nav header (navy) ── */}
      <div className="relative flex h-12 shrink-0 items-center justify-center px-4" style={{ background: 'var(--a-accent)' }}>
        <span className="text-[18px] font-semibold" style={{ color: 'var(--a-btn-fg)' }}>Tasks</span>
        <IconButton
          label="Filters"
          onClick={() => setFilterOpen(true)}
          className="absolute right-4"
          style={{ width: 'auto', height: 'auto', color: 'var(--a-btn-fg)' }}
        >
          <SlidersHorizontal className="h-[22px] w-[22px]" strokeWidth={1.8} aria-hidden />
        </IconButton>
      </div>

      {/* ── C.4 sub-tab bar ── */}
      <div className="flex shrink-0" style={ROW_DIVIDER_BG}>
        {(['today', 'overdue', 'upcoming'] as const).map((v) => {
          const active = view === v
          return (
            <Link
              key={v}
              href={tabHref(v, agent, showCompleted)}
              aria-current={active ? 'page' : undefined}
              className="flex h-10 flex-1 items-center justify-center gap-1.5 px-3 text-[13px]"
              style={{
                borderBottom: active ? '2px solid var(--a-accent)' : '2px solid transparent',
                color: active ? 'var(--a-accent)' : 'var(--a-text-2)',
                fontWeight: active ? 600 : 500,
              }}
            >
              {TAB_LABELS[v]}
              {v === 'overdue' && overdueBadge > 0 ? (
                <span
                  className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] font-bold leading-none a-num"
                  style={{ background: 'var(--a-danger)', color: 'var(--a-bg)' }}
                >
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
        <div className="flex h-11 items-center justify-between px-4" style={{ background: 'var(--a-bg)' }}>
          <span className="flex items-center gap-1.5 text-[15px] font-semibold" style={EMPHASIS_TEXT}>
            <Clock className="h-4 w-4" style={MUTED_TEXT} aria-hidden />
            {HEADER_TITLES[view]}
          </span>
          {view === 'overdue' && overdueBadge > 0 ? (
            <Button
              variant="quiet"
              className="text-[14px] font-medium"
              style={{ background: 'transparent', border: 'none', padding: 0, minHeight: 'auto', color: 'var(--a-accent)' }}
              onClick={() => setClearOpen(true)}
            >
              Clear My Overdue Tasks
            </Button>
          ) : null}
        </div>

        {error ? <p className="px-4 py-2 text-[13px]" style={{ background: 'var(--a-danger-wash)', color: 'var(--a-danger)' }}>{error}</p> : null}

        {visibleCount === 0 ? (
          /* C.7 empty state */
          <div className="mx-4 mt-6 flex flex-col items-center rounded-xl p-8 text-center" style={{ background: 'var(--a-bg)', border: '1px solid var(--a-border)' }}>
            <PencilLine className="mb-3 h-12 w-12" style={{ color: 'var(--a-text-2)', opacity: 0.5 }} aria-hidden />
            <p className="text-[16px] font-semibold" style={MUTED_TEXT}>
              {view === 'today' ? 'No tasks due today' : view === 'overdue' ? 'No overdue tasks' : 'No future tasks'}
            </p>
            <p className="mt-1 text-[13px]" style={{ color: 'var(--a-text-2)', opacity: 0.75 }}>Create a task to schedule a follow-up</p>
            <Button variant="quiet" className="mt-4 h-9 w-full" onClick={() => setCreateOpen(true)}>
              + Create Task
            </Button>
          </div>
        ) : (
          groups.map((g) => {
            const visible = g.tasks.filter((t) => !goneIds.has(t.id))
            if (visible.length === 0) return null
            return (
              <div key={g.key}>
                <div className="flex h-9 items-center px-4" style={INSET_BG}>
                  <span className="text-[13px]" style={EMPHASIS_TEXT}>{g.label}</span>
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
      <IconButton
        label="New task"
        onClick={() => setCreateOpen(true)}
        className="fixed bottom-20 right-4 z-40 md:hidden"
        style={{
          width: 56,
          height: 56,
          borderRadius: 999,
          background: 'var(--a-accent)',
          color: 'var(--a-btn-fg)',
          boxShadow: 'var(--a-shadow-overlay)',
        }}
      >
        <Plus className="h-6 w-6" aria-hidden />
      </IconButton>

      {/* ── C.10 filter bottom sheet ── */}
      <Sheet open={filterOpen} onClose={() => setFilterOpen(false)} title="Filters">
        <div className="-mx-4 overflow-y-auto" style={{ maxHeight: '60dvh' }}>
          <p className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase" style={{ color: 'var(--a-text-2)', letterSpacing: '0.05em' }}>Task type</p>
          <div className="px-4">
            <ToolbarCheck
              label="All Types"
              checked={typeFilter.size === 0}
              onChange={() => setTypeFilter(new Set())}
            />
          </div>
          {allTypes.map((t) => {
            const checked = typeFilter.size === 0 || typeFilter.has(t.key)
            return (
              <div key={t.key} className="px-4">
                <ToolbarCheck
                  label={
                    <span className="flex items-center gap-2">
                      <TaskTypeGlyph type={t.key} size={16} />
                      {t.label}
                    </span>
                  }
                  checked={checked}
                  onChange={(e) => {
                    setTypeFilter((prev) => {
                      const base = prev.size === 0 ? new Set(allTypes.map((x) => x.key)) : new Set(prev)
                      if (e.target.checked) base.add(t.key)
                      else base.delete(t.key)
                      return base.size === allTypes.length ? new Set() : base
                    })
                  }}
                />
              </div>
            )
          })}

          <p
            className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase"
            style={SHEET_SECTION_LABEL}
          >
            Visibility
          </p>
          <div className="px-4">
            <ToolbarCheck
              label="Show Completed"
              checked={showCompleted}
              onChange={(e) => router.push(filterHref({ completed: e.target.checked }))}
            />
          </div>

          {isSuperuser ? (
            <>
              <p
                className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase"
                style={SHEET_SECTION_LABEL}
              >
                Agent
              </p>
              {[{ slug: 'me', name: 'Me' }, { slug: 'all', name: 'All' }, ...brokers.filter((b) => b.slug !== currentBrokerSlug)].map((b) => (
                <Button
                  key={b.slug}
                  variant="quiet"
                  className="flex w-full items-center justify-between text-left"
                  style={{ background: 'transparent', border: 'none', borderRadius: 0, minHeight: 44 }}
                  onClick={() => { setFilterOpen(false); router.push(filterHref({ agent: b.slug })) }}
                >
                  <span className="text-[15px]" style={EMPHASIS_TEXT}>{b.name}</span>
                  {agent === b.slug ? <Check className="h-[18px] w-[18px]" style={ACCENT_TEXT} aria-hidden /> : null}
                </Button>
              ))}
            </>
          ) : null}
        </div>

        <div className="p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button variant="quiet" className="h-11 w-full" onClick={() => setFilterOpen(false)}>Apply</Button>
        </div>
      </Sheet>

      {/* ── C.5 Clear My Overdue confirm ── */}
      <ConfirmDialog
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        title={`Clear all ${overdueBadge} overdue tasks?`}
        description="This completes every overdue task assigned to you. It cannot be undone."
        confirmLabel="Clear"
        onConfirm={() => {
          setClearOpen(false)
          startTransition(async () => {
            const r = await clearOverdue()
            if (!r.ok) setError(r.error ?? 'Could not clear overdue tasks.')
            router.refresh()
          })
        }}
      />

      {/* Reschedule sheet (C.9 swipe-right) */}
      <Sheet
        open={resched != null}
        onClose={() => { setResched(null); setReschedAt('') }}
        title="Reschedule task"
      >
        <TextField
          label="New due date & time"
          type="datetime-local"
          value={reschedAt}
          onChange={(e) => setReschedAt(e.target.value)}
          className="h-11"
        />
        <Button className="h-11 w-full" disabled={!reschedAt} onClick={submitReschedule}>
          Save
        </Button>
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
