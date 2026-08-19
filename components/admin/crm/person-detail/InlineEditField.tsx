'use client'

/**
 * InlineEditField — the §07a §12 canonical inline-edit pattern for the
 * person-detail left sidebar (spec docs/crm-spec/07a-person-detail-
 * sidebar-and-inline-edit.md §12).
 *
 * Read state: static value (or muted "Add …" placeholder), pointer cursor,
 * hover highlight. Edit state: Input/Textarea/searchable option list with a
 * ✓ confirm and ✗ cancel. Enter saves (single-line), Escape cancels.
 * Errors return to edit state with an inline message.
 *
 * 11F: on the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * PRESENTATION ONLY — every export, prop, handler and user-visible string is
 * unchanged. Two notes on the swap:
 *  - The confirm/cancel pair are v2 IconButtons rather than sized <Button>s.
 *    They are icon-only, and IconButton is the primitive that refuses to
 *    compile without an accessible name; the old hand-tinted "success" fill is
 *    gone because §1 reserves colour for action and status.
 *  - The multiline control stays a raw <textarea> + `av2-input` + aria-label.
 *    TextAreaField prints a VISIBLE label above the box, and this field never
 *    had one (its label is the FieldRow to its left). Raw control + av2-input +
 *    aria-label is the folder's documented pattern for an unlabelled field
 *    (MobileNotesTab, MobileEditSheet, MobileCalendarTab) — dropping the
 *    visible label never drops the accessible one.
 */

import { useRef, useState, useTransition } from 'react'
import { Check, X, Search } from 'lucide-react'
import { IconButton, SearchField } from '@/components/admin/v2'
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
          // The hover fill is a CLASS, not an inline style: an inline
          // background would win over any :hover rule and leave the row dead.
          'cursor-pointer rounded px-1 py-0.5 text-sm hover:bg-[var(--a-inset)]',
          multiline && 'whitespace-pre-wrap break-words',
          className,
        )}
      >
        {(display ?? value) || <span style={{ color: 'var(--a-text-2)' }}>{placeholder}</span>}
      </div>
    )
  }

  return (
    <div className={cn('rounded-md p-1', className)} style={{ background: 'var(--a-inset)' }}>
      <div className="flex items-start gap-1">
        {multiline ? (
          <textarea
            className="av2-input flex-1"
            aria-label={placeholder}
            autoFocus
            value={draft}
            rows={4}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
          />
        ) : (
          <SearchField
            aria-label={placeholder}
            type="text"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            className="flex-1"
            style={{ maxWidth: 'none' }}
          />
        )}
        <IconButton label="Save" disabled={pending} onClick={save} className="shrink-0">
          <Check className="h-4 w-4" />
        </IconButton>
        <IconButton
          label="Cancel"
          tone="danger"
          disabled={pending}
          onClick={() => setEditing(false)}
          className="shrink-0"
        >
          <X className="h-4 w-4" />
        </IconButton>
      </div>
      {error ? (
        <p className="mt-1 px-1 text-xs" style={{ color: 'var(--a-danger)' }}>
          {error}
        </p>
      ) : null}
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
        className={cn('cursor-pointer rounded px-1 py-0.5 text-sm hover:bg-[var(--a-inset)]', className)}
      >
        {current ? (
          <span>
            {current}
            {displaySuffix ? <span style={{ color: 'var(--a-text-2)' }}>, {displaySuffix}</span> : null}
          </span>
        ) : (
          <span style={{ color: 'var(--a-text-2)' }}>{placeholder}</span>
        )}
      </div>
    )
  }

  const filtered = options.filter(
    (o) => !query.trim() || o.label.toLowerCase().includes(query.trim().toLowerCase()),
  )
  const groups = [...new Set(filtered.map((o) => o.group ?? ''))]

  return (
    <div
      className={cn('rounded-md p-1', className)}
      style={{
        border: '1px solid var(--a-border)',
        background: 'var(--a-surface)',
        boxShadow: 'var(--a-shadow-overlay)',
      }}
      onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
    >
      <div className="flex items-center gap-1 px-1 pb-1">
        <div className="relative flex-1">
          <Search
            className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
            style={{ color: 'var(--a-text-2)' }}
          />
          <SearchField
            aria-label={placeholder}
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full"
            // Padding is inline, not pl-7/pr-7: .av2-input--bar declares its own
            // padding UNLAYERED, which outranks a Tailwind utility — the icon
            // and the clear control would sit on top of the text.
            style={{ maxWidth: 'none', paddingLeft: 28, paddingRight: 28 }}
          />
          {query ? (
            <IconButton
              label="Clear search"
              onClick={() => setQuery('')}
              className="absolute right-1 top-1/2 -translate-y-1/2"
              style={{ width: 22, height: 22 }}
            >
              <X className="h-3.5 w-3.5" />
            </IconButton>
          ) : null}
        </div>
        <IconButton label="Save" disabled={pending} onClick={() => save(selected)} className="shrink-0">
          <Check className="h-4 w-4" />
        </IconButton>
        <IconButton
          label="Cancel"
          tone="danger"
          disabled={pending}
          onClick={() => setEditing(false)}
          className="shrink-0"
        >
          <X className="h-4 w-4" />
        </IconButton>
      </div>
      <div ref={listRef} className="max-h-56 overflow-y-auto">
        <button
          type="button"
          onClick={() => save(null)}
          className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-[var(--a-inset)]"
          style={{ color: 'var(--a-text-2)' }}
        >
          {clearLabel}
        </button>
        {groups.map((g) => (
          <div key={g || '_'}>
            {g ? (
              <div
                className="px-2 pt-2 pb-0.5 text-[11px] font-semibold uppercase tracking-wide"
                style={{ color: 'var(--a-text-2)' }}
              >
                {g}
              </div>
            ) : null}
            {filtered
              .filter((o) => (o.group ?? '') === g)
              .map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => save(o.value)}
                  className={cn(
                    'block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-[var(--a-inset)]',
                    o.value === selected && 'bg-[var(--a-inset)] font-medium',
                  )}
                >
                  {o.label}
                  {o.hint ? (
                    <span className="ml-1.5 text-xs" style={{ color: 'var(--a-text-2)' }}>
                      {o.hint}
                    </span>
                  ) : null}
                </button>
              ))}
          </div>
        ))}
        {filtered.length === 0 ? (
          <p className="px-2 py-2 text-center text-sm" style={{ color: 'var(--a-text-2)' }}>
            No options found.
          </p>
        ) : null}
      </div>
      {error ? (
        <p className="mt-1 px-1 text-xs" style={{ color: 'var(--a-danger)' }}>
          {error}
        </p>
      ) : null}
    </div>
  )
}
