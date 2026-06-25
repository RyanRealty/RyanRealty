'use client'

/**
 * ConfigTableEditor — the reusable CRM config-table editor island (Wave 2).
 *
 * One client surface that drives any config table shaped like crm_stages
 * (key / label / position / is_active / is_protected): stages, newsletter
 * segments, market-report areas, and (with the tag-specific delete mode) tags.
 * It renders a design-system <Table> of the rows plus add / rename / reorder /
 * activate / delete dialogs wired to the server actions passed in by the parent
 * server page. The actions ARE the guard + audit surface; this island only
 * renders state and dispatches.
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
 * Design-system only: Table, Dialog, Button, Input, Label, Select, Switch,
 * Badge, Alert + tokens. No raw HTML controls, no hex.
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
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import { moveInList, capitalizeNoun as cap } from '@/components/admin/crm/settings/config-editor-helpers'

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
  const reassignTargets = deleteRow
    ? rows.filter((r) => r.id !== deleteRow.id)
    : []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {rows.length} {rows.length === 1 ? noun : `${noun}s`}
        </p>
        <Button size="sm" onClick={() => setAddOpen(true)} disabled={pending}>
          Add {noun}
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
              <TableHead className="w-1/4">Key</TableHead>
              {usageVisible ? <TableHead className="w-1/6 text-right tabular-nums">In use</TableHead> : null}
              <TableHead className="w-1/6">Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={usageVisible ? 5 : 4} className="py-8 text-center text-sm text-muted-foreground">
                  No {noun}s yet. Add the first one above.
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
                          Protected
                        </Badge>
                      ) : null}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{row.key}</TableCell>
                  {usageVisible ? (
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {typeof row.usageCount === 'number' ? row.usageCount.toLocaleString('en-US') : '—'}
                    </TableCell>
                  ) : null}
                  <TableCell>
                    <span className="inline-flex items-center gap-2">
                      <Switch
                        checked={row.isActive}
                        disabled={pending}
                        onCheckedChange={(next) => submitActive(row, next)}
                        aria-label={`${row.label} active`}
                      />
                      <span className={cn('text-xs', row.isActive ? 'text-foreground' : 'text-muted-foreground')}>
                        {row.isActive ? 'Active' : 'Off'}
                      </span>
                    </span>
                  </TableCell>
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
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        disabled={pending}
                        onClick={() => {
                          setRenameRow(row)
                          setRenameLabel(row.label)
                          setNote(null)
                        }}
                      >
                        Rename
                      </Button>
                      {row.isProtected ? null : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-destructive hover:text-destructive"
                          disabled={pending}
                          onClick={() => {
                            setDeleteRow(row)
                            setReassignTo('')
                            setStripCarriers(false)
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

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={(o) => !pending && setAddOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add {noun}</DialogTitle>
            <DialogDescription>
              Give it a label. {allowKeyInput ? 'The key defaults to the label unless you set one.' : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cfg-add-label">Label</Label>
              <Input
                id="cfg-add-label"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder={`New ${noun}`}
                autoFocus
              />
            </div>
            {allowKeyInput ? (
              <div className="space-y-1.5">
                <Label htmlFor="cfg-add-key">Key (optional)</Label>
                <Input
                  id="cfg-add-key"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="Defaults to the label"
                  className="font-mono text-xs"
                />
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={submitAdd} disabled={pending}>
              Add {noun}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={!!renameRow} onOpenChange={(o) => !pending && !o && setRenameRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename {noun}</DialogTitle>
            <DialogDescription>
              The key stays the same. Only the display label changes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="cfg-rename-label">Label</Label>
            <Input
              id="cfg-rename-label"
              value={renameLabel}
              onChange={(e) => setRenameLabel(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameRow(null)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={submitRename} disabled={pending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={!!deleteRow} onOpenChange={(o) => !pending && !o && setDeleteRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleteRow?.label}</DialogTitle>
            <DialogDescription>
              {deleteMode === 'reassign'
                ? `Pick a ${noun} to move every affected ${dependentNoun} to. This cannot be undone.`
                : deleteMode === 'scrub'
                  ? `This removes the ${noun} from every ${dependentNoun} that references it, then deletes it. This cannot be undone.`
                  : `Delete this ${noun} from the list. Optionally strip it off every ${dependentNoun} that carries it.`}
            </DialogDescription>
          </DialogHeader>

          {deleteMode === 'reassign' ? (
            <div className="space-y-1.5">
              <Label>Move {dependentNoun} to</Label>
              <Select value={reassignTo} onValueChange={setReassignTo}>
                <SelectTrigger>
                  <SelectValue placeholder={`Choose a ${noun}`} />
                </SelectTrigger>
                <SelectContent>
                  {reassignTargets.map((t) => (
                    <SelectItem key={t.id} value={t.key}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {deleteMode === 'strip' ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Strip from every {dependentNoun}</p>
                <p className="text-xs text-muted-foreground">
                  {deleteRow?.usageCount
                    ? `${deleteRow.usageCount.toLocaleString('en-US')} ${dependentNoun} carry this ${noun}.`
                    : `No ${dependentNoun} carry this ${noun}.`}
                </p>
              </div>
              <Switch
                checked={stripCarriers}
                onCheckedChange={setStripCarriers}
                disabled={pending}
                aria-label={`Strip ${deleteRow?.label} from every ${dependentNoun}`}
              />
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteRow(null)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={submitDelete} disabled={pending}>
              Delete {noun}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
