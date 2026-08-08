'use client'

/**
 * CustomFieldEditor — the custom-field registry island (Wave 2).
 *
 * The registry types the free-form crm_people.custom jsonb bag for the contact
 * card Details section + the saved-view filter builder. Each field has a machine
 * key (immutable after create), a label, a type (text/number/date/select), and
 * for select-typed fields a list of {value,label} options. So this editor is
 * richer than the generic ConfigTableEditor: a type picker, an options list for
 * select fields, and hide-if-empty / read-only toggles.
 *
 * Actions take typed args: createCrmFieldDefinitionAction(input),
 * updateCrmFieldDefinitionAction(id, input), reorderCrmFieldDefinitionsAction(ids),
 * deleteCrmFieldDefinitionAction(id). The key is immutable on edit (the action
 * ignores it). A protected field shows no delete control.
 *
 * Migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md),
 * following its already-migrated sibling ConfigTableEditor.tsx in this folder.
 * Presentation only — the four server actions, the FieldInput payload, every
 * validation branch and every user-facing string are carried over verbatim.
 *
 * Table markup is the hand-rolled div/role grid ConfigTableEditor uses
 * (av2-rgrid* + report-grid.css) rather than the <ReportGrid> component, which
 * is server-only and stateless while these cells are interactive. The phone
 * fallback carries its layout in `av2-cardlist`, NOT `md:hidden` plus an inline
 * display — an inline style outranks the class and leaves BOTH layouts on
 * screen at desktop.
 *
 * ci:admin-ui rule C allows ONE primary-variant Button per FILE, and this island
 * may not be split (no new files in this unit), so the island's single primary
 * is the header "+ Add custom field"; the create/edit dialog's submit is quiet
 * and the delete confirm is danger.
 */
import { useState, useTransition, type CSSProperties } from 'react'
import {
  Button,
  ConfirmDialog,
  Dialog,
  IconButton,
  SectionHead,
  SelectField,
  Switch,
  TextAreaField,
  TextField,
  VerdictLine,
} from '@/components/admin/v2'
import '@/components/admin/v2/report-grid.css'
import { Pencil, Trash2, GripVertical } from 'lucide-react'
import {
  moveInList,
  parseOptions,
  serializeOptions,
} from '@/lib/admin/config-editor-helpers'

export type FieldType = 'text' | 'number' | 'date' | 'select'
export type FieldOption = { value: string; label: string }

export type FieldRow = {
  id: number
  key: string
  label: string
  type: FieldType
  options: FieldOption[]
  position: number
  hideIfEmpty: boolean
  readOnly: boolean
  fieldGroup: string | null
  isProtected: boolean
}

type ActionResult = { ok: true; id?: number; message?: string } | { ok: false; error: string }

type FieldInput = {
  key?: string
  label?: string
  type?: FieldType
  options?: FieldOption[]
  hideIfEmpty?: boolean
  readOnly?: boolean
  fieldGroup?: string | null
}

export type CustomFieldEditorActions = {
  create: (input: FieldInput) => Promise<ActionResult>
  update: (id: number, input: FieldInput) => Promise<ActionResult>
  reorder: (orderedIds: number[]) => Promise<ActionResult>
  remove: (id: number) => Promise<ActionResult>
}

type FormState = {
  key: string
  label: string
  type: FieldType
  optionsText: string
  fieldGroup: string
  hideIfEmpty: boolean
  readOnly: boolean
}

const EMPTY: FormState = {
  key: '',
  label: '',
  type: 'text',
  optionsText: '',
  fieldGroup: '',
  hideIfEmpty: false,
  readOnly: false,
}

/** Quiet outline pill for a row-level qualifier. Pills proper are FilterChip's. */
const BADGE: CSSProperties = {
  fontSize: 'var(--a-text-xs)',
  color: 'var(--a-text-2)',
  border: '1px solid var(--a-border)',
  borderRadius: 'var(--a-r-sm)',
  padding: '1px 6px',
  fontWeight: 400,
}

/** Monospaced inputs — the key and the options list are literals, not prose. */
const MONO: CSSProperties = { fontFamily: 'var(--a-font-mono)', fontSize: 'var(--a-text-xs)' }

/** The toggle wells inside the create/edit dialog. */
const TOGGLE_WELL: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  border: '1px solid var(--a-border)',
  borderRadius: 'var(--a-r-md)',
  padding: 12,
}

export function CustomFieldEditor({
  rows,
  actions,
}: {
  rows: FieldRow[]
  actions: CustomFieldEditorActions
}) {
  const [pending, startTransition] = useTransition()
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  const [editId, setEditId] = useState<number | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [deleteRow, setDeleteRow] = useState<FieldRow | null>(null)

  const orderedIds = rows.map((r) => r.id)

  function run(action: () => Promise<ActionResult>, fallbackOk: string, onOk?: () => void) {
    setNote(null)
    startTransition(async () => {
      const r = await action()
      if (r.ok) {
        setNote({ tone: 'ok', text: r.message ?? fallbackOk })
        onOk?.()
      } else {
        setNote({ tone: 'err', text: r.error })
      }
    })
  }

  function openCreate() {
    setEditId(null)
    setForm(EMPTY)
    setFormOpen(true)
    setNote(null)
  }

  function openEdit(row: FieldRow) {
    setEditId(row.id)
    setForm({
      key: row.key,
      label: row.label,
      type: row.type,
      optionsText: serializeOptions(row.options),
      fieldGroup: row.fieldGroup ?? '',
      hideIfEmpty: row.hideIfEmpty,
      readOnly: row.readOnly,
    })
    setFormOpen(true)
    setNote(null)
  }

  function submitForm() {
    const label = form.label.trim()
    if (!label) {
      setNote({ tone: 'err', text: 'A label is required' })
      return
    }
    const options = form.type === 'select' ? parseOptions(form.optionsText) : []
    if (form.type === 'select' && options.length === 0) {
      setNote({ tone: 'err', text: 'A select field needs at least one option' })
      return
    }
    const base: FieldInput = {
      label,
      type: form.type,
      options,
      fieldGroup: form.fieldGroup.trim() || null,
      hideIfEmpty: form.hideIfEmpty,
      readOnly: form.readOnly,
    }
    if (editId == null) {
      const key = form.key.trim()
      if (!key) {
        setNote({ tone: 'err', text: 'A field key is required' })
        return
      }
      run(() => actions.create({ ...base, key }), 'Field added', () => setFormOpen(false))
    } else {
      // Key is immutable on edit; the action ignores it.
      run(() => actions.update(editId, base), 'Field updated', () => setFormOpen(false))
    }
  }

  function submitReorder(id: number, dir: -1 | 1) {
    const next = moveInList(orderedIds, id, dir)
    if (!next) return
    run(() => actions.reorder(next), 'Order saved')
  }

  function submitDelete() {
    if (!deleteRow) return
    run(() => actions.remove(deleteRow.id), 'Field removed', () => setDeleteRow(null))
  }

  // Desktop column template — the custom properties report-grid.css reads at
  // >=720px. Below md the whole block is `hidden`, so the stacked-block rules
  // in that file never apply here; the card list takes over instead.
  const gridStyle = {
    '--rgrid-cols': '52px minmax(220px,1fr) 96px 120px 88px',
    '--rgrid-min': '600px',
  } as CSSProperties

  return (
    <div className="space-y-4">
      {/* count left, primary action right */}
      <div className="flex items-center justify-between gap-3">
        <SectionHead>
          {rows.length.toLocaleString('en-US')}{' '}
          <span style={{ fontWeight: 400, color: 'var(--a-text-2)' }}>
            {rows.length === 1 ? 'Custom field' : 'Custom fields'}
          </span>
        </SectionHead>
        <Button onClick={openCreate} disabled={pending}>
          + Add custom field
        </Button>
      </div>

      {note ? (
        <VerdictLine tone={note.tone === 'err' ? 'attention' : 'ok'}>{note.text}</VerdictLine>
      ) : null}

      {/* Desktop grid — hidden below md; the card list below takes over */}
      <div className="hidden md:block">
        <div className="av2-rgrid__scroll" role="group" tabIndex={0} aria-label="Custom fields">
          <div className="av2-rgrid" role="table" aria-label="Custom fields" style={gridStyle}>
            <div className="av2-rgrid__head" role="row">
              <span role="columnheader" className="av2-rgrid__h" />
              <span role="columnheader" className="av2-rgrid__h">
                Field name
              </span>
              <span role="columnheader" className="av2-rgrid__h">
                Type
              </span>
              <span role="columnheader" className="av2-rgrid__h">
                Group
              </span>
              <span role="columnheader" className="av2-rgrid__h" style={{ textAlign: 'right' }}>
                Actions
              </span>
            </div>

            {rows.length === 0 ? (
              <div className="av2-rgrid__empty" role="row">
                <span role="cell">No custom fields yet. Add the first one.</span>
              </div>
            ) : (
              rows.map((row, idx) => (
                <div key={row.id} role="row" className="av2-rgrid__row">
                  {/* Reorder — always visible. The old opacity-0 group-hover reveal
                      was undiscoverable by touch or keyboard; the migrated sibling
                      made the same control permanent. */}
                  <span role="cell" data-label="" className="av2-rgrid__c">
                    <IconButton
                      label={`Move ${row.label} up`}
                      tone="quiet"
                      disabled={pending || idx === 0}
                      onClick={() => submitReorder(row.id, -1)}
                    >
                      <GripVertical size={16} />
                    </IconButton>
                  </span>

                  <span role="cell" data-label="Field name" className="av2-rgrid__c">
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        fontWeight: 600,
                        color: 'var(--a-text)',
                      }}
                    >
                      {row.label}
                      {row.isProtected ? <span style={BADGE}>System</span> : null}
                    </span>
                  </span>

                  <span role="cell" data-label="Type" className="av2-rgrid__c">
                    <span style={{ ...BADGE, textTransform: 'uppercase' }}>{row.type}</span>
                  </span>

                  <span role="cell" data-label="Group" className="av2-rgrid__c">
                    {row.fieldGroup ?? '—'}
                  </span>

                  <span role="cell" data-label="Actions" className="av2-rgrid__c" style={{ textAlign: 'right' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                      <IconButton
                        label={`Edit ${row.label}`}
                        tone="quiet"
                        disabled={pending}
                        onClick={() => openEdit(row)}
                      >
                        <Pencil size={16} />
                      </IconButton>
                      {row.isProtected ? (
                        <span
                          className="av2-iconbtn"
                          aria-hidden="true"
                          style={{ visibility: 'hidden', pointerEvents: 'none' }}
                        />
                      ) : (
                        <IconButton
                          label={`Delete ${row.label}`}
                          tone="danger"
                          disabled={pending}
                          onClick={() => {
                            setDeleteRow(row)
                            setNote(null)
                          }}
                        >
                          <Trash2 size={16} />
                        </IconButton>
                      )}
                    </span>
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Phone card list — av2-cardlist owns the breakpoint, never an inline display */}
      <div className="av2-cardlist">
        {rows.map((row) => (
          <div
            key={row.id}
            className="av2-pane"
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <p
                className="truncate"
                style={{ margin: 0, fontSize: 'var(--a-text-sm)', fontWeight: 500, color: 'var(--a-text)' }}
              >
                {row.label}
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: 'var(--a-text-xs)',
                  color: 'var(--a-text-2)',
                  textTransform: 'uppercase',
                }}
              >
                {row.type}
              </p>
            </div>
            <div style={{ display: 'flex', flexShrink: 0, alignItems: 'center', gap: 4 }}>
              <IconButton
                label={`Edit ${row.label}`}
                tone="quiet"
                disabled={pending}
                onClick={() => openEdit(row)}
              >
                <Pencil size={16} />
              </IconButton>
              {!row.isProtected && (
                <IconButton
                  label={`Delete ${row.label}`}
                  tone="danger"
                  disabled={pending}
                  onClick={() => {
                    setDeleteRow(row)
                    setNote(null)
                  }}
                >
                  <Trash2 size={16} />
                </IconButton>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Create / edit dialog */}
      <Dialog
        open={formOpen}
        onClose={() => {
          if (!pending) setFormOpen(false)
        }}
        title={editId == null ? 'Add field' : 'Edit field'}
        description={
          editId == null
            ? 'The key is the stable identifier on the contact data. It cannot change later.'
            : 'The key is fixed. Only the label, type, options, group, and flags change.'
        }
        footer={
          <>
            <Button variant="quiet" onClick={() => setFormOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="quiet" onClick={submitForm} disabled={pending}>
              {editId == null ? 'Add field' : 'Save'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField
            label="Label"
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            autoFocus
          />
          <TextField
            label="Key"
            value={form.key}
            onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
            disabled={editId != null}
            style={MONO}
            placeholder="lower_snake_case"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SelectField
            label="Type"
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as FieldType }))}
          >
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="date">Date</option>
            <option value="select">Select</option>
          </SelectField>
          <TextField
            label="Group (optional)"
            value={form.fieldGroup}
            onChange={(e) => setForm((f) => ({ ...f, fieldGroup: e.target.value }))}
          />
        </div>

        {form.type === 'select' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--a-s1)' }}>
            <TextAreaField
              label="Options"
              value={form.optionsText}
              onChange={(e) => setForm((f) => ({ ...f, optionsText: e.target.value }))}
              rows={5}
              style={MONO}
              placeholder={'one per line\nvalue|Label\nbuyer|Buyer'}
            />
            <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
              One option per line. Use value|Label to set a display label.
            </p>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div style={TOGGLE_WELL}>
            <span style={{ fontSize: 'var(--a-text-sm)', fontWeight: 500, color: 'var(--a-text)' }}>
              Hide when empty
            </span>
            <Switch
              label="Hide when empty"
              labelHidden
              checked={form.hideIfEmpty}
              onChange={(e) => setForm((f) => ({ ...f, hideIfEmpty: e.target.checked }))}
              disabled={pending}
            />
          </div>
          <div style={TOGGLE_WELL}>
            <span style={{ fontSize: 'var(--a-text-sm)', fontWeight: 500, color: 'var(--a-text)' }}>
              Read only
            </span>
            <Switch
              label="Read only"
              labelHidden
              checked={form.readOnly}
              onChange={(e) => setForm((f) => ({ ...f, readOnly: e.target.checked }))}
              disabled={pending}
            />
          </div>
        </div>
      </Dialog>

      {/* Delete dialog */}
      <ConfirmDialog
        open={!!deleteRow}
        onClose={() => {
          if (!pending) setDeleteRow(null)
        }}
        title={`Remove ${deleteRow?.label ?? ''}`}
        description="This removes the field definition only. The stored values on each contact are kept, and the field can be re-added later."
        confirmLabel="Remove field"
        onConfirm={submitDelete}
        busy={pending}
      />
    </div>
  )
}
