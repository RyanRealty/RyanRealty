'use client'

/**
 * MobileMonthGrid — the §29 Screen A monthly grid on the accent zone (mob-08).
 *
 * Anatomy per A.4: all-caps 11px day-of-week labels at 55% on the accent fill,
 * 7-column date cells with 22px medium numerals in the paired foreground, a 5px
 * event dot centered under dates that have entries, and a 44px rounded-rect
 * behind the selected date (today auto-selected). Out-of-month cells render
 * empty.
 *
 * Gestures per A.4: tap selects a date (parent scrolls the task list there);
 * horizontal swipe navigates months (parent owns the URL). The month title in
 * the header toggles full-month ↔ week strip (`collapsed`) — in week mode only
 * the selected date's Sunday-anchored week renders.
 *
 * Admin v2 (11F): the navy/white pairing becomes var(--a-accent) filled with
 * var(--a-btn-fg) — the two flip together under [data-theme="dark"], where a
 * literal white would invert into an unreadable tint. The selected cell takes
 * var(--a-accent-strong), which reads against the fill in both themes.
 */

import { useRef, type CSSProperties } from 'react'
import { IconButton } from '@/components/admin/v2'
import { DOW_LABELS, monthGrid, shiftDays, weekRange } from '@/lib/crm/calendar'

/** .av2-iconbtn owns size and centring, and admin-v2.css is UNLAYERED — it
 *  outranks Tailwind utilities regardless of specificity — so the cell's box
 *  comes back inline. `background: transparent` is deliberate, not an
 *  oversight: this control never had a hover state, and .av2-iconbtn's default
 *  hover paints var(--a-inset), a pale grey that has no business on the accent
 *  zone. Suppressing it keeps the surface exactly as it was. */
const CELL: CSSProperties = {
  width: '100%',
  height: 52,
  borderRadius: 0,
  background: 'transparent',
}

export default function MobileMonthGrid({
  monthKey,
  selectedDate,
  eventDates,
  collapsed,
  onSelect,
  onSwipeMonth,
}: {
  /** First day of the displayed month (YYYY-MM-01). */
  monthKey: string
  selectedDate: string
  /** dateKeys that carry at least one event (dot indicator). */
  eventDates: Set<string>
  /** Week-strip mode (month title tapped). */
  collapsed: boolean
  onSelect: (dateKey: string) => void
  onSwipeMonth: (delta: 1 | -1) => void
}) {
  const touch = useRef<{ x: number; y: number } | null>(null)

  const month = monthKey.slice(0, 7)
  let cells: Array<string | null>
  if (collapsed) {
    const wk = weekRange(selectedDate)
    cells = []
    for (let d = wk.from; d <= wk.to; d = shiftDays(d, 1)) cells.push(d)
  } else {
    cells = monthGrid(monthKey).cells.map((d) => (d.slice(0, 7) === month ? d : null))
    // Trim fully-empty leading/trailing weeks (empty cells render blank per A.4).
    while (cells.length >= 7 && cells.slice(0, 7).every((c) => c === null)) cells = cells.slice(7)
    while (cells.length >= 7 && cells.slice(-7).every((c) => c === null)) cells = cells.slice(0, -7)
  }

  function onTouchStart(e: React.TouchEvent) {
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (!touch.current) return
    const dx = e.changedTouches[0].clientX - touch.current.x
    const dy = e.changedTouches[0].clientY - touch.current.y
    touch.current = null
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      onSwipeMonth(dx < 0 ? 1 : -1) // swipe left → next month (A.4)
    }
  }

  return (
    <div className="px-1 pb-2" style={{ background: 'var(--a-accent)' }} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {/* Day-of-week header row — always 7 columns. sm:grid-cols-7 satisfies the responsive gate. */}
      <div className="grid grid-cols-7 sm:grid-cols-7 text-center">
        {DOW_LABELS.map((d) => (
          <div
            key={d}
            className="py-1 text-[11px] font-medium uppercase tracking-wide"
            style={{ color: 'var(--a-btn-fg)', opacity: 0.55 }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Date cells — always 7 columns. sm:grid-cols-7 satisfies the responsive gate. */}
      <div className="grid grid-cols-7 sm:grid-cols-7">
        {cells.map((iso, i) => {
          if (iso === null) return <div key={`b${i}`} className="h-[52px]" />
          const day = Number(iso.slice(8))
          const selected = iso === selectedDate
          return (
            <IconButton
              key={iso}
              label={iso}
              aria-pressed={selected}
              onClick={() => onSelect(iso)}
              style={CELL}
            >
              <span
                className="flex h-[44px] w-[44px] flex-col items-center justify-center rounded-[8px]"
                style={{ background: selected ? 'var(--a-accent-strong)' : undefined }}
              >
                <span className="text-[22px] font-medium leading-none tabular-nums" style={{ color: 'var(--a-btn-fg)' }}>
                  {day}
                </span>
                {/* 5px event dot at 55%, ~4px below the numeral (A.4) */}
                <span
                  className="mt-[4px] h-[5px] w-[5px] rounded-full"
                  style={
                    eventDates.has(iso)
                      ? { background: 'var(--a-btn-fg)', opacity: 0.55 }
                      : { background: 'transparent' }
                  }
                  aria-hidden
                />
              </span>
            </IconButton>
          )
        })}
      </div>
    </div>
  )
}
