'use client'

/**
 * CalendarGrids — the §2.5 Day / Week / Month grid renderers
 * (docs/fub-crm-spec/09-tasks-and-calendar.md Part 2).
 *
 * Pure presentational: the page maps every event source (appointments, tasks,
 * deal closings) into CalEvent rows; these components only place them.
 *
 * Color taxonomy (§2.5.3, on the LOCKED admin v2 tokens — design_system/admin):
 *   appointment → the one action accent (FUB blue)
 *   task        → the warn semantic (FUB yellow)
 *   closing     → the ok semantic (FUB orange → the deals surface's established
 *                 closed-deal green; deliberate token swap)
 * Every fill pairs with var(--a-btn-fg), which flips WITH the fill under
 * [data-theme="dark"] — the pairing every solid control in the language uses.
 */

import type { CSSProperties } from 'react'
import { Button, IconButton } from '@/components/admin/v2'
import { cn } from '@/lib/utils'
import {
  DOW_LABELS,
  GRID_START_HOUR,
  GRID_END_HOUR,
  dayColumnLabel,
  time12,
  type CalEvent,
} from '@/lib/crm/calendar'

// ── Shared color maps ─────────────────────────────────────────────────────────

const BLOCK_STYLE: Record<CalEvent['kind'], CSSProperties> = {
  appointment: { background: 'var(--a-accent)', color: 'var(--a-btn-fg)' },
  task: { background: 'var(--a-warn)', color: 'var(--a-btn-fg)' },
  closing: { background: 'var(--a-ok)', color: 'var(--a-btn-fg)' },
}

const DOT_STYLE: Record<CalEvent['kind'], CSSProperties> = {
  appointment: { background: 'var(--a-accent)' },
  task: { background: 'var(--a-warn)' },
  closing: { background: 'var(--a-ok)' },
}

const HAIRLINE = '1px solid var(--a-border)'

/**
 * .av2-btn owns display, padding, height and type, and admin-v2.css ships
 * UNLAYERED — so it outranks every Tailwind utility regardless of specificity.
 * A v2 Button flattened back into a bare text target therefore restates its
 * geometry inline. Colour is deliberately NOT in these two: an inline
 * background beats the stylesheet's :hover rule and kills the affordance.
 * The event blocks below do carry an inline fill, and keep `hover:opacity-90`
 * — the same feedback they had before — because opacity is untouched by it.
 */
const FLAT_BLOCK: CSSProperties = {
  display: 'block',
  width: '100%',
  height: 'auto',
  minHeight: 0,
  border: 'none',
  borderRadius: 'var(--a-r-sm)',
  textAlign: 'left',
  fontWeight: 500,
}
const FLAT_ROW: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  gap: 4,
  width: '100%',
  height: 'auto',
  minHeight: 0,
  border: 'none',
  borderRadius: 'var(--a-r-sm)',
  textAlign: 'left',
}

const HOUR_H = 48 // px per hour row

type EventHandlers = {
  onEventClick: (ev: CalEvent) => void
  onSlotClick: (dateKey: string, minutes: number) => void
}

// ── Day / Week grid (§2.5.1 / §2.5.2) ─────────────────────────────────────────

export function TimeGrid({
  days,
  byDate,
  todayKey,
  onEventClick,
  onSlotClick,
}: {
  /** 1 column (day view) or 7 (week view). */
  days: string[]
  byDate: Map<string, CalEvent[]>
  todayKey: string
  } & EventHandlers) {
  const hours: number[] = []
  for (let h = GRID_START_HOUR; h <= GRID_END_HOUR; h++) hours.push(h)
  const bandTop = GRID_START_HOUR * 60
  const bandBottom = (GRID_END_HOUR + 1) * 60

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {/* Column headers */}
      <div className="flex" style={{ borderBottom: HAIRLINE }}>
        <div className="w-14 shrink-0" />
        {days.map((d) => (
          <div
            key={d}
            className="flex-1 px-2 py-1.5 text-center text-xs font-medium"
            style={{
              borderLeft: HAIRLINE,
              color: d === todayKey ? 'var(--a-accent)' : 'var(--a-text-2)',
            }}
          >
            {days.length === 1 ? dayColumnLabel(d) : (
              <>
                {DOW_LABELS[new Date(`${d}T00:00:00Z`).getUTCDay()]}{' '}
                <span
                  className={cn(
                    'tabular-nums',
                    d === todayKey && 'inline-flex h-5 w-5 items-center justify-center rounded-full',
                  )}
                  style={d === todayKey ? { background: 'var(--a-btn-bg)', color: 'var(--a-btn-fg)' } : undefined}
                >
                  {Number(d.slice(8))}
                </span>
              </>
            )}
          </div>
        ))}
      </div>

      {/* All Day row (§2.5.1) */}
      <div className="flex" style={{ borderBottom: HAIRLINE, background: 'var(--a-inset)' }}>
        <div
          className="w-14 shrink-0 px-1 py-1 text-right text-[10px] uppercase tracking-wide"
          style={{ color: 'var(--a-text-2)' }}
        >
          All Day
        </div>
        {days.map((d) => {
          const allDay = (byDate.get(d) ?? []).filter((e) => e.allDay)
          return (
            <div key={d} className="min-w-0 flex-1 space-y-0.5 px-1 py-1" style={{ borderLeft: HAIRLINE }}>
              {allDay.map((e) => (
                <Button
                  key={e.id}
                  variant="quiet"
                  onClick={() => onEventClick(e)}
                  className="truncate hover:opacity-90"
                  style={{ ...FLAT_BLOCK, padding: '2px 6px', fontSize: 12, ...BLOCK_STYLE[e.kind] }}
                >
                  {e.title}
                </Button>
              ))}
            </div>
          )
        })}
      </div>

      {/* Hourly band */}
      <div className="flex">
        {/* Hour labels */}
        <div className="w-14 shrink-0">
          {hours.map((h) => (
            <div key={h} className="relative" style={{ height: HOUR_H }}>
              <span className="absolute -top-2 right-2 text-[10px] tabular-nums" style={{ color: 'var(--a-text-2)' }}>
                {h === 12 ? '12pm' : h < 12 ? `${h}am` : `${h - 12}pm`}
              </span>
            </div>
          ))}
        </div>
        {/* Day columns */}
        {days.map((d) => {
          const timed = (byDate.get(d) ?? []).filter((e) => !e.allDay)
          return (
            <div
              key={d}
              className="relative min-w-0 flex-1"
              style={{
                borderLeft: HAIRLINE,
                height: hours.length * HOUR_H,
                background: d === todayKey && days.length > 1 ? 'var(--a-accent-wash)' : undefined,
              }}
            >
              {/* Clickable empty slots (quick-create). IconButton, not a flattened
                  Button: .av2-iconbtn is transparent by default and tints to
                  var(--a-inset) on hover, which is exactly the affordance the
                  shadcn ghost carried — and it survives because nothing here
                  sets background inline. */}
              {hours.map((h, i) => (
                <IconButton
                  key={h}
                  label={`Add appointment ${d} ${time12(h * 60)}`}
                  onClick={() => onSlotClick(d, h * 60)}
                  className="absolute inset-x-0"
                  style={{
                    top: i * HOUR_H,
                    height: HOUR_H,
                    width: 'auto',
                    borderRadius: 0,
                    borderTop: HAIRLINE,
                  }}
                >
                  <span className="sr-only">Add appointment</span>
                </IconButton>
              ))}
              {/* Timed event blocks */}
              {timed.map((e) => {
                const start = Math.max(e.startMin, bandTop)
                const end = Math.min(Math.max(e.endMin, e.startMin + 24), bandBottom)
                if (end <= bandTop || start >= bandBottom) return null
                const top = ((start - bandTop) / 60) * HOUR_H
                const height = Math.max(((end - start) / 60) * HOUR_H, 18)
                return (
                  <Button
                    key={e.id}
                    variant="quiet"
                    onClick={() => onEventClick(e)}
                    className="absolute inset-x-0.5 z-10 overflow-hidden hover:opacity-90"
                    style={{
                      ...FLAT_BLOCK,
                      width: 'auto',
                      padding: '2px 6px',
                      fontSize: 12,
                      top,
                      height,
                      ...BLOCK_STYLE[e.kind],
                    }}
                  >
                    <span className="block w-full truncate">
                      <span className="tabular-nums">{e.timeLabel}</span> {e.title}
                    </span>
                  </Button>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Month grid (§2.5.3) ───────────────────────────────────────────────────────

const MONTH_CELL_MAX_EVENTS = 4

export function MonthGrid({
  cells,
  monthPrefix,
  byDate,
  todayKey,
  onEventClick,
  onDayMore,
  onSlotClick,
}: {
  /** Sunday-aligned grid dateKeys incl. overflow days. */
  cells: string[]
  /** 'YYYY-MM' of the displayed month — overflow days render faded. */
  monthPrefix: string
  byDate: Map<string, CalEvent[]>
  todayKey: string
  /** "N More" overflow → jump to day view. */
  onDayMore: (dateKey: string) => void
} & EventHandlers) {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="grid grid-cols-7 sm:grid-cols-7" style={{ borderBottom: HAIRLINE }}>
        {DOW_LABELS.map((d) => (
          <div key={d} className="px-2 py-1.5 text-center text-xs font-medium" style={{ color: 'var(--a-text-2)' }}>
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 sm:grid-cols-7">
        {cells.map((d, i) => {
          const inMonth = d.startsWith(monthPrefix)
          const events = byDate.get(d) ?? []
          const shown = events.slice(0, MONTH_CELL_MAX_EVENTS)
          const overflow = events.length - shown.length
          const isToday = d === todayKey
          return (
            <div
              key={d}
              className="min-h-24 p-1"
              style={{
                borderBottom: HAIRLINE,
                // The 7-column grid fills row-major, so `i % 7 === 0` is the
                // first cell of a row — what `first:` + `[&:nth-child(7n+1)]:`
                // expressed before the border moved inline.
                borderLeft: i % 7 === 0 ? undefined : HAIRLINE,
                background: inMonth ? undefined : 'var(--a-inset)',
              }}
            >
              <div className="flex items-center justify-between">
                <IconButton
                  label={`Add appointment on ${d}`}
                  onClick={() => onSlotClick(d, 9 * 60)}
                  // av2-addbtn is the language's solid circular trigger: it
                  // carries the accent fill AND its own :hover, so today's date
                  // keeps a pressed/hover affordance no inline fill could give.
                  className={cn('tabular-nums', isToday && 'av2-addbtn')}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    fontSize: 12,
                    // Out-of-month takes NO inline colour on purpose: the cell
                    // behind it is already var(--a-inset), which is also
                    // .av2-iconbtn's hover fill, so the only hover cue left is
                    // the class's own var(--a-text-2) → var(--a-text) shift —
                    // and an inline colour would have killed that too.
                    color: isToday ? undefined : inMonth ? 'var(--a-text)' : undefined,
                  }}
                >
                  {Number(d.slice(8))}
                </IconButton>
              </div>
              <div className="mt-0.5 space-y-px">
                {shown.map((e) =>
                  e.allDay ? (
                    <Button
                      key={e.id}
                      variant="quiet"
                      onClick={() => onEventClick(e)}
                      className="truncate hover:opacity-90"
                      style={{ ...FLAT_BLOCK, padding: '1px 4px', fontSize: 11, ...BLOCK_STYLE[e.kind] }}
                    >
                      {e.title}
                    </Button>
                  ) : (
                    <IconButton
                      key={e.id}
                      label={`${e.timeLabel} ${e.title}`}
                      onClick={() => onEventClick(e)}
                      style={{ ...FLAT_ROW, padding: '1px 4px', fontSize: 11 }}
                    >
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={DOT_STYLE[e.kind]} aria-hidden />
                      <span className="min-w-0 flex-1 truncate" style={{ color: 'var(--a-text)' }}>
                        <span className="tabular-nums" style={{ color: 'var(--a-text-2)' }}>{e.timeLabel}</span> {e.title}
                      </span>
                    </IconButton>
                  ),
                )}
                {overflow > 0 && (
                  <IconButton
                    label={`${overflow} More`}
                    onClick={() => onDayMore(d)}
                    style={{ ...FLAT_ROW, padding: '1px 4px', fontSize: 11, fontWeight: 500, color: 'var(--a-accent)' }}
                  >
                    {overflow} More
                  </IconButton>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
