'use client'

/**
 * CustomFieldEditor — the client-side edit island for a single custom field row
 * on the contact record card. Handles the "Edit" button → inline input → Save/Cancel
 * flow, calling saveContactCustomFieldsAction on confirm.
 *
 * Server concerns (groupAndFormat, field registry reads) stay in CustomFieldsPanel
 * (a server component). This file only owns the interactive mutation layer.
 */

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { saveContactCustomFieldsAction } from '@/app/actions/contact-custom-fields'

export type EditableFieldDef = {
  key: string
  label: string
  type: 'text' | 'number' | 'date' | 'select'
  options: { value: string; label: string }[]
}

type Result = { ok: true; message?: string } | { ok: false; error: string }

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
        <Select value={val} onValueChange={setVal} disabled={disabled}>
          <SelectTrigger className="h-8 flex-1 text-sm">
            <SelectValue placeholder="— choose —" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">— clear —</SelectItem>
            {def.options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="default" className="h-8 px-3 text-xs" disabled={disabled} onClick={() => onSave(val)}>Save</Button>
        <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" disabled={disabled} onClick={onCancel}>Cancel</Button>
      </div>
    )
  }

  const inputType = def.type === 'number' ? 'number' : def.type === 'date' ? 'date' : 'text'

  return (
    <div className="flex items-center gap-2">
      <Input
        type={inputType}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className="h-8 flex-1 text-sm"
        disabled={disabled}
        inputMode={def.type === 'number' ? 'decimal' : undefined}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); onSave(val) }
          if (e.key === 'Escape') { e.preventDefault(); onCancel() }
        }}
      />
      <Button size="sm" variant="default" className="h-8 px-3 text-xs" disabled={disabled} onClick={() => onSave(val)}>Save</Button>
      <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" disabled={disabled} onClick={onCancel}>Cancel</Button>
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
          <p className="mt-1 text-xs text-destructive" role="status">{note.error}</p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between gap-3 min-w-0">
      <dd
        className={cn(
          'truncate text-right text-foreground min-w-0',
          def.type === 'number' || def.type === 'date' ? 'tabular-nums' : '',
        )}
      >
        {localDisplay}
      </dd>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => { setEditing(true); setNote(null) }}
        disabled={pending}
        className="h-6 shrink-0 px-2 text-xs text-muted-foreground"
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
