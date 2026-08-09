'use client'

/**
 * MobileCalendarTab — §25.9 Calendar tab for the mobile Contact Detail
 *
 * Layout:
 *   - "Add Appointment or Task" inline action row (§25.9.1) → D.2-style
 *     chooser (Appointment / Task) — both branches are REAL (P2-4 closure,
 *     2026-07-02 mobile audit: the row previously opened a task-only sheet).
 *     Appointment uses the same full-field AppointmentSheet as /admin/crm/
 *     calendar, pre-linked to this contact.
 *   - Empty state: compound calendar+clock icon + text (§25.9.2)
 *   - Rows (§25.9.3): the contact's appointments (navy date badge) +
 *     open tasks (accent date badge), chronological.
 *
 * Client component for the sheet open states.
 */

import { useState } from 'react'
import { CalendarDays, CheckSquare, Clock, Plus, Calendar as CalendarIcon } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import AppointmentSheet from '@/components/admin/crm/calendar/AppointmentSheet'
import type { AppointmentRow, AppointmentType, AppointmentOutcome } from '@/lib/data/crm/getAppointments'
import { formatDate } from '@/lib/format/date'

export interface MobileTask {
  id: number
  name: string
  type: string | null
  due_at: string | null
  completed_at: string | null
}

/** Appointment config + rows bundle assembled by the server page. */
export interface MobileApptData {
  rows: AppointmentRow[]
  types: AppointmentType[]
  outcomes: AppointmentOutcome[]
  brokerSlugs: string[]
  currentBrokerSlug: string
  isSuperuser: boolean
}

export interface MobileCalendarTabProps {
  personId: number
  personName: string
  tasks: MobileTask[]
  appointments: MobileApptData
  addTaskAction: (formData: FormData) => Promise<void>
  createAppointmentAction: (formData: FormData) => Promise<{ ok: boolean; error?: string; id?: number }>
  updateAppointmentAction: (id: number, formData: FormData) => Promise<{ ok: boolean; error?: string }>
}

function fmtDue(iso: string | null): string {
  if (!iso) return '—'
  return formatDate(iso, { month: 'short', day: 'numeric', year: 'numeric' })
}

function apptTimeLabel(a: AppointmentRow): string {
  if (a.allDay) return `${fmtDue(a.startAt)} · all day`
  const t = new Date(a.startAt).toLocaleString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Los_Angeles',
  })
  return `${fmtDue(a.startAt)} · ${t}`
}

/** §25.9.3 date badge (month over day). */
function DateBadge({ iso, tone }: { iso: string | null; tone: 'appt' | 'task' }) {
  return (
    <div
      className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg text-white"
      style={{ backgroundColor: tone === 'appt' ? 'var(--primary)' : 'var(--console-info)' }}
    >
      <span className="text-[10px] font-semibold uppercase">
        {iso ? new Date(iso).toLocaleString('en-US', { month: 'short', timeZone: 'America/Los_Angeles' }) : '?'}
      </span>
      <span className="text-[16px] font-semibold leading-none">
        {iso ? new Date(iso).toLocaleString('en-US', { day: 'numeric', timeZone: 'America/Los_Angeles' }) : '—'}
      </span>
    </div>
  )
}

export function MobileCalendarTab({
  personId,
  personName,
  tasks,
  appointments,
  addTaskAction,
  createAppointmentAction,
  updateAppointmentAction,
}: MobileCalendarTabProps) {
  const [chooserOpen, setChooserOpen] = useState(false)
  const [taskSheetOpen, setTaskSheetOpen] = useState(false)
  const [apptSheetOpen, setApptSheetOpen] = useState(false)
  const openTasks = tasks.filter((t) => !t.completed_at)
  const apptRows = appointments.rows

  return (
    <div className="bg-secondary pb-24">
      {/* §25.9.1 "Add Appointment or Task" inline row */}
      <button
        type="button"
        onClick={() => setChooserOpen(true)}
        className="flex w-full items-center gap-3 bg-secondary px-4 py-3"
        style={{ minHeight: 44 }}
      >
        {/* Filled accent circle + glyph (console link accent, see MobileNotesTab) */}
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: 'var(--console-info)' }}
        >
          <Plus size={14} className="text-white" strokeWidth={3} />
        </span>
        <span className="text-[16px]" style={{ color: 'var(--console-info)' }}>Add Appointment or Task</span>
      </button>

      {/* §25.9.2 Empty state */}
      {openTasks.length === 0 && apptRows.length === 0 && (
        <div className="flex flex-col items-center justify-center px-8 pt-16 pb-8 text-center">
          {/* §25.9.2: compound calendar+clock icon (overlay) */}
          <div className="relative mb-4">
            <CalendarDays className="text-muted-foreground" size={56} strokeWidth={1.5} />
            <Clock
              className="absolute -bottom-1 -right-1 rounded-full bg-secondary text-muted-foreground"
              size={24}
              strokeWidth={1.5}
              style={{ padding: 2 }}
            />
          </div>
          <p className="text-[17px] font-semibold text-muted-foreground">
            No Scheduled Appointments
          </p>
          <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">
            Tasks and Appointments will show up here
          </p>
        </div>
      )}

      {/* §25.9.3 Appointment rows (P2-4: the contact's real appointments) */}
      {apptRows.length > 0 && (
        <div className="bg-card">
          {apptRows.map((a) => (
            <div
              key={`appt-${a.id}`}
              className="flex min-h-[56px] items-center gap-3 border-b border-border px-4 py-3 last:border-0"
            >
              <DateBadge iso={a.startAt} tone="appt" />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium text-foreground">{a.title}</p>
                <p className="text-[12px] text-muted-foreground">
                  {[a.typeName ?? 'Appointment', apptTimeLabel(a), a.location].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* §25.9.3 Task rows */}
      {openTasks.length > 0 && (
        <div className="mt-px bg-card">
          {openTasks.map((t) => (
            <div
              key={t.id}
              className="flex min-h-[56px] items-center gap-3 border-b border-border px-4 py-3 last:border-0"
            >
              <DateBadge iso={t.due_at} tone="task" />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium text-foreground">{t.name}</p>
                <p className="text-[12px] text-muted-foreground">
                  {t.type ?? 'Task'} · due {fmtDue(t.due_at)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* D.2-style chooser — Appointment or Task (both real, P2-4) */}
      <Sheet open={chooserOpen} onOpenChange={setChooserOpen}>
        <SheetContent side="bottom" className="gap-0 rounded-t-2xl p-0" aria-describedby={undefined}>
          <SheetTitle className="px-4 pb-2 pt-4 text-[16px] font-semibold text-foreground">
            What would you like to add?
          </SheetTitle>
          <button
            type="button"
            className="flex h-[52px] w-full items-center gap-3 border-b border-border px-4 text-left active:bg-secondary"
            onClick={() => { setChooserOpen(false); setApptSheetOpen(true) }}
          >
            <CalendarIcon className="h-5 w-5 text-primary" aria-hidden />
            <span className="text-[16px] text-foreground">Appointment</span>
          </button>
          <button
            type="button"
            className="flex h-[52px] w-full items-center gap-3 border-b border-border px-4 text-left active:bg-secondary"
            onClick={() => { setChooserOpen(false); setTaskSheetOpen(true) }}
          >
            <CheckSquare className="h-5 w-5 text-primary" aria-hidden />
            <span className="text-[16px] text-foreground">Task</span>
          </button>
          <div className="p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <Button variant="ghost" className="w-full" onClick={() => setChooserOpen(false)}>Cancel</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Appointment branch — the same full-field sheet as /admin/crm/calendar,
          pre-linked to this contact. */}
      <AppointmentSheet
        open={apptSheetOpen}
        onOpenChange={setApptSheetOpen}
        appointment={null}
        presetPersonId={personId}
        types={appointments.types}
        outcomes={appointments.outcomes}
        contacts={[{ id: personId, name: personName }]}
        brokerSlugs={appointments.brokerSlugs}
        currentBrokerSlug={appointments.currentBrokerSlug}
        isSuperuser={appointments.isSuperuser}
        createAction={createAppointmentAction}
        updateAction={updateAppointmentAction}
      />

      {/* §25.9.4 Task create sheet */}
      <Sheet open={taskSheetOpen} onOpenChange={setTaskSheetOpen}>
        <SheetContent side="bottom" className="h-auto" aria-describedby={undefined}>
          <SheetHeader>
            <SheetTitle>Add Task</SheetTitle>
          </SheetHeader>
          <form
            action={addTaskAction}
            className="flex flex-col gap-3 pt-3"
            onSubmit={() => setTaskSheetOpen(false)}
          >
            <input type="hidden" name="personId" value={personId} />
            <Input name="name" placeholder="Task name" className="h-10" required />
            <div className="grid grid-cols-2 gap-2">
              <Select name="type" defaultValue="Follow Up">
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['Follow Up', 'Call', 'Text', 'Email'].map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select name="dueHours" defaultValue="24">
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">In 1 hour</SelectItem>
                  <SelectItem value="4">In 4 hours</SelectItem>
                  <SelectItem value="24">Tomorrow</SelectItem>
                  <SelectItem value="72">In 3 days</SelectItem>
                  <SelectItem value="168">In a week</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" type="button" onClick={() => setTaskSheetOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Add Task</Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
}
