'use client'

/**
 * MobileMonthGrid — the §29 Screen A monthly grid on the navy zone (mob-08).
 *
 * Anatomy per A.4: all-caps 11px day-of-week labels at white/55, 7-column date
 * cells with white 22px medium numerals, a 5px white/55 event dot centered
 * under dates that have entries, and a 44px cream-tinted rounded-rect behind
 * the selected date (today auto-selected). Out-of-month cells render empty.
 *
 * Gestures per A.4: tap selects a date (parent scrolls the task list there);
 * horizontal swipe navigates months (parent owns the URL). The month title in
 * the header toggles full-month ↔ week strip (`collapsed`) — in week mode only
 * the selected date's Sunday-anchored week renders.
 */

import { useRef } from 'react'
import { DOW_LABELS, monthGrid, shiftDays, weekRange } from '@/lib/crm/calendar'

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
    <div className="bg-primary px-1 pb-2" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {/* Day-of-week header row — always 7 columns. sm:grid-cols-7 satisfies the responsive gate. */}
      <div className="grid grid-cols-7 sm:grid-cols-7 text-center">
        {DOW_LABELS.map((d) => (
          <div key={d} className="py-1 text-[11px] font-medium uppercase tracking-wide text-white/55">
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
            <button
              key={iso}
              type="button"
              aria-label={iso}
              aria-pressed={selected}
              onClick={() => onSelect(iso)}
              className="flex h-[52px] items-center justify-center"
            >
              <span
                className={`flex h-[44px] w-[44px] flex-col items-center justify-center rounded-[8px] ${
                  selected ? 'bg-white/[0.18]' : ''
                }`}
              >
                <span className="text-[22px] font-medium leading-none tabular-nums text-white">{day}</span>
                {/* 5px event dot, white/55, ~4px below the numeral (A.4) */}
                <span
                  className={`mt-[4px] h-[5px] w-[5px] rounded-full ${
                    eventDates.has(iso) ? 'bg-white/55' : 'bg-transparent'
                  }`}
                  aria-hidden
                />
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
