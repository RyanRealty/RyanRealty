'use client'

/**
 * NewTaskDialog — create a task from the queue. Includes a searchable contact
 * picker so brokers do not need to know the numeric CRM person id. Optionally
 * auto-opens when the parent passes autoOpen={true} (used by the dashboard
 * FAB via ?new=1 on the tasks page).
 *
 * Admin v2 migration (11F): the shadcn Command/Popover/Dialog/Select stack is
 * replaced with '@/components/admin/v2' primitives. The v2 barrel has no
 * searchable-combobox primitive (SelectField/ToolbarSelect are for a plain
 * value list, Menu auto-closes on every click so it does not fit a live
 * results list), so the contact picker is hand-built from a v2 Button
 * trigger + SearchField + a token-styled results panel (reusing the
 * av2-menu__panel class). Click-outside and Escape close it, matching the
 * original Popover; arrow-key list navigation from cmdk is not reproduced
 * (click/tap-to-select only) — flagged in the migration report.
 */

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Dialog, SearchField, SelectField, TextField } from '@/components/admin/v2'
import type { CrmTaskType } from '@/lib/data/crm/getTaskQueue'
import type { ContactSearchHit } from '@/app/actions/crm-tasks'

export default function NewTaskDialog({
  taskTypes,
  createAction,
  searchAction,
  autoOpen = false,
}: {
  taskTypes: CrmTaskType[]
  createAction: (formData: FormData) => Promise<{ ok: boolean; error?: string }>
  searchAction: (q: string) => Promise<{ ok: boolean; results?: ContactSearchHit[]; error?: string }>
  autoOpen?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Contact picker state
  const [pickerOpen, setPickerOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ContactSearchHit[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedPerson, setSelectedPerson] = useState<ContactSearchHit | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pickerWrapRef = useRef<HTMLDivElement>(null)

  // Task fields
  const [name, setName] = useState('')
  const [type, setType] = useState('Follow Up')
  const [dueHours, setDueHours] = useState('24')

  const activeTypes = taskTypes.filter((t) => t.isActive)

  // Auto-open for ?new=1 FAB
  useEffect(() => {
    if (autoOpen) setOpen(true)
  }, [autoOpen])

  // Debounced contact search
  useEffect(() => {
    if (!pickerOpen) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) {
      setSearchResults([])
      return
    }
    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      const res = await searchAction(query)
      setSearching(false)
      if (res.ok && res.results) setSearchResults(res.results)
    }, 250)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, pickerOpen, searchAction])

  // Contact picker: click-outside + Escape close (mirrors the original Popover).
  useEffect(() => {
    if (!pickerOpen) return
    function onDocDown(e: MouseEvent) {
      if (!pickerWrapRef.current?.contains(e.target as Node)) setPickerOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setPickerOpen(false)
    }
    document.addEventListener('mousedown', onDocDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [pickerOpen])

  function resetForm() {
    setSelectedPerson(null)
    setQuery('')
    setSearchResults([])
    setName('')
    setType('Follow Up')
    setDueHours('24')
    setError(null)
  }

  const submit = () => {
    setError(null)
    const fd = new FormData()
    if (selectedPerson) fd.set('personId', String(selectedPerson.id))
    fd.set('name', name.trim())
    fd.set('type', type)
    fd.set('dueHours', dueHours || '24')
    startTransition(async () => {
      const res = await createAction(fd)
      if (!res.ok) {
        setError(res.error ?? 'Could not create the task')
        return
      }
      setOpen(false)
      resetForm()
      router.refresh()
    })
  }

  const canSubmit = !pending && name.trim().length > 0 && selectedPerson !== null

  return (
    <>
      <Button variant="quiet" className="h-10 sm:h-9" onClick={() => setOpen(true)}>
        New task
      </Button>
      <Dialog
        open={open}
        onClose={() => { setOpen(false); resetForm() }}
        title="New task"
        footer={
          <Button disabled={!canSubmit} onClick={submit}>
            {pending ? 'Creating…' : 'Create task'}
          </Button>
        }
      >
        <div className="space-y-3">

          {/* Task name */}
          <TextField
            label="Task"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Call back about the offer"
          />

          {/* Contact picker */}
          <div className="space-y-1.5">
            <span className="av2-field__label" style={{ display: 'block' }}>Contact</span>
            <div ref={pickerWrapRef} style={{ position: 'relative' }}>
              <Button
                variant="quiet"
                role="combobox"
                aria-expanded={pickerOpen}
                className="w-full justify-between font-normal"
                onClick={() => setPickerOpen((v) => !v)}
              >
                {selectedPerson ? (
                  <span className="truncate">{selectedPerson.name}</span>
                ) : (
                  <span style={{ color: 'var(--a-text-2)' }}>Search contacts…</span>
                )}
                <svg
                  aria-hidden
                  className="ml-2 size-4 shrink-0"
                  style={{ opacity: 0.5 }}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4M8 15l4 4 4-4" />
                </svg>
              </Button>
              {pickerOpen && (
                <div
                  className="av2-menu__panel"
                  role="listbox"
                  aria-label="Contact results"
                  data-align="start"
                  style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, maxHeight: 260, overflowY: 'auto' }}
                >
                  <SearchField
                    aria-label="Search contacts by name"
                    placeholder="Search by name…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="mb-1"
                    autoFocus
                  />
                  {searching ? (
                    <p className="px-2 py-2 text-sm" style={{ color: 'var(--a-text-2)' }}>Searching…</p>
                  ) : query.trim() && searchResults.length === 0 ? (
                    <p className="px-2 py-2 text-sm" style={{ color: 'var(--a-text-2)' }}>No contacts found.</p>
                  ) : !query.trim() ? (
                    <p className="px-2 py-2 text-sm" style={{ color: 'var(--a-text-2)' }}>Type a name to search.</p>
                  ) : (
                    searchResults.map((hit) => (
                      <Button
                        key={hit.id}
                        variant="quiet"
                        role="option"
                        className="w-full justify-start font-normal"
                        style={{ background: 'transparent', border: 'none' }}
                        onClick={() => {
                          setSelectedPerson(hit)
                          setPickerOpen(false)
                          setQuery('')
                          setSearchResults([])
                        }}
                      >
                        {hit.name}
                      </Button>
                    ))
                  )}
                </div>
              )}
            </div>
            <p className="text-xs" style={{ color: 'var(--a-text-2)' }}>A task must be linked to a contact.</p>
          </div>

          {/* Task type */}
          <SelectField label="Type" value={type} onChange={(e) => setType(e.target.value)}>
            {activeTypes.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </SelectField>

          {/* Due in hours */}
          <TextField
            label="Due in (hours)"
            type="number"
            min="1"
            value={dueHours}
            onChange={(e) => setDueHours(e.target.value)}
          />

          {error ? <p className="text-sm font-medium" style={{ color: 'var(--a-danger)' }}>{error}</p> : null}
        </div>
      </Dialog>
    </>
  )
}
