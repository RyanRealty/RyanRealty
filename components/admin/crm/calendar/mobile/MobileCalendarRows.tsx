'use client'

/**
 * MobileCalendarRows — the §29 Screen A task-list row set.
 *
 *   DateSectionHeader  — 34px sticky bg-muted header, "Monday, June 22nd".
 *   CalendarTaskRow    — 60px assignable-task anatomy per A.5: 18×18 warning-
 *                        border checkbox, 20px type icon, 15px description +
 *                        13px muted time sub-label, 32px broker badge circle.
 *                        Optimistic completion (A.11): warning fill + strike →
 *                        500ms slide-out → server action, revert on error.
 *                        Swipe-left reveals Delete / Reschedule / Complete
 *                        (A.5 gestures; touch-only, checkbox serves mouse).
 *   CalendarReminderRow— 50px event/reminder anatomy: 10px success dot +
 *                        title (time sub-label added when the event is timed —
 *                        appointments carry times the FUB all-day reminder
 *                        row didn't need).
 */

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MobileTypeIcon, brokerBadgeColor, brokerInitialsFor } from '@/components/admin/crm/mobile/task-type-icons'

const ACTIONS_W = 216 // 3 × 72px quick actions

export function DateSectionHeader({ label }: { label: string }) {
  return (
    /* top-14 = below the shell's sticky h-14 mobile header (z-20). */
    <div className="sticky top-14 z-10 flex h-[34px] items-center bg-muted px-4">
      <span className="text-[14px] font-semibold text-foreground">{label}</span>
    </div>
  )
}

export function CalendarTaskRow({
  taskId,
  type,
  title,
  timeLabel,
  broker,
  personId,
  onComplete,
  onDelete,
  onReschedule,
}: {
  taskId: number
  type: string | null
  title: string
  timeLabel: string
  broker: string | null
  personId: number | null
  onComplete: (taskId: number, personId: number | null) => Promise<{ ok: boolean; error?: string }>
  onDelete: (taskId: number) => Promise<{ ok: boolean; error?: string }>
  onReschedule: (taskId: number) => void
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [checked, setChecked] = useState(false)
  const [gone, setGone] = useState(false)
  const [dx, setDx] = useState(0)
  const touch = useRef<{ x: number; y: number; base: number } | null>(null)

  const complete = () => {
    if (checked) return
    setChecked(true)
    setDx(0)
    // A.11: strike now, slide out at 500ms, then the server write.
    setTimeout(() => {
      setGone(true)
      startTransition(async () => {
        const r = await onComplete(taskId, personId)
        if (!r.ok) { setChecked(false); setGone(false) } // revert on error
        else router.refresh()
      })
    }, 500)
  }

  const remove = () => {
    setDx(0)
    setGone(true)
    startTransition(async () => {
      const r = await onDelete(taskId)
      if (!r.ok) setGone(false)
      else router.refresh()
    })
  }

  function onTouchStart(e: React.TouchEvent) {
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, base: dx }
  }
  function onTouchMove(e: React.TouchEvent) {
    if (!touch.current) return
    const ddx = e.touches[0].clientX - touch.current.x
    const ddy = e.touches[0].clientY - touch.current.y
    if (Math.abs(ddx) < 8 || Math.abs(ddy) > Math.abs(ddx)) return
    setDx(Math.max(-ACTIONS_W, Math.min(0, touch.current.base + ddx)))
  }
  function onTouchEnd() {
    setDx((v) => (v <= -ACTIONS_W / 2 ? -ACTIONS_W : 0))
    touch.current = null
  }

  return (
    <div
      className={cn(
        'relative overflow-hidden border-b border-border bg-card transition-all duration-300',
        gone ? 'max-h-0 border-b-0 opacity-0' : 'max-h-[60px]',
      )}
    >
      {/* Behind-right quick actions (A.5 swipe-left): Delete / Reschedule / Complete */}
      <div className="absolute inset-y-0 right-0 flex" style={{ width: ACTIONS_W }}>
        <button type="button" onClick={remove} className="w-[72px] bg-destructive text-[13px] font-semibold text-destructive-foreground">
          Delete
        </button>
        <button type="button" onClick={() => { setDx(0); onReschedule(taskId) }} className="w-[72px] bg-muted text-[13px] font-semibold text-foreground">
          Resched.
        </button>
        <button type="button" onClick={complete} className="w-[72px] bg-success text-[13px] font-semibold text-success-foreground">
          Complete
        </button>
      </div>

      <div
        className="relative flex h-[60px] items-center bg-card pl-3 pr-4 transition-transform"
        style={{ transform: `translateX(${dx}px)` }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Checkbox — 18×18, warning border; fills warning on check (A.5) */}
        <button
          type="button"
          aria-label={checked ? 'Completed' : 'Mark complete'}
          onClick={(e) => { e.stopPropagation(); complete() }}
          className={cn(
            'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[3px] border-2 border-warning',
            checked ? 'bg-warning' : 'bg-card',
          )}
        >
          {checked ? <Check className="h-3 w-3 text-white" strokeWidth={3} /> : null}
        </button>

        <span className="ml-2 shrink-0"><MobileTypeIcon type={type} size={20} /></span>

        {/* Text column — tap navigates to the person record (A.5 gestures) */}
        <button
          type="button"
          className="ml-2.5 min-w-0 flex-1 text-left"
          onClick={() => { if (personId) router.push(`/admin/console/leads/${personId}`) }}
        >
          <span className={cn('block truncate text-[15px] text-foreground', checked && 'text-muted-foreground line-through')}>
            {title}
          </span>
          {timeLabel ? <span className="block text-[13px] text-muted-foreground">{timeLabel}</span> : null}
        </button>

        {/* Assignee badge — 32px circle, deterministic broker color */}
        <span
          className="ml-2 flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-white"
          style={{ backgroundColor: brokerBadgeColor(broker) }}
          aria-label={broker ?? undefined}
        >
          {brokerInitialsFor(broker)}
        </span>
      </div>
    </div>
  )
}

export function CalendarReminderRow({
  title,
  timeLabel,
  onPress,
}: {
  title: string
  timeLabel?: string
  onPress?: () => void
}) {
  const inner = (
    <>
      <span className="h-[10px] w-[10px] shrink-0 rounded-full bg-success" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] text-foreground">{title}</span>
        {timeLabel ? <span className="block text-[13px] text-muted-foreground">{timeLabel}</span> : null}
      </span>
    </>
  )
  const cls = 'flex min-h-[50px] w-full items-center gap-3 border-b border-border bg-card px-4 text-left'
  if (onPress) {
    return (
      <button type="button" className={cn(cls, 'active:bg-secondary')} onClick={onPress}>
        {inner}
      </button>
    )
  }
  return <div className={cls}>{inner}</div>
}

/** A.11 — date with no entries: placeholder row under its section header. */
export function EmptyDateRow() {
  return (
    <div className="flex h-[40px] items-center bg-card px-4">
      <span className="text-[12px] text-muted-foreground">No tasks scheduled</span>
    </div>
  )
}
