'use client'

/**
 * MobileCalendarScreen — the §29 Screen A mobile Calendar (mob-08), < md.
 *
 * Regions top → bottom per A.2: the accent header (broker avatar · month title
 * + caret · bell · search), the accent monthly grid (MobileMonthGrid), the
 * scrollable task list (sticky date section headers + CalendarTaskRow /
 * CalendarReminderRow), the FAB, and the global CrmMobileTabBar (§23 shell —
 * rendered by ConsoleShell, not here).
 *
 * Data: the same unified CalEvent window the desktop §09 CalendarView renders
 * (appointments + open tasks + deal closings — all real crm_* rows). Tapping
 * a date selects it and scrolls the list to that date's section (A.4); swiping
 * the grid navigates months via ?date= (server refetch); the title caret
 * toggles full-month ↔ week strip (A.3).
 *
 * FAB → Screen D.2 type picker ("Appointment" / "Task") → the existing
 * AppointmentSheet (full §2.6 field set) or MobileTaskCreateSheet (D.3).
 * Tapping a reminder row for an appointment opens it for edit.
 *
 * Admin v2 (11F): the navy/white phone chrome becomes var(--a-accent) filled
 * with var(--a-btn-fg) — the pairing every solid control in the language uses,
 * and the only one that survives [data-theme="dark"] — and the shadcn Sheet,
 * Button, Input and Label give way to the v2 barrel.
 */

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, Calendar as CalendarIcon, CheckSquare, ChevronDown, ChevronUp, Plus, Search } from 'lucide-react'
import { Button, IconButton, Sheet, TextField } from '@/components/admin/v2'
import { MONTH_FULL, eventsByDate, shiftMonths, type CalEvent } from '@/lib/crm/calendar'
import { BROKER_HEADSHOTS } from '@/components/admin/shared/mobile/task-type-icons'
import { CrmAvatar } from '@/components/admin/shared/mobile/CrmMobileKit'
import MobileMonthGrid from './MobileMonthGrid'
import { CalendarReminderRow, CalendarTaskRow, DateSectionHeader, EmptyDateRow } from './MobileCalendarRows'
import AppointmentSheet, { type ContactOption } from '@/components/admin/crm/calendar/AppointmentSheet'
import MobileTaskCreateSheet from '@/components/admin/shared/mobile/MobileTaskCreateSheet'
import type { AppointmentRow, AppointmentType, AppointmentOutcome } from '@/lib/data/crm/getAppointments'
import type { CrmTaskType } from '@/lib/data/crm/getTaskQueue'

type Result = { ok: boolean; error?: string }

const HAIRLINE = '1px solid var(--a-border)'

/** A control sitting ON the accent header. `background: transparent` is
 *  deliberate: none of these had a hover state before, and .av2-iconbtn's
 *  default hover paints var(--a-inset) — a pale grey that has no business on
 *  the accent fill. Everything else is geometry .av2-iconbtn would otherwise
 *  impose (admin-v2.css is UNLAYERED, so it outranks Tailwind utilities). */
const HEADER_CONTROL: CSSProperties = {
  width: 'auto',
  height: 'auto',
  background: 'transparent',
  color: 'var(--a-btn-fg)',
}

/** One D.2 type-picker row: full width, left-aligned, hairline-separated. */
const PICKER_ROW: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  gap: 12,
  width: '100%',
  height: 52,
  minHeight: 52,
  border: 'none',
  borderBottom: HAIRLINE,
  borderRadius: 0,
  padding: '0 4px',
  textAlign: 'left',
  fontSize: 16,
  fontWeight: 400,
  color: 'var(--a-text)',
}

/** "June 22nd" ordinal per the A.5 section-header format. */
function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`
}

function sectionLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return `${DOW[dow]}, ${MONTH_FULL[m - 1]} ${ordinal(d)}`
}

export default function MobileCalendarScreen({
  monthKey,
  todayKey,
  events,
  appointments,
  types,
  outcomes,
  contacts,
  brokerSlugs,
  currentBrokerSlug,
  brokerName,
  isSuperuser,
  taskTypes,
  createAction,
  updateAction,
  deleteAction,
  completeTaskAction,
  deleteTaskAction,
  rescheduleTaskAction,
  createTaskAction,
  searchContactsAction,
}: {
  monthKey: string
  todayKey: string
  events: CalEvent[]
  appointments: AppointmentRow[]
  types: AppointmentType[]
  outcomes: AppointmentOutcome[]
  contacts: ContactOption[]
  brokerSlugs: string[]
  currentBrokerSlug: string
  brokerName: string
  isSuperuser: boolean
  taskTypes: CrmTaskType[]
  createAction: (fd: FormData) => Promise<{ ok: boolean; error?: string; id?: number }>
  updateAction: (id: number, fd: FormData) => Promise<Result>
  deleteAction: (id: number) => Promise<Result>
  completeTaskAction: (taskId: number, personId: number | null) => Promise<Result>
  deleteTaskAction: (taskId: number) => Promise<Result>
  rescheduleTaskAction: (taskId: number, dueAtIso: string) => Promise<Result>
  createTaskAction: (fd: FormData) => Promise<Result>
  searchContactsAction: (q: string) => Promise<{ ok: boolean; results?: Array<{ id: number; name: string }>; error?: string }>
}) {
  const router = useRouter()
  const initialSelected = todayKey.slice(0, 7) === monthKey.slice(0, 7) ? todayKey : monthKey
  const [selectedDate, setSelectedDate] = useState(initialSelected)
  const [collapsed, setCollapsed] = useState(false)
  const [typePickerOpen, setTypePickerOpen] = useState(false)
  const [apptSheetOpen, setApptSheetOpen] = useState(false)
  const [editAppt, setEditAppt] = useState<AppointmentRow | null>(null)
  const [taskSheetOpen, setTaskSheetOpen] = useState(false)
  const [reschedId, setReschedId] = useState<number | null>(null)
  const [reschedAt, setReschedAt] = useState('')
  const [reschedErr, setReschedErr] = useState<string | null>(null)

  const rootRef = useRef<HTMLDivElement>(null)

  const monthLabelName = MONTH_FULL[Number(monthKey.slice(5, 7)) - 1]
  const month = monthKey.slice(0, 7)

  // Month-scoped events grouped by day (all-day first, then by time).
  const { byDate, dayKeys, eventDates } = useMemo(() => {
    const monthEvents = events.filter((e) => e.dateKey.slice(0, 7) === month)
    const map = eventsByDate(monthEvents)
    const keys = [...map.keys()].sort()
    if (!keys.includes(selectedDate) && selectedDate.slice(0, 7) === month) {
      keys.push(selectedDate)
      keys.sort()
    }
    return { byDate: map, dayKeys: keys, eventDates: new Set(map.keys()) }
  }, [events, month, selectedDate])

  const scrollTarget = useRef<string | null>(null)
  const selectDate = (d: string) => {
    scrollTarget.current = d
    setSelectedDate(d)
  }
  // A.4: selecting a date scrolls the task list to that date's section — in an
  // effect so the section (which may only exist AFTER the selection re-render)
  // has committed before we look it up (by data attribute, scoped to this root).
  useEffect(() => {
    const d = scrollTarget.current
    if (!d) return
    scrollTarget.current = null
    rootRef.current
      ?.querySelector(`[data-datekey="${d}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [selectedDate])

  const swipeMonth = (delta: 1 | -1) => {
    router.push(`/admin/crm/calendar?date=${shiftMonths(monthKey, delta)}`)
  }

  const openEditAppt = (apptId: number) => {
    const a = appointments.find((x) => x.id === apptId)
    if (!a) return
    setEditAppt(a)
    setApptSheetOpen(true)
  }

  const submitReschedule = () => {
    if (reschedId == null || !reschedAt) return
    const iso = new Date(reschedAt).toISOString()
    setReschedErr(null)
    void rescheduleTaskAction(reschedId, iso).then((r) => {
      if (!r.ok) { setReschedErr(r.error ?? 'Could not reschedule.'); return }
      setReschedId(null)
      setReschedAt('')
      router.refresh()
    })
  }

  return (
    <div ref={rootRef} className="flex min-h-[calc(100dvh-3.5rem)] flex-col" style={{ background: 'var(--a-surface)' }}>
      {/* ── A.3 nav / header bar (accent) ── */}
      <div className="flex h-[56px] shrink-0 items-center px-3" style={{ background: 'var(--a-accent)' }}>
        <Link href="/admin/settings" aria-label="Your settings" className="shrink-0">
          <CrmAvatar name={brokerName} src={BROKER_HEADSHOTS[currentBrokerSlug] ?? null} size={36} />
        </Link>
        <IconButton
          label="Toggle month view"
          className="flex-1"
          style={{ ...HEADER_CONTROL, gap: 4 }}
          onClick={() => setCollapsed((v) => !v)}
        >
          <span className="text-[20px] font-semibold" style={{ color: 'var(--a-btn-fg)' }}>{monthLabelName}</span>
          {collapsed
            ? <ChevronDown className="h-[14px] w-[14px]" style={{ color: 'var(--a-btn-fg)' }} aria-hidden />
            : <ChevronUp className="h-[14px] w-[14px]" style={{ color: 'var(--a-btn-fg)' }} aria-hidden />}
        </IconButton>
        <div className="flex shrink-0 items-center gap-4">
          <Link href="/admin/crm/activity" aria-label="Notifications">
            <Bell className="h-[22px] w-[22px]" style={{ color: 'var(--a-btn-fg)' }} strokeWidth={1.8} />
          </Link>
          <Link href="/admin/crm" aria-label="Search">
            <Search className="h-[22px] w-[22px]" style={{ color: 'var(--a-btn-fg)' }} strokeWidth={1.8} />
          </Link>
        </div>
      </div>

      {/* sr-only month nav for keyboard/AT users (touch users swipe per A.4) */}
      <div className="sr-only">
        <Button variant="quiet" onClick={() => swipeMonth(-1)}>Previous month</Button>
        <Button variant="quiet" onClick={() => swipeMonth(1)}>Next month</Button>
      </div>

      {/* ── A.4 monthly grid (accent) ── */}
      <MobileMonthGrid
        monthKey={monthKey}
        selectedDate={selectedDate}
        eventDates={eventDates}
        collapsed={collapsed}
        onSelect={selectDate}
        onSwipeMonth={swipeMonth}
      />

      {/* ── A.5 scrollable task list ── */}
      <div className="flex-1 pb-28" style={{ background: 'var(--a-surface)' }}>
        {dayKeys.length === 0 ? (
          <p className="px-4 py-8 text-center text-[14px]" style={{ color: 'var(--a-text-2)' }}>
            Nothing scheduled this month.
          </p>
        ) : (
          dayKeys.map((d) => {
            const items = byDate.get(d) ?? []
            return (
              <div key={d} data-datekey={d} style={{ scrollMarginTop: 56 }}>
                <DateSectionHeader label={sectionLabel(d)} />
                {items.length === 0 ? <EmptyDateRow /> : null}
                {items.map((e) =>
                  e.kind === 'task' ? (
                    <CalendarTaskRow
                      key={e.id}
                      taskId={Number(e.id.slice(5))}
                      type={e.taskType ?? null}
                      title={e.title}
                      timeLabel={e.timeLabel}
                      broker={e.broker}
                      personId={e.personId}
                      onComplete={completeTaskAction}
                      onDelete={deleteTaskAction}
                      onReschedule={(id) => { setReschedId(id); setReschedErr(null) }}
                    />
                  ) : (
                    <CalendarReminderRow
                      key={e.id}
                      title={e.title}
                      timeLabel={e.allDay ? undefined : e.timeLabel}
                      onPress={
                        e.kind === 'appointment' && e.apptId != null
                          ? () => openEditAppt(e.apptId as number)
                          : e.kind === 'closing'
                            ? () => router.push('/admin/crm/deals')
                            : e.kind === 'file' && e.propertyKey
                              ? () => router.push(`/admin/deals/${encodeURIComponent(e.propertyKey as string)}`)
                              : undefined
                      }
                    />
                  ),
                )}
              </div>
            )
          })
        )}
      </div>

      {/* ── A.7 FAB → D.2 type picker ── */}
      <IconButton
        label="Add appointment or task"
        onClick={() => setTypePickerOpen(true)}
        className="fixed bottom-20 right-4 z-40 md:hidden"
        style={{
          width: 56,
          height: 56,
          borderRadius: 999,
          background: 'var(--a-accent)',
          color: 'var(--a-btn-fg)',
          boxShadow: 'var(--a-shadow-overlay)',
        }}
      >
        <Plus className="h-6 w-6" />
      </IconButton>

      {/* D.2 type picker sheet */}
      <Sheet
        open={typePickerOpen}
        onClose={() => setTypePickerOpen(false)}
        title="What would you like to add?"
      >
        {/* No inline background on either row: .av2-btn--quiet supplies the
            surface, its :hover the tint and its :active the press the shadcn
            `active:bg-secondary` used to carry. */}
        <Button
          variant="quiet"
          style={PICKER_ROW}
          onClick={() => { setTypePickerOpen(false); setEditAppt(null); setApptSheetOpen(true) }}
        >
          <CalendarIcon className="h-5 w-5" style={{ color: 'var(--a-accent)' }} aria-hidden />
          <span className="text-[16px]">Appointment</span>
        </Button>
        <Button
          variant="quiet"
          style={PICKER_ROW}
          onClick={() => { setTypePickerOpen(false); setTaskSheetOpen(true) }}
        >
          <CheckSquare className="h-5 w-5" style={{ color: 'var(--a-accent)' }} aria-hidden />
          <span className="text-[16px]">Task</span>
        </Button>
        <div className="pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button variant="quiet" className="w-full" onClick={() => setTypePickerOpen(false)}>Cancel</Button>
        </div>
      </Sheet>

      {/* Create / edit appointment — the existing full-field sheet */}
      <AppointmentSheet
        open={apptSheetOpen}
        onOpenChange={(v) => { setApptSheetOpen(v); if (!v) setEditAppt(null) }}
        initialDate={selectedDate}
        appointment={editAppt}
        types={types}
        outcomes={outcomes}
        contacts={contacts}
        brokerSlugs={brokerSlugs}
        currentBrokerSlug={currentBrokerSlug}
        isSuperuser={isSuperuser}
        createAction={createAction}
        updateAction={updateAction}
        deleteAction={deleteAction}
      />

      {/* D.3 create-task sheet */}
      <MobileTaskCreateSheet
        open={taskSheetOpen}
        onOpenChange={setTaskSheetOpen}
        taskTypes={taskTypes}
        createAction={async (fd) => createTaskAction(fd)}
        searchAction={searchContactsAction}
      />

      {/* Reschedule sheet (A.5 swipe quick action) */}
      <Sheet
        open={reschedId != null}
        onClose={() => { setReschedId(null); setReschedAt('') }}
        title="Reschedule task"
      >
        <TextField
          label="New due date & time"
          type="datetime-local"
          value={reschedAt}
          onChange={(e) => setReschedAt(e.target.value)}
        />
        {reschedErr ? <p className="text-[13px]" style={{ color: 'var(--a-danger)' }}>{reschedErr}</p> : null}
        <div className="pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button className="h-11 w-full" disabled={!reschedAt} onClick={submitReschedule}>
            Save
          </Button>
        </div>
      </Sheet>
    </div>
  )
}
