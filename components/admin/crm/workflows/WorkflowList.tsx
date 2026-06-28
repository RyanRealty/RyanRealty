'use client'

/**
 * WorkflowList — the workflow (sequence) authoring list island (Wave 6).
 *
 * Renders every workflow with its status + enrollment analytics, a "New workflow"
 * button, and per-row lifecycle controls: open builder, duplicate, activate/pause,
 * archive, delete. Delete is REFUSED by the server when a workflow has live
 * enrollments or is an auto-enroll master — the refusal reason is surfaced inline
 * (the UI also pre-disables delete on the auto-enroll masters as an early signal).
 *
 * Actions are passed in (the page wires the server actions) so this island stays
 * a pure presentation + transition shell. Every action returns the standard
 * { ok } | { ok:false, error } result.
 *
 * Design-system only: Table, Button, Badge, Dialog, Input, Textarea, Switch,
 * Alert, cn. No raw HTML controls, no arbitrary Tailwind.
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { MoreVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { sequenceStatusMeta } from './step-display'

export type WorkflowRow = {
  id: number
  name: string
  status: string
  stepCount: number
  /** True when this is an auto-enroll master (fub_legacy_plan_id set) — never deletable. */
  isAutoEnrollMaster: boolean
  enrolled: number
  active: number
  completed: number
  stopped: number
  awaitingBroker: number
}

type ActionResult = { ok: true; id?: number } | { ok: false; error: string }

export type WorkflowListActions = {
  create: (input: { name: string; description?: string | null; stopOnReply: boolean }) => Promise<ActionResult>
  duplicate: (id: number) => Promise<ActionResult>
  setStatus: (id: number, status: 'active' | 'paused') => Promise<ActionResult>
  archive: (id: number) => Promise<ActionResult>
  remove: (id: number) => Promise<ActionResult>
}

function StatusBadge({ status }: { status: string }) {
  const meta = sequenceStatusMeta(status)
  const variant = meta.tone === 'active' ? 'default' : meta.tone === 'archived' ? 'outline' : 'secondary'
  return <Badge variant={variant}>{meta.label}</Badge>
}

export function WorkflowList({
  rows,
  analyticsUnreadable,
  actions,
}: {
  rows: WorkflowRow[]
  analyticsUnreadable: boolean
  actions: WorkflowListActions
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', stopOnReply: true })
  const [deleteRow, setDeleteRow] = useState<WorkflowRow | null>(null)

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

  function submitCreate() {
    const name = form.name.trim()
    if (!name) {
      setNote({ tone: 'err', text: 'A workflow name is required' })
      return
    }
    run(
      () => actions.create({ name, description: form.description.trim() || null, stopOnReply: form.stopOnReply }),
      'Workflow created. Build its steps next.',
      (r) => {
        setCreateOpen(false)
        setForm({ name: '', description: '', stopOnReply: true })
        if (r.ok && r.id) router.push(`/admin/crm/sequences/${r.id}/edit`)
      },
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {rows.length} {rows.length === 1 ? 'workflow' : 'workflows'}
        </p>
        <Button
          size="sm"
          onClick={() => {
            setForm({ name: '', description: '', stopOnReply: true })
            setNote(null)
            setCreateOpen(true)
          }}
          disabled={pending}
        >
          New workflow
        </Button>
      </div>

      {note ? (
        <Alert variant={note.tone === 'err' ? 'destructive' : 'default'}>
          <AlertDescription className="whitespace-pre-wrap">{note.text}</AlertDescription>
        </Alert>
      ) : null}

      {analyticsUnreadable ? (
        <Alert variant="destructive">
          <AlertDescription>
            Enrollment analytics could not be read right now. Counts below show as zero but may be inaccurate.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="rounded-xl border border-border bg-card overflow-x-auto no-scrollbar">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-1/4">Workflow</TableHead>
              <TableHead className="w-1/6">Status</TableHead>
              <TableHead className="hidden text-right tabular-nums md:table-cell">Steps</TableHead>
              <TableHead className="hidden text-right tabular-nums md:table-cell">Enrolled</TableHead>
              <TableHead className="hidden text-right tabular-nums md:table-cell">Active</TableHead>
              <TableHead className="hidden text-right tabular-nums md:table-cell">Waiting</TableHead>
              <TableHead className="hidden text-right tabular-nums md:table-cell">Done</TableHead>
              <TableHead className="text-right">Manage</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                  No workflows yet. Create the first one above.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const isActive = row.status === 'active'
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium text-foreground">
                      <Button
                        type="button"
                        variant="link"
                        className="block h-auto max-w-[32vw] truncate p-0 text-left font-medium md:max-w-none"
                        title={row.name}
                        onClick={() => router.push(`/admin/crm/sequences/${row.id}/edit`)}
                      >
                        {row.name}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} />
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums text-muted-foreground md:table-cell">{row.stepCount}</TableCell>
                    <TableCell className="hidden text-right tabular-nums text-foreground md:table-cell">{row.enrolled}</TableCell>
                    <TableCell className="hidden text-right tabular-nums text-foreground md:table-cell">{row.active}</TableCell>
                    <TableCell className="hidden text-right tabular-nums text-foreground md:table-cell">{row.awaitingBroker}</TableCell>
                    <TableCell className="hidden text-right tabular-nums text-muted-foreground md:table-cell">{row.completed}</TableCell>
                    <TableCell className="text-right">
                      {/* Mobile: a single overflow menu — the inline button row
                          doesn't fit a phone, so it gets clipped off-screen. */}
                      <div className="flex justify-end md:hidden">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={pending} aria-label={`Manage ${row.name}`}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => router.push(`/admin/crm/sequences/${row.id}/edit`)}>
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={row.status === 'archived'}
                              onSelect={() => run(() => actions.setStatus(row.id, isActive ? 'paused' : 'active'), isActive ? 'Workflow paused' : 'Workflow activated')}
                            >
                              {isActive ? 'Pause' : 'Activate'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => run(() => actions.duplicate(row.id), 'Workflow duplicated')}>
                              Duplicate
                            </DropdownMenuItem>
                            {row.status === 'archived' ? null : (
                              <DropdownMenuItem onSelect={() => run(() => actions.archive(row.id), 'Workflow archived')}>
                                Archive
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              disabled={row.isAutoEnrollMaster}
                              className="text-destructive focus:text-destructive"
                              onSelect={() => { setDeleteRow(row); setNote(null) }}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      {/* Desktop: the full inline button row. */}
                      <div className="hidden md:flex md:flex-wrap md:items-center md:justify-end md:gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8"
                          disabled={pending}
                          onClick={() => router.push(`/admin/crm/sequences/${row.id}/edit`)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8"
                          disabled={pending || row.status === 'archived'}
                          onClick={() => run(() => actions.setStatus(row.id, isActive ? 'paused' : 'active'), isActive ? 'Workflow paused' : 'Workflow activated')}
                        >
                          {isActive ? 'Pause' : 'Activate'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8"
                          disabled={pending}
                          onClick={() => run(() => actions.duplicate(row.id), 'Workflow duplicated')}
                        >
                          Duplicate
                        </Button>
                        {row.status === 'archived' ? null : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8"
                            disabled={pending}
                            onClick={() => run(() => actions.archive(row.id), 'Workflow archived')}
                          >
                            Archive
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-destructive hover:text-destructive"
                          disabled={pending || row.isAutoEnrollMaster}
                          title={
                            row.isAutoEnrollMaster
                              ? 'Auto-enroll workflow. Archive it instead of deleting.'
                              : undefined
                          }
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
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => !pending && setCreateOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New workflow</DialogTitle>
            <DialogDescription>
              A workflow starts paused. Add steps, then activate it when you are ready for it to run.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="wf-name">Name</Label>
              <Input
                id="wf-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wf-desc">Description (optional)</Label>
              <Textarea
                id="wf-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <div className="min-w-0">
                <Label htmlFor="wf-stop" className="text-sm font-medium">
                  Stop on reply
                </Label>
                <p className="text-xs text-muted-foreground">Pause a person the moment they reply.</p>
              </div>
              <Switch
                id="wf-stop"
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
              Create workflow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={!!deleteRow} onOpenChange={(o) => !pending && !o && setDeleteRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleteRow?.name}</DialogTitle>
            <DialogDescription>
              This removes the workflow for good. It is refused if anyone is still enrolled. Archive instead to keep
              the history.
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
                run(() => actions.remove(deleteRow.id), 'Workflow deleted', () => setDeleteRow(null))
              }}
            >
              Delete workflow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
