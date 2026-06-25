'use client'

/**
 * SavedViewSidebar — the Wave 4 smart-list sidebar for the CRM people list.
 *
 * Lists every saved view the caller may SEE (resolved server-side via
 * getCrmSavedViews(access), each row carrying a LIVE count already clamped to the
 * caller's broker scope), grouped into three buckets:
 *   - System smart lists  (the 12 seeded FUB lists, protected, read-only)
 *   - My views            (the caller's own private views — editable)
 *   - Shared views         (views other brokers shared — visible, count-scoped)
 *
 * Clicking a view navigates to ?view=<id>, which the server page resolves through
 * the one people-query resolver, so the list the operator sees is exactly the
 * cohort the count promised. A "Save current filter as a view" control turns the
 * active list filter into a named view. Own non-protected views get rename /
 * delete / share affordances; protected system views are read-only.
 *
 * SCOPE: this component never decides visibility or counts — both come from the
 * server reader under scopeBroker(access). A restricted broker is handed only the
 * views they may see, each with a count that already excludes contacts outside
 * their book, so a shared view can never leak another broker's volume.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Plus, Pencil, Trash2, Share2, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { describeSegment, type LegacyFilters } from '@/lib/crm/segment-ast'
import {
  groupSavedViews,
  legacyToPreview,
  type SavedViewItem,
} from '@/components/admin/crm/saved-view-grouping'
import {
  saveCurrentFilterAsViewAction,
  updateSavedViewAction,
  deleteSavedViewAction,
  setSavedViewSharedAction,
  type SavedViewActionResult,
} from '@/app/actions/crm-saved-views'

// SavedViewItem is owned by the pure helper module; re-export so the server page's
// `import SavedViewSidebar, { type SavedViewItem }` keeps resolving here.
export type { SavedViewItem }

export type SavedViewSidebarProps = {
  /** Every view the caller may see, each with a live scoped count. */
  views: SavedViewItem[]
  /** The currently active view id (from ?view=), or null. */
  activeViewId: number | null
  /** The active list filter, so "save current filter" can persist it. */
  activeFilters: LegacyFilters
  /** True when the active filter bag holds something worth saving. */
  hasActiveFilter: boolean
}

function fmtCount(count: number | null): string {
  if (count === null) return '—'
  return count.toLocaleString('en-US')
}

export default function SavedViewSidebar({
  views, activeViewId, activeFilters, hasActiveFilter,
}: SavedViewSidebarProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Dialog state. One dialog drives create / rename / share / delete.
  type DialogMode =
    | { kind: 'save' }
    | { kind: 'rename'; view: SavedViewItem }
    | { kind: 'delete'; view: SavedViewItem }
    | null
  const [dialog, setDialog] = useState<DialogMode>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { system: systemViews, mine: myViews, shared: sharedViews } = groupSavedViews(views)

  const openSave = () => {
    setName(''); setDescription(''); setError(null)
    setDialog({ kind: 'save' })
  }
  const openRename = (view: SavedViewItem) => {
    setName(view.name); setDescription(view.description ?? ''); setError(null)
    setDialog({ kind: 'rename', view })
  }
  const openDelete = (view: SavedViewItem) => {
    setError(null)
    setDialog({ kind: 'delete', view })
  }
  const close = () => { setDialog(null); setError(null) }

  const afterMutation = (res: SavedViewActionResult) => {
    if (!res.ok) { setError(res.error); return }
    close()
    startTransition(() => router.refresh())
  }

  const runSave = () => {
    const trimmed = name.trim()
    if (!trimmed) { setError('Name this view'); return }
    startTransition(async () => {
      const res = await saveCurrentFilterAsViewAction({
        name: trimmed,
        description: description.trim() || undefined,
        filters: activeFilters,
      })
      afterMutation(res)
    })
  }

  const runRename = (view: SavedViewItem) => {
    const trimmed = name.trim()
    if (!trimmed) { setError('Name is required'); return }
    startTransition(async () => {
      const res = await updateSavedViewAction({
        id: view.id,
        name: trimmed,
        description: description.trim() || null,
      })
      afterMutation(res)
    })
  }

  const runDelete = (view: SavedViewItem) => {
    startTransition(async () => {
      const res = await deleteSavedViewAction({ id: view.id })
      afterMutation(res)
    })
  }

  const toggleShare = (view: SavedViewItem) => {
    startTransition(async () => {
      const res = await setSavedViewSharedAction({ id: view.id, shared: !view.isShared })
      if (!res.ok) { setError(res.error); return }
      startTransition(() => router.refresh())
    })
  }

  return (
    <aside className="w-full md:w-64 md:shrink-0">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Smart lists</h2>
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          onClick={openSave}
          disabled={!hasActiveFilter || isPending}
          title={hasActiveFilter ? 'Save the active filter as a view' : 'Apply a filter first'}
        >
          <Plus className="mr-1 h-4 w-4" aria-hidden />
          Save view
        </Button>
      </div>

      {/* On phones the groups stack and stay scrollable inside a bounded box; on
          desktop the sidebar simply flows in the column. */}
      <div className="mt-3 max-h-96 space-y-4 overflow-y-auto no-scrollbar md:max-h-none md:overflow-visible">
        <ViewGroup
          title="System lists"
          views={systemViews}
          activeViewId={activeViewId}
          isPending={isPending}
        />
        <ViewGroup
          title="My views"
          views={myViews}
          activeViewId={activeViewId}
          isPending={isPending}
          onRename={openRename}
          onDelete={openDelete}
          onShare={toggleShare}
          emptyHint="Save a filter to make your first view."
        />
        <ViewGroup
          title="Shared with you"
          views={sharedViews}
          activeViewId={activeViewId}
          isPending={isPending}
        />
      </div>

      {/* Save / rename dialog */}
      <Dialog open={dialog?.kind === 'save' || dialog?.kind === 'rename'} onOpenChange={(o) => { if (!o) close() }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{dialog?.kind === 'rename' ? 'Rename view' : 'Save current filter'}</DialogTitle>
            <DialogDescription>
              {dialog?.kind === 'rename'
                ? 'Update the name or notes for this view.'
                : `This view will match ${describeSegment(legacyToPreview(activeFilters))}.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label htmlFor="saved-view-name" className="mb-1.5 block text-xs text-muted-foreground">Name</Label>
              <Input
                id="saved-view-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Bend sellers, no recent activity"
                className="h-10 md:h-9"
              />
            </div>
            <div>
              <Label htmlFor="saved-view-desc" className="mb-1.5 block text-xs text-muted-foreground">Notes (optional)</Label>
              <Textarea
                id="saved-view-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
            {error ? <p className="text-xs text-destructive" role="alert">{error}</p> : null}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={close} disabled={isPending}>Cancel</Button>
            <Button
              size="sm"
              disabled={isPending}
              onClick={() => {
                if (dialog?.kind === 'rename') runRename(dialog.view)
                else runSave()
              }}
            >
              {isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : null}
              {dialog?.kind === 'rename' ? 'Save changes' : 'Save view'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={dialog?.kind === 'delete'} onOpenChange={(o) => { if (!o) close() }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete view</DialogTitle>
            <DialogDescription>
              {dialog?.kind === 'delete'
                ? `Delete "${dialog.view.name}". This cannot be undone. Contacts are not affected.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          {error ? <p className="text-xs text-destructive" role="alert">{error}</p> : null}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={close} disabled={isPending}>Cancel</Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={isPending}
              onClick={() => { if (dialog?.kind === 'delete') runDelete(dialog.view) }}
            >
              {isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  )
}

type ViewGroupProps = {
  title: string
  views: SavedViewItem[]
  activeViewId: number | null
  isPending: boolean
  onRename?: (view: SavedViewItem) => void
  onDelete?: (view: SavedViewItem) => void
  onShare?: (view: SavedViewItem) => void
  emptyHint?: string
}

function ViewGroup({
  title, views, activeViewId, isPending, onRename, onDelete, onShare, emptyHint,
}: ViewGroupProps) {
  if (views.length === 0 && !emptyHint) return null
  return (
    <div>
      <p className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="mt-1.5 space-y-0.5">
        {views.length === 0 && emptyHint ? (
          <li className="px-2 py-1.5 text-xs text-muted-foreground">{emptyHint}</li>
        ) : null}
        {views.map((view) => {
          const active = activeViewId === view.id
          return (
            <li key={view.id} className="group/view">
              <div
                className={cn(
                  'flex items-center gap-1 rounded-md px-1.5 py-1 transition-colors',
                  active ? 'bg-primary/10' : 'hover:bg-muted/60',
                )}
              >
                <Link
                  href={`/admin/crm?view=${view.id}`}
                  className="flex min-w-0 flex-1 items-center gap-1.5"
                  title={describeSegment(view.ast)}
                >
                  {view.isProtected ? (
                    <Lock className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
                  ) : null}
                  <span className={cn('truncate text-sm', active ? 'font-semibold text-foreground' : 'text-foreground')}>
                    {view.name}
                  </span>
                </Link>
                <Badge variant={active ? 'default' : 'outline'} className="shrink-0 tabular-nums">
                  {fmtCount(view.count)}
                </Badge>
                {onRename || onDelete || onShare ? (
                  <div className="ml-0.5 flex shrink-0 items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover/view:opacity-100">
                    {onShare ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => onShare(view)}
                        disabled={isPending}
                        aria-label={view.isShared ? `Stop sharing ${view.name}` : `Share ${view.name}`}
                        title={view.isShared ? 'Shared with the team. Click to unshare.' : 'Share with the team'}
                      >
                        <Share2 className={cn('h-3.5 w-3.5', view.isShared ? 'text-primary' : 'text-muted-foreground')} aria-hidden />
                      </Button>
                    ) : null}
                    {onRename ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => onRename(view)}
                        disabled={isPending}
                        aria-label={`Rename ${view.name}`}
                      >
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                      </Button>
                    ) : null}
                    {onDelete ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => onDelete(view)}
                        disabled={isPending}
                        aria-label={`Delete ${view.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
