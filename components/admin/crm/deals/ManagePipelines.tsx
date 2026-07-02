'use client'

/**
 * ManagePipelines — the §9 Manage Pipelines settings surface (full-page route
 * /admin/crm/deals/pipelines, reached from the ⚙ gear on the Deals sub-bar).
 *
 * Owner-only (the route 403s everyone else; every action re-enforces).
 * Lists pipelines in tab order with: grip + explicit up/down reorder controls
 * (order_weight renumbers in 1000-unit gaps), ✏ rename (cascades to
 * crm_deals.pipeline strings), 🗑 delete (refused while deals exist in it),
 * and "+ Add Pipeline".
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronUp, CircleHelp, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { BoardPipeline } from '@/lib/data/crm/getDealPipelines'
import {
  createDealPipeline,
  renameDealPipeline,
  deleteDealPipeline,
  reorderDealPipelines,
} from '@/app/actions/crm-deal-pipelines'

export function ManagePipelines({ pipelines }: { pipelines: BoardPipeline[] }) {
  const router = useRouter()
  const [renaming, setRenaming] = useState<BoardPipeline | null>(null)
  const [deleting, setDeleting] = useState<BoardPipeline | null>(null)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, done?: () => void) {
    setError(null)
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) {
        setError(res.error ?? 'Failed')
        return
      }
      done?.()
      router.refresh()
    })
  }

  function move(index: number, dir: -1 | 1) {
    const ids = pipelines.map((p) => p.id)
    const j = index + dir
    if (j < 0 || j >= ids.length) return
    ;[ids[index], ids[j]] = [ids[j], ids[index]]
    run(() => reorderDealPipelines(ids))
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-foreground">Manage Pipelines</h1>
        <Button type="button" onClick={() => { setName(''); setAdding(true) }} className="gap-1.5">
          <Plus className="h-4 w-4" aria-hidden />
          Add Pipeline
        </Button>
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="link" size="sm" className="h-auto gap-1 p-0 text-sm">
            <CircleHelp className="h-3.5 w-3.5" aria-hidden />
            How Deal Pipelines work
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 text-sm text-muted-foreground">
          Pipelines are the tabs on the Deals board (Buyers, Sellers, or custom).
          Reorder them to change tab order, rename them, or delete an empty one.
          Stages are managed on the board itself: hover a column header for the
          edit pencil, or use the Add a stage link.
        </PopoverContent>
      </Popover>

      {error ? (
        <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
      ) : null}

      <Card className="mt-4 divide-y divide-border overflow-hidden py-0">
        <div className="flex items-center justify-between bg-muted/50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Pipeline name</span>
          <span>Actions</span>
        </div>
        {pipelines.map((p, i) => (
          <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="flex flex-col">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Move ${p.name} up`}
                  disabled={pending || i === 0}
                  onClick={() => move(i, -1)}
                >
                  <ChevronUp className="h-3 w-3" aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Move ${p.name} down`}
                  disabled={pending || i === pipelines.length - 1}
                  onClick={() => move(i, 1)}
                >
                  <ChevronDown className="h-3 w-3" aria-hidden />
                </Button>
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  {p.stages.length} {p.stages.length === 1 ? 'stage' : 'stages'}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Rename ${p.name}`}
                onClick={() => { setName(p.name); setRenaming(p) }}
              >
                <Pencil className="h-4 w-4" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Delete ${p.name}`}
                className="text-destructive hover:text-destructive"
                onClick={() => setDeleting(p)}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </div>
        ))}
      </Card>

      {/* Rename / Add dialog */}
      <Dialog
        open={renaming != null || adding}
        onOpenChange={(o) => {
          if (!o) {
            setRenaming(null)
            setAdding(false)
          }
        }}
      >
        <DialogContent aria-describedby={undefined} className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{adding ? 'Add pipeline' : `Rename ${renaming?.name}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5 py-1">
            <Label htmlFor="pipeline-name">Pipeline name</Label>
            <Input
              id="pipeline-name"
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setRenaming(null); setAdding(false) }} disabled={pending}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={pending || !name.trim()}
              onClick={() => {
                if (adding) {
                  run(() => createDealPipeline(name.trim()), () => setAdding(false))
                } else if (renaming) {
                  run(() => renameDealPipeline(renaming.id, name.trim()), () => setRenaming(null))
                }
              }}
            >
              {pending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={deleting != null} onOpenChange={(o) => { if (!o) setDeleting(null) }}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {deleting?.name}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            A pipeline can only be deleted when it holds no deals. This also
            removes its stages.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleting(null)} disabled={pending}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => {
                if (deleting) run(() => deleteDealPipeline(deleting.id), () => setDeleting(null))
              }}
            >
              {pending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
