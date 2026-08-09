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
 *
 * 11F: migrated to the admin v2 language. The Add/Rename and Delete dialogs
 * moved to PipelineFormDialog.tsx (see that file's header). "How Deal
 * Pipelines work" becomes a Dialog trigger, matching HowReportingWorks. No
 * <h1>: the page title is styled text at the token scale's own "page title"
 * size (--a-text-xl) rather than SectionHead, whose fixed small uppercase
 * eyebrow style is for in-page lane headings, not a standalone page title.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronUp, CircleHelp, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button, Dialog, IconButton } from '@/components/admin/v2'
import type { BoardPipeline } from '@/lib/data/crm/getDealPipelines'
import {
  createDealPipeline,
  deleteDealPipeline,
  renameDealPipeline,
  reorderDealPipelines,
} from '@/app/actions/crm-deal-pipelines'
import { DeletePipelineDialog, PipelineFormDialog } from './PipelineFormDialog'

function HowPipelinesWorkButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant="quiet"
        onClick={() => setOpen(true)}
        className="av2-textlink"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--a-text-sm)' }}
      >
        <CircleHelp className="h-3.5 w-3.5" aria-hidden />
        How Deal Pipelines work
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="How Deal Pipelines work">
        <p>
          Pipelines are the tabs on the Deals board (Buyers, Sellers, or custom).
          Reorder them to change tab order, rename them, or delete an empty one.
          Stages are managed on the board itself: hover a column header for the
          edit pencil, or use the Add a stage link.
        </p>
      </Dialog>
    </>
  )
}

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
    <div className="mx-auto w-full px-4 py-8" style={{ maxWidth: 768 }}>
      <div className="mb-1 flex items-center justify-between gap-3">
        <p style={{ margin: 0, fontSize: 'var(--a-text-xl)', fontWeight: 700, color: 'var(--a-text)' }}>Manage Pipelines</p>
        <Button onClick={() => { setName(''); setAdding(true) }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Plus className="h-4 w-4" aria-hidden />
          Add Pipeline
        </Button>
      </div>
      <HowPipelinesWorkButton />

      {error ? (
        <p className="mt-3 rounded-md px-3 py-2" style={{ background: 'var(--a-danger-wash)', color: 'var(--a-danger)', fontSize: 'var(--a-text-xs)' }}>
          {error}
        </p>
      ) : null}

      <div className="av2-pane mt-4" style={{ padding: 0 }}>
        <div
          className="flex items-center justify-between px-4 py-2"
          style={{ background: 'var(--a-inset)', fontSize: 'var(--a-text-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--a-text-2)' }}
        >
          <span>Pipeline name</span>
          <span>Actions</span>
        </div>
        {pipelines.map((p, i) => (
          <div
            key={p.id}
            className="flex items-center justify-between gap-3 px-4 py-3"
            style={i > 0 ? { borderTop: '1px solid var(--a-border)' } : undefined}
          >
            <div className="flex min-w-0 items-center gap-2">
              <GripVertical className="h-4 w-4 shrink-0" style={{ color: 'var(--a-text-2)' }} aria-hidden />
              <div className="av2-reorder">
                <IconButton
                  label={`Move ${p.name} up`}
                  disabled={pending || i === 0}
                  onClick={() => move(i, -1)}
                >
                  <ChevronUp className="h-3 w-3" aria-hidden />
                </IconButton>
                <IconButton
                  label={`Move ${p.name} down`}
                  disabled={pending || i === pipelines.length - 1}
                  onClick={() => move(i, 1)}
                >
                  <ChevronDown className="h-3 w-3" aria-hidden />
                </IconButton>
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium" style={{ margin: 0, fontSize: 'var(--a-text-sm)', color: 'var(--a-text)' }}>{p.name}</p>
                <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
                  {p.stages.length} {p.stages.length === 1 ? 'stage' : 'stages'}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <IconButton label={`Rename ${p.name}`} onClick={() => { setName(p.name); setRenaming(p) }}>
                <Pencil className="h-4 w-4" aria-hidden />
              </IconButton>
              <IconButton label={`Delete ${p.name}`} tone="danger" onClick={() => setDeleting(p)}>
                <Trash2 className="h-4 w-4" aria-hidden />
              </IconButton>
            </div>
          </div>
        ))}
      </div>

      {/* Rename / Add dialog */}
      <PipelineFormDialog
        open={renaming != null || adding}
        adding={adding}
        renaming={renaming}
        name={name}
        onNameChange={setName}
        onClose={() => {
          if (pending) return
          setRenaming(null)
          setAdding(false)
        }}
        pending={pending}
        onSubmit={() => {
          if (adding) {
            run(() => createDealPipeline(name.trim()), () => setAdding(false))
          } else if (renaming) {
            run(() => renameDealPipeline(renaming.id, name.trim()), () => setRenaming(null))
          }
        }}
      />

      {/* Delete confirmation */}
      <DeletePipelineDialog
        pipeline={deleting}
        pending={pending}
        onClose={() => {
          if (!pending) setDeleting(null)
        }}
        onConfirm={() => {
          if (deleting) run(() => deleteDealPipeline(deleting.id), () => setDeleting(null))
        }}
      />
    </div>
  )
}
