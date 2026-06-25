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
 * Design-system only.
 */
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
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import {
  moveInList,
  parseOptions,
  serializeOptions,
} from '@/components/admin/crm/settings/config-editor-helpers'

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {rows.length} {rows.length === 1 ? 'field' : 'fields'}
        </p>
        <Button size="sm" onClick={openCreate} disabled={pending}>
          Add field
        </Button>
      </div>

      {note ? (
        <Alert variant={note.tone === 'err' ? 'destructive' : 'default'}>
          <AlertDescription>{note.text}</AlertDescription>
        </Alert>
      ) : null}

      <div className="rounded-xl border border-border bg-card overflow-x-auto no-scrollbar">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-1/4">Label</TableHead>
              <TableHead className="w-1/5">Key</TableHead>
              <TableHead className="w-1/6">Type</TableHead>
              <TableHead className="w-1/6">Group</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  No custom fields yet. Add the first one above.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, idx) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium text-foreground">
                    <span className="inline-flex items-center gap-2">
                      {row.label}
                      {row.isProtected ? (
                        <Badge variant="outline" className="text-xs uppercase tracking-wide">
                          System
                        </Badge>
                      ) : null}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{row.key}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs uppercase tracking-wide">
                      {row.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.fieldGroup ?? '—'}</TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        disabled={pending || idx === 0}
                        aria-label={`Move ${row.label} up`}
                        onClick={() => submitReorder(row.id, -1)}
                      >
                        ↑
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        disabled={pending || idx === rows.length - 1}
                        aria-label={`Move ${row.label} down`}
                        onClick={() => submitReorder(row.id, 1)}
                      >
                        ↓
                      </Button>
                      <Button variant="outline" size="sm" className="h-8" disabled={pending} onClick={() => openEdit(row)}>
                        Edit
                      </Button>
                      {row.isProtected ? (
                        <span className="px-2 text-xs text-muted-foreground">Locked</span>
                      ) : (
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
                      )}
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
            <DialogTitle>{editId == null ? 'Add field' : 'Edit field'}</DialogTitle>
            <DialogDescription>
              {editId == null
                ? 'The key is the stable identifier on the contact data. It cannot change later.'
                : 'The key is fixed. Only the label, type, options, group, and flags change.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="fd-label">Label</Label>
                <Input id="fd-label" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fd-key">Key</Label>
                <Input
                  id="fd-key"
                  value={form.key}
                  onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
                  disabled={editId != null}
                  className="font-mono text-xs"
                  placeholder="lower_snake_case"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="fd-type">Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm((f) => ({ ...f, type: v as FieldType }))}
                >
                  <SelectTrigger id="fd-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="select">Select</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fd-group">Group (optional)</Label>
                <Input id="fd-group" value={form.fieldGroup} onChange={(e) => setForm((f) => ({ ...f, fieldGroup: e.target.value }))} />
              </div>
            </div>

            {form.type === 'select' ? (
              <div className="space-y-1.5">
                <Label htmlFor="fd-options">Options</Label>
                <Textarea
                  id="fd-options"
                  value={form.optionsText}
                  onChange={(e) => setForm((f) => ({ ...f, optionsText: e.target.value }))}
                  rows={5}
                  className="font-mono text-xs"
                  placeholder={'one per line\nvalue|Label\nbuyer|Buyer'}
                />
                <p className="text-xs text-muted-foreground">One option per line. Use value|Label to set a display label.</p>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                <span className="text-sm font-medium text-foreground">Hide when empty</span>
                <Switch
                  checked={form.hideIfEmpty}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, hideIfEmpty: v }))}
                  disabled={pending}
                  aria-label="Hide when empty"
                />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                <span className="text-sm font-medium text-foreground">Read only</span>
                <Switch
                  checked={form.readOnly}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, readOnly: v }))}
                  disabled={pending}
                  aria-label="Read only"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={submitForm} disabled={pending}>
              {editId == null ? 'Add field' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={!!deleteRow} onOpenChange={(o) => !pending && !o && setDeleteRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {deleteRow?.label}</DialogTitle>
            <DialogDescription>
              This removes the field definition only. The stored values on each contact are kept, and the field can be re-added later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteRow(null)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={submitDelete} disabled={pending}>
              Remove field
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
