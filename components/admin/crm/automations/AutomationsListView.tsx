'use client'

/**
 * AutomationsListView — the §12.2 Automations list (FUB /2/automations/v2),
 * re-skinned to Ryan Realty tokens.
 *
 * Spec: docs/fub-crm-spec/12-action-plans-and-automations.md §12.2 + the
 * pixel reference docs/fub-crm-spec/screens/screen-34.md:
 *   - Header: "Automations" + search + Create Folder (outline) +
 *     Create Automation (primary → name dialog → routes to the visual editor).
 *   - Folder section: "{N} Folder(s)" label + folder cards ("My Automations /
 *     N Automations"); clicking a card filters the table; user folders get
 *     rename/delete; the system folder has no controls (§12.5.3 pattern).
 *   - "{N} Automations" heading + the 10-column table: Name (link + hover
 *     tooltip), Linked Automations ("Using: N ▾" pill dropdown), Steps,
 *     Started, Engaged ⓘ ("N+ P%"), Completed, Created By (avatar + name),
 *     Status (optimistic toggle), Created On ↕ (sortable, default desc),
 *     Actions (Edit / Duplicate / Move to Folder / Archive / Delete).
 *
 * Working behaviors preserved from the previous list: plan-type badges on the
 * four auto-enroll masters, guarded delete (server refuses live enrollments /
 * masters), archive, the create dialog (name + description + stop-on-reply).
 *
 * Design-system only: Table, Button, Badge, Dialog, Input, Textarea, Switch,
 * Select, Avatar, Tooltip, DropdownMenu, Alert.
 */

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
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
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import { ArrowUpDown, ChevronDown, Folder, Info, MoreHorizontal, Search } from 'lucide-react'

export type WorkflowPlanType = 'buyer' | 'seller' | 'expired' | 'fsbo' | null

export type AutomationFolderItem = {
  id: number
  name: string
  isSystem: boolean
  memberCount: number
}

export type AutomationListRow = {
  id: number
  name: string
  status: string
  stepCount: number
  planType: WorkflowPlanType
  isAutoEnrollMaster: boolean
  /** Other automations that reference this one via Run Automation (§12.2.3 col 2). */
  usedBy: Array<{ id: number; name: string }>
  /** Total contacts ever enrolled (§12.2.3 "Started"). */
  started: number
  /** Contacts with an email open/reply on this automation; null = unreadable (§0). */
  engaged: number | null
  completed: number
  createdByName: string
  createdByAvatarUrl: string | null
  /** Pre-formatted server-side (hydration-safe) M/D/YYYY per shot-34. */
  createdOnLabel: string
  createdAtMs: number
  folderId: number | null
}

type ActionResult = { ok: true; id?: number } | { ok: false; error: string }

export type AutomationsListActions = {
  create: (input: { name: string; description?: string | null; stopOnReply: boolean }) => Promise<ActionResult>
  duplicate: (id: number) => Promise<ActionResult>
  setStatus: (id: number, status: 'active' | 'paused') => Promise<ActionResult>
  archive: (id: number) => Promise<ActionResult>
  remove: (id: number) => Promise<ActionResult>
  createFolder: (name: string) => Promise<ActionResult>
  renameFolder: (id: number, name: string) => Promise<ActionResult>
  deleteFolder: (id: number) => Promise<ActionResult>
  moveToFolder: (sequenceId: number, folderId: number | null) => Promise<ActionResult>
}

/** §12.2.3 Engaged format: null → em-dash placeholder, 0 → "0%", else "N+ P%". */
export function engagedLabel(engaged: number | null, started: number): string {
  if (engaged == null) return '—'
  if (engaged === 0) return '0%'
  const pct = started > 0 ? Math.round((engaged / started) * 100) : 0
  return `${engaged}+ ${pct}%`
}

const PLAN_BADGES: Record<Exclude<WorkflowPlanType, null>, string> = {
  buyer: 'Default buyer',
  seller: 'Default seller',
  expired: 'Default expired',
  fsbo: 'Default FSBO',
}

export function AutomationsListView({
  rows,
  folders,
  analyticsUnreadable,
  actions,
}: {
  rows: AutomationListRow[]
  folders: AutomationFolderItem[]
  analyticsUnreadable: boolean
  actions: AutomationsListActions
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  const [search, setSearch] = useState('')
  const [activeFolder, setActiveFolder] = useState<number | null>(null)
  const [sortDesc, setSortDesc] = useState(true)
  /** Optimistic status overrides (§12.2.3 col 8 — flip immediately, revert on error). */
  const [statusOverride, setStatusOverride] = useState<Record<number, string>>({})

  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', stopOnReply: true })
  const [folderDialog, setFolderDialog] = useState<{ mode: 'create' } | { mode: 'rename'; id: number } | null>(null)
  const [folderName, setFolderName] = useState('')
  const [moveRow, setMoveRow] = useState<AutomationListRow | null>(null)
  const [moveTarget, setMoveTarget] = useState<string>('none')
  const [deleteRow, setDeleteRow] = useState<AutomationListRow | null>(null)

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = rows.filter((r) => {
      if (activeFolder != null && r.folderId !== activeFolder) return false
      if (q && !r.name.toLowerCase().includes(q)) return false
      return true
    })
    return [...filtered].sort((a, b) => (sortDesc ? b.createdAtMs - a.createdAtMs : a.createdAtMs - b.createdAtMs))
  }, [rows, search, activeFolder, sortDesc])

  function run(action: () => Promise<ActionResult>, okText: string, onOk?: (r: ActionResult) => void) {
    setNote(null)
    startTransition(async () => {
      const r = await action()
      if (r.ok) {
        setNote({ tone: 'ok', text: okText })
        onOk?.(r)
        router.refresh()
      } else {
        setNote({ tone: 'err', text: r.error })
      }
    })
  }

  function toggleStatus(row: AutomationListRow, next: boolean) {
    const target = next ? 'active' : 'paused'
    // Optimistic flip; revert on API error (§12.2.3 col 8).
    setStatusOverride((m) => ({ ...m, [row.id]: target }))
    setNote(null)
    startTransition(async () => {
      const r = await actions.setStatus(row.id, target)
      if (!r.ok) {
        setStatusOverride((m) => ({ ...m, [row.id]: row.status }))
        setNote({ tone: 'err', text: r.error })
      } else {
        router.refresh()
      }
    })
  }

  function submitCreate() {
    const name = form.name.trim()
    if (!name) {
      setNote({ tone: 'err', text: 'An automation name is required' })
      return
    }
    run(
      () => actions.create({ name, description: form.description.trim() || null, stopOnReply: form.stopOnReply }),
      'Automation created. Build its steps next.',
      (r) => {
        setCreateOpen(false)
        setForm({ name: '', description: '', stopOnReply: true })
        if (r.ok && r.id) router.push(`/admin/crm/sequences/${r.id}/edit`)
      },
    )
  }

  function submitFolder() {
    const name = folderName.trim()
    if (!name || !folderDialog) return
    if (folderDialog.mode === 'create') {
      run(() => actions.createFolder(name), 'Folder created', () => setFolderDialog(null))
    } else {
      run(() => actions.renameFolder(folderDialog.id, name), 'Folder renamed', () => setFolderDialog(null))
    }
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-5">
        {/* ── Header row (§12.2.1): title · search · Create Folder · Create Automation ── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-foreground">Automations</h1>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="h-9 w-56 rounded-full pl-8"
                aria-label="Search automations"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              disabled={pending}
              onClick={() => {
                setFolderName('')
                setFolderDialog({ mode: 'create' })
              }}
            >
              Create Folder
            </Button>
            <Button
              size="sm"
              className="h-9"
              disabled={pending}
              onClick={() => {
                setForm({ name: '', description: '', stopOnReply: true })
                setNote(null)
                setCreateOpen(true)
              }}
            >
              + Create Automation
            </Button>
          </div>
        </div>

        {note ? (
          <Alert variant={note.tone === 'err' ? 'destructive' : 'default'}>
            <AlertDescription className="whitespace-pre-wrap">{note.text}</AlertDescription>
          </Alert>
        ) : null}

        {analyticsUnreadable ? (
          <Alert variant="destructive">
            <AlertDescription>
              Enrollment analytics could not be read right now. Started / Engaged / Completed may be inaccurate.
            </AlertDescription>
          </Alert>
        ) : null}

        {/* ── Folder section (§12.2.2 / shot-34) ── */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            {folders.length} {folders.length === 1 ? 'Folder' : 'Folders'}
          </p>
          <div className="flex flex-wrap gap-2">
            {folders.map((f) => {
              const active = activeFolder === f.id
              return (
                <div
                  key={f.id}
                  className={cn(
                    'flex items-center gap-2 rounded-xl border bg-card px-3 py-2 shadow-sm transition-colors',
                    active ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-primary/40',
                  )}
                >
                  <button
                    type="button"
                    className="flex items-center gap-2 text-left"
                    onClick={() => setActiveFolder(active ? null : f.id)}
                    aria-pressed={active}
                  >
                    <Folder className="h-5 w-5 text-warning" aria-hidden />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">{f.name}</span>
                      <span className="block text-xs tabular-nums text-muted-foreground">
                        {f.memberCount} {f.memberCount === 1 ? 'Automation' : 'Automations'}
                      </span>
                    </span>
                  </button>
                  {!f.isSystem ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6" aria-label={`Manage folder ${f.name}`}>
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() => {
                            setFolderName(f.name)
                            setFolderDialog({ mode: 'rename', id: f.id })
                          }}
                        >
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={() => run(() => actions.deleteFolder(f.id), 'Folder deleted', () => setActiveFolder(null))}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Automations table (§12.2.3) ── */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            {visible.length} {visible.length === 1 ? 'Automation' : 'Automations'}
          </p>
          <div className="overflow-x-auto rounded-xl border border-border bg-card no-scrollbar">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-56">Name</TableHead>
                  <TableHead>Linked Automations</TableHead>
                  <TableHead className="text-right">Steps</TableHead>
                  <TableHead className="text-right">Started</TableHead>
                  <TableHead className="text-right">
                    <span className="inline-flex items-center gap-1">
                      Engaged
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3.5 w-3.5 text-muted-foreground" aria-label="What counts as engaged" />
                        </TooltipTrigger>
                        <TooltipContent>Contacts who opened or replied to an email from this automation.</TooltipContent>
                      </Tooltip>
                    </span>
                  </TableHead>
                  <TableHead className="text-right">Completed</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-foreground"
                      onClick={() => setSortDesc((v) => !v)}
                      aria-label={`Sort by created on, currently ${sortDesc ? 'newest first' : 'oldest first'}`}
                    >
                      Created On
                      <ArrowUpDown className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="py-8 text-center text-sm text-muted-foreground">
                      No automations{search ? ' match this search' : activeFolder != null ? ' in this folder' : ' yet. Create the first one above'}.
                    </TableCell>
                  </TableRow>
                ) : (
                  visible.map((row) => {
                    const status = statusOverride[row.id] ?? row.status
                    const isActive = status === 'active'
                    const isArchived = status === 'archived'
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium text-foreground">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Button
                              type="button"
                              variant="link"
                              className="block h-auto max-w-72 truncate p-0 text-left font-medium"
                              title={row.name}
                              onClick={() => router.push(`/admin/crm/sequences/${row.id}/edit`)}
                            >
                              {row.name}
                            </Button>
                            {row.planType ? (
                              <Badge variant="secondary" className="shrink-0 text-xs">
                                {PLAN_BADGES[row.planType]}
                              </Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          {row.usedBy.length > 0 ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="h-6 rounded-full px-2.5 text-xs"
                                  aria-label={`Used by ${row.usedBy.length} automations`}
                                >
                                  Using: {row.usedBy.length}
                                  <ChevronDown className="ml-1 h-3 w-3" aria-hidden />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start">
                                <DropdownMenuLabel>Referenced by</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {row.usedBy.map((u) => (
                                  <DropdownMenuItem key={u.id} onSelect={() => router.push(`/admin/crm/sequences/${u.id}/edit`)}>
                                    {u.name}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            <span className="text-sm text-muted-foreground">None</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{row.stepCount}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.started > 0 ? (
                            <Button
                              type="button"
                              variant="link"
                              className="h-auto p-0 tabular-nums"
                              onClick={() => router.push('/admin/crm/workflows')}
                              title="Open the enrollment board"
                            >
                              {row.started}
                            </Button>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-foreground">
                          {engagedLabel(row.engaged, row.started)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.completed > 0 ? (
                            <Button
                              type="button"
                              variant="link"
                              className="h-auto p-0 tabular-nums"
                              onClick={() => router.push('/admin/crm/workflows')}
                              title="Open the enrollment board"
                            >
                              {row.completed}
                            </Button>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              {row.createdByAvatarUrl ? <AvatarImage src={row.createdByAvatarUrl} alt="" /> : null}
                              <AvatarFallback className="text-xs">
                                {row.createdByName
                                  .split(' ')
                                  .map((p) => p[0])
                                  .join('')
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="max-w-28 truncate text-sm text-foreground" title={row.createdByName}>
                              {row.createdByName}
                            </span>
                          </span>
                        </TableCell>
                        <TableCell>
                          {isArchived ? (
                            <Badge variant="outline">Archived</Badge>
                          ) : (
                            <Switch
                              checked={isActive}
                              disabled={pending}
                              onCheckedChange={(v) => toggleStatus(row, v)}
                              aria-label={`${row.name} is ${isActive ? 'enabled' : 'disabled'}`}
                            />
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">{row.createdOnLabel}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" disabled={pending} aria-label={`Actions for ${row.name}`}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => router.push(`/admin/crm/sequences/${row.id}/edit`)}>Edit</DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => run(() => actions.duplicate(row.id), 'Automation duplicated')}>
                                Duplicate
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => {
                                  setMoveRow(row)
                                  setMoveTarget(row.folderId != null ? String(row.folderId) : 'none')
                                }}
                              >
                                Move to Folder
                              </DropdownMenuItem>
                              {isArchived ? null : (
                                <DropdownMenuItem onSelect={() => run(() => actions.archive(row.id), 'Automation archived')}>
                                  Archive
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                disabled={row.isAutoEnrollMaster}
                                className="text-destructive focus:text-destructive"
                                onSelect={() => {
                                  setDeleteRow(row)
                                  setNote(null)
                                }}
                              >
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Create automation dialog (name → route to the visual editor, §12.2.1) */}
        <Dialog open={createOpen} onOpenChange={(o) => !pending && setCreateOpen(o)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New automation</DialogTitle>
              <DialogDescription>
                An automation starts disabled. Build its steps in the visual editor, then enable it.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="au-name">Name</Label>
                <Input id="au-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="au-desc">Description (optional)</Label>
                <Textarea
                  id="au-desc"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <div className="min-w-0">
                  <Label htmlFor="au-stop" className="text-sm font-medium">
                    Stop on reply
                  </Label>
                  <p className="text-xs text-muted-foreground">Pause a person the moment they reply.</p>
                </div>
                <Switch
                  id="au-stop"
                  checked={form.stopOnReply}
                  disabled={pending}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, stopOnReply: v }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button onClick={submitCreate} disabled={pending}>
                Create automation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create / rename folder dialog */}
        <Dialog open={!!folderDialog} onOpenChange={(o) => !pending && !o && setFolderDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{folderDialog?.mode === 'rename' ? 'Rename folder' : 'Create folder'}</DialogTitle>
              <DialogDescription>Folders group automations on this page.</DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="fold-name">Folder name</Label>
              <Input id="fold-name" value={folderName} onChange={(e) => setFolderName(e.target.value)} autoFocus />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setFolderDialog(null)} disabled={pending}>
                Cancel
              </Button>
              <Button onClick={submitFolder} disabled={pending || !folderName.trim()}>
                {folderDialog?.mode === 'rename' ? 'Rename' : 'Create folder'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Move to Folder dialog (§12.2.3 row action) */}
        <Dialog open={!!moveRow} onOpenChange={(o) => !pending && !o && setMoveRow(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Move {moveRow?.name}</DialogTitle>
              <DialogDescription>Pick the folder this automation lives in.</DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="move-folder">Folder</Label>
              <Select value={moveTarget} onValueChange={setMoveTarget}>
                <SelectTrigger id="move-folder">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No folder</SelectItem>
                  {folders.map((f) => (
                    <SelectItem key={f.id} value={String(f.id)}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMoveRow(null)} disabled={pending}>
                Cancel
              </Button>
              <Button
                disabled={pending}
                onClick={() => {
                  if (!moveRow) return
                  const folderId = moveTarget === 'none' ? null : Number(moveTarget)
                  run(() => actions.moveToFolder(moveRow.id, folderId), 'Automation moved', () => setMoveRow(null))
                }}
              >
                Move
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete dialog (guarded server-side: masters + live enrollments refuse) */}
        <Dialog open={!!deleteRow} onOpenChange={(o) => !pending && !o && setDeleteRow(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete {deleteRow?.name}</DialogTitle>
              <DialogDescription>
                This removes the automation for good. It is refused if anyone is still enrolled. Archive instead to
                keep the history.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteRow(null)} disabled={pending}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={pending}
                onClick={() => {
                  if (!deleteRow) return
                  run(() => actions.remove(deleteRow.id), 'Automation deleted', () => setDeleteRow(null))
                }}
              >
                Delete automation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
