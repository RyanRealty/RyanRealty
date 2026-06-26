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
 * Design-system only. The server actions are the guard + the chunked rewrite;
 * this island renders state and dispatches.
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
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Pencil, Trash2, GripVertical } from 'lucide-react'
import { moveInList } from '@/components/admin/crm/settings/config-editor-helpers'

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

  return (
    <div className="space-y-4">
      {/* FUB-style header: count left, actions right */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">
          {rows.length.toLocaleString('en-US')}{' '}
          <span className="font-normal text-muted-foreground">
            {rows.length === 1 ? 'Tag' : 'Tags'}
          </span>
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setMergeOpen(true)} disabled={pending}>
            Merge tags
          </Button>
          <Button onClick={() => setAddOpen(true)} disabled={pending}>
            + Add tag
          </Button>
        </div>
      </div>

      {note ? (
        <Alert variant={note.tone === 'err' ? 'destructive' : 'default'}>
          <AlertDescription>{note.text}</AlertDescription>
        </Alert>
      ) : null}

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto no-scrollbar rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-8 px-2" />
              <TableHead>Name</TableHead>
              <TableHead className="w-28 text-right tabular-nums">Used</TableHead>
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="w-20 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                  No tags yet. Add the first one.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, idx) => (
                <TableRow key={row.id} className="group">
                  <TableCell className="w-8 px-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground opacity-0 group-hover:opacity-100 disabled:opacity-0 transition-opacity"
                      disabled={pending || idx === 0}
                      aria-label={`Move ${row.label} up`}
                      onClick={() => submitReorder(row.id, -1)}
                    >
                      <GripVertical className="h-4 w-4" />
                    </Button>
                  </TableCell>

                  <TableCell className="font-medium text-foreground">
                    <span className="inline-flex items-center gap-2">
                      {row.label}
                      {row.isProtected ? (
                        <Badge variant="outline" className="text-xs">
                          Compliance
                        </Badge>
                      ) : null}
                    </span>
                  </TableCell>

                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {row.usageCount.toLocaleString('en-US')}
                  </TableCell>

                  <TableCell>
                    <span className="inline-flex items-center gap-2">
                      <Switch
                        checked={row.isActive}
                        disabled={pending}
                        onCheckedChange={(next) => submitActive(row, next)}
                        aria-label={`${row.label} active`}
                      />
                      <span
                        className={cn(
                          'text-xs',
                          row.isActive ? 'text-foreground' : 'text-muted-foreground',
                        )}
                      >
                        {row.isActive ? 'Active' : 'Off'}
                      </span>
                    </span>
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1">
                      {row.isProtected ? (
                        <span className="w-16" />
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                            disabled={pending}
                            aria-label={`Rename ${row.label}`}
                            onClick={() => {
                              setRenameRow(row)
                              setRenameKey(row.key)
                              setRenameLabel(row.label)
                              setNote(null)
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                            disabled={pending}
                            aria-label={`Delete ${row.label}`}
                            onClick={() => {
                              setDeleteRow(row)
                              setStripCarriers(false)
                              setNote(null)
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-2">
        {rows.map((row) => (
          <Card
            key={row.id}
            className="flex items-center justify-between gap-3 px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{row.label}</p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {row.usageCount.toLocaleString('en-US')} contacts
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Switch
                checked={row.isActive}
                disabled={pending}
                onCheckedChange={(next) => submitActive(row, next)}
                aria-label={`${row.label} active`}
              />
              {!row.isProtected && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                    disabled={pending}
                    aria-label={`Rename ${row.label}`}
                    onClick={() => {
                      setRenameRow(row)
                      setRenameKey(row.key)
                      setRenameLabel(row.label)
                      setNote(null)
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    disabled={pending}
                    aria-label={`Delete ${row.label}`}
                    onClick={() => {
                      setDeleteRow(row)
                      setStripCarriers(false)
                      setNote(null)
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={(o) => !pending && setAddOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add tag</DialogTitle>
            <DialogDescription>The key is the literal value stored on each contact. It defaults to the label.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="tag-add-label">Label</Label>
              <Input id="tag-add-label" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="New tag" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tag-add-key">Key (optional)</Label>
              <Input id="tag-add-key" value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="Defaults to the label" className="font-mono text-xs" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={pending}>Cancel</Button>
            <Button onClick={submitAdd} disabled={pending}>Add tag</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename dialog — changes the KEY everywhere */}
      <Dialog open={!!renameRow} onOpenChange={(o) => !pending && !o && setRenameRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename {renameRow?.label}</DialogTitle>
            <DialogDescription>
              Renaming the key rewrites it on every contact that carries it
              {renameRow ? ` (${renameRow.usageCount.toLocaleString('en-US')} now).` : '.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="tag-rename-key">New key</Label>
              <Input id="tag-rename-key" value={renameKey} onChange={(e) => setRenameKey(e.target.value)} className="font-mono text-xs" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tag-rename-label">New label</Label>
              <Input id="tag-rename-label" value={renameLabel} onChange={(e) => setRenameLabel(e.target.value)} placeholder="Defaults to the key" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameRow(null)} disabled={pending}>Cancel</Button>
            <Button onClick={submitRename} disabled={pending}>Rename everywhere</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge dialog */}
      <Dialog open={mergeOpen} onOpenChange={(o) => !pending && setMergeOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge tags</DialogTitle>
            <DialogDescription>
              Every contact carrying the first tag is moved to the second, then the first tag is removed. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Merge this tag</Label>
              <Select value={mergeFrom} onValueChange={setMergeFrom}>
                <SelectTrigger>
                  <SelectValue placeholder="Tag to fold in" />
                </SelectTrigger>
                <SelectContent>
                  {mergeSources.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.label} ({t.usageCount.toLocaleString('en-US')})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Into this tag</Label>
              <Select value={mergeInto} onValueChange={setMergeInto}>
                <SelectTrigger>
                  <SelectValue placeholder="Destination tag" />
                </SelectTrigger>
                <SelectContent>
                  {rows.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.label} ({t.usageCount.toLocaleString('en-US')})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeOpen(false)} disabled={pending}>Cancel</Button>
            <Button variant="destructive" onClick={submitMerge} disabled={pending}>Merge tags</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={!!deleteRow} onOpenChange={(o) => !pending && !o && setDeleteRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleteRow?.label}</DialogTitle>
            <DialogDescription>
              Remove this tag from the taxonomy. Optionally strip it off every contact that carries it.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Strip from every contact</p>
              <p className="text-xs text-muted-foreground">
                {deleteRow?.usageCount
                  ? `${deleteRow.usageCount.toLocaleString('en-US')} contacts carry this tag.`
                  : 'No contacts carry this tag.'}
              </p>
            </div>
            <Switch checked={stripCarriers} onCheckedChange={setStripCarriers} disabled={pending} aria-label="Strip from every contact" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteRow(null)} disabled={pending}>Cancel</Button>
            <Button variant="destructive" onClick={submitDelete} disabled={pending}>Delete tag</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
