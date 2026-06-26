'use client'

/**
 * AutomationRulesManager — the trigger-config island (Wave 6 authoring).
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
 * Design-system only. Reorder is up/down (a11y + robust).
 */

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'

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

export type SequenceOption = { id: number; name: string }
export type KeyLabelOption = { key: string; label: string }
export type BrokerOption = { slug: string; label: string }

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

type FormState = {
  name: string
  triggerType: string
  triggerValue: string
  actionType: string
  actionValue: string
}

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {rows.length} {rows.length === 1 ? 'rule' : 'rules'}
        </p>
        <Button size="sm" onClick={openCreate} disabled={pending}>
          New rule
        </Button>
      </div>

      {note ? (
        <Alert variant={note.tone === 'err' ? 'destructive' : 'default'}>
          <AlertDescription className="whitespace-pre-wrap">{note.text}</AlertDescription>
        </Alert>
      ) : null}

      <div className="rounded-xl border border-border bg-card overflow-x-auto no-scrollbar">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-1/4">Rule</TableHead>
              <TableHead className="w-1/4">When</TableHead>
              <TableHead className="w-1/4">Then</TableHead>
              <TableHead className="w-1/6">Status</TableHead>
              <TableHead className="text-right">Manage</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  No automation rules yet. Create the first one above.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, i) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium text-foreground">{row.name}</TableCell>
                  <TableCell className="text-muted-foreground">{triggerSummary(row)}</TableCell>
                  <TableCell className="text-muted-foreground">{actionSummary(row)}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-2">
                      <Switch
                        checked={row.isActive}
                        disabled={pending}
                        onCheckedChange={(next) => submitActive(row, next)}
                        aria-label={`${row.name} active`}
                      />
                      <Badge variant={row.isActive ? 'default' : 'secondary'}>
                        {row.isActive ? 'On' : 'Off'}
                      </Badge>
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        disabled={pending || i === 0}
                        aria-label={`Move ${row.name} up`}
                        onClick={() => move(row, -1)}
                      >
                        <span aria-hidden>↑</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        disabled={pending || i === rows.length - 1}
                        aria-label={`Move ${row.name} down`}
                        onClick={() => move(row, 1)}
                      >
                        <span aria-hidden>↓</span>
                      </Button>
                      <Button variant="outline" size="sm" className="h-8" disabled={pending} onClick={() => openEdit(row)}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-destructive hover:text-destructive"
                        disabled={pending}
                        onClick={() => {
                          setDeleteRow(row)
                          setNote(null)
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create / edit dialog */}
      <Dialog open={formOpen} onOpenChange={(o) => !pending && setFormOpen(o)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editId == null ? 'New rule' : 'Edit rule'}</DialogTitle>
            <DialogDescription>
              When the trigger fires, the action runs. Only the tag-added to enroll-in-workflow path runs in the engine
              today. The rest persist for the next engine pass.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="rule-name">Name</Label>
              <Input id="rule-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="rule-trigger">When</Label>
                <Select
                  value={form.triggerType}
                  onValueChange={(v) => setForm((f) => ({ ...f, triggerType: v, triggerValue: '' }))}
                >
                  <SelectTrigger id="rule-trigger">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIGGER_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rule-trigger-value">Trigger value</Label>
                <TriggerValueControl form={form} tags={tags} stages={stages} setForm={setForm} disabled={pending} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="rule-action">Then</Label>
                <Select
                  value={form.actionType}
                  onValueChange={(v) => setForm((f) => ({ ...f, actionType: v, actionValue: '' }))}
                >
                  <SelectTrigger id="rule-action">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_TYPES.map((a) => (
                      <SelectItem key={a.value} value={a.value}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rule-action-value">Action target</Label>
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
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={submitForm} disabled={pending}>
              {editId == null ? 'Create rule' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={!!deleteRow} onOpenChange={(o) => !pending && !o && setDeleteRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleteRow?.name}</DialogTitle>
            <DialogDescription>This removes the automation rule. It cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteRow(null)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={submitDelete} disabled={pending}>
              Delete rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Type-aware value controls ─────────────────────────────────────────────────

function TriggerValueControl({
  form,
  tags,
  stages,
  setForm,
  disabled,
}: {
  form: FormState
  tags: KeyLabelOption[]
  stages: KeyLabelOption[]
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  disabled: boolean
}) {
  if (form.triggerType === 'tag_added') {
    return (
      <KeyPicker
        id="rule-trigger-value"
        placeholder="Choose a tag"
        value={form.triggerValue}
        options={tags}
        disabled={disabled}
        onChange={(v) => setForm((f) => ({ ...f, triggerValue: v }))}
      />
    )
  }
  if (form.triggerType === 'stage_changed') {
    return (
      <KeyPicker
        id="rule-trigger-value"
        placeholder="Choose a stage"
        value={form.triggerValue}
        options={stages}
        disabled={disabled}
        onChange={(v) => setForm((f) => ({ ...f, triggerValue: v }))}
      />
    )
  }
  if (form.triggerType === 'inactivity') {
    return (
      <Input
        id="rule-trigger-value"
        type="number"
        min={1}
        inputMode="numeric"
        placeholder="Days"
        value={form.triggerValue}
        disabled={disabled}
        onChange={(e) => setForm((f) => ({ ...f, triggerValue: e.target.value }))}
      />
    )
  }
  // source_is (free text)
  return (
    <Input
      id="rule-trigger-value"
      placeholder="Source value"
      value={form.triggerValue}
      disabled={disabled}
      onChange={(e) => setForm((f) => ({ ...f, triggerValue: e.target.value }))}
    />
  )
}

function ActionValueControl({
  form,
  sequences,
  tags,
  stages,
  brokers,
  setForm,
  disabled,
}: {
  form: FormState
  sequences: SequenceOption[]
  tags: KeyLabelOption[]
  stages: KeyLabelOption[]
  brokers: BrokerOption[]
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  disabled: boolean
}) {
  if (form.actionType === 'enroll_sequence') {
    return (
      <Select value={form.actionValue} disabled={disabled} onValueChange={(v) => setForm((f) => ({ ...f, actionValue: v }))}>
        <SelectTrigger id="rule-action-value">
          <SelectValue placeholder="Choose a workflow" />
        </SelectTrigger>
        <SelectContent>
          {sequences.length === 0 ? (
            <SelectItem value="__none__" disabled>
              No workflows
            </SelectItem>
          ) : (
            sequences.map((s) => (
              <SelectItem key={s.id} value={String(s.id)}>
                {s.name}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    )
  }
  if (form.actionType === 'add_tag') {
    return (
      <KeyPicker
        id="rule-action-value"
        placeholder="Choose a tag"
        value={form.actionValue}
        options={tags}
        disabled={disabled}
        onChange={(v) => setForm((f) => ({ ...f, actionValue: v }))}
      />
    )
  }
  if (form.actionType === 'set_stage') {
    return (
      <KeyPicker
        id="rule-action-value"
        placeholder="Choose a stage"
        value={form.actionValue}
        options={stages}
        disabled={disabled}
        onChange={(v) => setForm((f) => ({ ...f, actionValue: v }))}
      />
    )
  }
  // assign_broker
  return (
    <Select value={form.actionValue} disabled={disabled} onValueChange={(v) => setForm((f) => ({ ...f, actionValue: v }))}>
      <SelectTrigger id="rule-action-value">
        <SelectValue placeholder="Choose a broker" />
      </SelectTrigger>
      <SelectContent>
        {brokers.map((b) => (
          <SelectItem key={b.slug} value={b.slug}>
            {b.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function KeyPicker({
  id,
  placeholder,
  value,
  options,
  disabled,
  onChange,
}: {
  id: string
  placeholder: string
  value: string
  options: KeyLabelOption[]
  disabled: boolean
  onChange: (v: string) => void
}) {
  return (
    <Select value={value} disabled={disabled} onValueChange={onChange}>
      <SelectTrigger id={id}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.length === 0 ? (
          <SelectItem value="__none__" disabled>
            None available
          </SelectItem>
        ) : (
          options.map((o) => (
            <SelectItem key={o.key} value={o.key}>
              {o.label}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  )
}
