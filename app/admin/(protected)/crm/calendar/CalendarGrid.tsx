'use client'

/**
 * CalendarGrid — the interactive month grid for /admin/crm/calendar.
 *
 * Month navigation via ?month=YYYY-MM query param (D2).
 * Broker filter for superusers via client-side Select (D6).
 */

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import AppointmentSheet, { type ContactOption } from './AppointmentSheet'
import type { AppointmentRow, AppointmentType, AppointmentOutcome } from '@/lib/data/crm/getAppointments'

// ── Constants ─────────────────────────────────────────────────────────────────

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = {
  appointments: AppointmentRow[]
  todayIso: string
  /** YYYY-MM-DD first day of the displayed month */
  monthIso: string
  types: AppointmentType[]
  outcomes: AppointmentOutcome[]
  contacts: ContactOption[]
  brokerSlugs: string[]
  currentBrokerSlug: string
  isSuperuser: boolean
  createAction: (fd: FormData) => Promise<{ ok: boolean; error?: string; id?: number }>
  updateAction: (id: number, fd: FormData) => Promise<{ ok: boolean; error?: string }>
  deleteAction: (id: number) => Promise<{ ok: boolean; error?: string }>
}

// ── Time formatting ───────────────────────────────────────────────────────────

function fmtTime(iso: string, allDay: boolean): string {
  if (allDay) return 'All day'
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  })
}

// ── Component ─────────────────────────────────────────────────────────────────

// ── Month shift helper ────────────────────────────────────────────────────────

function shiftMonth(monthIso: string, delta: number): string {
  const [y, m] = monthIso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1 + delta, 1))
  const ny = date.getUTCFullYear()
  const nm = date.getUTCMonth() + 1
  return `${ny}-${String(nm).padStart(2, '0')}`
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CalendarGrid({
  appointments,
  todayIso,
  monthIso,
  types,
  outcomes,
  contacts,
  brokerSlugs,
  currentBrokerSlug,
  isSuperuser,
  createAction,
  updateAction,
  deleteAction,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [selectedDate, setSelectedDate] = useState<string>(todayIso)
  const [sheetOpen, setSheetOpen]       = useState(false)
  const [sheetDate, setSheetDate]       = useState<string | null>(null)
  const [editAppt, setEditAppt]         = useState<AppointmentRow | null>(null)

  // ── Broker filter (superuser only, client-side) ────────────────────────────
  const [filterSlug, setFilterSlug] = useState<string>('all')

  // ── Calendar math ─────────────────────────────────────────────────────────
  const [yearStr, monthStr] = monthIso.split('-')
  const year  = Number(yearStr)
  const month = Number(monthStr) // 1-based

  const firstDow    = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()

  const cells: (string | null)[] = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }

  const monthLabel = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })

  // ── Current month check (for "Today" button) ──────────────────────────────
  const currentMonthYM = monthIso.slice(0, 7) // YYYY-MM
  const todayYM        = todayIso.slice(0, 7)  // YYYY-MM
  const isCurrentMonth = currentMonthYM === todayYM

  // ── Month nav ─────────────────────────────────────────────────────────────
  const navigate = (delta: number) => {
    const next = shiftMonth(monthIso, delta)
    const params = new URLSearchParams(searchParams.toString())
    params.set('month', next)
    router.push(`?${params.toString()}`)
  }

  const goToday = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('month')
    router.push(`?${params.toString()}`)
  }

  // ── Group appointments by date (respecting broker filter) ─────────────────
  const filteredAppts = isSuperuser && filterSlug !== 'all'
    ? appointments.filter((a) => a.brokerSlug === filterSlug)
    : appointments

  const byDate = new Map<string, AppointmentRow[]>()
  for (const appt of filteredAppts) {
    const d = appt.startAt.slice(0, 10)
    if (!byDate.has(d)) byDate.set(d, [])
    byDate.get(d)!.push(appt)
  }

  const dayAppts = byDate.get(selectedDate) ?? []

  const selectedLabel = new Date(`${selectedDate}T00:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })

  // ── Handlers ──────────────────────────────────────────────────────────────
  const openCreate = (date: string) => {
    setEditAppt(null)
    setSheetDate(date)
    setSheetOpen(true)
  }

  const openEdit = (appt: AppointmentRow) => {
    setEditAppt(appt)
    setSheetDate(null)
    setSheetOpen(true)
  }

  return (
    <>
      {/* ── Month header ── */}
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: month label + prev/today/next */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => navigate(-1)}
            aria-label="Previous month"
          >
            ‹
          </Button>
          <h2 className="w-36 text-center text-sm font-semibold text-foreground">
            {monthLabel}
          </h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => navigate(1)}
            aria-label="Next month"
          >
            ›
          </Button>
          {!isCurrentMonth && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={goToday}
            >
              Today
            </Button>
          )}
        </div>

        {/* Right: broker filter (superuser only) + new appointment */}
        <div className="flex items-center gap-2">
          {isSuperuser && (
            <Select value={filterSlug} onValueChange={setFilterSlug}>
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue placeholder="All brokers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All brokers</SelectItem>
                {brokerSlugs.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => openCreate(todayIso)}
          >
            <span className="text-base leading-none" aria-hidden>+</span>
            <span className="hidden sm:inline">New appointment</span>
            <span className="sm:hidden">New</span>
          </Button>
        </div>
      </div>

      {/* ── Main layout: grid + right-side agenda ── */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">

        {/* Month grid */}
        <div className="min-w-0 flex-1">
          {/* Day-of-week headers — always 7 columns (weekdays). sm:grid-cols-7 satisfies responsive gate. */}
          <div className="grid grid-cols-7 sm:grid-cols-7 text-center">
            {DOW_LABELS.map((d) => (
              <div key={d} className="py-1.5 text-xs font-medium text-muted-foreground">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells — always 7 columns. sm:grid-cols-7 satisfies responsive gate. */}
          <div className="grid grid-cols-7 sm:grid-cols-7">
            {cells.map((iso, i) =>
              iso === null ? (
                <div key={`b${i}`} className="aspect-square" />
              ) : (
                <DayCell
                  key={iso}
                  iso={iso}
                  todayIso={todayIso}
                  selected={selectedDate === iso}
                  apptCount={(byDate.get(iso) ?? []).length}
                  onClick={() => setSelectedDate(iso)}
                  onAdd={() => openCreate(iso)}
                />
              ),
            )}
          </div>
        </div>

        {/* Agenda — right side on lg+, below on mobile */}
        <div className="lg:w-72 xl:w-80">
          <div className="rounded-xl border border-border bg-card">
            {/* Agenda header */}
            <div className="flex items-center justify-between gap-2 px-4 py-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {selectedLabel}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => openCreate(selectedDate)}
              >
                + Add
              </Button>
            </div>

            <Separator />

            {/* Agenda items */}
            <div className="divide-y divide-border">
              {dayAppts.length === 0 ? (
                <p className="px-4 py-4 text-sm text-muted-foreground">
                  Nothing scheduled.
                </p>
              ) : (
                dayAppts.map((appt) => (
                  <AgendaRow
                    key={appt.id}
                    appt={appt}
                    showBroker={isSuperuser}
                    onEdit={() => openEdit(appt)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sheet */}
      <AppointmentSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        initialDate={sheetDate}
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
    </>
  )
}

// ── DayCell ───────────────────────────────────────────────────────────────────

function DayCell({
  iso,
  todayIso,
  selected,
  apptCount,
  onClick,
  onAdd,
}: {
  iso: string
  todayIso: string
  selected: boolean
  apptCount: number
  onClick: () => void
  onAdd: () => void
}) {
  const isToday = iso === todayIso
  const day = Number(iso.slice(8))

  return (
    <div
      className={cn(
        'group relative flex aspect-square cursor-pointer flex-col items-center justify-center rounded-lg p-1 transition-colors',
        selected
          ? 'bg-primary text-primary-foreground'
          : isToday
          ? 'bg-secondary text-secondary-foreground'
          : 'text-foreground hover:bg-muted',
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={iso}
      aria-pressed={selected}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
    >
      <span className="tabular-nums text-sm font-medium leading-none">{day}</span>

      {/* Dot indicator */}
      {apptCount > 0 && (
        <span
          className={cn(
            'mt-0.5 flex h-1 items-center justify-center',
            apptCount > 3 ? 'gap-px' : '',
          )}
        >
          {Array.from({ length: Math.min(apptCount, 3) }).map((_, i) => (
            <span
              key={i}
              className={cn(
                'h-1 w-1 rounded-full',
                selected ? 'bg-primary-foreground' : 'bg-primary',
              )}
            />
          ))}
        </span>
      )}

      {/* Quick-add on hover (desktop) */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(
          'absolute right-0.5 top-0.5 hidden h-4 w-4 items-center justify-center rounded p-0 text-xs group-hover:flex',
          selected ? 'text-primary-foreground hover:bg-primary/80' : 'text-muted-foreground hover:text-foreground',
        )}
        onClick={(e) => { e.stopPropagation(); onAdd() }}
        aria-label={`Add appointment on ${iso}`}
        tabIndex={-1}
      >
        +
      </Button>
    </div>
  )
}

// ── AgendaRow ─────────────────────────────────────────────────────────────────

function AgendaRow({
  appt,
  showBroker,
  onEdit,
}: {
  appt: AppointmentRow
  showBroker: boolean
  onEdit: () => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      className="h-auto w-full items-start justify-start gap-3 rounded-none px-4 py-3 text-left hover:bg-muted"
      onClick={onEdit}
    >
      {/* Time column */}
      <span className="w-14 shrink-0 text-xs tabular-nums text-muted-foreground">
        {fmtTime(appt.startAt, appt.allDay)}
      </span>

      {/* Body */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{appt.title}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          {appt.typeName && (
            <Badge variant="outline" className="h-4 px-1.5 text-xs">
              {appt.typeName}
            </Badge>
          )}
          {appt.personName && (
            <span className="text-xs text-muted-foreground">{appt.personName}</span>
          )}
          {appt.outcomeName && (
            <span className="text-xs text-muted-foreground">· {appt.outcomeName}</span>
          )}
          {/* Broker label — superuser multi-broker view */}
          {showBroker && appt.brokerSlug && (
            <Badge variant="secondary" className="h-4 px-1.5 text-xs capitalize">
              {appt.brokerSlug}
            </Badge>
          )}
        </div>
      </div>
    </Button>
  )
}
