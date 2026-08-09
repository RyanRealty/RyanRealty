'use client'

/**
 * MobileTaskCreateSheet — the §29 Screen D.3 "New Task" bottom sheet.
 *
 * Fields (top → bottom per spec): Contact (live search, locked when opened
 * from a contact), Type (all configured task types, each carrying its A.6
 * glyph — a native <option> cannot host an icon, so the short fixed list is a
 * radio group, which is what pattern 6 asks for on a phone anyway), a
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
import {
  Button,
  IconButton,
  SearchField,
  SelectField,
  Sheet,
  TextAreaField,
  TextField,
} from '@/components/admin/v2'
import { MobileTypeIcon } from '@/components/admin/shared/mobile/task-type-icons'
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
    <Sheet
      open={open}
      onClose={() => { reset(); onOpenChange(false) }}
      title="New Task"
    >
      {/* The sheet's own head carries the D.3 title and the dismiss control, so
          this file renders neither: a second header published a second control
          named "Close" inside one dialog. .av2-sheet also owns the scroll and
          the max-height — repeating calc(85dvh - 50px) here constrained the
          form a second time against a height it no longer sets. */}
      <div className="flex flex-col gap-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {/* 1. Contact */}
        <div className="space-y-1.5">
          <span className="av2-field__label block">Contact</span>
          {picked ? (
            <div
              className="flex h-11 items-center justify-between px-3"
              style={{ border: '1px solid var(--a-border)', borderRadius: 'var(--a-r-md)', background: 'var(--a-surface)' }}
            >
              <span className="truncate text-[15px]" style={{ color: 'var(--a-text)' }}>{picked.name}</span>
              {!presetContact ? (
                <IconButton label="Remove contact" onClick={() => setContact(null)}>
                  <X className="h-4 w-4" />
                </IconButton>
              ) : null}
            </div>
          ) : (
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                style={{ color: 'var(--a-text-2)' }}
              />
              <SearchField
                aria-label="Search contacts"
                type="text"
                value={query}
                onChange={(e) => onQuery(e.target.value)}
                placeholder="Search contacts..."
                className="w-full"
                style={{ maxWidth: 'none', minHeight: 'var(--a-touch)', paddingLeft: 36, fontSize: 15 }}
              />
              {results.length > 0 ? (
                <div
                  className="absolute inset-x-0 top-12 z-10 max-h-52 overflow-y-auto"
                  style={{
                    border: '1px solid var(--a-border)',
                    borderRadius: 'var(--a-r-md)',
                    background: 'var(--a-bg)',
                    boxShadow: 'var(--a-shadow-overlay)',
                  }}
                >
                  {results.map((r, i) => (
                    <button
                      key={r.id}
                      type="button"
                      className="flex min-h-[44px] w-full items-center px-3 text-left text-[15px] active:opacity-70"
                      // inline wins over `last:border-0`, so the last-row rule is explicit
                      style={{
                        borderBottom: i === results.length - 1 ? undefined : '1px solid var(--a-border)',
                        color: 'var(--a-text)',
                      }}
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

        {/* 2. Type. D.3 asks for the A.6 glyph beside the type, and a native
            <option> cannot host one — but the fix for that shipped a radio per
            type at var(--a-touch) each, and `activeTypes` is NOT a short fixed
            list: it reads public.crm_task_types, a broker-editable table seeded
            with eight rows. Eight radios is ~352px for one field, which pushed
            the sheet past .av2-sheet's 92dvh and put "Create Task" below the
            fold on a phone. A control that grows every time a broker adds a
            custom type is the wrong shape here.

            So: one 44px SelectField, with the glyph shown for the CHOSEN type
            beside it. The list loses its per-row icons; the field keeps its
            height and the primary action stays on screen. Restoring the icon
            inside the list needs an icon-capable compact control (Combobox or
            Menu), which is queued rather than improvised here. */}
        <div className="flex items-end gap-2">
          <span
            aria-hidden
            className="flex shrink-0 items-center justify-center"
            style={{ height: 'var(--a-touch)', color: 'var(--a-text-2)' }}
          >
            <MobileTypeIcon type={type} size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <SelectField
              label="Type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              style={{ fontSize: 15 }}
            >
              {activeTypes.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </SelectField>
          </div>
        </div>

        {/* 3. Description */}
        <TextAreaField
          label="Description"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add a note about this task..."
          rows={2}
          style={{ fontSize: 15 }}
        />

        {/* 4 + 5. Due date / due time */}
        <div className="space-y-1.5">
          <TextField
            label="Due date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            style={{ fontSize: 15 }}
          />
          {dueDate && !dueTime ? (
            <p className="text-[12px]" style={{ color: 'var(--a-warn)' }}>Without a time, the task is due at 9:00 am.</p>
          ) : null}
          {!dueDate ? (
            <p className="text-[12px]" style={{ color: 'var(--a-text-2)' }}>No date picked — due in 24 hours.</p>
          ) : null}
        </div>
        {dueDate ? (
          <TextField
            label="Due time"
            type="time"
            value={dueTime}
            onChange={(e) => setDueTime(e.target.value)}
            style={{ fontSize: 15 }}
          />
        ) : null}

        {/* 6. Assignee — creation assigns the caller (backend contract). */}
        <div className="space-y-1.5">
          <span className="av2-field__label block">Assigned to</span>
          <div
            className="flex h-11 items-center px-3 text-[15px]"
            style={{
              border: '1px solid var(--a-border)',
              borderRadius: 'var(--a-r-md)',
              background: 'var(--a-surface)',
              color: 'var(--a-text)',
            }}
          >
            Me
          </div>
        </div>

        {error ? <p className="text-[13px]" style={{ color: 'var(--a-danger)' }}>{error}</p> : null}

        <Button
          type="button"
          className="h-12 w-full"
          style={{ fontSize: 15 }}
          disabled={pending || !picked || !name.trim()}
          onClick={submit}
        >
          {pending ? 'Creating…' : 'Create Task'}
        </Button>
      </div>
    </Sheet>
  )
}
