'use client'

/**
 * MobileCalendarScreen — the §29 Screen A mobile Calendar (mob-08), < md.
 *
 * Regions top → bottom per A.2: navy header (broker avatar · month title +
 * caret · bell · search), the navy monthly grid (MobileMonthGrid), the white
 * scrollable task list (sticky date section headers + CalendarTaskRow /
 * CalendarReminderRow), the navy FAB, and the global CrmMobileTabBar (§23
 * shell — rendered by ConsoleShell, not here).
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
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, Calendar as CalendarIcon, CheckSquare, ChevronDown, ChevronUp, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { MONTH_FULL, eventsByDate, shiftMonths, type CalEvent } from '@/lib/crm/calendar'
import { BROKER_HEADSHOTS } from '@/components/admin/crm/mobile/task-type-icons'
import { CrmAvatar } from '@/components/admin/crm/mobile/CrmMobileKit'
import MobileMonthGrid from './MobileMonthGrid'
import { CalendarReminderRow, CalendarTaskRow, DateSectionHeader, EmptyDateRow } from './MobileCalendarRows'
import AppointmentSheet, { type ContactOption } from '@/components/admin/crm/calendar/AppointmentSheet'
import MobileTaskCreateSheet from '@/components/admin/crm/mobile/MobileTaskCreateSheet'
import type { AppointmentRow, AppointmentType, AppointmentOutcome } from '@/lib/data/crm/getAppointments'
import type { CrmTaskType } from '@/lib/data/crm/getTaskQueue'

type Result = { ok: boolean; error?: string }

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
    <div ref={rootRef} className="flex min-h-[calc(100dvh-3.5rem)] flex-col bg-card">
      {/* ── A.3 nav / header bar (navy) ── */}
      <div className="flex h-[56px] shrink-0 items-center bg-primary px-3">
        <Link href="/admin/settings" aria-label="Your settings" className="shrink-0">
          <CrmAvatar name={brokerName} src={BROKER_HEADSHOTS[currentBrokerSlug] ?? null} size={36} className="bg-white/20" />
        </Link>
        <button
          type="button"
          className="flex flex-1 items-center justify-center gap-1"
          onClick={() => setCollapsed((v) => !v)}
          aria-label="Toggle month view"
        >
          <span className="text-[20px] font-semibold text-white">{monthLabelName}</span>
          {collapsed
            ? <ChevronDown className="h-[14px] w-[14px] text-white" aria-hidden />
            : <ChevronUp className="h-[14px] w-[14px] text-white" aria-hidden />}
        </button>
        <div className="flex shrink-0 items-center gap-4">
          <Link href="/admin/crm/activity" aria-label="Notifications">
            <Bell className="h-[22px] w-[22px] text-white" strokeWidth={1.8} />
          </Link>
          <Link href="/admin/crm" aria-label="Search">
            <Search className="h-[22px] w-[22px] text-white" strokeWidth={1.8} />
          </Link>
        </div>
      </div>

      {/* sr-only month nav for keyboard/AT users (touch users swipe per A.4) */}
      <div className="sr-only">
        <button type="button" onClick={() => swipeMonth(-1)}>Previous month</button>
        <button type="button" onClick={() => swipeMonth(1)}>Next month</button>
      </div>

      {/* ── A.4 monthly grid (navy) ── */}
      <MobileMonthGrid
        monthKey={monthKey}
        selectedDate={selectedDate}
        eventDates={eventDates}
        collapsed={collapsed}
        onSelect={selectDate}
        onSwipeMonth={swipeMonth}
      />

      {/* ── A.5 scrollable task list (white) ── */}
      <div className="flex-1 bg-card pb-28">
        {dayKeys.length === 0 ? (
          <p className="px-4 py-8 text-center text-[14px] text-muted-foreground">
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
      <button
        type="button"
        aria-label="Add appointment or task"
        onClick={() => setTypePickerOpen(true)}
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg md:hidden"
        style={{ boxShadow: '0 4px 8px rgba(16,39,66,0.30)' }}
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* D.2 type picker sheet */}
      <Sheet open={typePickerOpen} onOpenChange={setTypePickerOpen}>
        <SheetContent aria-describedby={undefined} side="bottom" className="gap-0 rounded-t-2xl p-0">
          <SheetTitle className="px-4 pb-2 pt-4 text-[16px] font-semibold text-foreground">
            What would you like to add?
          </SheetTitle>
          <button
            type="button"
            className="flex h-[52px] w-full items-center gap-3 border-b border-border px-4 text-left active:bg-secondary"
            onClick={() => { setTypePickerOpen(false); setEditAppt(null); setApptSheetOpen(true) }}
          >
            <CalendarIcon className="h-5 w-5 text-primary" aria-hidden />
            <span className="text-[16px] text-foreground">Appointment</span>
          </button>
          <button
            type="button"
            className="flex h-[52px] w-full items-center gap-3 border-b border-border px-4 text-left active:bg-secondary"
            onClick={() => { setTypePickerOpen(false); setTaskSheetOpen(true) }}
          >
            <CheckSquare className="h-5 w-5 text-primary" aria-hidden />
            <span className="text-[16px] text-foreground">Task</span>
          </button>
          <div className="p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <Button variant="ghost" className="w-full" onClick={() => setTypePickerOpen(false)}>Cancel</Button>
          </div>
        </SheetContent>
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
      <Sheet open={reschedId != null} onOpenChange={(v) => { if (!v) { setReschedId(null); setReschedAt('') } }}>
        <SheetContent aria-describedby={undefined} side="bottom" className="gap-3 rounded-t-2xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <SheetTitle className="text-[16px] font-semibold text-foreground">Reschedule task</SheetTitle>
          <Label className="text-[12px] font-medium text-muted-foreground">New due date & time</Label>
          <Input type="datetime-local" value={reschedAt} onChange={(e) => setReschedAt(e.target.value)} className="h-11" />
          {reschedErr ? <p className="text-[13px] text-destructive">{reschedErr}</p> : null}
          <Button type="button" className="h-11 w-full" disabled={!reschedAt} onClick={submitReschedule}>
            Save
          </Button>
        </SheetContent>
      </Sheet>
    </div>
  )
}
