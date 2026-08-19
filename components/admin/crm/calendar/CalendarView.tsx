'use client'

/**
 * CalendarView — the §2.2 two-column Calendar page
 * (docs/crm-spec/09-tasks-and-calendar.md Part 2).
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
 *
 * Admin v2 (11F): the shadcn primitives are replaced by '@/components/admin/v2'
 * and every semantic Tailwind colour class by a var(--a-*) token. The one
 * hand-built control is the sidebar's Schedule | Filters switch — the v2 barrel
 * has no tab primitive (TabBar is the locked phone tab bar), so it is two quiet
 * Buttons carrying role="tab"/aria-selected over the same local state Radix's
 * uncontrolled `defaultValue="schedule"` held.
 */

import { useMemo, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Button, IconButton, ToolbarCheck, ToolbarSelect } from '@/components/admin/v2'
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

const HAIRLINE = '1px solid var(--a-border)'

/** A card shell in the locked language: hairline + 12px radius + surface. */
const CARD: CSSProperties = {
  border: HAIRLINE,
  borderRadius: 'var(--a-r-lg)',
  background: 'var(--a-surface)',
}

/**
 * .av2-btn owns display, padding, height and type, and admin-v2.css is
 * UNLAYERED — it outranks every Tailwind utility regardless of specificity —
 * so a v2 Button flattened into a bare text row restates its geometry inline.
 * No colour lives here on purpose: an inline background beats the stylesheet's
 * :hover rule and would kill the affordance.
 */
const FLAT_ROW: CSSProperties = {
  display: 'block',
  width: '100%',
  height: 'auto',
  minHeight: 0,
  border: 'none',
  borderRadius: 'var(--a-r-sm)',
  textAlign: 'left',
  padding: '4px 6px',
  fontSize: 12,
}

/** A 24px round date cell in the mini month. */
const MINI_CELL: CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: '50%',
  fontSize: 11,
}

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

  // ── Sidebar tab (§2.3.2) — Radix's uncontrolled defaultValue, made local ────
  const [sideTab, setSideTab] = useState<'schedule' | 'filters'>('schedule')

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
      router.push(e.personId ? `/admin/people/${e.personId}` : '/admin/crm/tasks?view=overdue')
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
      <aside className="w-64 shrink-0" style={CARD}>
        {/* Mini month calendar (§2.3.1) */}
        <div className="p-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-sm font-semibold" style={{ color: 'var(--a-text)' }}>{monthLabel(miniMonth)}</span>
            <span className="flex items-center">
              <IconButton label="Previous month" style={{ width: 24, height: 24 }}
                onClick={() => setMiniMonth(shiftMonths(miniMonth, -1))}>‹</IconButton>
              <IconButton label="Next month" style={{ width: 24, height: 24 }}
                onClick={() => setMiniMonth(shiftMonths(miniMonth, 1))}>›</IconButton>
            </span>
          </div>
          <div className="grid grid-cols-7 sm:grid-cols-7 text-center">
            {DOW_LABELS.map((d) => (
              <span key={d} className="py-0.5 text-[10px] font-medium" style={{ color: 'var(--a-text-2)' }}>{d[0]}</span>
            ))}
            {mini.cells.map((d) => {
              const inMonth = d.startsWith(miniMonth.slice(0, 7))
              const isToday = d === todayKey
              const isFocus = d === dateKey
              return (
                <IconButton
                  key={d}
                  label={d}
                  onClick={() => nav({ date: d })}
                  // av2-addbtn is the language's solid circular trigger and
                  // carries its own :hover, so today keeps a hover state that an
                  // inline fill would have killed. The FOCUSED date takes an
                  // accent RING rather than a fill for the same reason —
                  // .av2-iconbtn already reserves a 1px transparent border, so
                  // colouring it costs no layout and leaves :hover intact.
                  className={cn('mx-auto tabular-nums', isToday && 'av2-addbtn')}
                  style={{
                    ...MINI_CELL,
                    borderColor: !isToday && isFocus ? 'var(--a-accent)' : undefined,
                    // Out-of-month takes no inline colour: .av2-iconbtn already
                    // resolves to var(--a-text-2) and shifts to var(--a-text)
                    // on hover, a cue an inline colour would have removed.
                    color: isToday
                      ? undefined
                      : isFocus
                        ? 'var(--a-accent)'
                        : inMonth
                          ? 'var(--a-text)'
                          : undefined,
                    fontWeight: !isToday && isFocus ? 600 : undefined,
                  }}
                >
                  {Number(d.slice(8))}
                </IconButton>
              )
            })}
          </div>
        </div>

        <div style={{ height: 1, background: 'var(--a-border)' }} />

        {/* Schedule | Filters tabs (§2.3.2) */}
        <div className="p-3">
          <div className="grid w-full grid-cols-2" role="tablist" aria-label="Calendar sidebar">
            {([['schedule', 'Schedule'], ['filters', 'Filters']] as const).map(([key, label]) => {
              const active = sideTab === key
              return (
                <Button
                  key={key}
                  variant="quiet"
                  role="tab"
                  id={`cal-tab-${key}`}
                  aria-selected={active}
                  aria-controls={`cal-panel-${key}`}
                  onClick={() => setSideTab(key)}
                  style={{
                    border: 'none',
                    borderRadius: 0,
                    borderBottom: active ? '2px solid var(--a-accent)' : '2px solid transparent',
                    color: active ? 'var(--a-accent)' : 'var(--a-text-2)',
                    fontWeight: active ? 600 : 500,
                  }}
                >
                  {label}
                </Button>
              )
            })}
          </div>

          {sideTab === 'schedule' ? (
            <div className="mt-3 space-y-4" role="tabpanel" id="cal-panel-schedule" aria-labelledby="cal-tab-schedule">
              {[
                { key: todayKey, label: `Today, ${MONTH_SHORT[Number(todayKey.slice(5, 7)) - 1]} ${Number(todayKey.slice(8))}` },
                { key: tomorrowKey, label: `Tomorrow, ${MONTH_SHORT[Number(tomorrowKey.slice(5, 7)) - 1]} ${Number(tomorrowKey.slice(8))}` },
              ].map(({ key, label }) => {
                const dayEvents = scheduleByDate.get(key) ?? []
                return (
                  <div key={key}>
                    <p className="text-xs font-semibold" style={{ color: 'var(--a-text)' }}>{label}</p>
                    {dayEvents.length === 0 ? (
                      <p className="mt-1 text-xs" style={{ color: 'var(--a-text-2)' }}>
                        No events,{' '}
                        <Button
                          variant="quiet"
                          className="av2-textlink"
                          style={{ fontSize: 12 }}
                          onClick={() => openCreate(key)}
                        >
                          add appointment
                        </Button>
                      </p>
                    ) : (
                      <div className="mt-1 space-y-1">
                        {dayEvents.map((e) =>
                          e.allDay ? (
                            <Button
                              key={e.id}
                              variant="quiet"
                              onClick={() => onEventClick(e)}
                              className="truncate hover:opacity-90"
                              style={{
                                ...FLAT_ROW,
                                fontWeight: 500,
                                background: 'var(--a-accent)',
                                color: 'var(--a-btn-fg)',
                              }}
                            >
                              {e.title}
                            </Button>
                          ) : (
                            <IconButton
                              key={e.id}
                              label={`${e.timeLabel} ${e.title}`}
                              onClick={() => onEventClick(e)}
                              className="truncate"
                              style={{ ...FLAT_ROW, color: 'var(--a-text)' }}
                            >
                              <span className="tabular-nums" style={{ color: 'var(--a-text-2)' }}>{e.timeLabel} </span>
                              {e.title}
                            </IconButton>
                          ),
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="mt-3 space-y-2" role="tabpanel" id="cal-panel-filters" aria-labelledby="cal-tab-filters">
              {KIND_LABELS.map(({ kind, label }) => (
                <div key={kind}>
                  <ToolbarCheck
                    label={label}
                    checked={!hiddenKinds.has(kind)}
                    onChange={() => toggleKind(kind)}
                  />
                </div>
              ))}
              <p className="pt-1 text-xs" style={{ color: 'var(--a-text-2)' }}>Filters apply to the calendar grid.</p>
            </div>
          )}
        </div>
      </aside>

      {/* ══ MAIN CALENDAR GRID (§2.4 / §2.5) ══ */}
      <section className="min-w-0 flex-1" style={CARD}>
        {/* Header row */}
        <div className="flex flex-wrap items-center gap-2 px-3 py-2" style={{ borderBottom: HAIRLINE }}>
          {/* View switcher */}
          <div className="flex items-center">
            {(['day', 'week', 'month'] as const).map((v) => (
              <Button
                key={v}
                variant="quiet"
                onClick={() => nav({ view: v })}
                className="capitalize"
                style={{
                  minHeight: 32,
                  padding: '0 12px',
                  border: 'none',
                  borderRadius: 0,
                  borderBottom: view === v ? '2px solid var(--a-accent)' : '2px solid transparent',
                  color: view === v ? 'var(--a-text)' : 'var(--a-text-2)',
                  fontWeight: view === v ? 600 : 500,
                }}
              >
                {v}
              </Button>
            ))}
          </div>

          {/* ‹ Today › */}
          <div className="ml-2 flex items-center gap-1">
            <IconButton label="Previous" onClick={() => step(-1)}>‹</IconButton>
            <Button variant="quiet" style={{ minHeight: 32, padding: '0 12px' }}
              onClick={() => nav({ date: todayKey })}>Today</Button>
            <IconButton label="Next" onClick={() => step(1)}>›</IconButton>
          </div>

          {/* Current range label */}
          <span className="ml-1 text-sm font-semibold" style={{ color: 'var(--a-text)' }}>
            {monthLabel(dateKey)}
          </span>

          <span className="flex-1" />

          {/* Everyone ▾ (§2.15 — superuser only; brokers are data-layer scoped) */}
          {isSuperuser && (
            <ToolbarSelect
              aria-label="Agent filter"
              value={agent}
              onChange={(e) => nav({ agent: e.target.value })}
              className="w-36"
            >
              <option value="all">Everyone</option>
              {brokers.map((b) => (
                <option key={b.slug} value={b.slug}>{b.name}</option>
              ))}
            </ToolbarSelect>
          )}

          {/* + (teal circle in CRM → the one action accent) */}
          <Button
            onClick={() => openCreate(dateKey)}
            aria-label="Create appointment"
            style={{ width: 36, height: 36, minHeight: 36, padding: 0, borderRadius: '50%' }}
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
