'use client'

import './admin-v2.css'
import { useEffect, useId, useMemo, useRef, useState } from 'react'

/**
 * Combobox — a searchable single-select with APG keyboard support (11F).
 *
 * WHY THIS EXISTS. Two separate migrations replaced a cmdk `Command` picker
 * (contact picker in NewTaskDialog, template picker in StepConfigPanel) with a
 * hand-rolled search + results panel, and BOTH reported the same casualty:
 * arrow-key navigation was gone, leaving click/tap as the only way to choose.
 * ADMIN_UI §4 is explicit that composites follow APG and that the admin is
 * keyboard-first, so "click only" is a regression, not a trade — and when two
 * independent agents drop the same behaviour, the barrel is what is missing.
 *
 * Implements the APG combobox pattern: the input owns role=combobox with
 * aria-expanded / aria-controls / aria-activedescendant; the panel is a
 * role=listbox of role=option; ArrowDown/ArrowUp move the active option and
 * wrap, Home/End jump, Enter selects, Escape closes and returns focus, Tab
 * closes without selecting. Selection is by aria-activedescendant (the input
 * keeps DOM focus) so screen readers announce the option without losing typing.
 *
 * NOT a filter. Choosing a value that already has a short fixed list is
 * SelectField's or ToolbarSelect's job — the platform makes those accessible
 * for free. Reach for this only when the list is long enough to need a search.
 */
export interface ComboboxOption {
  value: string
  label: string
  /** Optional second line (e.g. an email under a name). */
  hint?: string
}

export function Combobox({
  label,
  options,
  value,
  onSelect,
  placeholder = 'Search…',
  emptyText = 'No matches.',
  disabled = false,
  maxVisible = 50,
  onQueryChange,
  loading = false,
  idleText,
}: {
  /** Accessible name for the input. Required — a nameless combobox is unusable. */
  label: string
  options: ComboboxOption[]
  value?: string | null
  onSelect: (value: string) => void
  placeholder?: string
  emptyText?: string
  disabled?: boolean
  maxVisible?: number
  /**
   * Supply this when the CALLER owns the search (a debounced server lookup over
   * a list too large to ship to the browser — the contact picker searches 23k
   * people). When present, `options` is treated as the already-filtered result
   * set and no local filtering happens. Omit it for a static list.
   */
  onQueryChange?: (query: string) => void
  /** Async searches only: shows a searching state instead of the empty text. */
  loading?: boolean
  /** Async searches only: what to say before the user has typed anything. */
  idleText?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()

  const matches = useMemo(() => {
    // Caller-driven search: `options` IS the result set, already filtered by
    // whoever ran the query. Filtering again here would hide rows the server
    // matched on a field the label does not show.
    if (onQueryChange) return options.slice(0, maxVisible)
    const q = query.trim().toLowerCase()
    const pool = q
      ? options.filter(
          (o) => o.label.toLowerCase().includes(q) || (o.hint ?? '').toLowerCase().includes(q),
        )
      : options
    return pool.slice(0, maxVisible)
  }, [options, query, maxVisible, onQueryChange])

  // Keep the active index inside the current match list.
  useEffect(() => {
    setActive((i) => (i >= matches.length ? 0 : i))
  }, [matches.length])

  useEffect(() => {
    if (!open) return
    function onDocDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocDown)
    return () => document.removeEventListener('mousedown', onDocDown)
  }, [open])

  function choose(i: number) {
    const opt = matches[i]
    if (!opt) return
    onSelect(opt.value)
    setOpen(false)
    setQuery('')
    inputRef.current?.focus()
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) {
        setOpen(true)
        return
      }
      if (!matches.length) return
      const dir = e.key === 'ArrowDown' ? 1 : -1
      setActive((i) => (i + dir + matches.length) % matches.length) // wraps, per APG
      return
    }
    if (e.key === 'Home' && open) {
      e.preventDefault()
      setActive(0)
      return
    }
    if (e.key === 'End' && open) {
      e.preventDefault()
      setActive(Math.max(0, matches.length - 1))
      return
    }
    if (e.key === 'Enter' && open) {
      e.preventDefault()
      choose(active)
      return
    }
    if (e.key === 'Escape' && open) {
      e.preventDefault()
      setOpen(false)
      return
    }
    // Tab closes WITHOUT selecting — an unconfirmed highlight is not a choice.
    if (e.key === 'Tab' && open) setOpen(false)
  }

  const activeId = open && matches[active] ? `${listId}-opt-${active}` : undefined

  return (
    <div ref={wrapRef} className="av2-combo">
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        className="av2-input av2-input--bar"
        aria-label={label}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        placeholder={placeholder}
        disabled={disabled}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          onQueryChange?.(e.target.value)
          setOpen(true)
          setActive(0)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {open ? (
        <div className="av2-combo__panel" id={listId} role="listbox" aria-label={label}>
          {loading ? (
            <p className="av2-combo__empty">Searching…</p>
          ) : matches.length === 0 ? (
            <p className="av2-combo__empty">
              {idleText && !query.trim() ? idleText : emptyText}
            </p>
          ) : (
            matches.map((o, i) => (
              <div
                key={o.value}
                id={`${listId}-opt-${i}`}
                role="option"
                aria-selected={value != null && o.value === value}
                className={i === active ? 'av2-combo__opt av2-combo__opt--active' : 'av2-combo__opt'}
                // mousedown, not click: click fires after the input's blur, which
                // would close the panel before the choice registers.
                onMouseDown={(e) => {
                  e.preventDefault()
                  choose(i)
                }}
                onMouseEnter={() => setActive(i)}
              >
                <span className="av2-combo__label">{o.label}</span>
                {o.hint ? <span className="av2-combo__hint">{o.hint}</span> : null}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}
