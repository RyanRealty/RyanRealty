'use client'

/**
 * MobileCalendarTab — §25.9 Calendar tab for the mobile Contact Detail
 *
 * Layout:
 *   - "Add Appointment or Task" inline action row (§25.9.1)
 *   - Empty state: compound calendar+clock icon + text (§25.9.2)
 *   - When tasks exist: chronological rows (§25.9.3) — currently showing tasks,
 *     appointments support TBD (crm_appointments not yet in page data)
 *
 * Client component for the add-sheet open state.
 */

import { useState } from 'react'
import { CalendarDays, Clock, Plus } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDate } from '@/lib/format/date'
import { cn } from '@/lib/utils'

export interface MobileTask {
  id: number
  name: string
  type: string | null
  due_at: string | null
  completed_at: string | null
}

export interface MobileCalendarTabProps {
  personId: number
  tasks: MobileTask[]
  addTaskAction: (formData: FormData) => Promise<void>
}

function fmtDue(iso: string | null): string {
  if (!iso) return '—'
  return formatDate(iso, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function MobileCalendarTab({ personId, tasks, addTaskAction }: MobileCalendarTabProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const openTasks = tasks.filter((t) => !t.completed_at)

  return (
    <div className="bg-secondary pb-24">
      {/* §25.9.1 "Add Appointment or Task" inline row */}
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
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
      {openTasks.length === 0 && (
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

      {/* §25.9.3 Task rows */}
      {openTasks.length > 0 && (
        <div className="bg-card">
          {openTasks.map((t) => (
            <div
              key={t.id}
              className="flex min-h-[56px] items-center gap-3 border-b border-border px-4 py-3 last:border-0"
            >
              {/* Date badge — console link accent fill, white text (§25.9.3) */}
              <div
                className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg text-white"
                style={{ backgroundColor: 'var(--console-info)' }}
              >
                <span className="text-[10px] font-semibold uppercase">
                  {t.due_at ? new Date(t.due_at).toLocaleString('en-US', { month: 'short', timeZone: 'America/Los_Angeles' }) : '?'}
                </span>
                <span className="text-[16px] font-semibold leading-none">
                  {t.due_at ? new Date(t.due_at).toLocaleString('en-US', { day: 'numeric', timeZone: 'America/Los_Angeles' }) : '—'}
                </span>
              </div>
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

      {/* §25.9.4 Create sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="h-auto">
          <SheetHeader>
            <SheetTitle>Add Task</SheetTitle>
          </SheetHeader>
          <form
            action={addTaskAction}
            className="flex flex-col gap-3 pt-3"
            onSubmit={() => setSheetOpen(false)}
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
              <Button variant="outline" type="button" onClick={() => setSheetOpen(false)}>
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
