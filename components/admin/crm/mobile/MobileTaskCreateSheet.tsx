'use client'

/**
 * MobileTaskCreateSheet — the §29 Screen D.3 "New Task" bottom sheet.
 *
 * Fields (top → bottom per spec): Contact (live search, locked when opened
 * from a contact), Type (all configured task types with the A.6 icon), a
 * Description textarea, Due date + Due time (time appears once a date is set;
 * the date-without-time warning note renders per D.3 field 4), Assigned to
 * (display-only "Me" — addCrmTaskAction always assigns the caller; a
 * reassign happens on the created row, logged as a deviation).
 *
 * Submits through the page-bound addCrmTaskAction wrapper (personId, name,
 * type, dueHours) — the existing gated write path; no new mutation surface.
 */

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MobileTypeIcon } from '@/components/admin/crm/mobile/task-type-icons'
import type { CrmTaskType } from '@/lib/data/crm/getTaskQueue'

export type TaskSheetContact = { id: number; name: string }

export default function MobileTaskCreateSheet({
  open,
  onOpenChange,
  taskTypes,
  presetContact,
  createAction,
  searchAction,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  taskTypes: CrmTaskType[]
  /** Pre-scoped contact (Screen B "Add Appointment or Task") — locks the field. */
  presetContact?: TaskSheetContact | null
  createAction: (fd: FormData) => Promise<{ ok: boolean; error?: string }>
  searchAction: (q: string) => Promise<{ ok: boolean; results?: Array<{ id: number; name: string }>; error?: string }>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [contact, setContact] = useState<TaskSheetContact | null>(presetContact ?? null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TaskSheetContact[]>([])
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [type, setType] = useState('Follow Up')
  const [name, setName] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')

  const activeTypes = taskTypes.filter((t) => t.isActive)
  const picked = contact ?? presetContact ?? null

  const onQuery = (q: string) => {
    setQuery(q)
    if (debounce.current) clearTimeout(debounce.current)
    if (q.trim().length < 2) { setResults([]); return }
    debounce.current = setTimeout(async () => {
      const r = await searchAction(q.trim())
      setResults(r.ok ? (r.results ?? []) : [])
    }, 250)
  }

  const reset = () => {
    setContact(presetContact ?? null)
    setQuery('')
    setResults([])
    setName('')
    setType('Follow Up')
    setDueDate('')
    setDueTime('')
    setError(null)
  }

  const submit = () => {
    if (!picked || !name.trim()) return
    // dueHours = distance from now to the picked instant (the existing action's
    // contract). No date picked → the action's 24h default.
    let dueHours = 24
    if (dueDate) {
      const instant = new Date(`${dueDate}T${dueTime || '09:00'}:00`)
      const diff = (instant.getTime() - Date.now()) / 3600e3 // hydration-safe
      if (diff <= 0) { setError('Due date must be in the future.'); return }
      dueHours = diff
    }
    const fd = new FormData()
    fd.set('personId', String(picked.id))
    fd.set('name', name.trim())
    fd.set('type', type)
    fd.set('dueHours', String(dueHours))
    setError(null)
    startTransition(async () => {
      const r = await createAction(fd)
      if (!r.ok) { setError(r.error ?? 'Could not create task.'); return }
      reset()
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <SheetContent aria-describedby={undefined} side="bottom" className="gap-0 overflow-hidden rounded-t-2xl p-0" style={{ maxHeight: '85dvh' }}>
        {/* Header — title + dismiss X (D.3) */}
        <div className="flex h-[50px] shrink-0 items-center justify-between border-b border-border px-4">
          <SheetTitle className="text-[16px] font-semibold text-foreground">New Task</SheetTitle>
          <button type="button" aria-label="Close" onClick={() => { reset(); onOpenChange(false) }}>
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto px-4 py-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]" style={{ maxHeight: 'calc(85dvh - 50px)' }}>
          {/* 1. Contact */}
          <div className="space-y-1.5">
            <Label className="text-[12px] font-medium text-muted-foreground">Contact</Label>
            {picked ? (
              <div className="flex h-11 items-center justify-between rounded-lg border border-border bg-secondary px-3">
                <span className="truncate text-[15px] text-foreground">{picked.name}</span>
                {!presetContact ? (
                  <button type="button" aria-label="Remove contact" onClick={() => setContact(null)}>
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => onQuery(e.target.value)}
                  placeholder="Search contacts..."
                  className="h-11 pl-9 text-[15px]"
                />
                {results.length > 0 ? (
                  <div className="absolute inset-x-0 top-12 z-10 max-h-52 overflow-y-auto rounded-lg border border-border bg-card shadow-md">
                    {results.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        className="flex min-h-[44px] w-full items-center border-b border-border px-3 text-left text-[15px] text-foreground last:border-0 active:bg-secondary"
                        onClick={() => { setContact(r); setResults([]); setQuery('') }}
                      >
                        {r.name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* 2. Type */}
          <div className="space-y-1.5">
            <Label className="text-[12px] font-medium text-muted-foreground">Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="h-11 w-full">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {activeTypes.map((t) => (
                  <SelectItem key={t.key} value={t.key}>
                    <span className="flex items-center gap-2">
                      <MobileTypeIcon type={t.key} size={16} />
                      {t.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 3. Description */}
          <div className="space-y-1.5">
            <Label className="text-[12px] font-medium text-muted-foreground">Description</Label>
            <Textarea
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Add a note about this task..."
              rows={2}
              className="text-[15px]"
            />
          </div>

          {/* 4 + 5. Due date / due time */}
          <div className="space-y-1.5">
            <Label className="text-[12px] font-medium text-muted-foreground">Due date</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-11 text-[15px]" />
            {dueDate && !dueTime ? (
              <p className="text-[12px] text-warning">Without a time, the task is due at 9:00 am.</p>
            ) : null}
            {!dueDate ? (
              <p className="text-[12px] text-muted-foreground">No date picked — due in 24 hours.</p>
            ) : null}
          </div>
          {dueDate ? (
            <div className="space-y-1.5">
              <Label className="text-[12px] font-medium text-muted-foreground">Due time</Label>
              <Input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} className="h-11 text-[15px]" />
            </div>
          ) : null}

          {/* 6. Assignee — creation assigns the caller (backend contract). */}
          <div className="space-y-1.5">
            <Label className="text-[12px] font-medium text-muted-foreground">Assigned to</Label>
            <div className="flex h-11 items-center rounded-lg border border-border bg-secondary px-3 text-[15px] text-foreground">
              Me
            </div>
          </div>

          {error ? <p className="text-[13px] text-destructive">{error}</p> : null}

          <Button
            type="button"
            className="h-12 w-full rounded-lg text-[15px]"
            disabled={pending || !picked || !name.trim()}
            onClick={submit}
          >
            {pending ? 'Creating…' : 'Create Task'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
