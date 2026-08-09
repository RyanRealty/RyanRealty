'use client'

/**
 * MobileCalendarRows — the §29 Screen A task-list row set.
 *
 *   DateSectionHeader  — 34px sticky inset-toned header, "Monday, June 22nd".
 *   CalendarTaskRow    — 60px assignable-task anatomy per A.5: 18×18 warn-
 *                        border checkbox, 20px type icon, 15px description +
 *                        13px muted time sub-label, 32px broker badge circle.
 *                        Optimistic completion (A.11): warn fill + strike →
 *                        500ms slide-out → server action, revert on error.
 *                        Swipe-left reveals Delete / Reschedule / Complete
 *                        (A.5 gestures; touch-only, checkbox serves mouse).
 *   CalendarReminderRow— 50px event/reminder anatomy: 10px ok dot +
 *                        title (time sub-label added when the event is timed —
 *                        appointments carry times the FUB all-day reminder
 *                        row didn't need).
 *
 * Admin v2 (11F): every raw control is a v2 primitive and every semantic
 * Tailwind colour class a var(--a-*) token. The reminder row's `active:` press
 * feedback is now .av2-btn's own :active (a 1px geometric press) plus its
 * :hover tint — the affordance moves onto the primitive rather than being
 * dropped. The swipe actions keep an inline fill because they are revealed
 * behind a moving row on touch, where there is no hover to preserve.
 */

import { useRef, useState, useTransition, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { Button, IconButton } from '@/components/admin/v2'
import { cn } from '@/lib/utils'
import { MobileTypeIcon, brokerBadgeColor, brokerInitialsFor } from '@/components/admin/shared/mobile/task-type-icons'

const ACTIONS_W = 216 // 3 × 72px quick actions

const HAIRLINE = '1px solid var(--a-border)'

/** A swipe-revealed quick action: full-height, square, no radius. */
const SWIPE_ACTION: CSSProperties = {
  width: 72,
  height: '100%',
  minHeight: 0,
  border: 'none',
  borderRadius: 0,
  fontSize: 13,
  fontWeight: 600,
}

/**
 * .av2-btn / .av2-iconbtn own display, padding, size and type, and
 * admin-v2.css is UNLAYERED — it outranks Tailwind utilities regardless of
 * specificity — so a primitive flattened back into a bare row restates its
 * geometry inline. Colour is deliberately absent: an inline background beats
 * the stylesheet's :hover rule and kills the affordance.
 */
const FLAT_TEXT_TARGET: CSSProperties = {
  display: 'block',
  width: 'auto',
  height: 'auto',
  minHeight: 0,
  border: 'none',
  borderRadius: 0,
  padding: 0,
  textAlign: 'left',
}

const REMINDER_ROW: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  gap: 12,
  width: '100%',
  minHeight: 50,
  height: 'auto',
  border: 'none',
  borderBottom: HAIRLINE,
  borderRadius: 0,
  padding: '0 16px',
  textAlign: 'left',
  fontSize: 15,
  fontWeight: 400,
}

export function DateSectionHeader({ label }: { label: string }) {
  return (
    /* top-14 = below the shell's sticky h-14 mobile header (z-20). */
    <div className="sticky top-14 z-10 flex h-[34px] items-center px-4" style={{ background: 'var(--a-inset)' }}>
      <span className="text-[14px] font-semibold" style={{ color: 'var(--a-text)' }}>{label}</span>
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
        'relative overflow-hidden transition-all duration-300',
        gone ? 'max-h-0 opacity-0' : 'max-h-[60px]',
      )}
      style={{ borderBottom: gone ? undefined : HAIRLINE, background: 'var(--a-surface)' }}
    >
      {/* Behind-right quick actions (A.5 swipe-left): Delete / Reschedule / Complete */}
      <div className="absolute inset-y-0 right-0 flex" style={{ width: ACTIONS_W }}>
        <Button variant="danger" onClick={remove} style={SWIPE_ACTION}>
          Delete
        </Button>
        <Button
          variant="quiet"
          onClick={() => { setDx(0); onReschedule(taskId) }}
          style={{ ...SWIPE_ACTION, background: 'var(--a-inset)', color: 'var(--a-text)' }}
        >
          Resched.
        </Button>
        <Button
          variant="quiet"
          onClick={complete}
          style={{ ...SWIPE_ACTION, background: 'var(--a-ok)', color: 'var(--a-btn-fg)' }}
        >
          Complete
        </Button>
      </div>

      <div
        className="relative flex h-[60px] items-center pl-3 pr-4 transition-transform"
        style={{ transform: `translateX(${dx}px)`, background: 'var(--a-surface)' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Checkbox — 18×18, warn border; fills warn on check (A.5) */}
        <IconButton
          label={checked ? 'Completed' : 'Mark complete'}
          onClick={(e) => { e.stopPropagation(); complete() }}
          className="shrink-0"
          style={{
            width: 18,
            height: 18,
            borderRadius: 3,
            border: '2px solid var(--a-warn)',
            background: checked ? 'var(--a-warn)' : 'var(--a-surface)',
          }}
        >
          {checked ? <Check className="h-3 w-3" style={{ color: 'var(--a-btn-fg)' }} strokeWidth={3} /> : null}
        </IconButton>

        <span className="ml-2 shrink-0"><MobileTypeIcon type={type} size={20} /></span>

        {/* Text column — tap navigates to the person record (A.5 gestures) */}
        <IconButton
          label={title}
          className="ml-2.5 min-w-0 flex-1"
          style={FLAT_TEXT_TARGET}
          onClick={() => { if (personId) router.push(`/admin/people/${personId}`) }}
        >
          <span
            className={cn('block truncate text-[15px]', checked && 'line-through')}
            style={{ color: checked ? 'var(--a-text-2)' : 'var(--a-text)' }}
          >
            {title}
          </span>
          {timeLabel ? <span className="block text-[13px]" style={{ color: 'var(--a-text-2)' }}>{timeLabel}</span> : null}
        </IconButton>

        {/* Assignee badge — 32px circle, deterministic broker color */}
        <span
          // Foreground comes from the token, not a hardcoded white: every
          // --a-* colour flips lightness under [data-theme="dark"], so a fill
          // paired with literal white inverts to a pale tint and the initials
          // disappear. --a-btn-fg flips WITH the fill, the same pairing every
          // solid button in the language uses.
          className="ml-2 flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full text-[13px] font-semibold"
          style={{ backgroundColor: brokerBadgeColor(broker), color: 'var(--a-btn-fg)' }}
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
      <span className="h-[10px] w-[10px] shrink-0 rounded-full" style={{ background: 'var(--a-ok)' }} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px]" style={{ color: 'var(--a-text)' }}>{title}</span>
        {timeLabel ? <span className="block text-[13px]" style={{ color: 'var(--a-text-2)' }}>{timeLabel}</span> : null}
      </span>
    </>
  )
  if (onPress) {
    // No inline background: .av2-btn--quiet supplies the surface, its :hover the
    // tint and its :active the 1px press the shadcn `active:bg-secondary` used
    // to carry. An inline fill here would outrank all three.
    return (
      <Button variant="quiet" style={REMINDER_ROW} onClick={onPress}>
        {inner}
      </Button>
    )
  }
  return <div style={{ ...REMINDER_ROW, background: 'var(--a-surface)' }}>{inner}</div>
}

/** A.11 — date with no entries: placeholder row under its section header. */
export function EmptyDateRow() {
  return (
    <div className="flex h-[40px] items-center px-4" style={{ background: 'var(--a-surface)' }}>
      <span className="text-[12px]" style={{ color: 'var(--a-text-2)' }}>No tasks scheduled</span>
    </div>
  )
}
