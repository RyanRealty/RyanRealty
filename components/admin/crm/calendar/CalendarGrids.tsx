'use client'

/**
 * CalendarGrids — the §2.5 Day / Week / Month grid renderers
 * (docs/fub-crm-spec/09-tasks-and-calendar.md Part 2).
 *
 * Pure presentational: the page maps every event source (appointments, tasks,
 * deal closings) into CalEvent rows; these components only place them.
 *
 * Color taxonomy (§2.5.3, re-skinned to Ryan Realty tokens):
 *   appointment → navy `bg-primary` (FUB blue → brand primary)
 *   task        → amber `bg-warning` (FUB yellow)
 *   closing     → green `bg-success` (FUB orange → the deals surface's
 *                 established closed-deal green; deliberate token swap)
 */

import { Button } from '@/components/ui/button'
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

const BLOCK_CLASS: Record<CalEvent['kind'], string> = {
  appointment: 'bg-primary text-primary-foreground',
  task: 'bg-warning text-warning-foreground',
  closing: 'bg-success text-success-foreground',
}

const DOT_CLASS: Record<CalEvent['kind'], string> = {
  appointment: 'bg-primary',
  task: 'bg-warning',
  closing: 'bg-success',
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
      <div className="flex border-b border-border">
        <div className="w-14 shrink-0" />
        {days.map((d) => (
          <div
            key={d}
            className={cn(
              'flex-1 border-l border-border px-2 py-1.5 text-center text-xs font-medium',
              d === todayKey ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            {days.length === 1 ? dayColumnLabel(d) : (
              <>
                {DOW_LABELS[new Date(`${d}T00:00:00Z`).getUTCDay()]}{' '}
                <span className={cn(
                  'tabular-nums',
                  d === todayKey && 'inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground',
                )}>
                  {Number(d.slice(8))}
                </span>
              </>
            )}
          </div>
        ))}
      </div>

      {/* All Day row (§2.5.1) */}
      <div className="flex border-b border-border bg-muted/30">
        <div className="w-14 shrink-0 px-1 py-1 text-right text-[10px] uppercase tracking-wide text-muted-foreground">
          All Day
        </div>
        {days.map((d) => {
          const allDay = (byDate.get(d) ?? []).filter((e) => e.allDay)
          return (
            <div key={d} className="min-w-0 flex-1 space-y-0.5 border-l border-border px-1 py-1">
              {allDay.map((e) => (
                <Button
                  key={e.id}
                  type="button"
                  variant="ghost"
                  onClick={() => onEventClick(e)}
                  className={cn(
                    'block h-auto w-full truncate rounded px-1.5 py-0.5 text-left text-xs font-medium hover:opacity-90',
                    BLOCK_CLASS[e.kind],
                  )}
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
              <span className="absolute -top-2 right-2 text-[10px] tabular-nums text-muted-foreground">
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
              className={cn(
                'relative min-w-0 flex-1 border-l border-border',
                d === todayKey && days.length > 1 && 'bg-secondary/40',
              )}
              style={{ height: hours.length * HOUR_H }}
            >
              {/* Clickable empty slots (quick-create) */}
              {hours.map((h, i) => (
                <Button
                  key={h}
                  type="button"
                  variant="ghost"
                  onClick={() => onSlotClick(d, h * 60)}
                  aria-label={`Add appointment ${d} ${time12(h * 60)}`}
                  className="absolute inset-x-0 h-auto rounded-none border-t border-border/70 p-0 hover:bg-muted/60"
                  style={{ top: i * HOUR_H, height: HOUR_H }}
                >
                  <span className="sr-only">Add appointment</span>
                </Button>
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
                    type="button"
                    variant="ghost"
                    onClick={() => onEventClick(e)}
                    className={cn(
                      'absolute inset-x-0.5 z-10 h-auto items-start justify-start overflow-hidden rounded px-1.5 py-0.5 text-left text-xs font-medium hover:opacity-90',
                      BLOCK_CLASS[e.kind],
                    )}
                    style={{ top, height }}
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
      <div className="grid grid-cols-7 sm:grid-cols-7 border-b border-border">
        {DOW_LABELS.map((d) => (
          <div key={d} className="px-2 py-1.5 text-center text-xs font-medium text-muted-foreground">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 sm:grid-cols-7">
        {cells.map((d) => {
          const inMonth = d.startsWith(monthPrefix)
          const events = byDate.get(d) ?? []
          const shown = events.slice(0, MONTH_CELL_MAX_EVENTS)
          const overflow = events.length - shown.length
          const isToday = d === todayKey
          return (
            <div
              key={d}
              className={cn(
                'min-h-24 border-b border-l border-border p-1 first:border-l-0 [&:nth-child(7n+1)]:border-l-0',
                !inMonth && 'bg-muted/30',
              )}
            >
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onSlotClick(d, 9 * 60)}
                  aria-label={`Add appointment on ${d}`}
                  className={cn(
                    'h-6 w-6 items-center justify-center rounded-full p-0 text-xs tabular-nums',
                    isToday
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
                      : inMonth
                        ? 'text-foreground'
                        : 'text-muted-foreground',
                  )}
                >
                  {Number(d.slice(8))}
                </Button>
              </div>
              <div className="mt-0.5 space-y-px">
                {shown.map((e) =>
                  e.allDay ? (
                    <Button
                      key={e.id}
                      type="button"
                      variant="ghost"
                      onClick={() => onEventClick(e)}
                      className={cn(
                        'block h-auto w-full truncate rounded px-1 py-px text-left text-[11px] font-medium hover:opacity-90',
                        BLOCK_CLASS[e.kind],
                      )}
                    >
                      {e.title}
                    </Button>
                  ) : (
                    <Button
                      key={e.id}
                      type="button"
                      variant="ghost"
                      onClick={() => onEventClick(e)}
                      className="flex h-auto w-full items-center gap-1 rounded px-1 py-px text-left text-[11px] hover:bg-muted"
                    >
                      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', DOT_CLASS[e.kind])} aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-foreground">
                        <span className="tabular-nums text-muted-foreground">{e.timeLabel}</span> {e.title}
                      </span>
                    </Button>
                  ),
                )}
                {overflow > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => onDayMore(d)}
                    className="block h-auto w-full rounded px-1 py-px text-left text-[11px] font-medium text-primary hover:bg-muted"
                  >
                    {overflow} More
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
