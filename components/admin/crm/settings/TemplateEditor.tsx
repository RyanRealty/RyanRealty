'use client'

/**
 * TemplateEditor — the email + SMS template CRUD island (Wave 2).
 *
 * Templates carry more than a label: a channel (email|sms), an email subject, a
 * multi-line body, and an optional category. So this is a richer editor than the
 * generic ConfigTableEditor: a table of templates plus a create/edit dialog with
 * subject + body fields, a channel toggle, an active switch, and a delete guarded
 * by sequence usage. The server save runs the brand-voice gate, so a banned word
 * surfaces here as the action error.
 *
 * The actions take typed args (not FormData): createTemplateAction(input),
 * updateTemplateAction(id, input), setTemplateActiveAction(id, isActive),
 * deleteTemplateAction(id). Delete is refused while any sequence references the
 * template (usage > 0) — the UI also disables the control to make that obvious.
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

export type TemplateRow = {
  id: number
  key: string
  channel: 'email' | 'sms'
  name: string
  subject: string | null
  body: string
  category: string | null
  isActive: boolean
  usage: number
}

type ActionResult = { ok: true; id?: number; message?: string } | { ok: false; error: string }

type TemplateInput = {
  channel: string
  name: string
  subject?: string | null
  body: string
  category?: string | null
}

export type TemplateEditorActions = {
  create: (input: TemplateInput) => Promise<ActionResult>
  update: (id: number, input: TemplateInput) => Promise<ActionResult>
  setActive: (id: number, isActive: boolean) => Promise<ActionResult>
  remove: (id: number) => Promise<ActionResult>
}

type FormState = {
  channel: 'email' | 'sms'
  name: string
  subject: string
  body: string
  category: string
}

const EMPTY: FormState = { channel: 'email', name: '', subject: '', body: '', category: '' }

export function TemplateEditor({
  rows,
  actions,
}: {
  rows: TemplateRow[]
  actions: TemplateEditorActions
}) {
  const [pending, startTransition] = useTransition()
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  const [editId, setEditId] = useState<number | null>(null) // null = create, number = edit
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [deleteRow, setDeleteRow] = useState<TemplateRow | null>(null)

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

  function openEdit(row: TemplateRow) {
    setEditId(row.id)
    setForm({
      channel: row.channel,
      name: row.name,
      subject: row.subject ?? '',
      body: row.body,
      category: row.category ?? '',
    })
    setFormOpen(true)
    setNote(null)
  }

  function submitForm() {
    const name = form.name.trim()
    if (!name) {
      setNote({ tone: 'err', text: 'A template name is required' })
      return
    }
    if (!form.body.trim()) {
      setNote({ tone: 'err', text: 'Template body is required' })
      return
    }
    if (form.channel === 'email' && !form.subject.trim()) {
      setNote({ tone: 'err', text: 'An email template needs a subject line' })
      return
    }
    const input: TemplateInput = {
      channel: form.channel,
      name,
      subject: form.channel === 'email' ? form.subject.trim() : null,
      body: form.body.trim(),
      category: form.category.trim() || null,
    }
    const action = editId == null ? () => actions.create(input) : () => actions.update(editId, input)
    run(action, editId == null ? 'Template created' : 'Template saved', () => setFormOpen(false))
  }

  function submitActive(row: TemplateRow, next: boolean) {
    run(() => actions.setActive(row.id, next), next ? 'Template enabled' : 'Template disabled')
  }

  function submitDelete() {
    if (!deleteRow) return
    run(() => actions.remove(deleteRow.id), 'Template deleted', () => setDeleteRow(null))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {rows.length} {rows.length === 1 ? 'template' : 'templates'}
        </p>
        <Button size="sm" onClick={openCreate} disabled={pending}>
          New template
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
              <TableHead className="w-1/3">Name</TableHead>
              <TableHead className="w-1/6">Channel</TableHead>
              <TableHead className="w-1/6">Category</TableHead>
              <TableHead className="w-1/12 text-right tabular-nums">In use</TableHead>
              <TableHead className="w-1/6">Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  No templates yet. Create the first one above.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium text-foreground">{row.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="uppercase text-xs tracking-wide">
                      {row.channel}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.category ?? '—'}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {row.usage.toLocaleString('en-US')}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-2">
                      <Switch
                        checked={row.isActive}
                        disabled={pending}
                        onCheckedChange={(next) => submitActive(row, next)}
                        aria-label={`${row.name} active`}
                      />
                      <span className={cn('text-xs', row.isActive ? 'text-foreground' : 'text-muted-foreground')}>
                        {row.isActive ? 'Active' : 'Off'}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1">
                      <Button variant="outline" size="sm" className="h-8" disabled={pending} onClick={() => openEdit(row)}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-destructive hover:text-destructive"
                        disabled={pending || row.usage > 0}
                        title={row.usage > 0 ? 'Referenced by a sequence. Detach it first.' : undefined}
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
            <DialogTitle>{editId == null ? 'New template' : 'Edit template'}</DialogTitle>
            <DialogDescription>
              Subject and body run the brand-voice check on save. A banned word or em-dash is rejected.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tpl-name">Name</Label>
                <Input id="tpl-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tpl-channel">Channel</Label>
                <Select
                  value={form.channel}
                  onValueChange={(v) => setForm((f) => ({ ...f, channel: v === 'sms' ? 'sms' : 'email' }))}
                >
                  <SelectTrigger id="tpl-channel">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.channel === 'email' ? (
              <div className="space-y-1.5">
                <Label htmlFor="tpl-subject">Subject</Label>
                <Input id="tpl-subject" value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} />
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="tpl-body">Body</Label>
              <Textarea
                id="tpl-body"
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                rows={8}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tpl-category">Category (optional)</Label>
              <Input id="tpl-category" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={submitForm} disabled={pending}>
              {editId == null ? 'Create template' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={!!deleteRow} onOpenChange={(o) => !pending && !o && setDeleteRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleteRow?.name}</DialogTitle>
            <DialogDescription>This cannot be undone. The template is removed for good.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteRow(null)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={submitDelete} disabled={pending}>
              Delete template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
