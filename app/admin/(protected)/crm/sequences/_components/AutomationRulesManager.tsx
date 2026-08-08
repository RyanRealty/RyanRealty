'use client'

/**
 * AutomationRulesManager — the trigger-config island (Wave 6 authoring).
 *
 * 11F: migrated off shadcn (Table/Dialog/Select/Button/Input/Label/Badge/
 * Switch/Alert) onto components/admin/v2, the LOCKED admin visual language
 * (design_system/admin/ADMIN_UI.md). PRESENTATION ONLY — every prop,
 * callback, computation and user-facing string carries over unchanged.
 *
 * Manages crm_automation_rules: "when TRIGGER fires, run ACTION". A rule is
 * (trigger_type + trigger_value) -> (action_type + action_value). The engine
 * today wires the tag_added -> enroll_sequence path; the other triggers/actions
 * persist + manage here for the future engine pass (the page copy says so).
 *
 * The server actions take FormData (the established pattern in
 * app/actions/crm-automation-rules.ts), so this island builds FormData and calls
 * the passed-in callbacks. Create/edit validate the action target exists
 * server-side, so a dead sequence id / unknown tag surfaces as the action error.
 *
 * The action-value control swaps by action type: a sequence picker for
 * enroll_sequence, a tag picker for add_tag, a stage picker for set_stage, a
 * broker picker for assign_broker. Likewise an inactivity trigger takes a day
 * count, the others a free value (tag/stage/source string).
 *
 * Reorder is up/down (a11y + robust) — IconButton chevrons, the same
 * av2-reorder pattern ConfigTableEditor.tsx uses.
 *
 * ci:admin-ui rule C (at most one primary-variant v2 <Button> per file): this
 * file's ONE primary is the header "New rule" button. The dialog's submit
 * ("Create rule" / "Save"), which was a default/primary shadcn Button, is
 * `variant="quiet"` here instead; its Cancel was already quiet-equivalent.
 * Row actions (reorder / edit / delete) are IconButtons, matching the same
 * Manage-column idiom ConfigTableEditor.tsx uses for its config tables.
 *
 * Design-system only: Button, IconButton, Dialog, ConfirmDialog, SelectField,
 * TextField, Switch, VerdictLine + tokens. No raw HTML controls, no hex, no
 * shadcn/ui imports.
 */

import { useRouter } from 'next/navigation'
import { useState, useTransition, type CSSProperties } from 'react'
import {
  Button,
  ConfirmDialog,
  Dialog,
  IconButton,
  SelectField,
  Switch,
  TextField,
  VerdictLine,
} from '@/components/admin/v2'
import '@/components/admin/v2/report-grid.css'
import { ChevronDown, ChevronUp, Pencil, Trash2 } from 'lucide-react'
import {
  ActionValueControl,
  TriggerValueControl,
  type BrokerOption,
  type FormState,
  type KeyLabelOption,
  type SequenceOption,
} from './automation-rules-bits'

export type RuleRow = {
  id: number
  name: string
  isActive: boolean
  triggerType: string
  triggerValue: string
  actionType: string
  actionValue: string
  position: number
}

export type { SequenceOption, KeyLabelOption, BrokerOption, FormState }

type ActionResult = { ok: true } | { ok: false; error: string }

export type AutomationRulesActions = {
  create: (fd: FormData) => Promise<ActionResult>
  update: (fd: FormData) => Promise<ActionResult>
  setActive: (fd: FormData) => Promise<ActionResult>
  remove: (fd: FormData) => Promise<ActionResult>
  reorder: (orderedIds: number[]) => Promise<ActionResult>
}

const TRIGGER_TYPES = [
  { value: 'tag_added', label: 'Tag added' },
  { value: 'stage_changed', label: 'Stage changed' },
  { value: 'source_is', label: 'Source is' },
  { value: 'inactivity', label: 'Inactive for N days' },
  { value: 'deal_stage_changed', label: 'Deal stage changed' },
  { value: 'inquiry', label: 'Inquiry submitted' },
  { value: 'property_saved', label: 'Property saved' },
  { value: 'calendar_date', label: 'Calendar date' },
  { value: 'appointment', label: 'Appointment' },
] as const

const ACTION_TYPES = [
  { value: 'enroll_sequence', label: 'Enroll in workflow' },
  { value: 'add_tag', label: 'Add tag' },
  { value: 'set_stage', label: 'Set stage' },
  { value: 'assign_broker', label: 'Assign broker' },
] as const

const EMPTY: FormState = {
  name: '',
  triggerType: 'tag_added',
  triggerValue: '',
  actionType: 'enroll_sequence',
  actionValue: '',
}

function labelFor(list: ReadonlyArray<{ value: string; label: string }>, value: string): string {
  return list.find((x) => x.value === value)?.label ?? value
}

/** Badge substitution (11F recipe): a static label, never a status pill. */
const badgeStyle: CSSProperties = {
  fontSize: 'var(--a-text-xs)',
  color: 'var(--a-text-2)',
  border: '1px solid var(--a-border)',
  borderRadius: 'var(--a-r-sm)',
  padding: '1px 6px',
  whiteSpace: 'nowrap',
}

const CELL_RIGHT: CSSProperties = { textAlign: 'right' }
const ROW_BETWEEN: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }
const CARD_SUBTEXT: CSSProperties = { margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }

export function AutomationRulesManager({
  rows,
  sequences,
  tags,
  stages,
  brokers,
  actions,
}: {
  rows: RuleRow[]
  sequences: SequenceOption[]
  tags: KeyLabelOption[]
  stages: KeyLabelOption[]
  brokers: BrokerOption[]
  actions: AutomationRulesActions
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [deleteRow, setDeleteRow] = useState<RuleRow | null>(null)

  function run(action: () => Promise<ActionResult>, okText: string, onOk?: () => void) {
    setNote(null)
    startTransition(async () => {
      const r = await action()
      if (r.ok) {
        setNote({ tone: 'ok', text: okText })
        onOk?.()
        router.refresh()
      } else {
        setNote({ tone: 'err', text: r.error })
      }
    })
  }

  function openCreate() {
    setEditId(null)
    setForm(EMPTY)
    setNote(null)
    setFormOpen(true)
  }

  function openEdit(row: RuleRow) {
    setEditId(row.id)
    setForm({
      name: row.name,
      triggerType: row.triggerType,
      triggerValue: row.triggerValue,
      actionType: row.actionType,
      actionValue: row.actionValue,
    })
    setNote(null)
    setFormOpen(true)
  }

  function submitForm() {
    const name = form.name.trim()
    if (!name) {
      setNote({ tone: 'err', text: 'A rule name is required' })
      return
    }
    if (!form.triggerValue.trim()) {
      setNote({ tone: 'err', text: 'Set the trigger value' })
      return
    }
    if (!form.actionValue.trim()) {
      setNote({ tone: 'err', text: 'Set the action target' })
      return
    }
    const fd = new FormData()
    if (editId != null) fd.set('id', String(editId))
    fd.set('name', name)
    fd.set('triggerType', form.triggerType)
    fd.set('triggerValue', form.triggerValue.trim())
    fd.set('actionType', form.actionType)
    fd.set('actionValue', form.actionValue.trim())
    const action = editId == null ? () => actions.create(fd) : () => actions.update(fd)
    run(action, editId == null ? 'Rule created' : 'Rule saved', () => setFormOpen(false))
  }

  function submitActive(row: RuleRow, next: boolean) {
    const fd = new FormData()
    fd.set('id', String(row.id))
    fd.set('isActive', next ? '1' : '0')
    run(() => actions.setActive(fd), next ? 'Rule enabled' : 'Rule disabled')
  }

  function submitDelete() {
    if (!deleteRow) return
    const fd = new FormData()
    fd.set('id', String(deleteRow.id))
    run(() => actions.remove(fd), 'Rule deleted', () => setDeleteRow(null))
  }

  function move(row: RuleRow, dir: -1 | 1) {
    const ids = rows.map((r) => r.id)
    const i = ids.indexOf(row.id)
    const target = i + dir
    if (target < 0 || target >= ids.length) return
    const next = [...ids]
    next[i] = ids[target]
    next[target] = ids[i]
    run(() => actions.reorder(next), 'Order updated')
  }

  function triggerSummary(row: RuleRow): string {
    const t = labelFor(TRIGGER_TYPES, row.triggerType)
    if (row.triggerType === 'inactivity') return `${t} (${row.triggerValue})`
    return `${t}: ${row.triggerValue}`
  }

  function actionSummary(row: RuleRow): string {
    const a = labelFor(ACTION_TYPES, row.actionType)
    if (row.actionType === 'enroll_sequence') {
      const seq = sequences.find((s) => String(s.id) === row.actionValue)
      return `${a}: ${seq?.name ?? `#${row.actionValue}`}`
    }
    if (row.actionType === 'assign_broker') {
      const b = brokers.find((x) => x.slug === row.actionValue)
      return `${a}: ${b?.label ?? row.actionValue}`
    }
    if (row.actionType === 'set_stage') {
      const s = stages.find((x) => x.key === row.actionValue)
      return `${a}: ${s?.label ?? row.actionValue}`
    }
    if (row.actionType === 'add_tag') {
      const tg = tags.find((x) => x.key === row.actionValue)
      return `${a}: ${tg?.label ?? row.actionValue}`
    }
    return `${a}: ${row.actionValue}`
  }

  const gridStyle = {
    '--rgrid-cols': 'minmax(150px,1fr) minmax(170px,1fr) minmax(170px,1fr) 100px 176px',
    '--rgrid-min': '860px',
  } as CSSProperties

  const emptyMessage = 'No automation rules yet. Create the first one above.'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--a-s4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <p style={{ margin: 0, fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
          <span className="a-num">{rows.length}</span> {rows.length === 1 ? 'rule' : 'rules'}
        </p>
        {/* This file's ONE primary (ci:admin-ui rule C). */}
        <Button onClick={openCreate} disabled={pending}>
          New rule
        </Button>
      </div>

      {note ? (
        <VerdictLine tone={note.tone === 'err' ? 'attention' : 'ok'}>
          <span style={{ whiteSpace: 'pre-wrap' }}>{note.text}</span>
        </VerdictLine>
      ) : null}

      {/* Desktop grid — hidden below md; the phone card list below takes over */}
      <div className="hidden md:block">
        <div className="av2-rgrid__scroll" role="group" tabIndex={0} aria-label="Automation rules">
          <div className="av2-rgrid" role="table" aria-label="Automation rules" style={gridStyle}>
            <div className="av2-rgrid__head" role="row">
              <span role="columnheader" className="av2-rgrid__h">Rule</span>
              <span role="columnheader" className="av2-rgrid__h">When</span>
              <span role="columnheader" className="av2-rgrid__h">Then</span>
              <span role="columnheader" className="av2-rgrid__h">Status</span>
              <span role="columnheader" className="av2-rgrid__h" style={CELL_RIGHT}>Manage</span>
            </div>

            {rows.length === 0 ? (
              <div className="av2-rgrid__empty" role="row">
                <span role="cell">{emptyMessage}</span>
              </div>
            ) : (
              rows.map((row, i) => (
                <div key={row.id} role="row" className="av2-rgrid__row">
                  <span role="cell" data-label="" className="av2-rgrid__c" style={{ fontWeight: 600, color: 'var(--a-text)' }}>
                    {row.name}
                  </span>
                  <span role="cell" data-label="When" className="av2-rgrid__c">
                    {triggerSummary(row)}
                  </span>
                  <span role="cell" data-label="Then" className="av2-rgrid__c">
                    {actionSummary(row)}
                  </span>
                  <span role="cell" data-label="Status" className="av2-rgrid__c">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <Switch
                        label={`${row.name} active`}
                        labelHidden
                        checked={row.isActive}
                        disabled={pending}
                        onChange={(e) => submitActive(row, e.target.checked)}
                      />
                      <span style={badgeStyle}>{row.isActive ? 'On' : 'Off'}</span>
                    </span>
                  </span>
                  <span role="cell" data-label="Manage" className="av2-rgrid__c" style={CELL_RIGHT}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                      <span className="av2-reorder">
                        <IconButton
                          label={`Move ${row.name} up`}
                          tone="quiet"
                          disabled={pending || i === 0}
                          onClick={() => move(row, -1)}
                        >
                          <ChevronUp size={14} />
                        </IconButton>
                        <IconButton
                          label={`Move ${row.name} down`}
                          tone="quiet"
                          disabled={pending || i === rows.length - 1}
                          onClick={() => move(row, 1)}
                        >
                          <ChevronDown size={14} />
                        </IconButton>
                      </span>
                      <IconButton label={`Edit ${row.name}`} tone="quiet" disabled={pending} onClick={() => openEdit(row)}>
                        <Pencil size={16} />
                      </IconButton>
                      <IconButton
                        label={`Delete ${row.name}`}
                        tone="danger"
                        disabled={pending}
                        onClick={() => {
                          setDeleteRow(row)
                          setNote(null)
                        }}
                      >
                        <Trash2 size={16} />
                      </IconButton>
                    </span>
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Phone card list — visible below md */}
      <div className="av2-cardlist">
        {rows.length === 0 ? (
          <p style={{ margin: 0, padding: '28px 2px', fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
            {emptyMessage}
          </p>
        ) : (
          rows.map((row, i) => (
            <div key={row.id} className="av2-pane">
              <div style={ROW_BETWEEN}>
                <p style={{ margin: 0, fontWeight: 600, color: 'var(--a-text)', fontSize: 'var(--a-text-sm)' }}>{row.name}</p>
                <span style={badgeStyle}>{row.isActive ? 'On' : 'Off'}</span>
              </div>
              <p style={CARD_SUBTEXT}>When: {triggerSummary(row)}</p>
              <p style={CARD_SUBTEXT}>Then: {actionSummary(row)}</p>
              <div style={ROW_BETWEEN}>
                <Switch
                  label={`${row.name} active`}
                  labelHidden
                  stateText={row.isActive ? 'On' : 'Off'}
                  checked={row.isActive}
                  disabled={pending}
                  onChange={(e) => submitActive(row, e.target.checked)}
                />
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span className="av2-reorder">
                    <IconButton
                      label={`Move ${row.name} up`}
                      tone="quiet"
                      disabled={pending || i === 0}
                      onClick={() => move(row, -1)}
                    >
                      <ChevronUp size={14} />
                    </IconButton>
                    <IconButton
                      label={`Move ${row.name} down`}
                      tone="quiet"
                      disabled={pending || i === rows.length - 1}
                      onClick={() => move(row, 1)}
                    >
                      <ChevronDown size={14} />
                    </IconButton>
                  </span>
                  <IconButton label={`Edit ${row.name}`} tone="quiet" disabled={pending} onClick={() => openEdit(row)}>
                    <Pencil size={16} />
                  </IconButton>
                  <IconButton
                    label={`Delete ${row.name}`}
                    tone="danger"
                    disabled={pending}
                    onClick={() => {
                      setDeleteRow(row)
                      setNote(null)
                    }}
                  >
                    <Trash2 size={16} />
                  </IconButton>
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create / edit dialog */}
      <Dialog
        open={formOpen}
        onClose={() => {
          if (!pending) setFormOpen(false)
        }}
        title={editId == null ? 'New rule' : 'Edit rule'}
        description="When the trigger fires, the action runs. Only the tag-added to enroll-in-workflow path runs in the engine today. The rest persist for the next engine pass."
        footer={
          <>
            <Button variant="quiet" onClick={() => setFormOpen(false)} disabled={pending}>
              Cancel
            </Button>
            {/* Downgraded from primary: this file's one primary is the header
                "New rule" button (ci:admin-ui rule C). */}
            <Button variant="quiet" onClick={submitForm} disabled={pending}>
              {editId == null ? 'Create rule' : 'Save'}
            </Button>
          </>
        }
      >
        <TextField label="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoFocus />

        <div className="av2-editgrid">
          <SelectField
            label="When"
            value={form.triggerType}
            onChange={(e) => setForm((f) => ({ ...f, triggerType: e.target.value, triggerValue: '' }))}
          >
            {TRIGGER_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </SelectField>
          <TriggerValueControl form={form} tags={tags} stages={stages} setForm={setForm} disabled={pending} />
        </div>

        <div className="av2-editgrid">
          <SelectField
            label="Then"
            value={form.actionType}
            onChange={(e) => setForm((f) => ({ ...f, actionType: e.target.value, actionValue: '' }))}
          >
            {ACTION_TYPES.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </SelectField>
          <ActionValueControl
            form={form}
            sequences={sequences}
            tags={tags}
            stages={stages}
            brokers={brokers}
            setForm={setForm}
            disabled={pending}
          />
        </div>
      </Dialog>

      {/* Delete dialog */}
      <ConfirmDialog
        open={!!deleteRow}
        onClose={() => {
          if (!pending) setDeleteRow(null)
        }}
        title={`Delete ${deleteRow?.name ?? ''}`}
        description="This removes the automation rule. It cannot be undone."
        confirmLabel="Delete rule"
        busy={pending}
        onConfirm={submitDelete}
      />
    </div>
  )
}
