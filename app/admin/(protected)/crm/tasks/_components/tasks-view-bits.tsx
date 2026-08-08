'use client'

/**
 * tasks-view-bits — stateless task-row presentation for TasksView, extracted
 * in 11F so that file stays under the 600-LOC budget (ci:file-size-budget).
 * Splitting the file is the fix the gate asks for; re-baselining a
 * ~780-line component is not.
 */
import Link from 'next/link'
import {
  Check, ChevronsRight, ClipboardList, Clock, DoorOpen, Flag, Heart, Home, Mail, MessageSquare, Phone, User,
} from 'lucide-react'
import { Button, IconButton, SelectField, TextField, ToolbarCheck } from '@/components/admin/v2'
import { cn } from '@/lib/utils'
import { time12 } from '@/lib/crm/calendar'
import { zonedMinutes } from '@/lib/format/date'
import type { TaskQueueRow, CrmTaskType } from '@/lib/data/crm/getTaskQueue'

// ── §1.12 type icon map ───────────────────────────────────────────────────────

export function TypeIcon({ type }: { type: string | null }) {
  const cls = 'h-4 w-4 shrink-0'
  switch (type) {
    case 'Follow Up': return <Flag className={cls} style={{ color: 'var(--a-accent)' }} aria-hidden />
    case 'Call': return <Phone className={cls} style={{ color: 'var(--a-ok)' }} aria-hidden />
    case 'Email': return <Mail className={cls} style={{ color: 'var(--a-accent)' }} aria-hidden />
    case 'Text': return <MessageSquare className={cls} style={{ color: 'var(--a-accent)' }} aria-hidden />
    case 'Showing': return <Home className={cls} style={{ color: 'var(--a-warn)' }} aria-hidden />
    case 'Closing': return <Check className={cls} style={{ color: 'var(--a-ok)' }} aria-hidden />
    case 'Open House': return <DoorOpen className={cls} style={{ color: 'var(--a-warn)' }} aria-hidden />
    case 'Thank You': return <Heart className={cls} style={{ color: 'var(--a-danger)' }} aria-hidden />
    default: return <ClipboardList className={cls} style={{ color: 'var(--a-text-2)' }} aria-hidden />
  }
}

/** Deterministic avatar tint per contact (§1.5.3 "color assigned per contact"). */
const AVATAR_TINTS = [
  { bg: 'var(--a-accent-wash)', fg: 'var(--a-accent)' },
  { bg: 'var(--a-ok-wash)', fg: 'var(--a-ok)' },
  { bg: 'var(--a-warn-wash)', fg: 'var(--a-warn)' },
  { bg: 'var(--a-inset)', fg: 'var(--a-text)' },
  { bg: 'var(--a-inset)', fg: 'var(--a-text-2)' },
] as const

export function initials(name: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
}

export function avatarTint(id: number | null) {
  return AVATAR_TINTS[Math.abs(id ?? 0) % AVATAR_TINTS.length]
}

// ── §1.5.3 task row ───────────────────────────────────────────────────────────

export function TaskRow({
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
  const tint = avatarTint(task.personId)
  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 transition-colors"
      style={{
        background: selected ? 'var(--a-accent-wash)' : undefined,
        opacity: completed ? 0.6 : undefined,
      }}
    >
      <ToolbarCheck
        label={null}
        checked={struck}
        disabled={disabled || completed}
        onChange={() => onCheck()}
        aria-label={`Complete: ${task.name}`}
      />
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-medium"
        style={{ background: tint.bg, color: tint.fg }}
      >
        {initials(task.personName)}
      </span>
      <div className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          {task.personId ? (
            <Link
              href={`/admin/people/${task.personId}`}
              className="truncate text-sm font-medium hover:underline"
              style={{ color: 'var(--a-accent)' }}
            >
              {task.personName ?? `Contact #${task.personId}`}
            </Link>
          ) : (
            <span className="truncate text-sm font-medium" style={{ color: 'var(--a-text)' }}>No contact</span>
          )}
          <TypeIcon type={task.type} />
          <span
            className={cn('min-w-0 truncate text-sm', struck && 'line-through')}
            style={{ color: 'var(--a-text)', opacity: 0.8 }}
          >
            {task.name}
          </span>
        </span>
        <span className="mt-0.5 flex items-center gap-1 text-xs" style={{ color: 'var(--a-text-2)' }}>
          <User className="h-3 w-3" aria-hidden />
          {task.assignedBroker
            ? task.assignedBroker.charAt(0).toUpperCase() + task.assignedBroker.slice(1)
            : 'Unassigned'}
        </span>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        {dueLabel && (
          <span className="flex items-center gap-1 text-xs tabular-nums" style={{ color: 'var(--a-text-2)' }}>
            <Clock className="h-3 w-3" aria-hidden />
            {dueLabel}
          </span>
        )}
        <IconButton
          label={`Open task: ${task.name}`}
          onClick={onSelect}
          style={{ width: 20, height: 20, color: 'var(--a-text-2)' }}
        >
          <ChevronsRight className="h-4 w-4" aria-hidden />
        </IconButton>
      </div>
    </div>
  )
}

// ── §1.9 How Tasks Work — static body, no props ───────────────────────────────

export function HowTasksWorkBody() {
  return (
    <div className="space-y-2 text-sm" style={{ color: 'var(--a-text-2)' }}>
      <p>
        Tasks are action reminders tied to a contact. They land in one of three buckets:
        <span className="font-medium" style={{ color: 'var(--a-text)' }}> Today&rsquo;s Tasks</span> (due today),
        <span className="font-medium" style={{ color: 'var(--a-text)' }}> Overdue</span> (past due — clear these first), and
        <span className="font-medium" style={{ color: 'var(--a-text)' }}> Future</span> (due later, or no due date yet).
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
  )
}

// ── Left-panel task detail — presentational form, no hooks (state stays in the
// TaskDetailCard container in TasksView.tsx; this receives everything as props) ──

export function TaskDetailForm({
  task,
  taskTypes,
  brokers,
  isSuperuser,
  tint,
  name,
  type,
  due,
  err,
  pending,
  onNameChange,
  onTypeChange,
  onDueChange,
  onReassign,
  onSave,
  onComplete,
  onSnooze1,
  onSnooze7,
  onDelete,
  onClose,
}: {
  task: TaskQueueRow
  taskTypes: CrmTaskType[]
  brokers: Array<{ slug: string; name: string }>
  isSuperuser: boolean
  tint: { bg: string; fg: string }
  name: string
  type: string
  due: string
  err: string | null
  pending: boolean
  onNameChange: (v: string) => void
  onTypeChange: (v: string) => void
  onDueChange: (v: string) => void
  onReassign: (v: string) => void
  onSave: () => void
  onComplete: () => void
  onSnooze1: () => void
  onSnooze7: () => void
  onDelete: () => void
  onClose: () => void
}) {
  return (
    <div className="rounded-lg" style={{ border: '1px solid var(--a-border)', background: 'var(--a-bg)' }}>
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-medium"
            style={{ background: tint.bg, color: tint.fg }}
          >
            {initials(task.personName)}
          </span>
          <div>
            {task.personId ? (
              <Link
                href={`/admin/people/${task.personId}`}
                className="text-sm font-semibold hover:underline"
                style={{ color: 'var(--a-accent)' }}
              >
                {task.personName ?? `Contact #${task.personId}`}
              </Link>
            ) : (
              <p className="text-sm font-semibold" style={{ color: 'var(--a-text)' }}>No contact</p>
            )}
            {task.personStage && <p className="text-xs" style={{ color: 'var(--a-text-2)' }}>{task.personStage}</p>}
          </div>
        </div>
        <Button
          variant="quiet"
          className="px-2 text-xs"
          style={{ minHeight: 28, background: 'transparent', border: 'none' }}
          onClick={onClose}
        >
          Close
        </Button>
      </div>
      <div style={{ borderTop: '1px solid var(--a-border)' }} />
      <div className="space-y-3 px-4 py-3">
        <TextField
          label="Task"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
        />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <SelectField label="Type" aria-label="Task type" value={type} onChange={(e) => onTypeChange(e.target.value)}>
            {taskTypes.map((t) => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </SelectField>
          <TextField
            label="Due"
            type="datetime-local"
            value={due}
            onChange={(e) => onDueChange(e.target.value)}
          />
        </div>
        {isSuperuser && (
          <SelectField
            label="Assigned to"
            aria-label="Reassign"
            value={task.assignedBroker ?? ''}
            onChange={(e) => onReassign(e.target.value)}
          >
            <option value="" disabled>Unassigned</option>
            {brokers.map((b) => (
              <option key={b.slug} value={b.slug}>{b.name}</option>
            ))}
          </SelectField>
        )}
        {err && <p className="text-xs font-medium" style={{ color: 'var(--a-danger)' }}>{err}</p>}
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            disabled={pending || !name.trim()}
            onClick={onSave}
          >
            Save
          </Button>
          <Button variant="quiet" disabled={pending} onClick={onComplete}>
            Complete
          </Button>
          <Button variant="quiet" disabled={pending}
            onClick={onSnooze1}>
            Snooze 1d
          </Button>
          <Button variant="quiet" disabled={pending}
            onClick={onSnooze7}>
            7d
          </Button>
          <Button
            variant="danger" disabled={pending}
            onClick={onDelete}
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  )
}
