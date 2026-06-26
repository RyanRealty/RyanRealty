'use client'

/**
 * TaskQueue — the cross-contact task queue with row-level lifecycle controls
 * (Wave 7). Renders the rows for the active view (today / overdue / upcoming /
 * completed) with multi-select bulk-complete and a per-row action menu
 * (complete, snooze, edit, reassign, delete). Every mutation calls the pre-bound
 * server actions passed in; the component holds only selection + edit-dialog UI
 * state.
 *
 * Mobile (< md): FUB calendar/agenda layout — CrmSegmented view tabs + grouped
 * agenda with CrmSectionLabel date headers, CrmList, CrmListRow, and an inline
 * Done button in the trailing slot. Shared CrmMobileKit; zero desktop changes.
 */

import { useState, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/lib/format/date'
import { CRM_BROKERS, CRM_BROKER_DISPLAY, type CrmBrokerSlug } from '@/lib/crm/constants'
import type { TaskQueueRow, TaskQueueView, CrmTaskType } from '@/lib/data/crm/getTaskQueue'
import {
  CrmList,
  CrmListRow,
  CrmSegmented,
  CrmSectionLabel,
} from '@/components/admin/crm/mobile/CrmMobileKit'

type TaskActionResult = { ok: boolean; error?: string }

export type TaskActions = {
  complete: (taskId: number, personId: number | null) => Promise<TaskActionResult>
  bulkComplete: (ids: number[]) => Promise<TaskActionResult>
  snooze: (id: number, days: number) => Promise<TaskActionResult>
  remove: (id: number) => Promise<TaskActionResult>
  update: (input: { id: number; name?: string; type?: string; dueAt?: string | null }) => Promise<TaskActionResult>
  reassign: (id: number, broker: string) => Promise<TaskActionResult>
}

function brokerLabel(slug: string | null): string {
  if (!slug) return 'Unassigned'
  return CRM_BROKER_DISPLAY[slug as CrmBrokerSlug] ?? slug
}

/* ── Mobile agenda helpers ──────────────────────────────────────────────────
 * Groups a flat list of tasks into [{label, tasks}] buckets keyed by calendar
 * day. Uses the same TZ the brand uses (America/Los_Angeles) so the day break
 * matches what a broker in Central Oregon would expect.
 */

const TZ = 'America/Los_Angeles'

/** e.g. "MONDAY, JUNE 22ND" — FUB-style section header */
function agendaDateLabel(iso: string | null): string {
  if (!iso) return 'NO DATE'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'NO DATE'
  const day = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, weekday: 'long',
  }).format(d).toUpperCase()
  const month = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, month: 'long',
  }).format(d).toUpperCase()
  const date = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, day: 'numeric',
  }).format(d)
  // ordinal suffix
  const n = parseInt(date, 10)
  const suffix = n === 1 || n === 21 || n === 31 ? 'ST' : n === 2 || n === 22 ? 'ND' : n === 3 || n === 23 ? 'RD' : 'TH'
  return `${day}, ${month} ${date}${suffix}`
}

/** "9:30 AM" from an ISO string — shown as the right-side meta on each row. */
function agendaTimeLabel(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hour: 'numeric', minute: '2-digit',
  }).format(d)
}

/** YYYY-MM-DD in TZ — the bucket key for grouping. */
function dayKey(iso: string | null): string {
  if (!iso) return 'nodate'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'nodate'
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d) // yields YYYY-MM-DD
}

type AgendaGroup = { key: string; label: string; tasks: TaskQueueRow[] }

function groupByDay(rows: TaskQueueRow[], completed: boolean): AgendaGroup[] {
  const map = new Map<string, AgendaGroup>()
  for (const t of rows) {
    const iso = completed ? t.completedAt : t.dueAt
    const k = dayKey(iso)
    if (!map.has(k)) {
      map.set(k, { key: k, label: k === 'nodate' ? 'NO DATE' : agendaDateLabel(iso), tasks: [] })
    }
    map.get(k)!.tasks.push(t)
  }
  // Sort groups: nodate last, otherwise ascending by day key (YYYY-MM-DD sorts lexicographically)
  return [...map.values()].sort((a, b) => {
    if (a.key === 'nodate') return 1
    if (b.key === 'nodate') return -1
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0
  })
}

const MOBILE_VIEWS: { value: TaskQueueView; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'completed', label: 'Done' },
]

export default function TaskQueue({
  rows,
  view,
  taskTypes,
  canReassign,
  actions,
}: {
  rows: TaskQueueRow[]
  view: TaskQueueView
  taskTypes: CrmTaskType[]
  canReassign: boolean
  actions: TaskActions
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [editTask, setEditTask] = useState<TaskQueueRow | null>(null)

  const isCompletedView = view === 'completed'

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const run = (fn: () => Promise<TaskActionResult>) => {
    setError(null)
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) {
        setError(res.error ?? 'Could not update the task')
        return
      }
      setSelected(new Set())
      setEditTask(null)
      router.refresh()
    })
  }

  // ── Mobile: grouped agenda ───────────────────────────────────────────────
  const agendaGroups = groupByDay(rows, isCompletedView)

  // Stable complete handler for mobile rows (avoids closures inside map)
  const mobileComplete = useCallback(
    (t: TaskQueueRow, e: React.MouseEvent) => {
      e.preventDefault() // don't navigate the row's href
      e.stopPropagation()
      run(() => actions.complete(t.id, t.personId))
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pending],
  )

  const mobileEmpty = (
    <p className="py-12 text-center text-sm text-muted-foreground">
      Nothing in this view.
    </p>
  )

  // ── Common empty state (desktop) ─────────────────────────────────────────
  if (rows.length === 0) {
    return (
      <>
        {/* Mobile: show segmented + empty state so tabs still work */}
        <div className="md:hidden">
          <CrmSegmented
            options={MOBILE_VIEWS}
            value={view}
            onChange={(v) => router.push(`/admin/crm/tasks?view=${v}`)}
            className="-mx-3 mb-0"
          />
          {mobileEmpty}
        </div>
        {/* Desktop */}
        <p className="hidden py-10 text-center text-sm text-muted-foreground md:block">
          Nothing in this view. New tasks land here the moment a lead acts or a follow-up comes due.
        </p>
      </>
    )
  }

  return (
    <div className="space-y-3">
      {/* ── MOBILE AGENDA (< md) ─────────────────────────────────────────── */}
      <div className="md:hidden">
        {/* Segmented view tabs — drives URL so the server re-fetches */}
        <CrmSegmented
          options={MOBILE_VIEWS}
          value={view}
          onChange={(v) => router.push(`/admin/crm/tasks?view=${v}`)}
          className="-mx-3 mb-0"
        />

        {error ? (
          <p className="mt-3 text-sm font-medium text-destructive">{error}</p>
        ) : null}

        {agendaGroups.length === 0 ? mobileEmpty : (
          <div className="-mx-3 mt-0 border-t border-border">
            {agendaGroups.map((group) => (
              <div key={group.key}>
                <CrmSectionLabel>{group.label}</CrmSectionLabel>
                <CrmList>
                  {group.tasks.map((t) => {
                    const personName = t.personName ?? 'No contact'
                    const timeStr = isCompletedView
                      ? agendaTimeLabel(t.completedAt)
                      : agendaTimeLabel(t.dueAt)
                    const subtitle = t.type
                      ? `${personName} · ${t.type}`
                      : personName

                    const trailing = isCompletedView ? (
                      <CheckCircle2 className="h-5 w-5 text-muted-foreground/40" aria-label="Completed" />
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Complete ${t.name}`}
                        disabled={pending}
                        onClick={(e) => mobileComplete(t, e)}
                        className="h-9 w-9 shrink-0 rounded-full"
                      >
                        <CheckCircle2 className="h-6 w-6 text-muted-foreground/50" />
                      </Button>
                    )

                    return (
                      <CrmListRow
                        key={t.id}
                        href={t.personId ? `/admin/crm/${t.personId}` : undefined}
                        name={personName}
                        title={t.name}
                        subtitle={subtitle}
                        meta={timeStr || undefined}
                        trailing={trailing}
                      />
                    )
                  })}
                </CrmList>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── DESKTOP CARD LIST (≥ md) ─────────────────────────────────────── */}
      <div className="hidden md:block">
        {!isCompletedView && selected.size > 0 ? (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/40 p-2">
            <span className="px-1 text-sm font-medium tabular-nums text-foreground">{selected.size} selected</span>
            <Button type="button" size="sm" disabled={pending} onClick={() => run(() => actions.bulkComplete([...selected]))}>
              Complete selected
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        ) : null}

        {error ? <p className="mb-2 text-sm font-medium text-destructive">{error}</p> : null}

        <div className="space-y-2">
          {rows.map((t) => (
            <Card key={t.id}>
              <CardContent className="flex items-start gap-3 p-3 sm:p-4">
                {!isCompletedView ? (
                  <div className="pt-0.5">
                    <Checkbox
                      checked={selected.has(t.id)}
                      onCheckedChange={() => toggle(t.id)}
                      aria-label={`Select ${t.name}`}
                    />
                  </div>
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-foreground">{t.name}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    {t.personName && t.personId ? (
                      <a href={`/admin/crm/${t.personId}`} className="font-medium text-primary hover:underline">
                        {t.personName}
                      </a>
                    ) : (
                      <span>No contact</span>
                    )}
                    <span className="tabular-nums">
                      {isCompletedView ? `Done ${formatDateTime(t.completedAt)}` : formatDateTime(t.dueAt)}
                    </span>
                    {t.type ? (
                      <Badge variant="outline" className="text-xs">
                        {t.type}
                      </Badge>
                    ) : null}
                    <span>{brokerLabel(t.assignedBroker)}</span>
                  </div>
                </div>
                {!isCompletedView ? (
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-9 px-3 sm:h-8"
                      disabled={pending}
                      onClick={() => run(() => actions.complete(t.id, t.personId))}
                    >
                      Done
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-9 px-2.5 sm:h-8"
                      disabled={pending}
                      onClick={() => run(() => actions.snooze(t.id, 1))}
                    >
                      Snooze
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-9 px-2.5 sm:h-8"
                      disabled={pending}
                      onClick={() => setEditTask(t)}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-9 px-2.5 text-destructive sm:h-8"
                      disabled={pending}
                      onClick={() => run(() => actions.remove(t.id))}
                    >
                      Delete
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Edit dialog — shared between mobile and desktop */}
      <Dialog open={editTask !== null} onOpenChange={(o) => !o && setEditTask(null)}>
        <DialogContent>
          {editTask ? (
            <EditTaskForm
              task={editTask}
              taskTypes={taskTypes}
              canReassign={canReassign}
              pending={pending}
              onSave={(patch) => run(() => actions.update({ id: editTask.id, ...patch }))}
              onReassign={(broker) => run(() => actions.reassign(editTask.id, broker))}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function EditTaskForm({
  task,
  taskTypes,
  canReassign,
  pending,
  onSave,
  onReassign,
}: {
  task: TaskQueueRow
  taskTypes: CrmTaskType[]
  canReassign: boolean
  pending: boolean
  onSave: (patch: { name?: string; type?: string; dueAt?: string | null }) => void
  onReassign: (broker: string) => void
}) {
  const [name, setName] = useState(task.name)
  const [type, setType] = useState(task.type ?? '')
  // Datetime-local wants YYYY-MM-DDTHH:mm; derive from the ISO without a render Date.
  const [due, setDue] = useState(task.dueAt ? task.dueAt.slice(0, 16) : '')

  const activeTypes = taskTypes.filter((t) => t.isActive || t.key === task.type)

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit task</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="edit-task-name">Task</Label>
          <Input id="edit-task-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-task-type">Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger id="edit-task-type">
              <SelectValue placeholder="Select a type" />
            </SelectTrigger>
            <SelectContent>
              {activeTypes.map((t) => (
                <SelectItem key={t.key} value={t.key}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-task-due">Due</Label>
          <Input
            id="edit-task-due"
            type="datetime-local"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
        </div>
        {canReassign ? (
          <div className="space-y-1.5">
            <Label>Reassign</Label>
            <div className="flex flex-wrap gap-1.5">
              {CRM_BROKERS.map((b) => (
                <Button
                  key={b}
                  type="button"
                  size="sm"
                  variant={task.assignedBroker === b ? 'default' : 'outline'}
                  disabled={pending}
                  onClick={() => onReassign(b)}
                  className={cn('h-9 sm:h-8')}
                >
                  {CRM_BROKER_DISPLAY[b]}
                </Button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <DialogFooter>
        <Button
          type="button"
          disabled={pending}
          onClick={() =>
            onSave({
              name: name.trim() || undefined,
              type: type.trim() || undefined,
              dueAt: due ? new Date(due).toISOString() : null,
            })
          }
        >
          Save changes
        </Button>
      </DialogFooter>
    </>
  )
}
