'use client'

/**
 * TagTaxonomyEditor — the tag-manager island (Wave 2). Richer than the generic
 * ConfigTableEditor because tags are two layers: the taxonomy row AND the literal
 * key stored on every crm_people.tags array. So this editor adds:
 *   - a usage column (how many contacts carry each key),
 *   - rename that changes the KEY everywhere (newKey + newLabel),
 *   - merge one tag into another (folds carriers + drops the from-row),
 *   - delete with an optional strip-off-every-carrier toggle.
 * Compliance tags are protected: the actions refuse rename/merge/delete, and the
 * UI hides those controls for protected rows.
 *
 * Migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md),
 * following its already-migrated sibling ConfigTableEditor.tsx in this folder.
 * Presentation only — the six server actions, the FormData field names, every
 * validation branch and every user-facing string are carried over verbatim.
 *
 * Table markup is the hand-rolled div/role grid ConfigTableEditor uses
 * (av2-rgrid* + report-grid.css, role="table"/"row"/"columnheader"/"cell")
 * rather than the <ReportGrid> component: that component is server-only and
 * stateless, and these cells are interactive (Switch, IconButton) with a shared
 * pending state. The phone fallback carries its layout in `av2-cardlist`, NOT
 * `md:hidden` plus an inline display — an inline style outranks the class and
 * leaves BOTH layouts on screen at desktop.
 *
 * ci:admin-ui rule C allows ONE primary-variant Button per FILE, and this island
 * may not be split (no new files in this unit), so the island's single primary
 * is the header "+ Add tag". "Merge tags" and both non-destructive dialog
 * submits are quiet; the two destructive submits are danger.
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
  TextField,
  VerdictLine,
} from '@/components/admin/v2'
import '@/components/admin/v2/report-grid.css'
import { Pencil, Trash2, GripVertical } from 'lucide-react'
import { moveInList } from '@/lib/admin/config-editor-helpers'

export type TagRow = {
  id: number
  key: string
  label: string
  position: number
  isActive: boolean
  isProtected: boolean
  usageCount: number
}

type ActionResult = { ok: true } | { ok: false; error: string }

export type TagTaxonomyEditorActions = {
  create: (formData: FormData) => Promise<ActionResult>
  /** FormData: id, newKey, newLabel. */
  rename: (formData: FormData) => Promise<ActionResult>
  /** FormData: fromId, intoId. */
  merge: (formData: FormData) => Promise<ActionResult>
  /** FormData: id, strip ('1'|'0'). */
  remove: (formData: FormData) => Promise<ActionResult>
  /** FormData: id, isActive ('1'|'0'). */
  setActive: (formData: FormData) => Promise<ActionResult>
  reorder: (orderedIds: number[]) => Promise<ActionResult>
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

/** Monospaced key inputs — the key is a literal stored on every contact. */
const MONO: CSSProperties = { fontFamily: 'var(--a-font-mono)', fontSize: 'var(--a-text-xs)' }

export function TagTaxonomyEditor({
  rows,
  actions,
}: {
  rows: TagRow[]
  actions: TagTaxonomyEditorActions
}) {
  const [pending, startTransition] = useTransition()
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  const [addOpen, setAddOpen] = useState(false)
  const [renameRow, setRenameRow] = useState<TagRow | null>(null)
  const [deleteRow, setDeleteRow] = useState<TagRow | null>(null)
  const [mergeOpen, setMergeOpen] = useState(false)

  const [newLabel, setNewLabel] = useState('')
  const [newKey, setNewKey] = useState('')
  const [renameKey, setRenameKey] = useState('')
  const [renameLabel, setRenameLabel] = useState('')
  const [stripCarriers, setStripCarriers] = useState(false)
  const [mergeFrom, setMergeFrom] = useState('')
  const [mergeInto, setMergeInto] = useState('')

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
    if (newKey.trim()) fd.set('key', newKey.trim())
    run(() => actions.create(fd), 'Tag added', () => {
      setAddOpen(false)
      setNewLabel('')
      setNewKey('')
    })
  }

  function submitRename() {
    if (!renameRow) return
    const key = renameKey.trim()
    if (!key) {
      setNote({ tone: 'err', text: 'A new tag name is required' })
      return
    }
    const fd = new FormData()
    fd.set('id', String(renameRow.id))
    fd.set('newKey', key)
    fd.set('newLabel', renameLabel.trim() || key)
    run(() => actions.rename(fd), 'Tag renamed', () => setRenameRow(null))
  }

  function submitActive(row: TagRow, next: boolean) {
    const fd = new FormData()
    fd.set('id', String(row.id))
    fd.set('isActive', next ? '1' : '0')
    run(() => actions.setActive(fd), next ? 'Tag enabled' : 'Tag disabled')
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
    fd.set('strip', stripCarriers ? '1' : '0')
    run(() => actions.remove(fd), 'Tag deleted', () => {
      setDeleteRow(null)
      setStripCarriers(false)
    })
  }

  function submitMerge() {
    if (!mergeFrom || !mergeInto) {
      setNote({ tone: 'err', text: 'Pick a tag to merge and a tag to merge into' })
      return
    }
    if (mergeFrom === mergeInto) {
      setNote({ tone: 'err', text: 'Cannot merge a tag into itself' })
      return
    }
    const fd = new FormData()
    fd.set('fromId', mergeFrom)
    fd.set('intoId', mergeInto)
    run(() => actions.merge(fd), 'Tags merged', () => {
      setMergeOpen(false)
      setMergeFrom('')
      setMergeInto('')
    })
  }

  // Merge sources cannot be protected (the action refuses); destinations can.
  const mergeSources = rows.filter((r) => !r.isProtected)

  // Desktop column template — the custom properties report-grid.css reads at
  // >=720px. Below md the whole block is `hidden`, so the stacked-block rules
  // in that file never apply here; the card list takes over instead.
  const gridStyle = {
    '--rgrid-cols': '52px minmax(220px,1fr) 88px 132px 88px',
    '--rgrid-min': '600px',
  } as CSSProperties

  return (
    <div className="space-y-4">
      {/* count left, actions right */}
      <div className="flex items-center justify-between gap-3">
        <SectionHead>
          {rows.length.toLocaleString('en-US')}{' '}
          <span style={{ fontWeight: 400, color: 'var(--a-text-2)' }}>
            {rows.length === 1 ? 'Tag' : 'Tags'}
          </span>
        </SectionHead>
        <div className="flex items-center gap-2">
          <Button variant="quiet" onClick={() => setMergeOpen(true)} disabled={pending}>
            Merge tags
          </Button>
          <Button onClick={() => setAddOpen(true)} disabled={pending}>
            + Add tag
          </Button>
        </div>
      </div>

      {note ? (
        <VerdictLine tone={note.tone === 'err' ? 'attention' : 'ok'}>{note.text}</VerdictLine>
      ) : null}

      {/* Desktop grid — hidden below md; the card list below takes over */}
      <div className="hidden md:block">
        <div className="av2-rgrid__scroll" role="group" tabIndex={0} aria-label="Tags">
          <div className="av2-rgrid" role="table" aria-label="Tags" style={gridStyle}>
            <div className="av2-rgrid__head" role="row">
              <span role="columnheader" className="av2-rgrid__h" />
              <span role="columnheader" className="av2-rgrid__h">
                Name
              </span>
              <span role="columnheader" className="av2-rgrid__h av2-rgrid__h--n">
                Used
              </span>
              <span role="columnheader" className="av2-rgrid__h">
                Status
              </span>
              <span role="columnheader" className="av2-rgrid__h" style={{ textAlign: 'right' }}>
                Actions
              </span>
            </div>

            {rows.length === 0 ? (
              <div className="av2-rgrid__empty" role="row">
                <span role="cell">No tags yet. Add the first one.</span>
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
                      {row.isProtected ? <span style={BADGE}>Compliance</span> : null}
                    </span>
                  </span>

                  <span role="cell" data-label="Used" className="av2-rgrid__c av2-rgrid__c--n">
                    {row.usageCount.toLocaleString('en-US')}
                  </span>

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
                      {row.isProtected ? (
                        <>
                          <span
                            className="av2-iconbtn"
                            aria-hidden="true"
                            style={{ visibility: 'hidden', pointerEvents: 'none' }}
                          />
                          <span
                            className="av2-iconbtn"
                            aria-hidden="true"
                            style={{ visibility: 'hidden', pointerEvents: 'none' }}
                          />
                        </>
                      ) : (
                        <>
                          <IconButton
                            label={`Rename ${row.label}`}
                            tone="quiet"
                            disabled={pending}
                            onClick={() => {
                              setRenameRow(row)
                              setRenameKey(row.key)
                              setRenameLabel(row.label)
                              setNote(null)
                            }}
                          >
                            <Pencil size={16} />
                          </IconButton>
                          <IconButton
                            label={`Delete ${row.label}`}
                            tone="danger"
                            disabled={pending}
                            onClick={() => {
                              setDeleteRow(row)
                              setStripCarriers(false)
                              setNote(null)
                            }}
                          >
                            <Trash2 size={16} />
                          </IconButton>
                        </>
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
                className="a-num"
                style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}
              >
                {row.usageCount.toLocaleString('en-US')} contacts
              </p>
            </div>
            <div style={{ display: 'flex', flexShrink: 0, alignItems: 'center', gap: 4 }}>
              <Switch
                label={`${row.label} active`}
                labelHidden
                checked={row.isActive}
                disabled={pending}
                onChange={(e) => submitActive(row, e.target.checked)}
              />
              {!row.isProtected && (
                <>
                  <IconButton
                    label={`Rename ${row.label}`}
                    tone="quiet"
                    disabled={pending}
                    onClick={() => {
                      setRenameRow(row)
                      setRenameKey(row.key)
                      setRenameLabel(row.label)
                      setNote(null)
                    }}
                  >
                    <Pencil size={16} />
                  </IconButton>
                  <IconButton
                    label={`Delete ${row.label}`}
                    tone="danger"
                    disabled={pending}
                    onClick={() => {
                      setDeleteRow(row)
                      setStripCarriers(false)
                      setNote(null)
                    }}
                  >
                    <Trash2 size={16} />
                  </IconButton>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add dialog */}
      <Dialog
        open={addOpen}
        onClose={() => {
          if (!pending) setAddOpen(false)
        }}
        title="Add tag"
        description="The key is the literal value stored on each contact. It defaults to the label."
        footer={
          <>
            <Button variant="quiet" onClick={() => setAddOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="quiet" onClick={submitAdd} disabled={pending}>
              Add tag
            </Button>
          </>
        }
      >
        <TextField
          label="Label"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="New tag"
          autoFocus
        />
        <TextField
          label="Key (optional)"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder="Defaults to the label"
          style={MONO}
        />
      </Dialog>

      {/* Rename dialog — changes the KEY everywhere */}
      <Dialog
        open={!!renameRow}
        onClose={() => {
          if (!pending) setRenameRow(null)
        }}
        title={`Rename ${renameRow?.label ?? ''}`}
        description={
          <>
            Renaming the key rewrites it on every contact that carries it
            {renameRow ? ` (${renameRow.usageCount.toLocaleString('en-US')} now).` : '.'}
          </>
        }
        footer={
          <>
            <Button variant="quiet" onClick={() => setRenameRow(null)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="quiet" onClick={submitRename} disabled={pending}>
              Rename everywhere
            </Button>
          </>
        }
      >
        <TextField
          label="New key"
          value={renameKey}
          onChange={(e) => setRenameKey(e.target.value)}
          style={MONO}
          autoFocus
        />
        <TextField
          label="New label"
          value={renameLabel}
          onChange={(e) => setRenameLabel(e.target.value)}
          placeholder="Defaults to the key"
        />
      </Dialog>

      {/* Merge dialog */}
      <Dialog
        open={mergeOpen}
        onClose={() => {
          if (!pending) setMergeOpen(false)
        }}
        title="Merge tags"
        description="Every contact carrying the first tag is moved to the second, then the first tag is removed. This cannot be undone."
        footer={
          <>
            <Button variant="quiet" onClick={() => setMergeOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="danger" onClick={submitMerge} disabled={pending}>
              Merge tags
            </Button>
          </>
        }
      >
        <SelectField label="Merge this tag" value={mergeFrom} onChange={(e) => setMergeFrom(e.target.value)}>
          <option value="" disabled>
            Tag to fold in
          </option>
          {mergeSources.map((t) => (
            <option key={t.id} value={String(t.id)}>
              {t.label} ({t.usageCount.toLocaleString('en-US')})
            </option>
          ))}
        </SelectField>
        <SelectField label="Into this tag" value={mergeInto} onChange={(e) => setMergeInto(e.target.value)}>
          <option value="" disabled>
            Destination tag
          </option>
          {rows.map((t) => (
            <option key={t.id} value={String(t.id)}>
              {t.label} ({t.usageCount.toLocaleString('en-US')})
            </option>
          ))}
        </SelectField>
      </Dialog>

      {/* Delete dialog */}
      <ConfirmDialog
        open={!!deleteRow}
        onClose={() => {
          if (!pending) setDeleteRow(null)
        }}
        title={`Delete ${deleteRow?.label ?? ''}`}
        description="Remove this tag from the taxonomy. Optionally strip it off every contact that carries it."
        confirmLabel="Delete tag"
        onConfirm={submitDelete}
        busy={pending}
      >
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
              Strip from every contact
            </p>
            <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
              {deleteRow?.usageCount
                ? `${deleteRow.usageCount.toLocaleString('en-US')} contacts carry this tag.`
                : 'No contacts carry this tag.'}
            </p>
          </div>
          <Switch
            label="Strip from every contact"
            labelHidden
            checked={stripCarriers}
            disabled={pending}
            onChange={(e) => setStripCarriers(e.target.checked)}
          />
        </div>
      </ConfirmDialog>
    </div>
  )
}
