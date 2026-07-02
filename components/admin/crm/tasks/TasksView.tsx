'use client'

/**
 * TasksView — the §09 Part 1 desktop Tasks module
 * (docs/fub-crm-spec/09-tasks-and-calendar.md).
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
 */

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Check, ChevronsRight, ClipboardList, Clock, DoorOpen, Flag, Heart, Home,
  Info, Mail, MessageSquare, Pencil, Phone, User,
} from 'lucide-react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { taskGroupLabel, time12 } from '@/lib/crm/calendar'
import { zonedDateKey, zonedMinutes } from '@/lib/format/date'
import type { TaskQueueRow, TaskQueueCounts, CrmTaskType } from '@/lib/data/crm/getTaskQueue'
import type { TaskActions } from './TaskQueue'

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── §1.12 type icon map ───────────────────────────────────────────────────────

function TypeIcon({ type }: { type: string | null }) {
  const cls = 'h-4 w-4 shrink-0'
  switch (type) {
    case 'Follow Up': return <Flag className={cn(cls, 'text-primary')} aria-hidden />
    case 'Call': return <Phone className={cn(cls, 'text-success')} aria-hidden />
    case 'Email': return <Mail className={cn(cls, 'text-primary')} aria-hidden />
    case 'Text': return <MessageSquare className={cn(cls, 'text-primary')} aria-hidden />
    case 'Showing': return <Home className={cn(cls, 'text-warning')} aria-hidden />
    case 'Closing': return <Check className={cn(cls, 'text-success')} aria-hidden />
    case 'Open House': return <DoorOpen className={cn(cls, 'text-warning')} aria-hidden />
    case 'Thank You': return <Heart className={cn(cls, 'text-destructive')} aria-hidden />
    default: return <ClipboardList className={cn(cls, 'text-muted-foreground')} aria-hidden />
  }
}

/** Deterministic avatar tint per contact (§1.5.3 "color assigned per contact"). */
const AVATAR_TINTS = [
  'bg-primary/15 text-primary',
  'bg-success/15 text-success',
  'bg-warning/25 text-warning-foreground',
  'bg-secondary text-secondary-foreground',
  'bg-muted text-muted-foreground',
] as const

function initials(name: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
}

function avatarTint(id: number | null): string {
  return AVATAR_TINTS[Math.abs(id ?? 0) % AVATAR_TINTS.length]
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
      <div className="flex flex-wrap items-center gap-2 border-b border-border">
        <div className="flex items-center">
          {tabs.map((t) => {
            const active = view === t.key
            return (
              <Button
                key={t.key}
                type="button"
                variant="ghost"
                onClick={() => nav({ view: t.key === 'upcoming' ? 'future' : t.key })}
                className={cn(
                  'relative h-10 gap-1.5 rounded-none px-4 text-sm',
                  active
                    ? 'font-semibold text-foreground after:absolute after:inset-x-1 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary'
                    : 'text-muted-foreground',
                )}
              >
                {t.label}
                {t.key === 'overdue' && overdueBadge > 0 && (
                  <Badge className="h-5 bg-warning px-1.5 tabular-nums text-warning-foreground hover:bg-warning">
                    {overdueBadge}
                  </Badge>
                )}
              </Button>
            )
          })}
        </div>

        <span className="flex-1" />

        {/* §1.9 — How Tasks work */}
        <HowTasksWorkButton />

        {/* §1.4.2 — Filters ▾ */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="h-8">
              Filters ▾
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuCheckboxItem
              checked={allTypesChecked}
              onCheckedChange={() => setHiddenTypes(allTypesChecked ? new Set(taskTypes.map((t) => t.key)) : new Set())}
              onSelect={(e) => e.preventDefault()}
            >
              All types
            </DropdownMenuCheckboxItem>
            {taskTypes.filter((t) => t.isActive).map((t) => (
              <DropdownMenuCheckboxItem
                key={t.key}
                checked={!hiddenTypes.has(t.key)}
                onCheckedChange={() => toggleType(t.key)}
                onSelect={(e) => e.preventDefault()}
              >
                <span className="flex items-center gap-2">
                  <TypeIcon type={t.key} />
                  {t.label}
                </span>
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={showCompleted}
              onCheckedChange={(v) => nav({ completed: v === true })}
              onSelect={(e) => e.preventDefault()}
            >
              Show Completed
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* §1.4.3 — agent scope (permission-gated to the owner) */}
        {isSuperuser ? (
          <Select value={agent} onValueChange={(v) => nav({ agent: v })}>
            <SelectTrigger className="h-8 w-28 text-xs" aria-label="Agent scope">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="me">Me</SelectItem>
              <SelectItem value="all">All</SelectItem>
              {brokers.filter((b) => b.slug !== currentBrokerSlug).map((b) => (
                <SelectItem key={b.slug} value={b.slug}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Button type="button" variant="outline" size="sm" className="h-8" disabled>
            Me
          </Button>
        )}
      </div>

      {error && <p className="mt-2 text-sm font-medium text-destructive">{error}</p>}

      {/* ══ Two-panel body (§1.2) ══ */}
      <div className="mt-3 flex min-w-0 items-stretch gap-3">
        {/* LEFT PANEL — idle gray / selected-task detail */}
        <div className="w-2/5 shrink-0 rounded-xl bg-muted/60 p-3">
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
            <p className="p-4 text-sm text-muted-foreground">Select a task to see its details.</p>
          )}
        </div>

        {/* TASK LIST PANEL */}
        <Card className="min-w-0 flex-1 gap-0 rounded-xl py-0">
          {/* §1.5.1 content header */}
          <div className="flex items-center justify-between gap-2 px-4 py-3">
            <span className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
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
          <Separator />

          {/* §1.5.2 / §1.5.3 date groups + rows */}
          {groups.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
              <Pencil className="h-8 w-8 text-muted-foreground/40" aria-hidden />
              <p className="text-sm text-muted-foreground">
                {view === 'upcoming' ? 'No future tasks.' : view === 'today' ? 'No tasks due today.' : 'No overdue tasks.'}
              </p>
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/crm/tasks?view=${view === 'upcoming' ? 'future' : view}&new=1`}>Create task</Link>
              </Button>
            </div>
          ) : (
            <div className="pb-2">
              {groups.map((g) => (
                <div key={g.key}>
                  <p className="px-4 pb-1 pt-3 text-[13px] text-muted-foreground">
                    {g.label} ({g.tasks.length})
                  </p>
                  <div className="divide-y divide-border/70">
                    {g.tasks.map((t) => (
                      <TaskRow
                        key={t.id}
                        task={t}
                        struck={striking.has(t.id) || !!t.completedAt}
                        completed={!!t.completedAt}
                        selected={selectedId === t.id}
                        disabled={pending}
                        onCheck={() => completeTask(t)}
                        onSelect={() => setSelectedId(t.id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

// ── §1.5.3 task row ───────────────────────────────────────────────────────────

function TaskRow({
  task,
  struck,
  completed,
  selected,
  disabled,
  onCheck,
  onSelect,
}: {
  task: TaskQueueRow
  struck: boolean
  completed: boolean
  selected: boolean
  disabled: boolean
  onCheck: () => void
  onSelect: () => void
}) {
  const dueLabel = task.dueAt ? time12(zonedMinutes(task.dueAt)) : ''
  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-2.5 transition-colors',
        selected && 'bg-secondary/50',
        completed && 'opacity-60',
      )}
    >
      <Checkbox
        checked={struck}
        disabled={disabled || completed}
        onCheckedChange={() => onCheck()}
        aria-label={`Complete: ${task.name}`}
      />
      <Avatar className="h-8 w-8">
        <AvatarFallback className={cn('text-[11px] font-medium', avatarTint(task.personId))}>
          {initials(task.personName)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          {task.personId ? (
            <Link
              href={`/admin/console/leads/${task.personId}`}
              className="truncate text-sm font-medium text-primary hover:underline"
            >
              {task.personName ?? `Contact #${task.personId}`}
            </Link>
          ) : (
            <span className="truncate text-sm font-medium text-foreground">No contact</span>
          )}
          <TypeIcon type={task.type} />
          <span className={cn('min-w-0 truncate text-sm text-foreground/80', struck && 'line-through')}>
            {task.name}
          </span>
        </span>
        <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
          <User className="h-3 w-3" aria-hidden />
          {task.assignedBroker
            ? task.assignedBroker.charAt(0).toUpperCase() + task.assignedBroker.slice(1)
            : 'Unassigned'}
        </span>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        {dueLabel && (
          <span className="flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
            <Clock className="h-3 w-3" aria-hidden />
            {dueLabel}
          </span>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onSelect}
          aria-label={`Open task: ${task.name}`}
          className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
        >
          <ChevronsRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
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
    <Card className="gap-0 rounded-lg py-0">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className={cn('text-[11px] font-medium', avatarTint(task.personId))}>
              {initials(task.personName)}
            </AvatarFallback>
          </Avatar>
          <div>
            {task.personId ? (
              <Link href={`/admin/console/leads/${task.personId}`} className="text-sm font-semibold text-primary hover:underline">
                {task.personName ?? `Contact #${task.personId}`}
              </Link>
            ) : (
              <p className="text-sm font-semibold text-foreground">No contact</p>
            )}
            {task.personStage && <p className="text-xs text-muted-foreground">{task.personStage}</p>}
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onClose}>
          Close
        </Button>
      </div>
      <Separator />
      <div className="space-y-3 px-4 py-3">
        <div className="space-y-1">
          <Label htmlFor="task-detail-name" className="text-xs text-muted-foreground">Task</Label>
          <Input id="task-detail-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger aria-label="Task type"><SelectValue /></SelectTrigger>
              <SelectContent>
                {taskTypes.map((t) => (
                  <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="task-detail-due" className="text-xs text-muted-foreground">Due</Label>
            <Input id="task-detail-due" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
        </div>
        {isSuperuser && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Assigned to</Label>
            <Select
              value={task.assignedBroker ?? ''}
              onValueChange={(v) => run(() => actions.reassign(task.id, v))}
            >
              <SelectTrigger aria-label="Reassign"><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                {brokers.map((b) => (
                  <SelectItem key={b.slug} value={b.slug}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {err && <p className="text-xs font-medium text-destructive">{err}</p>}
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button" size="sm" disabled={pending || !name.trim()}
            onClick={() => run(() => actions.update({ id: task.id, name: name.trim(), type, dueAt: due ? `${due}:00Z` : null }))}
          >
            Save
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={onComplete}>
            Complete
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={pending}
            onClick={() => run(() => actions.snooze(task.id, 1))}>
            Snooze 1d
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={pending}
            onClick={() => run(() => actions.snooze(task.id, 7))}>
            7d
          </Button>
          <Button
            type="button" variant="ghost" size="sm" disabled={pending}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => run(() => actions.remove(task.id), onClose)}
          >
            Delete
          </Button>
        </div>
      </div>
    </Card>
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
  const [pending, startTransition] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto p-0 text-sm font-medium text-primary hover:bg-transparent hover:underline"
        >
          Clear My Overdue Tasks
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Clear your overdue tasks?</AlertDialogTitle>
          <AlertDialogDescription>
            This completes all of your overdue tasks (up to {count} shown). It never touches
            another agent&rsquo;s tasks, and it cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {err && <p className="text-sm font-medium text-destructive">{err}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={(e) => {
              e.preventDefault()
              startTransition(async () => {
                const res = await clearOverdue()
                if (!res.ok) { setErr(res.error ?? 'Could not clear tasks'); return }
                onCleared()
              })
            }}
          >
            {pending ? 'Clearing…' : 'Clear tasks'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ── §1.9 How Tasks Work ───────────────────────────────────────────────────────

function HowTasksWorkButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setOpen(true)}>
        <Info className="h-3.5 w-3.5" aria-hidden />
        How Tasks work
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4" aria-hidden />
              How Tasks Work
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              Tasks are action reminders tied to a contact. They land in one of three buckets:
              <span className="font-medium text-foreground"> Today&rsquo;s Tasks</span> (due today),
              <span className="font-medium text-foreground"> Overdue</span> (past due — clear these first), and
              <span className="font-medium text-foreground"> Future</span> (due later, or no due date yet).
            </p>
            <p>
              Check a task off when it&rsquo;s done — completion is recorded on the contact&rsquo;s
              timeline. Tasks with a due time also show on the Calendar in amber.
            </p>
            <p>
              Create tasks from a contact&rsquo;s page, from the New Task button here, or let
              automations create them for you.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
