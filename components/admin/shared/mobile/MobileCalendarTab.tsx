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
 *   - Rows (§25.9.3): the contact's appointments (accent-strong date badge) +
 *     open tasks (accent date badge), chronological.
 *
 * Client component for the sheet open states.
 */

import { useState } from 'react'
import { CalendarDays, CheckSquare, Clock, Plus, Calendar as CalendarIcon } from 'lucide-react'
import { Button, Sheet, ToolbarSelect } from '@/components/admin/v2'
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
      className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg"
      style={{
        backgroundColor: tone === 'appt' ? 'var(--a-accent-strong)' : 'var(--a-btn-bg)',
        color: 'var(--a-btn-fg)',
      }}
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
    <div className="pb-24" style={{ background: 'var(--a-inset)' }}>
      {/* §25.9.1 "Add Appointment or Task" inline row */}
      <button
        type="button"
        onClick={() => setChooserOpen(true)}
        className="flex w-full items-center gap-3 px-4 py-3"
        style={{ minHeight: 44, background: 'var(--a-inset)' }}
      >
        {/* Filled accent circle + glyph (see MobileNotesTab) */}
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: 'var(--a-btn-bg)' }}
        >
          <Plus size={14} strokeWidth={3} style={{ color: 'var(--a-btn-fg)' }} />
        </span>
        <span className="text-[16px]" style={{ color: 'var(--a-accent)' }}>Add Appointment or Task</span>
      </button>

      {/* §25.9.2 Empty state */}
      {openTasks.length === 0 && apptRows.length === 0 && (
        <div className="flex flex-col items-center justify-center px-8 pt-16 pb-8 text-center">
          {/* §25.9.2: compound calendar+clock icon (overlay) */}
          <div className="relative mb-4">
            <CalendarDays style={{ color: 'var(--a-text-2)' }} size={56} strokeWidth={1.5} />
            <Clock
              className="absolute -bottom-1 -right-1 rounded-full"
              size={24}
              strokeWidth={1.5}
              style={{ padding: 2, background: 'var(--a-inset)', color: 'var(--a-text-2)' }}
            />
          </div>
          <p className="text-[17px] font-semibold" style={{ color: 'var(--a-text-2)' }}>
            No Scheduled Appointments
          </p>
          <p className="mt-1 text-[14px] leading-relaxed" style={{ color: 'var(--a-text-2)' }}>
            Tasks and Appointments will show up here
          </p>
        </div>
      )}

      {/* §25.9.3 Appointment rows (P2-4: the contact's real appointments) */}
      {apptRows.length > 0 && (
        <div style={{ background: 'var(--a-surface)' }}>
          {apptRows.map((a, i) => (
            <div
              key={`appt-${a.id}`}
              className="flex min-h-[56px] items-center gap-3 px-4 py-3"
              // inline wins over `last:border-0`, so the last-row rule is explicit
              style={{ borderBottom: i === apptRows.length - 1 ? undefined : '1px solid var(--a-border)' }}
            >
              <DateBadge iso={a.startAt} tone="appt" />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium" style={{ color: 'var(--a-text)' }}>{a.title}</p>
                <p className="text-[12px]" style={{ color: 'var(--a-text-2)' }}>
                  {[a.typeName ?? 'Appointment', apptTimeLabel(a), a.location].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* §25.9.3 Task rows */}
      {openTasks.length > 0 && (
        <div className="mt-px" style={{ background: 'var(--a-surface)' }}>
          {openTasks.map((t, i) => (
            <div
              key={t.id}
              className="flex min-h-[56px] items-center gap-3 px-4 py-3"
              // inline wins over `last:border-0`, so the last-row rule is explicit
              style={{ borderBottom: i === openTasks.length - 1 ? undefined : '1px solid var(--a-border)' }}
            >
              <DateBadge iso={t.due_at} tone="task" />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium" style={{ color: 'var(--a-text)' }}>{t.name}</p>
                <p className="text-[12px]" style={{ color: 'var(--a-text-2)' }}>
                  {t.type ?? 'Task'} · due {fmtDue(t.due_at)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* D.2-style chooser — Appointment or Task (both real, P2-4) */}
      <Sheet
        open={chooserOpen}
        onClose={() => setChooserOpen(false)}
        title="What would you like to add?"
      >
        {/* One flex child: av2-sheet__body gaps its children, and the rows
            stack flush (the shadcn original set gap-0). The question is the
            sheet's `title` rather than an <h2> in here — rendered both ways it
            printed twice, once under the head's own dismiss control.
            active:opacity-70 restores the phone pressed state the migration
            dropped — an opacity, not a background, because the rows paint
            inline and an inline style outranks any :active background rule. */}
        <div>
          <button
            type="button"
            className="flex h-[52px] w-full items-center gap-3 text-left active:opacity-70"
            style={{ borderBottom: '1px solid var(--a-border)' }}
            onClick={() => { setChooserOpen(false); setApptSheetOpen(true) }}
          >
            <CalendarIcon className="h-5 w-5" style={{ color: 'var(--a-accent)' }} aria-hidden />
            <span className="text-[16px]" style={{ color: 'var(--a-text)' }}>Appointment</span>
          </button>
          <button
            type="button"
            className="flex h-[52px] w-full items-center gap-3 text-left active:opacity-70"
            style={{ borderBottom: '1px solid var(--a-border)' }}
            onClick={() => { setChooserOpen(false); setTaskSheetOpen(true) }}
          >
            <CheckSquare className="h-5 w-5" style={{ color: 'var(--a-accent)' }} aria-hidden />
            <span className="text-[16px]" style={{ color: 'var(--a-text)' }}>Task</span>
          </button>
          <div className="p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <Button variant="quiet" className="w-full" onClick={() => setChooserOpen(false)}>Cancel</Button>
          </div>
        </div>
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
      <Sheet
        open={taskSheetOpen}
        onClose={() => setTaskSheetOpen(false)}
        title="Add Task"
      >
        {/* ONE child of av2-sheet__body, which is a flex column with a gap: the
            title moved to the sheet's `title` prop (it was printing twice, once
            under the head's own dismiss control), so the form is the only child
            and the gap has nothing to open up — the same shape every sibling
            sheet in this folder uses. */}
        <form
          action={addTaskAction}
          className="flex flex-col gap-3"
          onSubmit={() => setTaskSheetOpen(false)}
        >
          <input type="hidden" name="personId" value={personId} />
          <input
            className="av2-input w-full"
            name="name"
            aria-label="Task name"
            placeholder="Task name"
            style={{ minHeight: 40 }}
            required
          />
          <div className="grid grid-cols-2 gap-2">
            <ToolbarSelect
              name="type"
              aria-label="Task type"
              defaultValue="Follow Up"
              style={{ width: '100%', maxWidth: 'none', minHeight: 40 }}
            >
              {['Follow Up', 'Call', 'Text', 'Email'].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </ToolbarSelect>
            <ToolbarSelect
              name="dueHours"
              aria-label="Due"
              defaultValue="24"
              style={{ width: '100%', maxWidth: 'none', minHeight: 40 }}
            >
              <option value="1">In 1 hour</option>
              <option value="4">In 4 hours</option>
              <option value="24">Tomorrow</option>
              <option value="72">In 3 days</option>
              <option value="168">In a week</option>
            </ToolbarSelect>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="quiet" type="button" onClick={() => setTaskSheetOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Add Task</Button>
          </div>
        </form>
      </Sheet>
    </div>
  )
}
