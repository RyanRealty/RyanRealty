'use client'

/**
 * TemplateEditor (§13 delivery) — email + SMS template CRUD island.
 *
 * Features added over the Wave 2 baseline:
 *   1. Folder sidebar — left panel lists unique categories. Clicking a folder
 *      filters the main table to templates in that folder. "All templates"
 *      reverts to the full accordion view. "+ New folder" lets brokers name
 *      a folder before creating their first template in it.
 *
 *   2. Merge-field inserter — expanded token palette (Contact / Agent / Sender /
 *      Company / Lender / Property / Lead source / CMA / Other). Clicking a chip
 *      inserts the token at the cursor in the body textarea. SMS hides the CMA
 *      group since those links are not clickable in text messages.
 *
 *   3. Share toggle — "Share with team" Switch in the editor form. When enabled
 *      (is_shared = true), the template is visible to all brokers, not just the
 *      owner. Legacy/seeded templates default to shared so existing workflows
 *      continue uninterrupted.
 *
 *   4. Test-send — "Send test to myself" button in the editor footer. Sends the
 *      current form body (pre-save, with sample merge data) to the broker's own
 *      email or cell phone via the same underlying send path used for real sends,
 *      so A2P + TCPA quiet-hours gates still apply.
 *
 * Design-system only. Navy/cream tokens throughout.
 */
import { useRef, useState, useTransition } from 'react'
import { FolderOpen, Pencil, Plus, Share2 } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { MergeFieldPicker, insertAtCursor } from '@/components/admin/crm/MergeFieldPicker'
import { TemplatePreviewPane } from '@/components/admin/crm/settings/TemplatePreviewPane'
import { cn } from '@/lib/utils'
import type { CrmTemplatePerf } from '@/lib/data/crm/getCrmTemplatesAdmin'
import type { SendTestInput } from '@/app/actions/crm-template-test'

export type TemplateRow = {
  id: number
  key: string
  channel: 'email' | 'sms'
  name: string
  subject: string | null
  body: string
  category: string | null
  isActive: boolean
  isShared: boolean
  ownerBroker: string | null
  usage: number
  perf?: CrmTemplatePerf | null
}

type ActionResult = { ok: true; id?: number; message?: string } | { ok: false; error: string }

type TemplateInput = {
  channel: string
  name: string
  subject?: string | null
  body: string
  category?: string | null
  isShared?: boolean
  ownerBroker?: string | null
}

export type TemplateEditorActions = {
  create: (input: TemplateInput) => Promise<ActionResult>
  update: (id: number, input: TemplateInput) => Promise<ActionResult>
  setActive: (id: number, isActive: boolean) => Promise<ActionResult>
  remove: (id: number) => Promise<ActionResult>
  renameCategory?: (oldName: string, newName: string) => Promise<ActionResult>
  testSend?: (input: SendTestInput) => Promise<ActionResult>
}

type FormState = {
  channel: 'email' | 'sms'
  name: string
  subject: string
  body: string
  category: string
  isShared: boolean
}

const EMPTY: FormState = {
  channel: 'email',
  name: '',
  subject: '',
  body: '',
  category: '',
  isShared: false,
}

/** Canonical category for display. Blank/null resolves to 'Uncategorized'. */
function catLabel(c: string | null | undefined): string {
  return (c ?? '').trim() || 'Uncategorized'
}

/** Format a perf percentage (0-100) or null for display. */
function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return `${n}%`
}

// ── TemplateTable — extracted to a stable top-level component so React hooks
// rules are satisfied (no component-inside-render). Props carry all the
// callbacks the parent manages.

type TemplateTableProps = {
  tableRows: TemplateRow[]
  hasPerf: boolean
  pending: boolean
  onEdit: (row: TemplateRow) => void
  onToggleActive: (row: TemplateRow, next: boolean) => void
  onDelete: (row: TemplateRow) => void
}

function TemplateTable({
  tableRows,
  hasPerf,
  pending,
  onEdit,
  onToggleActive,
  onDelete,
}: TemplateTableProps) {
  return (
    <div className="overflow-x-auto no-scrollbar">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-1/3">Name</TableHead>
            <TableHead className="hidden w-1/8 md:table-cell">Channel</TableHead>
            <TableHead className="hidden w-1/12 text-right tabular-nums md:table-cell">In use</TableHead>
            {hasPerf ? (
              <>
                <TableHead className="hidden w-1/12 text-right tabular-nums md:table-cell">Sends</TableHead>
                <TableHead className="hidden w-1/12 text-right tabular-nums md:table-cell">Open%</TableHead>
                <TableHead className="hidden w-1/12 text-right tabular-nums md:table-cell">Click%</TableHead>
              </>
            ) : null}
            <TableHead className="hidden w-20 md:table-cell">Shared</TableHead>
            <TableHead className="w-1/8">Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tableRows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium text-foreground">
                <button
                  type="button"
                  className="block max-w-[44vw] truncate text-left hover:underline disabled:no-underline md:max-w-none"
                  disabled={pending}
                  onClick={() => onEdit(row)}
                  title={row.name}
                >
                  {row.name}
                </button>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <Badge variant="outline" className="uppercase text-xs tracking-wide">
                  {row.channel}
                </Badge>
              </TableCell>
              <TableCell className="hidden text-right tabular-nums text-muted-foreground md:table-cell">
                {row.usage.toLocaleString('en-US')}
              </TableCell>
              {hasPerf ? (
                row.channel === 'email' ? (
                  <>
                    <TableCell className="hidden text-right tabular-nums text-muted-foreground md:table-cell">
                      {row.perf?.sent != null && row.perf.sent > 0
                        ? row.perf.sent.toLocaleString('en-US')
                        : '—'}
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums text-muted-foreground md:table-cell">
                      {fmtPct(row.perf?.openPct)}
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums text-muted-foreground md:table-cell">
                      {fmtPct(row.perf?.clickPct)}
                    </TableCell>
                  </>
                ) : (
                  <>
                    <TableCell className="hidden md:table-cell" />
                    <TableCell className="hidden md:table-cell" />
                    <TableCell className="hidden md:table-cell" />
                  </>
                )
              ) : null}
              <TableCell className="hidden md:table-cell">
                {row.isShared ? (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Share2 className="h-3 w-3" />
                    Team
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground/50">Private</span>
                )}
              </TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-2">
                  <Switch
                    checked={row.isActive}
                    disabled={pending}
                    onCheckedChange={(next) => onToggleActive(row, next)}
                    aria-label={`${row.name} active`}
                  />
                  <span
                    className={cn(
                      'hidden text-xs sm:inline',
                      row.isActive ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {row.isActive ? 'Active' : 'Off'}
                  </span>
                </span>
              </TableCell>
              <TableCell className="text-right">
                <div className="inline-flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="hidden h-8 md:inline-flex"
                    disabled={pending}
                    onClick={() => onEdit(row)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-destructive hover:text-destructive"
                    disabled={pending || row.usage > 0}
                    title={row.usage > 0 ? 'Referenced by a sequence. Detach it first.' : undefined}
                    onClick={() => onDelete(row)}
                  >
                    Delete
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function TemplateEditor({
  rows,
  actions,
}: {
  rows: TemplateRow[]
  actions: TemplateEditorActions
}) {
  const [pending, startTransition] = useTransition()
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  const [editId, setEditId] = useState<number | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [deleteRow, setDeleteRow] = useState<TemplateRow | null>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  // Folder sidebar state
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [pendingFolders, setPendingFolders] = useState<string[]>([])
  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  // Folder rename state
  const [renameCatOld, setRenameCatOld] = useState<string | null>(null)
  const [renameCatNew, setRenameCatNew] = useState('')

  // Test-send in-flight flag (separate from the form pending so the send
  // button can be disabled without disabling Save at the same time).
  const [testSending, setTestSending] = useState(false)

  // ── Derived data ──────────────────────────────────────────────────────────

  // Group rows by category for the accordion ("All") view.
  const grouped = new Map<string, TemplateRow[]>()
  for (const row of rows) {
    const cat = catLabel(row.category)
    if (!grouped.has(cat)) grouped.set(cat, [])
    grouped.get(cat)!.push(row)
  }

  // Ordered category list: named folders first (alpha), then Uncategorized.
  const dbCategories = [...grouped.keys()].sort((a, b) => {
    if (a === 'Uncategorized') return 1
    if (b === 'Uncategorized') return -1
    return a.localeCompare(b)
  })

  // Merge pending folders that do not already exist in the DB.
  const allFolders: string[] = [
    ...dbCategories.filter((c) => c !== 'Uncategorized'),
    ...pendingFolders.filter((f) => !dbCategories.includes(f)),
    ...(grouped.has('Uncategorized') ? ['Uncategorized'] : []),
  ]

  // Rows shown in the folder-scoped flat table.
  const filteredRows =
    selectedFolder === null ? rows : rows.filter((r) => catLabel(r.category) === selectedFolder)

  const hasPerf = rows.some((r) => r.channel === 'email')

  // ── Helpers ───────────────────────────────────────────────────────────────

  function run(
    action: () => Promise<ActionResult>,
    fallbackOk: string,
    onOk?: () => void,
  ) {
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
    // Pre-fill category with the currently selected folder.
    setForm({
      ...EMPTY,
      category: selectedFolder && selectedFolder !== 'Uncategorized' ? selectedFolder : '',
    })
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
      isShared: row.isShared,
    })
    setFormOpen(true)
    setNote(null)
  }

  function handleInsertToken(token: string) {
    const el = bodyRef.current
    if (!el) {
      setForm((f) => ({ ...f, body: f.body + token }))
      return
    }
    const next = insertAtCursor(el, token)
    setForm((f) => ({ ...f, body: next }))
    const pos = (el.selectionStart ?? 0) + token.length
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(pos, pos)
    })
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
      isShared: form.isShared,
    }
    const action =
      editId == null ? () => actions.create(input) : () => actions.update(editId, input)
    run(action, editId == null ? 'Template created' : 'Template saved', () => {
      setFormOpen(false)
      // If creating a template in a pending folder, promote it to the DB set.
      if (editId == null && form.category.trim()) {
        const cat = form.category.trim()
        setPendingFolders((prev) => prev.filter((f) => f !== cat))
      }
    })
  }

  function handleTestSend() {
    if (!actions.testSend) return
    const body = form.body.trim()
    if (!body) {
      setNote({ tone: 'err', text: 'Template body is empty. Nothing to send.' })
      return
    }
    setNote(null)
    setTestSending(true)
    actions
      .testSend({ channel: form.channel, subject: form.subject || null, body })
      .then((r) => {
        if (r.ok) {
          setNote({ tone: 'ok', text: r.message ?? 'Test sent' })
        } else {
          setNote({ tone: 'err', text: r.error })
        }
      })
      .finally(() => setTestSending(false))
  }

  function submitActive(row: TemplateRow, next: boolean) {
    run(
      () => actions.setActive(row.id, next),
      next ? 'Template enabled' : 'Template disabled',
    )
  }

  function submitDelete() {
    if (!deleteRow) return
    run(() => actions.remove(deleteRow.id), 'Template deleted', () => setDeleteRow(null))
  }

  function submitRenameCategory() {
    if (!renameCatOld || !actions.renameCategory) return
    const next = renameCatNew.trim()
    run(
      () => actions.renameCategory!(renameCatOld, next),
      next ? `Folder renamed to "${next}"` : 'Templates moved to Uncategorized',
      () => {
        // Keep sidebar selection consistent with the rename.
        if (selectedFolder === renameCatOld) setSelectedFolder(next || null)
        setRenameCatOld(null)
        setRenameCatNew('')
      },
    )
  }

  function confirmNewFolder() {
    const name = newFolderName.trim()
    if (!name) return
    if (!allFolders.includes(name)) {
      setPendingFolders((prev) => [...prev, name])
    }
    setSelectedFolder(name)
    setNewFolderOpen(false)
    setNewFolderName('')
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex gap-6">
      {/* ── Folder sidebar ──────────────────────────────────────────────── */}
      <aside className="hidden w-48 shrink-0 md:block">
        <nav className="space-y-0.5">
          {/* "All templates" entry */}
          <button
            type="button"
            onClick={() => setSelectedFolder(null)}
            className={cn(
              'group flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors',
              selectedFolder === null
                ? 'bg-primary text-primary-foreground font-medium'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            <span className="flex items-center gap-2">
              <FolderOpen className="h-3.5 w-3.5" />
              All templates
            </span>
            <Badge
              variant={selectedFolder === null ? 'secondary' : 'outline'}
              className="tabular-nums text-xs"
            >
              {rows.length}
            </Badge>
          </button>

          {allFolders.length > 0 && (
            <div className="pt-1 pb-0.5">
              <Separator className="mb-2" />
              {allFolders.map((folder) => {
                const count = grouped.get(folder)?.length ?? 0
                const isUncategorized = folder === 'Uncategorized'
                return (
                  <div key={folder} className="group relative flex items-center">
                    <button
                      type="button"
                      onClick={() => setSelectedFolder(folder)}
                      className={cn(
                        'flex flex-1 items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors',
                        selectedFolder === folder
                          ? 'bg-primary text-primary-foreground font-medium'
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                      )}
                    >
                      <span className="truncate">{folder}</span>
                      <Badge
                        variant={selectedFolder === folder ? 'secondary' : 'outline'}
                        className="tabular-nums text-xs ml-1 shrink-0"
                      >
                        {count}
                      </Badge>
                    </button>
                    {/* Rename pencil (not shown for Uncategorized) */}
                    {!isUncategorized && actions.renameCategory && count > 0 ? (
                      <button
                        type="button"
                        aria-label={`Rename folder ${folder}`}
                        className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground focus:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation()
                          setRenameCatOld(folder)
                          setRenameCatNew(folder)
                          setNote(null)
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}

          <Separator className="my-2" />
          <button
            type="button"
            onClick={() => {
              setNewFolderName('')
              setNewFolderOpen(true)
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            New folder
          </button>
        </nav>
      </aside>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {selectedFolder !== null ? (
              <>
                <span className="font-medium text-foreground">{selectedFolder}</span>
                {' · '}
              </>
            ) : null}
            {filteredRows.length}{' '}
            {filteredRows.length === 1 ? 'template' : 'templates'}
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

        {selectedFolder !== null ? (
          /* Single-folder flat table */
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {filteredRows.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No templates in this folder yet. Create the first one above.
              </p>
            ) : (
              <TemplateTable
                tableRows={filteredRows}
                hasPerf={hasPerf}
                pending={pending}
                onEdit={openEdit}
                onToggleActive={submitActive}
                onDelete={(row) => { setDeleteRow(row); setNote(null) }}
              />
            )}
          </div>
        ) : (
          /* All-templates accordion view */
          <>
            <Accordion type="multiple" defaultValue={dbCategories} className="space-y-2">
              {dbCategories.map((cat) => {
                const catRows = grouped.get(cat) ?? []
                return (
                  <AccordionItem
                    key={cat}
                    value={cat}
                    className="group rounded-xl border border-border bg-card overflow-hidden"
                  >
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        {cat}
                        <Badge variant="secondary" className="tabular-nums text-xs">
                          {catRows.length}
                        </Badge>
                        {actions.renameCategory && cat !== 'Uncategorized' ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label={`Rename folder ${cat}`}
                            className="ml-1 h-5 w-5 p-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 focus:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation()
                              setRenameCatOld(cat)
                              setRenameCatNew(cat)
                              setNote(null)
                            }}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        ) : null}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="p-0">
                      <TemplateTable
                        tableRows={catRows}
                        hasPerf={hasPerf}
                        pending={pending}
                        onEdit={openEdit}
                        onToggleActive={submitActive}
                        onDelete={(row) => { setDeleteRow(row); setNote(null) }}
                      />
                    </AccordionContent>
                  </AccordionItem>
                )
              })}
            </Accordion>

            {rows.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No templates yet. Create the first one above.
              </p>
            ) : null}
          </>
        )}
      </div>

      {/* ── New folder dialog ────────────────────────────────────────────── */}
      <Dialog
        open={newFolderOpen}
        onOpenChange={(o) => {
          if (!o) {
            setNewFolderOpen(false)
            setNewFolderName('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New folder</DialogTitle>
            <DialogDescription>
              Enter a name for the new folder. Templates you create while this
              folder is selected will be assigned to it automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="new-folder-input">Folder name</Label>
            <Input
              id="new-folder-input"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmNewFolder()
              }}
              placeholder="e.g. Buyer, Seller, Drip..."
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setNewFolderOpen(false)
                setNewFolderName('')
              }}
            >
              Cancel
            </Button>
            <Button onClick={confirmNewFolder} disabled={!newFolderName.trim()}>
              Create folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create / edit dialog ─────────────────────────────────────────── */}
      <Dialog open={formOpen} onOpenChange={(o) => !pending && setFormOpen(o)}>
        <DialogContent className="max-w-2xl overflow-y-auto" style={{ maxHeight: '90vh' }}>
          <DialogHeader>
            <DialogTitle>{editId == null ? 'New template' : 'Edit template'}</DialogTitle>
            <DialogDescription>
              Subject and body run the brand-voice check on save. A banned word or
              em-dash is rejected.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tpl-name">Name</Label>
                <Input
                  id="tpl-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tpl-channel">Channel</Label>
                <Select
                  value={form.channel}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, channel: v === 'sms' ? 'sms' : 'email' }))
                  }
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
                <Input
                  id="tpl-subject"
                  value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                />
              </div>
            ) : null}

            <Tabs defaultValue="edit">
              <TabsList className="h-8">
                <TabsTrigger value="edit" className="text-xs">
                  Edit body
                </TabsTrigger>
                <TabsTrigger value="preview" className="text-xs">
                  Preview
                </TabsTrigger>
              </TabsList>

              <TabsContent value="edit" className="space-y-2 mt-2">
                <MergeFieldPicker channel={form.channel} onInsert={handleInsertToken} />
                <Textarea
                  ref={bodyRef}
                  id="tpl-body"
                  value={form.body}
                  onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                  rows={8}
                  placeholder="Template body..."
                />
              </TabsContent>

              <TabsContent value="preview" className="mt-2">
                <TemplatePreviewPane
                  channel={form.channel}
                  subject={form.subject}
                  body={form.body}
                  signatureHtml={null}
                />
              </TabsContent>
            </Tabs>

            <div className="space-y-1.5">
              <Label htmlFor="tpl-category">Folder (optional)</Label>
              <Input
                id="tpl-category"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="e.g. Seller, Buyer, Drip..."
                list="tpl-category-options"
              />
              {/* Browser datalist for folder autocomplete */}
              <datalist id="tpl-category-options">
                {allFolders
                  .filter((f) => f !== 'Uncategorized')
                  .map((f) => (
                    <option key={f} value={f} />
                  ))}
              </datalist>
            </div>

            {/* Share toggle */}
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
              <Switch
                id="tpl-shared"
                checked={form.isShared}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isShared: v }))}
              />
              <div>
                <Label htmlFor="tpl-shared" className="cursor-pointer text-sm font-medium">
                  Share with team
                </Label>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {form.isShared
                    ? 'All brokers can see and use this template.'
                    : 'Only you can see and use this template.'}
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => setFormOpen(false)}
              disabled={pending || testSending}
            >
              Cancel
            </Button>
            {/* Test-send button — renders the current form body with sample data. */}
            {actions.testSend ? (
              <Button
                type="button"
                variant="outline"
                onClick={handleTestSend}
                disabled={pending || testSending || !form.body.trim()}
                title="Sends this template to your own email/phone with sample data"
              >
                {testSending ? 'Sending...' : 'Send test to myself'}
              </Button>
            ) : null}
            <Button onClick={submitForm} disabled={pending || testSending}>
              {editId == null ? 'Create template' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Folder rename dialog ─────────────────────────────────────────── */}
      <Dialog
        open={renameCatOld !== null}
        onOpenChange={(o) => {
          if (!o && !pending) {
            setRenameCatOld(null)
            setRenameCatNew('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename folder</DialogTitle>
            <DialogDescription>
              All templates in &ldquo;{renameCatOld}&rdquo; will move to the new
              folder name. Leave blank to move them to Uncategorized.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="rename-cat-input">New folder name</Label>
            <Input
              id="rename-cat-input"
              value={renameCatNew}
              onChange={(e) => setRenameCatNew(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitRenameCategory()
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRenameCatOld(null)
                setRenameCatNew('')
              }}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button onClick={submitRenameCategory} disabled={pending}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete dialog ────────────────────────────────────────────────── */}
      <Dialog
        open={!!deleteRow}
        onOpenChange={(o) => !pending && !o && setDeleteRow(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleteRow?.name}</DialogTitle>
            <DialogDescription>
              This cannot be undone. The template is removed for good.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteRow(null)}
              disabled={pending}
            >
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
