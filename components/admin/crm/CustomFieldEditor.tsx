'use client'

/**
 * CustomFieldEditor — the client-side edit island for a single custom field row
 * on the contact record card. Handles the "Edit" button → inline input → Save/Cancel
 * flow, calling saveContactCustomFieldsAction on confirm.
 *
 * Server concerns (groupAndFormat, field registry reads) stay in CustomFieldsPanel
 * (a server component). This file only owns the interactive mutation layer.
 *
 * 11F: on the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * PRESENTATION ONLY — every export, prop, handler and action is unchanged.
 * Four notes on the swap:
 *  - The unlabelled inline controls become SearchField / ToolbarSelect, the two
 *    label-free variants in the barrel. Both REQUIRE an aria-label, so the row's
 *    field name now reaches assistive tech where the shadcn Input/SelectTrigger
 *    gave it no accessible name at all.
 *  - `maxWidth: 'none'` is inline, not a utility: .av2-input--bar declares its
 *    200px cap UNLAYERED, so a Tailwind class loses and the control would stop
 *    filling the row.
 *  - The Radix placeholder ("— choose —") has no native equivalent: a native
 *    select displays the text of whichever option is selected. The empty option keeps
 *    the string the original declared as a real list entry ("— clear —"), which
 *    is the element-for-element swap; the placeholder prop has no target.
 *  - TWO primary Buttons here, one per branch of FieldInput: they are the SAME
 *    Save control rendered for the select and the text case, never both at once.
 *    Demoting one would give the text editor a different-looking Save than the
 *    select editor for no reason a broker could read.
 */

import { useState, useTransition } from 'react'
import { Button, SearchField, ToolbarSelect } from '@/components/admin/v2'
import { cn } from '@/lib/utils'
import { saveContactCustomFieldsAction } from '@/app/actions/contact-custom-fields'

export type EditableFieldDef = {
  key: string
  label: string
  type: 'text' | 'number' | 'date' | 'select'
  options: { value: string; label: string }[]
}

type Result = { ok: true; message?: string } | { ok: false; error: string }

/** h-8 rows: .av2-btn's 36px floor is unlayered, so the metric goes inline. */
const SAVE_STYLE: React.CSSProperties = { minHeight: 32, padding: '0 12px' }
const CANCEL_STYLE: React.CSSProperties = { minHeight: 32, padding: '0 8px' }

// ── Inline field editor input ─────────────────────────────────────────────────

function FieldInput({
  def,
  initial,
  disabled,
  onSave,
  onCancel,
}: {
  def: EditableFieldDef
  initial: string
  disabled: boolean
  onSave: (v: string) => void
  onCancel: () => void
}) {
  const [val, setVal] = useState(initial)

  if (def.type === 'select' && def.options.length > 0) {
    return (
      <div className="flex items-center gap-2">
        <ToolbarSelect
          aria-label={def.label}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          disabled={disabled}
          className="flex-1 text-sm"
          style={{ maxWidth: 'none' }}
        >
          <option value="">— clear —</option>
          {def.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </ToolbarSelect>
        <Button className="text-xs" style={SAVE_STYLE} disabled={disabled} onClick={() => onSave(val)}>Save</Button>
        <Button variant="quiet" className="text-xs" style={CANCEL_STYLE} disabled={disabled} onClick={onCancel}>Cancel</Button>
      </div>
    )
  }

  const inputType = def.type === 'number' ? 'number' : def.type === 'date' ? 'date' : 'text'

  return (
    <div className="flex items-center gap-2">
      <SearchField
        aria-label={def.label}
        type={inputType}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className="flex-1 text-sm"
        style={{ maxWidth: 'none' }}
        disabled={disabled}
        inputMode={def.type === 'number' ? 'decimal' : undefined}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); onSave(val) }
          if (e.key === 'Escape') { e.preventDefault(); onCancel() }
        }}
      />
      <Button className="text-xs" style={SAVE_STYLE} disabled={disabled} onClick={() => onSave(val)}>Save</Button>
      <Button variant="quiet" className="text-xs" style={CANCEL_STYLE} disabled={disabled} onClick={onCancel}>Cancel</Button>
    </div>
  )
}

// ── Exported island ───────────────────────────────────────────────────────────

/**
 * Per-row editable control. Renders an "Edit" button when idle; flips to the
 * inline editor when activated. Lives alongside the server-rendered display value
 * inside CustomFieldsPanel.
 *
 * Usage:
 *   <CustomFieldEditor
 *     personId={person.id}
 *     def={def}
 *     currentRaw={localRawValue}
 *     displayValue={row.display}
 *   />
 */
export function CustomFieldEditor({
  personId,
  def,
  currentRaw,
  displayValue,
}: {
  personId: number
  def: EditableFieldDef
  /** The raw value stored in crm_people.custom (used as the initial editor state). */
  currentRaw: unknown
  /** The pre-formatted display string from groupAndFormat. */
  displayValue: string
}) {
  const initial =
    currentRaw !== null && currentRaw !== undefined ? String(currentRaw) : ''
  // Optimistically update the displayed value after a successful save so the
  // panel reflects the change immediately without a full page reload.
  const [localDisplay, setLocalDisplay] = useState(displayValue)
  const [editing, setEditing] = useState(false)
  const [pending, startTransition] = useTransition()
  const [note, setNote] = useState<Result | null>(null)

  function handleSave(raw: string) {
    setNote(null)
    startTransition(async () => {
      const r = await saveContactCustomFieldsAction(personId, { [def.key]: raw })
      if (r.ok) {
        // Optimistic display: use the raw value we submitted. The server revalidates
        // the page in the background so a reload always shows the authoritative value.
        setLocalDisplay(raw || '—')
        setEditing(false)
        setNote(r)
      } else {
        setNote(r)
      }
    })
  }

  if (editing) {
    return (
      <div className="mt-1.5">
        <FieldInput
          def={def}
          initial={initial}
          disabled={pending}
          onSave={handleSave}
          onCancel={() => { setEditing(false); setNote(null) }}
        />
        {note && !note.ok ? (
          <p className="mt-1 text-xs" style={{ color: 'var(--a-danger)' }} role="status">{note.error}</p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between gap-3 min-w-0">
      <dd
        className={cn(
          'truncate text-right min-w-0',
          def.type === 'number' || def.type === 'date' ? 'tabular-nums' : '',
        )}
        style={{ color: 'var(--a-text)' }}
      >
        {localDisplay}
      </dd>
      <Button
        type="button"
        variant="quiet"
        onClick={() => { setEditing(true); setNote(null) }}
        disabled={pending}
        className="shrink-0 text-xs"
        // Height + padding inline for the same unlayered reason as SAVE_STYLE;
        // colour only, never a background — .av2-btn--quiet's hover lives on
        // background, and an inline one there would kill it.
        style={{ minHeight: 24, padding: '0 8px', color: 'var(--a-text-2)' }}
        aria-label={`Edit ${def.label}`}
      >
        Edit
      </Button>
      {note?.ok ? (
        <p className="sr-only" role="status">{note.message}</p>
      ) : null}
    </div>
  )
}
