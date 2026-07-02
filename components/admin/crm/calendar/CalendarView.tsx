'use client'

/**
 * CalendarView — the §2.2 two-column Calendar page
 * (docs/fub-crm-spec/09-tasks-and-calendar.md Part 2).
 *
 * LEFT SIDEBAR (~256px): mini month calendar (§2.3.1) + Schedule | Filters
 * tabs (§2.3.2 — Schedule lists Today/Tomorrow events; empty days render
 * "No events, add appointment"). MAIN GRID: header row with the Day | Week |
 * Month switcher, ‹ Today ›, the "Everyone ▾" agent filter (superuser only —
 * brokers are scoped at the data layer) and the circular + button (§2.4),
 * over the active view grid (§2.5).
 *
 * View + date + agent all live in the URL (?view=&date=&agent=) — the server
 * refetches the exact window per view.
 */

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  MONTH_SHORT,
  DOW_LABELS,
  eventsByDate,
  monthGrid,
  monthLabel,
  shiftDays,
  shiftMonths,
  weekRange,
  type CalEvent,
  type CalEventKind,
} from '@/lib/crm/calendar'
import { TimeGrid, MonthGrid } from './CalendarGrids'
import AppointmentModal, { type BrokerOption, type GuestChip } from './AppointmentModal'
import type { AppointmentRow, AppointmentType, AppointmentOutcome } from '@/lib/data/crm/getAppointments'

export type CalendarViewMode = 'day' | 'week' | 'month'

type Props = {
  view: CalendarViewMode
  /** The focused date (YYYY-MM-DD). */
  dateKey: string
  todayKey: string
  tomorrowKey: string
  /** Every event in the fetched window (already mapped by the page). */
  events: CalEvent[]
  /** Today + tomorrow events for the Schedule sidebar (fetched separately). */
  scheduleEvents: CalEvent[]
  /** Appointment rows by id — the edit modal needs the full row. */
  appointmentsById: Record<number, AppointmentRow>
  types: AppointmentType[]
  outcomes: AppointmentOutcome[]
  brokers: BrokerOption[]
  currentBrokerSlug: string
  isSuperuser: boolean
  /** Active agent filter ('all' or a slug) — superuser only. */
  agent: string
  guestNames: Record<number, string>
  searchContacts: (q: string) => Promise<{ ok: boolean; results?: GuestChip[]; error?: string }>
  createAction: (fd: FormData) => Promise<{ ok: boolean; error?: string; id?: number }>
  updateAction: (id: number, fd: FormData) => Promise<{ ok: boolean; error?: string }>
  deleteAction: (id: number) => Promise<{ ok: boolean; error?: string }>
}

const KIND_LABELS: Array<{ kind: CalEventKind; label: string }> = [
  { kind: 'appointment', label: 'Appointments' },
  { kind: 'task', label: 'Tasks' },
  { kind: 'closing', label: 'Deal closings' },
]

export default function CalendarView({
  view,
  dateKey,
  todayKey,
  tomorrowKey,
  events,
  scheduleEvents,
  appointmentsById,
  types,
  outcomes,
  brokers,
  currentBrokerSlug,
  isSuperuser,
  agent,
  guestNames,
  searchContacts,
  createAction,
  updateAction,
  deleteAction,
}: Props) {
  const router = useRouter()

  // ── Modal state ─────────────────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false)
  const [editAppt, setEditAppt] = useState<AppointmentRow | null>(null)
  const [createDate, setCreateDate] = useState<string | null>(null)
  const [createMin, setCreateMin] = useState<number | null>(null)

  // ── Sidebar filters (§2.3.2 Filters tab) ────────────────────────────────────
  const [hiddenKinds, setHiddenKinds] = useState<Set<CalEventKind>>(new Set())
  const toggleKind = (k: CalEventKind) =>
    setHiddenKinds((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })

  // ── Mini calendar month (client-local; init from the focused date) ─────────
  const [miniMonth, setMiniMonth] = useState(dateKey.slice(0, 7) + '-01')
  const mini = useMemo(() => monthGrid(miniMonth), [miniMonth])

  // ── URL navigation ──────────────────────────────────────────────────────────
  const nav = (next: { view?: CalendarViewMode; date?: string; agent?: string }) => {
    const params = new URLSearchParams()
    params.set('view', next.view ?? view)
    params.set('date', next.date ?? dateKey)
    const a = next.agent ?? agent
    if (a && a !== 'all') params.set('agent', a)
    router.push(`/admin/crm/calendar?${params.toString()}`)
  }

  const step = (dir: 1 | -1) => {
    if (view === 'day') nav({ date: shiftDays(dateKey, dir) })
    else if (view === 'week') nav({ date: shiftDays(dateKey, dir * 7) })
    else nav({ date: shiftMonths(dateKey, dir) })
  }

  // ── Event handlers ──────────────────────────────────────────────────────────
  const openCreate = (d: string, minutes?: number) => {
    setEditAppt(null)
    setCreateDate(d)
    setCreateMin(minutes ?? null)
    setModalOpen(true)
  }

  const onEventClick = (e: CalEvent) => {
    if (e.kind === 'appointment' && e.apptId != null && appointmentsById[e.apptId]) {
      setEditAppt(appointmentsById[e.apptId])
      setCreateDate(null)
      setCreateMin(null)
      setModalOpen(true)
    } else if (e.kind === 'task') {
      router.push(e.personId ? `/admin/console/leads/${e.personId}` : '/admin/crm/tasks?view=overdue')
    } else if (e.kind === 'closing') {
      router.push(`/admin/crm/deals?deal=${e.id.replace('deal:', '')}`)
    }
  }

  // ── Grid data ───────────────────────────────────────────────────────────────
  const visibleEvents = useMemo(
    () => events.filter((e) => !hiddenKinds.has(e.kind)),
    [events, hiddenKinds],
  )
  const byDate = useMemo(() => eventsByDate(visibleEvents), [visibleEvents])

  const weekDays = useMemo(() => {
    const { from } = weekRange(dateKey)
    return Array.from({ length: 7 }, (_, i) => shiftDays(from, i))
  }, [dateKey])

  const grid = useMemo(() => monthGrid(dateKey), [dateKey])

  const scheduleByDate = useMemo(() => eventsByDate(scheduleEvents), [scheduleEvents])

  return (
    <div className="flex min-w-0 items-start gap-4">
      {/* ══ LEFT SIDEBAR (§2.3) ══ */}
      <aside className="w-64 shrink-0 rounded-xl border border-border bg-card">
        {/* Mini month calendar (§2.3.1) */}
        <div className="p-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">{monthLabel(miniMonth)}</span>
            <span className="flex items-center">
              <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0"
                onClick={() => setMiniMonth(shiftMonths(miniMonth, -1))} aria-label="Previous month">‹</Button>
              <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0"
                onClick={() => setMiniMonth(shiftMonths(miniMonth, 1))} aria-label="Next month">›</Button>
            </span>
          </div>
          <div className="grid grid-cols-7 sm:grid-cols-7 text-center">
            {DOW_LABELS.map((d) => (
              <span key={d} className="py-0.5 text-[10px] font-medium text-muted-foreground">{d[0]}</span>
            ))}
            {mini.cells.map((d) => {
              const inMonth = d.startsWith(miniMonth.slice(0, 7))
              const isToday = d === todayKey
              const isFocus = d === dateKey
              return (
                <Button
                  key={d}
                  type="button"
                  variant="ghost"
                  onClick={() => nav({ date: d })}
                  aria-label={d}
                  className={cn(
                    'mx-auto h-6 w-6 rounded-full p-0 text-[11px] tabular-nums',
                    isToday
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
                      : isFocus
                        ? 'bg-secondary text-secondary-foreground'
                        : inMonth
                          ? 'text-foreground'
                          : 'text-muted-foreground/60',
                  )}
                >
                  {Number(d.slice(8))}
                </Button>
              )
            })}
          </div>
        </div>

        <Separator />

        {/* Schedule | Filters tabs (§2.3.2) */}
        <Tabs defaultValue="schedule" className="p-3">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="filters">Filters</TabsTrigger>
          </TabsList>

          <TabsContent value="schedule" className="mt-3 space-y-4">
            {[
              { key: todayKey, label: `Today, ${MONTH_SHORT[Number(todayKey.slice(5, 7)) - 1]} ${Number(todayKey.slice(8))}` },
              { key: tomorrowKey, label: `Tomorrow, ${MONTH_SHORT[Number(tomorrowKey.slice(5, 7)) - 1]} ${Number(tomorrowKey.slice(8))}` },
            ].map(({ key, label }) => {
              const dayEvents = scheduleByDate.get(key) ?? []
              return (
                <div key={key}>
                  <p className="text-xs font-semibold text-foreground">{label}</p>
                  {dayEvents.length === 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      No events,{' '}
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => openCreate(key)}
                        className="h-auto p-0 text-xs font-medium text-primary hover:bg-transparent hover:underline"
                      >
                        add appointment
                      </Button>
                    </p>
                  ) : (
                    <div className="mt-1 space-y-1">
                      {dayEvents.map((e) => (
                        <Button
                          key={e.id}
                          type="button"
                          variant="ghost"
                          onClick={() => onEventClick(e)}
                          className={cn(
                            'block h-auto w-full truncate rounded px-1.5 py-1 text-left text-xs',
                            e.allDay
                              ? 'bg-primary font-medium text-primary-foreground hover:opacity-90'
                              : 'text-foreground hover:bg-muted',
                          )}
                        >
                          {!e.allDay && <span className="tabular-nums text-muted-foreground">{e.timeLabel} </span>}
                          {e.title}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </TabsContent>

          <TabsContent value="filters" className="mt-3 space-y-2">
            {KIND_LABELS.map(({ kind, label }) => (
              <div key={kind} className="flex items-center gap-2">
                <Checkbox
                  id={`cal-filter-${kind}`}
                  checked={!hiddenKinds.has(kind)}
                  onCheckedChange={() => toggleKind(kind)}
                />
                <Label htmlFor={`cal-filter-${kind}`} className="cursor-pointer text-sm">{label}</Label>
              </div>
            ))}
            <p className="pt-1 text-xs text-muted-foreground">Filters apply to the calendar grid.</p>
          </TabsContent>
        </Tabs>
      </aside>

      {/* ══ MAIN CALENDAR GRID (§2.4 / §2.5) ══ */}
      <section className="min-w-0 flex-1 rounded-xl border border-border bg-card">
        {/* Header row */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
          {/* View switcher */}
          <div className="flex items-center">
            {(['day', 'week', 'month'] as const).map((v) => (
              <Button
                key={v}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => nav({ view: v })}
                className={cn(
                  'relative h-8 rounded-none px-3 text-sm capitalize',
                  view === v
                    ? 'font-semibold text-foreground after:absolute after:inset-x-1 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary'
                    : 'text-muted-foreground',
                )}
              >
                {v}
              </Button>
            ))}
          </div>

          {/* ‹ Today › */}
          <div className="ml-2 flex items-center gap-1">
            <Button type="button" variant="outline" size="sm" className="h-8 w-8 p-0"
              onClick={() => step(-1)} aria-label="Previous">‹</Button>
            <Button type="button" variant="outline" size="sm" className="h-8 px-3"
              onClick={() => nav({ date: todayKey })}>Today</Button>
            <Button type="button" variant="outline" size="sm" className="h-8 w-8 p-0"
              onClick={() => step(1)} aria-label="Next">›</Button>
          </div>

          {/* Current range label */}
          <span className="ml-1 text-sm font-semibold text-foreground">
            {monthLabel(dateKey)}
          </span>

          <span className="flex-1" />

          {/* Everyone ▾ (§2.15 — superuser only; brokers are data-layer scoped) */}
          {isSuperuser && (
            <Select value={agent} onValueChange={(v) => nav({ agent: v })}>
              <SelectTrigger className="h-8 w-36 text-xs" aria-label="Agent filter">
                <SelectValue placeholder="Everyone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Everyone</SelectItem>
                {brokers.map((b) => (
                  <SelectItem key={b.slug} value={b.slug}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* + (teal circle in FUB → brand primary) */}
          <Button
            type="button"
            size="sm"
            onClick={() => openCreate(dateKey)}
            aria-label="Create appointment"
            className="h-9 w-9 rounded-full p-0"
          >
            <Plus className="h-4 w-4" aria-hidden />
          </Button>
        </div>

        {/* Active view */}
        <div className="overflow-x-auto">
          {view === 'day' && (
            <TimeGrid
              days={[dateKey]}
              byDate={byDate}
              todayKey={todayKey}
              onEventClick={onEventClick}
              onSlotClick={openCreate}
            />
          )}
          {view === 'week' && (
            <TimeGrid
              days={weekDays}
              byDate={byDate}
              todayKey={todayKey}
              onEventClick={onEventClick}
              onSlotClick={openCreate}
            />
          )}
          {view === 'month' && (
            <MonthGrid
              cells={grid.cells}
              monthPrefix={dateKey.slice(0, 7)}
              byDate={byDate}
              todayKey={todayKey}
              onEventClick={onEventClick}
              onSlotClick={(d) => openCreate(d)}
              onDayMore={(d) => nav({ view: 'day', date: d })}
            />
          )}
        </div>
      </section>

      {/* Create / edit modal (§2.6) */}
      <AppointmentModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        appointment={editAppt}
        initialDate={createDate}
        initialStartMin={createMin}
        types={types}
        outcomes={outcomes}
        brokers={brokers}
        currentBrokerSlug={currentBrokerSlug}
        isSuperuser={isSuperuser}
        guestNames={guestNames}
        searchContacts={searchContacts}
        createAction={createAction}
        updateAction={updateAction}
        deleteAction={deleteAction}
      />
    </div>
  )
}
