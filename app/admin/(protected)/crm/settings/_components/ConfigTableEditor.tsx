'use client'

/**
 * ConfigTableEditor — the reusable CRM config-table editor island.
 *
 * P11C-2: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * Was components/admin/crm/settings/ConfigTableEditor.tsx (shadcn Table/Dialog/
 * Select/Switch/Badge/Alert); moved here and split across three files so the
 * v2 primitives can be used without tripping ci:admin-ui rule C (at most one
 * primary-variant v2 <Button> per file — primary is the DEFAULT variant, i.e.
 * no `variant` prop). This file keeps the island's one primary
 * ("+ Add {noun}"); the Add and Rename submit buttons live in their own
 * dialog files (AddRowDialog.tsx, RenameRowDialog.tsx). Delete uses
 * ConfirmDialog directly here — its Cancel/Delete buttons are quiet/danger,
 * never primary, so it doesn't need a file of its own.
 *
 * One client surface that drives any config table shaped like crm_stages
 * (key / label / position / is_active / is_protected): stages, newsletter
 * segments, market-report areas, and (with the tag-specific delete mode) tags.
 * It renders the rows plus add / rename / reorder / activate / delete dialogs
 * wired to the server actions passed in by the parent server page. The
 * actions ARE the guard + audit surface; this island only renders state and
 * dispatches — presentation moved, the create/rename/reorder/activate/delete
 * wiring below did not.
 *
 * Delete is the one place the tables differ, so it is passed as a `deleteMode`:
 *   - 'reassign' (stages, segments): the admin picks a fallback row; affected
 *     records move there before the row is removed.
 *   - 'scrub'    (areas): the slug is stripped from every subscription's areas[]
 *     automatically; no fallback pick needed.
 *   - 'strip'    (tags): the admin chooses whether to also strip the tag off
 *     every carrier, or leave historical occurrences in place.
 * A protected row never shows a delete control (the action refuses it anyway).
 *
 * Table markup is a hand-rolled div/role grid reusing ReportGrid's classes +
 * roles (av2-rgrid*, role="table"/"row"/"columnheader"/"cell" — see
 * components/admin/v2/ReportGrid.tsx and report-grid.css) rather than the
 * <ReportGrid> component itself: that component is documented server-only /
 * stateless, and this grid's cells are interactive (Switch, IconButton) with
 * per-row pending state. report-grid.css is imported directly below since
 * nothing else on this route pulls it in.
 *
 * Two layouts, both required, matching the pre-migration behavior exactly:
 * a desktop grid (`hidden md:block`) and a mobile card list (`md:hidden`,
 * `av2-pane` cards) — never both visible, never a raw <table>.
 *
 * Design-system only: Button, IconButton, Switch, ConfirmDialog, SelectField,
 * VerdictLine + tokens. No raw HTML controls, no hex.
 */
import { useState, useTransition, type CSSProperties } from 'react'
import { Button, ConfirmDialog, IconButton, SelectField, Switch, VerdictLine } from '@/components/admin/v2'
import '@/components/admin/v2/report-grid.css'
import { moveInList, capitalizeNoun as cap } from '@/lib/admin/config-editor-helpers'
import { Pencil, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import { AddRowDialog } from './AddRowDialog'
import { RenameRowDialog } from './RenameRowDialog'

/** A config row the editor renders. Matches the cached reader shape. */
export type ConfigEditorRow = {
  id: number
  key: string
  label: string
  position: number
  isActive: boolean
  isProtected: boolean
  /** Optional usage count (tags surface this; others omit it). */
  usageCount?: number
}

type ActionResult = { ok: true } | { ok: false; error: string }

export type ConfigTableEditorActions = {
  /** Create a row. FormData carries `label` (+ optional `key`). */
  create: (formData: FormData) => Promise<ActionResult>
  /** Rename a row's label. FormData carries `id` + `label`. */
  rename: (formData: FormData) => Promise<ActionResult>
  /** Reorder by the full ordered id list. */
  reorder: (orderedIds: number[]) => Promise<ActionResult>
  /** Toggle active. FormData carries `id` + `isActive` ('1'|'0'). */
  setActive: (formData: FormData) => Promise<ActionResult>
  /** Delete a row. FormData fields depend on deleteMode (see below). */
  remove: (formData: FormData) => Promise<ActionResult>
}

export type ConfigTableEditorProps = {
  rows: ConfigEditorRow[]
  actions: ConfigTableEditorActions
  /** Singular noun for copy, e.g. 'stage', 'segment', 'area', 'tag'. */
  noun: string
  /** What the rows hold, for the delete-confirm copy, e.g. 'contacts'. */
  dependentNoun: string
  /**
   * How delete works for this table:
   *  - 'reassign': pick a fallback row, dependents move there (FormData id + reassignToKey).
   *  - 'scrub'   : dependents auto-scrubbed, no pick (FormData id).
   *  - 'strip'   : optional strip-off-carriers checkbox (FormData id + strip '1'|'0').
   */
  deleteMode: 'reassign' | 'scrub' | 'strip'
  /** Whether the create dialog exposes an advanced key field (defaults true). */
  allowKeyInput?: boolean
  /** Whether the editor shows a usage column (defaults to rows carrying usageCount). */
  showUsage?: boolean
}

export function ConfigTableEditor({
  rows,
  actions,
  noun,
  dependentNoun,
  deleteMode,
  allowKeyInput = true,
  showUsage,
}: ConfigTableEditorProps) {
  const [pending, startTransition] = useTransition()
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  // Dialog state
  const [addOpen, setAddOpen] = useState(false)
  const [renameRow, setRenameRow] = useState<ConfigEditorRow | null>(null)
  const [deleteRow, setDeleteRow] = useState<ConfigEditorRow | null>(null)

  // Add-form fields
  const [newLabel, setNewLabel] = useState('')
  const [newKey, setNewKey] = useState('')
  // Rename field
  const [renameLabel, setRenameLabel] = useState('')
  // Delete fields
  const [reassignTo, setReassignTo] = useState('')
  const [stripCarriers, setStripCarriers] = useState(false)

  const usageVisible = showUsage ?? rows.some((r) => typeof r.usageCount === 'number')
  const orderedIds = rows.map((r) => r.id)

  function run(action: () => Promise<ActionResult>, okText: string, onOk?: () => void) {
    setNote(null)
    startTransition(async () => {
      const r = await action()
      if (r.ok) {
        setNote({ tone: 'ok', text: okText })
        onOk?.()
      } else {
        setNote({ tone: 'err', text: r.error })
      }
    })
  }

  function submitAdd() {
    const label = newLabel.trim()
    if (!label) {
      setNote({ tone: 'err', text: 'Label is required' })
      return
    }
    const fd = new FormData()
    fd.set('label', label)
    if (allowKeyInput && newKey.trim()) fd.set('key', newKey.trim())
    run(() => actions.create(fd), `${cap(noun)} added`, () => {
      setAddOpen(false)
      setNewLabel('')
      setNewKey('')
    })
  }

  function submitRename() {
    if (!renameRow) return
    const label = renameLabel.trim()
    if (!label) {
      setNote({ tone: 'err', text: 'Label is required' })
      return
    }
    const fd = new FormData()
    fd.set('id', String(renameRow.id))
    fd.set('label', label)
    run(() => actions.rename(fd), `${cap(noun)} renamed`, () => setRenameRow(null))
  }

  function submitActive(row: ConfigEditorRow, next: boolean) {
    const fd = new FormData()
    fd.set('id', String(row.id))
    fd.set('isActive', next ? '1' : '0')
    run(() => actions.setActive(fd), next ? `${cap(noun)} enabled` : `${cap(noun)} disabled`)
  }

  function submitReorder(id: number, dir: -1 | 1) {
    const next = moveInList(orderedIds, id, dir)
    if (!next) return
    run(() => actions.reorder(next), 'Order saved')
  }

  function submitDelete() {
    if (!deleteRow) return
    const fd = new FormData()
    fd.set('id', String(deleteRow.id))
    if (deleteMode === 'reassign') {
      if (!reassignTo) {
        setNote({ tone: 'err', text: `Pick a ${noun} to move ${dependentNoun} to` })
        return
      }
      fd.set('reassignToKey', reassignTo)
    } else if (deleteMode === 'strip') {
      fd.set('strip', stripCarriers ? '1' : '0')
    }
    run(() => actions.remove(fd), `${cap(noun)} deleted`, () => {
      setDeleteRow(null)
      setReassignTo('')
      setStripCarriers(false)
    })
  }

  // Active, non-deleting rows the admin can pick as a reassign fallback.
  const reassignTargets = deleteRow ? rows.filter((r) => r.id !== deleteRow.id) : []

  // Desktop grid column template — the CSS custom properties report-grid.css
  // reads at >=720px to lay out .av2-rgrid__head / .av2-rgrid__row as a real
  // grid (below that this whole block is `hidden`, so the narrower stacked-
  // block rules in report-grid.css never apply here).
  const gridStyle = {
    '--rgrid-cols': usageVisible
      ? '52px minmax(220px,1fr) 88px 132px 88px'
      : '52px minmax(220px,1fr) 132px 88px',
    '--rgrid-min': usageVisible ? '600px' : '520px',
  } as CSSProperties

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--a-s4)' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button onClick={() => setAddOpen(true)} disabled={pending}>
          + Add {noun}
        </Button>
      </div>

      {note ? <VerdictLine tone={note.tone === 'err' ? 'attention' : 'ok'}>{note.text}</VerdictLine> : null}

      {/* Desktop grid — hidden below md; the mobile card list below takes over */}
      <div className="hidden md:block">
        <div className="av2-rgrid__scroll" role="group" tabIndex={0} aria-label={`${cap(noun)}s`}>
          <div className="av2-rgrid" role="table" aria-label={`${cap(noun)}s`} style={gridStyle}>
            <div className="av2-rgrid__head" role="row">
              <span role="columnheader" className="av2-rgrid__h" />
              <span role="columnheader" className="av2-rgrid__h">
                Name
              </span>
              {usageVisible ? (
                <span role="columnheader" className="av2-rgrid__h av2-rgrid__h--n">
                  Used
                </span>
              ) : null}
              <span role="columnheader" className="av2-rgrid__h">
                Status
              </span>
              <span role="columnheader" className="av2-rgrid__h" style={{ textAlign: 'right' }}>
                Actions
              </span>
            </div>

            {rows.length === 0 ? (
              <div className="av2-rgrid__empty" role="row">
                <span role="cell">No {noun}s yet. Add the first one.</span>
              </div>
            ) : (
              rows.map((row, idx) => (
                <div key={row.id} role="row" className="av2-rgrid__row">
                  {/* Reorder: stacked up/down icon buttons — ALWAYS visible. The old
                      opacity-0 group-hover:opacity-100 chevrons were undiscoverable on
                      a touch screen or by keyboard; the mobile card list already showed
                      them always, so the desktop grid now matches it. */}
                  <span role="cell" data-label="" className="av2-rgrid__c">
                    <span style={{ display: 'flex', flexDirection: 'column' }}>
                      <IconButton
                        label={`Move ${row.label} up`}
                        tone="quiet"
                        disabled={pending || idx === 0}
                        onClick={() => submitReorder(row.id, -1)}
                      >
                        <ChevronUp size={14} />
                      </IconButton>
                      <IconButton
                        label={`Move ${row.label} down`}
                        tone="quiet"
                        disabled={pending || idx === rows.length - 1}
                        onClick={() => submitReorder(row.id, 1)}
                      >
                        <ChevronDown size={14} />
                      </IconButton>
                    </span>
                  </span>

                  <span role="cell" data-label="Name" className="av2-rgrid__c">
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
                      {row.isProtected ? (
                        <span
                          style={{
                            fontSize: 'var(--a-text-xs)',
                            color: 'var(--a-text-2)',
                            border: '1px solid var(--a-border)',
                            borderRadius: 'var(--a-r-sm)',
                            padding: '1px 6px',
                            fontWeight: 400,
                          }}
                        >
                          Protected
                        </span>
                      ) : null}
                    </span>
                  </span>

                  {usageVisible ? (
                    <span role="cell" data-label="Used" className="av2-rgrid__c av2-rgrid__c--n">
                      {typeof row.usageCount === 'number' ? row.usageCount.toLocaleString('en-US') : '—'}
                    </span>
                  ) : null}

                  <span role="cell" data-label="Status" className="av2-rgrid__c">
                    <Switch
                      label={`${row.label} active`}
                      labelHidden
                      stateText={row.isActive ? 'Active' : 'Off'}
                      checked={row.isActive}
                      disabled={pending}
                      onChange={(e) => submitActive(row, e.target.checked)}
                    />
                  </span>

                  <span role="cell" data-label="Actions" className="av2-rgrid__c" style={{ textAlign: 'right' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                      <IconButton
                        label={`Rename ${row.label}`}
                        tone="quiet"
                        disabled={pending}
                        onClick={() => {
                          setRenameRow(row)
                          setRenameLabel(row.label)
                          setNote(null)
                        }}
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
                            setReassignTo('')
                            setStripCarriers(false)
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

      {/* Mobile card list — visible below md (satisfies the table-no-mobile-fallback gate) */}
      <div className="md:hidden" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--a-s2)' }}>
        {rows.map((row, idx) => (
          <div
            key={row.id}
            className="av2-pane"
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <p
                style={{
                  margin: 0,
                  fontSize: 'var(--a-text-sm)',
                  fontWeight: 500,
                  color: 'var(--a-text)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {row.label}
              </p>
              {usageVisible && typeof row.usageCount === 'number' ? (
                <p
                  style={{
                    margin: 0,
                    fontSize: 'var(--a-text-xs)',
                    color: 'var(--a-text-2)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {row.usageCount.toLocaleString('en-US')} {dependentNoun}
                </p>
              ) : null}
            </div>
            <div style={{ display: 'flex', flexShrink: 0, alignItems: 'center', gap: 4 }}>
              <span style={{ display: 'flex', flexDirection: 'column' }}>
                <IconButton
                  label={`Move ${row.label} up`}
                  tone="quiet"
                  disabled={pending || idx === 0}
                  onClick={() => submitReorder(row.id, -1)}
                >
                  <ChevronUp size={14} />
                </IconButton>
                <IconButton
                  label={`Move ${row.label} down`}
                  tone="quiet"
                  disabled={pending || idx === rows.length - 1}
                  onClick={() => submitReorder(row.id, 1)}
                >
                  <ChevronDown size={14} />
                </IconButton>
              </span>
              <Switch
                label={`${row.label} active`}
                labelHidden
                checked={row.isActive}
                disabled={pending}
                onChange={(e) => submitActive(row, e.target.checked)}
              />
              <IconButton
                label={`Rename ${row.label}`}
                tone="quiet"
                disabled={pending}
                onClick={() => {
                  setRenameRow(row)
                  setRenameLabel(row.label)
                  setNote(null)
                }}
              >
                <Pencil size={16} />
              </IconButton>
              {!row.isProtected ? (
                <IconButton
                  label={`Delete ${row.label}`}
                  tone="danger"
                  disabled={pending}
                  onClick={() => {
                    setDeleteRow(row)
                    setReassignTo('')
                    setStripCarriers(false)
                    setNote(null)
                  }}
                >
                  <Trash2 size={16} />
                </IconButton>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <AddRowDialog
        open={addOpen}
        onClose={() => {
          if (!pending) setAddOpen(false)
        }}
        pending={pending}
        noun={noun}
        allowKeyInput={allowKeyInput}
        label={newLabel}
        onLabelChange={setNewLabel}
        keyValue={newKey}
        onKeyChange={setNewKey}
        onSubmit={submitAdd}
      />

      <RenameRowDialog
        open={!!renameRow}
        onClose={() => {
          if (!pending) setRenameRow(null)
        }}
        pending={pending}
        noun={noun}
        label={renameLabel}
        onLabelChange={setRenameLabel}
        onSubmit={submitRename}
      />

      <ConfirmDialog
        open={!!deleteRow}
        onClose={() => {
          if (!pending) setDeleteRow(null)
        }}
        title={`Delete ${deleteRow?.label ?? ''}`}
        description={
          deleteMode === 'reassign'
            ? `Pick a ${noun} to move every affected ${dependentNoun} to. This cannot be undone.`
            : deleteMode === 'scrub'
              ? `This removes the ${noun} from every ${dependentNoun} that references it, then deletes it. This cannot be undone.`
              : `Delete this ${noun} from the list. Optionally strip it off every ${dependentNoun} that carries it.`
        }
        confirmLabel={`Delete ${noun}`}
        onConfirm={submitDelete}
        busy={pending}
      >
        {deleteMode === 'reassign' ? (
          <SelectField label={`Move ${dependentNoun} to`} value={reassignTo} onChange={(e) => setReassignTo(e.target.value)}>
            <option value="" disabled>
              {`Choose a ${noun}`}
            </option>
            {reassignTargets.map((t) => (
              <option key={t.id} value={t.key}>
                {t.label}
              </option>
            ))}
          </SelectField>
        ) : null}

        {deleteMode === 'strip' ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              border: '1px solid var(--a-border)',
              borderRadius: 'var(--a-r-md)',
              padding: 12,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 'var(--a-text-sm)', fontWeight: 500, color: 'var(--a-text)' }}>
                Strip from every {dependentNoun}
              </p>
              <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
                {deleteRow?.usageCount
                  ? `${deleteRow.usageCount.toLocaleString('en-US')} ${dependentNoun} carry this ${noun}.`
                  : `No ${dependentNoun} carry this ${noun}.`}
              </p>
            </div>
            <Switch
              label={`Strip ${deleteRow?.label} from every ${dependentNoun}`}
              labelHidden
              checked={stripCarriers}
              disabled={pending}
              onChange={(e) => setStripCarriers(e.target.checked)}
            />
          </div>
        ) : null}
      </ConfirmDialog>
    </div>
  )
}
