'use client'

/**
 * TasksView — the §09 Part 1 desktop Tasks module
 * (docs/crm-spec/09-tasks-and-calendar.md).
 *
 * Structure (§1.2): sub-tab bar (Today's Tasks | Overdue (N) | Future) with the
 * right-aligned toolbar (How Tasks work · Filters ▾ · Me ▾), over a two-panel
 * body — LEFT detail panel (~40%, light gray when idle; the selected task's
 * contact/task card otherwise) and the TASK LIST panel (~60%, white) with the
 * §1.5.1 content header ("Clear My Overdue Tasks" on Overdue only), §1.5.2
 * date-group headers ("Tuesday, Jun 23 (3)") and §1.5.3 task-row anatomy.
 *
 * Completion (§1.6): optimistic — checkbox fills, text strikes through, the
 * Overdue badge decrements in the same tick, the row slides out after ~500ms.
 *
 * Admin v2 migration (11F): every shadcn/ui import replaced with
 * '@/components/admin/v2' primitives; every semantic shadcn color utility
 * (surface / muted-text / accent / destructive, …) replaced with var(--a-*)
 * tokens or av2 CSS classes per design_system/admin/ADMIN_UI.md. Presentation
 * only — no data, props, effects, conditionals, or user-facing strings changed.
 */

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Clock, Info, Pencil } from 'lucide-react'
import {
  Button, ConfirmDialog, Dialog, ToolbarCheck, ToolbarSelect,
} from '@/components/admin/v2'
import { taskGroupLabel } from '@/lib/crm/calendar'
import { zonedDateKey } from '@/lib/format/date'
import type { TaskQueueRow, TaskQueueCounts, CrmTaskType } from '@/lib/data/crm/getTaskQueue'
import { HowTasksWorkBody, TaskDetailForm, TaskRow, TypeIcon, avatarTint } from './tasks-view-bits'

// ── Types ─────────────────────────────────────────────────────────────────────

type TaskActionResult = { ok: boolean; error?: string }

/** The uniform server-action bundle both task surfaces receive (was TaskQueue's). */
export type TaskActions = {
  complete: (taskId: number, personId: number | null) => Promise<TaskActionResult>
  bulkComplete: (ids: number[]) => Promise<TaskActionResult>
  snooze: (id: number, days: number) => Promise<TaskActionResult>
  remove: (id: number) => Promise<TaskActionResult>
  update: (input: { id: number; name?: string; type?: string; dueAt?: string | null }) => Promise<TaskActionResult>
  reassign: (id: number, broker: string) => Promise<TaskActionResult>
}

export type TasksDesktopView = 'today' | 'overdue' | 'upcoming'

export type TasksViewProps = {
  rows: TaskQueueRow[]
  /** Trailing-30d completed rows — merged in when "Show Completed" is on. */
  completedRows: TaskQueueRow[]
  counts: TaskQueueCounts
  view: TasksDesktopView
  taskTypes: CrmTaskType[]
  brokers: Array<{ slug: string; name: string }>
  isSuperuser: boolean
  currentBrokerSlug: string
  /** 'me' | 'all' | broker slug (superuser only). */
  agent: string
  todayKey: string
  showCompleted: boolean
  actions: TaskActions
  clearOverdue: () => Promise<{ ok: boolean; cleared?: number; error?: string }>
}

const VIEW_TITLES: Record<TasksDesktopView, string> = {
  today: "Today's Tasks",
  overdue: 'Overdue Tasks',
  upcoming: 'Future Tasks',
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TasksView({
  rows,
  completedRows,
  counts,
  view,
  taskTypes,
  brokers,
  isSuperuser,
  currentBrokerSlug,
  agent,
  todayKey,
  showCompleted,
  actions,
  clearOverdue,
}: TasksViewProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  // Optimistic completion state (§1.6)
  const [striking, setStriking] = useState<Set<number>>(new Set())
  const [gone, setGone] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)

  // Left-panel selection
  const [selectedId, setSelectedId] = useState<number | null>(null)

  // Filters ▾ (§1.4.2) — live, client-side
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set())
  const allTypesChecked = hiddenTypes.size === 0

  const nav = (next: { view?: string; agent?: string; completed?: boolean }) => {
    const params = new URLSearchParams()
    params.set('view', next.view ?? view)
    const a = next.agent ?? agent
    if (a && a !== 'me') params.set('agent', a)
    const c = next.completed ?? showCompleted
    if (c) params.set('completed', '1')
    router.push(`/admin/crm/tasks?${params.toString()}`)
  }

  // ── Merge + group ───────────────────────────────────────────────────────────
  const visibleRows = useMemo(() => {
    const open = rows.filter(
      (t) => !gone.has(t.id) && (!t.type || !hiddenTypes.has(t.type)),
    )
    if (!showCompleted) return open
    // §1.16 — completed tasks slot into the date group their due date belongs
    // to, restricted to the active bucket.
    const inBucket = completedRows.filter((t) => {
      if (t.type && hiddenTypes.has(t.type)) return false
      const key = t.dueAt ? zonedDateKey(t.dueAt) : null
      if (view === 'today') return key === todayKey
      if (view === 'overdue') return !!key && key < todayKey
      return key === null || (!!key && key > todayKey)
    })
    return [...open, ...inBucket]
  }, [rows, completedRows, gone, hiddenTypes, showCompleted, view, todayKey])

  const groups = useMemo(() => {
    const map = new Map<string, TaskQueueRow[]>()
    for (const t of visibleRows) {
      const key = t.dueAt ? zonedDateKey(t.dueAt) : 'nodate'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(t)
    }
    const keys = [...map.keys()].sort()
    if (view === 'overdue') keys.reverse() // §1.5.2 — most recent first
    // "No due date" group always last (§1.8 — Future includes undated tasks).
    const ordered = keys.filter((k) => k !== 'nodate')
    if (map.has('nodate')) ordered.push('nodate')
    return ordered.map((k) => ({
      key: k,
      label: k === 'nodate' ? 'No due date' : taskGroupLabel(k),
      tasks: map.get(k)!.sort((a, b) => (a.dueAt ?? '').localeCompare(b.dueAt ?? '')),
    }))
  }, [visibleRows, view])

  // Live badge (§1.6 step 4): server count minus optimistic completions.
  const struckOverdue = view === 'overdue' ? striking.size + gone.size : 0
  const overdueBadge = Math.max(counts.overdue - struckOverdue, 0)

  const selected = visibleRows.find((t) => t.id === selectedId) ?? null

  // ── Completion flow (§1.6) ─────────────────────────────────────────────────
  const completeTask = (t: TaskQueueRow) => {
    if (striking.has(t.id) || gone.has(t.id)) return
    setError(null)
    setStriking((prev) => new Set(prev).add(t.id))
    setTimeout(() => {
      setGone((prev) => new Set(prev).add(t.id))
      if (selectedId === t.id) setSelectedId(null)
    }, 500)
    startTransition(async () => {
      const res = await actions.complete(t.id, t.personId)
      if (!res.ok) {
        setStriking((prev) => { const n = new Set(prev); n.delete(t.id); return n })
        setGone((prev) => { const n = new Set(prev); n.delete(t.id); return n })
        setError(res.error ?? 'Could not complete task')
      }
    })
  }

  const toggleType = (key: string) =>
    setHiddenTypes((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const tabs: Array<{ key: TasksDesktopView; label: string }> = [
    { key: 'today', label: "Today's Tasks" },
    { key: 'overdue', label: 'Overdue' },
    { key: 'upcoming', label: 'Future' },
  ]

  return (
    <div className="flex min-w-0 flex-col">
      {/* ══ Sub-tab bar + toolbar (§1.3 / §1.4) ══ */}
      <div className="flex flex-wrap items-center gap-2" style={{ borderBottom: '1px solid var(--a-border)' }}>
        <div className="flex items-center">
          {tabs.map((t) => {
            const active = view === t.key
            return (
              <Button
                key={t.key}
                variant="quiet"
                onClick={() => nav({ view: t.key === 'upcoming' ? 'future' : t.key })}
                className="relative gap-1.5 px-4 text-sm"
                style={{
                  minHeight: 40,
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 0,
                  color: active ? 'var(--a-text)' : 'var(--a-text-2)',
                  fontWeight: active ? 600 : 500,
                }}
              >
                {t.label}
                {t.key === 'overdue' && overdueBadge > 0 && (
                  <span className="av2-state av2-state--slow a-num" style={{ marginLeft: 2 }}>
                    {overdueBadge}
                  </span>
                )}
                {active && (
                  <span
                    aria-hidden
                    className="absolute inset-x-1 bottom-0 h-0.5 rounded-full"
                    style={{ background: 'var(--a-accent)' }}
                  />
                )}
              </Button>
            )
          })}
        </div>

        <span className="flex-1" />

        {/* §1.9 — How Tasks work */}
        <HowTasksWorkButton />

        {/* §1.4.2 — Filters ▾ */}
        <FiltersMenu
          taskTypes={taskTypes}
          hiddenTypes={hiddenTypes}
          allTypesChecked={allTypesChecked}
          onToggleType={toggleType}
          onToggleAll={() => setHiddenTypes(allTypesChecked ? new Set(taskTypes.map((t) => t.key)) : new Set())}
          showCompleted={showCompleted}
          onToggleCompleted={(v) => nav({ completed: v })}
        />

        {/* §1.4.3 — agent scope (permission-gated to the owner) */}
        {isSuperuser ? (
          <ToolbarSelect aria-label="Agent scope" value={agent} onChange={(e) => nav({ agent: e.target.value })}>
            <option value="me">Me</option>
            <option value="all">All</option>
            {brokers.filter((b) => b.slug !== currentBrokerSlug).map((b) => (
              <option key={b.slug} value={b.slug}>{b.name}</option>
            ))}
          </ToolbarSelect>
        ) : (
          <Button variant="quiet" disabled>
            Me
          </Button>
        )}
      </div>

      {error && <p className="mt-2 text-sm font-medium" style={{ color: 'var(--a-danger)' }}>{error}</p>}

      {/* ══ Two-panel body (§1.2) ══ */}
      <div className="mt-3 flex min-w-0 items-stretch gap-3">
        {/* LEFT PANEL — idle gray / selected-task detail */}
        <div className="w-2/5 shrink-0 rounded-xl p-3" style={{ background: 'var(--a-inset)' }}>
          {selected ? (
            <TaskDetailCard
              task={selected}
              taskTypes={taskTypes}
              brokers={brokers}
              isSuperuser={isSuperuser}
              actions={actions}
              onComplete={() => completeTask(selected)}
              onClose={() => setSelectedId(null)}
            />
          ) : (
            <p className="p-4 text-sm" style={{ color: 'var(--a-text-2)' }}>Select a task to see its details.</p>
          )}
        </div>

        {/* TASK LIST PANEL */}
        <div className="min-w-0 flex-1 rounded-xl" style={{ border: '1px solid var(--a-border)', background: 'var(--a-bg)' }}>
          {/* §1.5.1 content header */}
          <div className="flex items-center justify-between gap-2 px-4 py-3">
            <span className="flex items-center gap-2 text-[15px] font-semibold" style={{ color: 'var(--a-text)' }}>
              <Clock className="h-4 w-4" aria-hidden />
              {VIEW_TITLES[view]}
            </span>
            {view === 'overdue' && overdueBadge > 0 && (
              <ClearOverdueLink
                count={overdueBadge}
                clearOverdue={clearOverdue}
                onCleared={() => router.refresh()}
              />
            )}
          </div>
          <div style={{ borderTop: '1px solid var(--a-border)' }} />

          {/* §1.5.2 / §1.5.3 date groups + rows */}
          {groups.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
              <Pencil className="h-8 w-8" style={{ color: 'var(--a-text-2)', opacity: 0.4 }} aria-hidden />
              <p className="text-sm" style={{ color: 'var(--a-text-2)' }}>
                {view === 'upcoming' ? 'No future tasks.' : view === 'today' ? 'No tasks due today.' : 'No overdue tasks.'}
              </p>
              <Link
                href={`/admin/crm/tasks?view=${view === 'upcoming' ? 'future' : view}&new=1`}
                className="av2-btn av2-btn--quiet"
              >
                Create task
              </Link>
            </div>
          ) : (
            <div className="pb-2">
              {groups.map((g) => (
                <div key={g.key}>
                  <p className="px-4 pb-1 pt-3 text-[13px]" style={{ color: 'var(--a-text-2)' }}>
                    {g.label} ({g.tasks.length})
                  </p>
                  <div className="flex flex-col">
                    {g.tasks.map((t, idx) => (
                      <div key={t.id} style={idx > 0 ? { borderTop: '1px solid var(--a-border)' } : undefined}>
                        <TaskRow
                          task={t}
                          struck={striking.has(t.id) || !!t.completedAt}
                          completed={!!t.completedAt}
                          selected={selectedId === t.id}
                          disabled={pending}
                          onCheck={() => completeTask(t)}
                          onSelect={() => setSelectedId(t.id)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── §1.4.2 Filters ▾ — a multi-check panel, not an actions menu, so it is not
// built from the Menu primitive (Menu auto-closes on every item click; a
// filter checklist must stay open while checks are toggled — the same reason
// the original DropdownMenuCheckboxItem calls e.preventDefault() on select).
// The panel reuses the av2-menu / av2-menu__panel token classes for visual
// consistency and ToolbarCheck for each row. ─────────────────────────────────

function FiltersMenu({
  taskTypes,
  hiddenTypes,
  allTypesChecked,
  onToggleType,
  onToggleAll,
  showCompleted,
  onToggleCompleted,
}: {
  taskTypes: CrmTaskType[]
  hiddenTypes: Set<string>
  allTypesChecked: boolean
  onToggleType: (key: string) => void
  onToggleAll: () => void
  showCompleted: boolean
  onToggleCompleted: (v: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={wrapRef} className="av2-menu">
      <Button
        variant="quiet"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        Filters ▾
      </Button>
      {open && (
        <div className="av2-menu__panel" role="menu" aria-label="Task filters" data-align="end" style={{ minWidth: 220 }}>
          <div style={{ padding: '4px 8px' }}>
            <ToolbarCheck label="All types" checked={allTypesChecked} onChange={onToggleAll} />
          </div>
          {taskTypes.filter((t) => t.isActive).map((t) => (
            <div key={t.key} style={{ padding: '4px 8px' }}>
              <ToolbarCheck
                label={
                  <span className="flex items-center gap-2">
                    <TypeIcon type={t.key} />
                    {t.label}
                  </span>
                }
                checked={!hiddenTypes.has(t.key)}
                onChange={() => onToggleType(t.key)}
              />
            </div>
          ))}
          <div style={{ borderTop: '1px solid var(--a-border)', margin: '4px 0' }} />
          <div style={{ padding: '4px 8px' }}>
            <ToolbarCheck
              label="Show Completed"
              checked={showCompleted}
              onChange={(e) => onToggleCompleted(e.target.checked)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Left-panel task detail ────────────────────────────────────────────────────

function TaskDetailCard({
  task,
  taskTypes,
  brokers,
  isSuperuser,
  actions,
  onComplete,
  onClose,
}: {
  task: TaskQueueRow
  taskTypes: CrmTaskType[]
  brokers: Array<{ slug: string; name: string }>
  isSuperuser: boolean
  actions: TaskActions
  onComplete: () => void
  onClose: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState(task.name)
  const [type, setType] = useState(task.type ?? 'Follow Up')
  const [due, setDue] = useState(task.dueAt ? task.dueAt.slice(0, 16) : '')
  const [err, setErr] = useState<string | null>(null)
  const tint = avatarTint(task.personId)

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => {
    setErr(null)
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) { setErr(res.error ?? 'Action failed'); return }
      router.refresh()
      after?.()
    })
  }

  return (
    <TaskDetailForm
      task={task}
      taskTypes={taskTypes}
      brokers={brokers}
      isSuperuser={isSuperuser}
      tint={tint}
      name={name}
      type={type}
      due={due}
      err={err}
      pending={pending}
      onNameChange={setName}
      onTypeChange={setType}
      onDueChange={setDue}
      onReassign={(v) => run(() => actions.reassign(task.id, v))}
      onSave={() => run(() => actions.update({ id: task.id, name: name.trim(), type, dueAt: due ? `${due}:00Z` : null }))}
      onComplete={onComplete}
      onSnooze1={() => run(() => actions.snooze(task.id, 1))}
      onSnooze7={() => run(() => actions.snooze(task.id, 7))}
      onDelete={() => run(() => actions.remove(task.id), onClose)}
      onClose={onClose}
    />
  )
}

// ── §1.5.1 Clear My Overdue Tasks ─────────────────────────────────────────────

function ClearOverdueLink({
  count,
  clearOverdue,
  onCleared,
}: {
  count: number
  clearOverdue: () => Promise<{ ok: boolean; cleared?: number; error?: string }>
  onCleared: () => void
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  return (
    <>
      <Button
        variant="quiet"
        className="text-sm font-medium"
        style={{ background: 'transparent', border: 'none', padding: 0, minHeight: 'auto', color: 'var(--a-accent)' }}
        onClick={() => setOpen(true)}
      >
        Clear My Overdue Tasks
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Clear your overdue tasks?"
        description={
          <>
            This completes all of your overdue tasks (up to {count} shown). It never touches
            another agent&rsquo;s tasks, and it cannot be undone.
          </>
        }
        confirmLabel={pending ? 'Clearing…' : 'Clear tasks'}
        busy={pending}
        onConfirm={() => {
          setErr(null)
          startTransition(async () => {
            const res = await clearOverdue()
            if (!res.ok) { setErr(res.error ?? 'Could not clear tasks'); return }
            onCleared()
          })
        }}
      >
        {err && <p className="text-sm font-medium" style={{ color: 'var(--a-danger)' }}>{err}</p>}
      </ConfirmDialog>
    </>
  )
}

// ── §1.9 How Tasks Work ───────────────────────────────────────────────────────

function HowTasksWorkButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="quiet" className="gap-1.5" onClick={() => setOpen(true)}>
        <Info className="h-3.5 w-3.5" aria-hidden />
        How Tasks work
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="How Tasks Work">
        <HowTasksWorkBody />
      </Dialog>
    </>
  )
}
