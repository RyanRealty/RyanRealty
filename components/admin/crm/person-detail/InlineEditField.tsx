'use client'

/**
 * InlineEditField — the §07a §12 canonical inline-edit pattern for the
 * person-detail left sidebar (spec docs/fub-crm-spec/07a-person-detail-
 * sidebar-and-inline-edit.md §12).
 *
 * Read state: static value (or muted "Add …" placeholder), pointer cursor,
 * hover highlight. Edit state: Input/Textarea/searchable option list with a
 * green ✓ confirm and red ✗ cancel. Enter saves (single-line), Escape cancels.
 * Errors return to edit state with an inline message.
 */

import { useRef, useState, useTransition } from 'react'
import { Check, X, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

type SaveResult = { ok: true } | { ok: false; error: string }

export function InlineEditText({
  value,
  placeholder,
  multiline = false,
  display,
  onSave,
  className,
}: {
  value: string | null
  placeholder: string
  multiline?: boolean
  /** Optional formatted read-state display (e.g. "$895,000" for raw "895000"). */
  display?: string | null
  onSave: (next: string) => Promise<SaveResult>
  className?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function open() {
    setDraft(value ?? '')
    setError(null)
    setEditing(true)
  }
  function save() {
    start(async () => {
      const r = await onSave(draft)
      if (r.ok) setEditing(false)
      else setError(r.error)
    })
  }
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') setEditing(false)
    if (e.key === 'Enter' && !multiline) {
      e.preventDefault()
      save()
    }
    if (e.key === 'Enter' && multiline && (e.metaKey || e.ctrlKey)) save()
  }

  if (!editing) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={open}
        onKeyDown={(e) => e.key === 'Enter' && open()}
        className={cn(
          'cursor-pointer rounded px-1 py-0.5 text-sm hover:bg-muted/40',
          multiline && 'whitespace-pre-wrap break-words',
          className,
        )}
      >
        {(display ?? value) || <span className="text-muted-foreground">{placeholder}</span>}
      </div>
    )
  }

  return (
    <div className={cn('rounded-md bg-muted/30 p-1', className)}>
      <div className="flex items-start gap-1">
        {multiline ? (
          <Textarea autoFocus value={draft} rows={4} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKeyDown} className="flex-1 text-sm" />
        ) : (
          <Input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKeyDown} className="h-8 flex-1 text-sm" />
        )}
        <Button size="icon" disabled={pending} onClick={save} aria-label="Save" className="h-8 w-8 shrink-0 bg-success text-success-foreground hover:bg-success/90">
          <Check className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="destructive" disabled={pending} onClick={() => setEditing(false)} aria-label="Cancel" className="h-8 w-8 shrink-0">
          <X className="h-4 w-4" />
        </Button>
      </div>
      {error ? <p className="mt-1 px-1 text-xs text-destructive">{error}</p> : null}
    </div>
  )
}

export type InlineOption = { value: string; label: string; hint?: string; group?: string }

export function InlineEditSelect({
  value,
  options,
  placeholder,
  clearLabel = 'Select an Option',
  onSave,
  className,
  displaySuffix,
  readLabel,
}: {
  value: string | null
  options: InlineOption[]
  placeholder: string
  /** Top row that resets the field to null (§07a 5.5). */
  clearLabel?: string
  onSave: (next: string | null) => Promise<SaveResult>
  className?: string
  /** Read-state suffix, e.g. the source recency label (§07a 5.3). */
  displaySuffix?: string | null
  /** Explicit read-state label (e.g. broker display name instead of the "Me" shortcut). */
  readLabel?: string | null
}) {
  const [editing, setEditing] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(value)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const listRef = useRef<HTMLDivElement>(null)

  function open() {
    setSelected(value)
    setQuery('')
    setError(null)
    setEditing(true)
  }
  function save(next: string | null) {
    start(async () => {
      const r = await onSave(next)
      if (r.ok) setEditing(false)
      else setError(r.error)
    })
  }

  if (!editing) {
    const current = readLabel ?? options.find((o) => o.value === value)?.label ?? value
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={open}
        onKeyDown={(e) => e.key === 'Enter' && open()}
        className={cn('cursor-pointer rounded px-1 py-0.5 text-sm hover:bg-muted/40', className)}
      >
        {current ? (
          <span>
            {current}
            {displaySuffix ? <span className="text-muted-foreground">, {displaySuffix}</span> : null}
          </span>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
      </div>
    )
  }

  const filtered = options.filter(
    (o) => !query.trim() || o.label.toLowerCase().includes(query.trim().toLowerCase()),
  )
  const groups = [...new Set(filtered.map((o) => o.group ?? ''))]

  return (
    <div className={cn('rounded-md border border-border bg-card p-1 shadow-md', className)} onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}>
      <div className="flex items-center gap-1 px-1 pb-1">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} className="h-8 pl-7 pr-7 text-sm" />
          {query ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
        <Button size="icon" disabled={pending} onClick={() => save(selected)} aria-label="Save" className="h-8 w-8 shrink-0 bg-success text-success-foreground hover:bg-success/90">
          <Check className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="destructive" disabled={pending} onClick={() => setEditing(false)} aria-label="Cancel" className="h-8 w-8 shrink-0">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div ref={listRef} className="max-h-56 overflow-y-auto">
        <button
          type="button"
          onClick={() => save(null)}
          className="block w-full rounded px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-secondary"
        >
          {clearLabel}
        </button>
        {groups.map((g) => (
          <div key={g || '_'}>
            {g ? <div className="px-2 pt-2 pb-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g}</div> : null}
            {filtered
              .filter((o) => (o.group ?? '') === g)
              .map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => save(o.value)}
                  className={cn(
                    'block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-secondary',
                    o.value === selected && 'bg-secondary font-medium',
                  )}
                >
                  {o.label}
                  {o.hint ? <span className="ml-1.5 text-xs text-muted-foreground">{o.hint}</span> : null}
                </button>
              ))}
          </div>
        ))}
        {filtered.length === 0 ? <p className="px-2 py-2 text-center text-sm text-muted-foreground">No options found.</p> : null}
      </div>
      {error ? <p className="mt-1 px-1 text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
