'use client'

/**
 * BulkActions — the overhauled sticky bulk-action bar for the CRM contacts list
 * (Wave 3). Replaces the two-action BulkAssignBar with a suppression-aware,
 * scaled-to-18K bar.
 *
 * SELECTION MODEL. The bar acts on one of two selections, mirroring the
 * BulkActionSelection contract in app/actions/crm-bulk.ts:
 *   - 'ids'      — the explicit checkbox set the operator ticked.
 *   - 'matching' — "select all N matching this filter": the bar carries the
 *     ACTIVE LIST FILTER (q / stage / broker / tag) to the server, which builds
 *     the AST and resolves the ids under the caller's frozen broker scope. No id
 *     is enumerated client-side, so this scales past the 50-row page cap to the
 *     whole book.
 *
 * EVERY action funnels through one confirm dialog that first runs
 * bulkPreflightCount (the same compiler the worker runs) and shows
 * "<total> selected, <skip> will be skipped" before anything is enqueued. Send
 * kinds (email cohort, workflow enroll) surface a real suppression-skip estimate;
 * the worker still isSuppressed-checks every contact at run time, fail-closed.
 *
 * After enqueue the bar mounts BulkProgress to poll the job to completion. The
 * chunked worker cron drains the job; this bar never loops over thousands inline.
 *
 * The one legacy bulk action (add-to-newsletter) lives here too so there is one
 * bulk surface. It runs on the explicit id set only (it is not part of the
 * suppression-gated bulk-job framework — newsletter subscription has its own
 * double-opt-in path). Assign-saved-search graduated to the bulk-job framework
 * (kind 'crm:assign-saved-search') with a real filter builder — no more {} filters.
 *
 * DECOMPOSITION (audit finding #7b, verbatim-behavior refactor): each of the 17
 * discriminated actions (assign_broker, add_tag, remove_tag, set_stage,
 * enroll_workflow, set_report_subscription, email_cohort, newsletter,
 * saved_search, delete_contacts, set_source, set_timeframe, set_lender,
 * assign_pond, add_collaborator, remove_collaborator, merge_people) now lives as
 * one small, colocated `BulkActionSpec` in `bulk/registry.tsx` — its form
 * (`Fields`), its client validation, and its `run` (which calls the exact same
 * server action with the exact same payload the old mega-switch called). This
 * component owns only the shared chrome every spec plugs into: the sticky bar +
 * icon strip, the scope toggle (checked ids vs "all matching"), the preflight
 * count, the confirm-dialog shell, and the enqueue -> BulkProgress hookup. The
 * public API (props, the `openAction` imperative handle) is unchanged so the
 * parent (PeopleListView) needs no changes.
 */

import { forwardRef, useImperativeHandle, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, X, MoreHorizontal, Tag, Mail, Upload, Trash2, Download } from 'lucide-react'
import { bulkPreflightCount } from '@/app/actions/crm-bulk'
import type {
  BulkActionSelection,
  BulkKind,
  BulkEnqueueResult,
} from '@/lib/crm/bulk-helpers'
import type { LegacyFilters } from '@/lib/crm/segment-ast'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import BulkProgress from '@/components/admin/crm/BulkProgress'
import { BULK_ACTION_REGISTRY } from '@/components/admin/crm/bulk/registry'
import type { ActionId, BulkCtx } from '@/components/admin/crm/bulk/types'

// ── Picker option shapes (passed from the server page's Wave-2 readers) ───────
// Re-exported from the registry's type module so this file's public import
// path stays identical for every existing caller (PeopleListView, etc.).
export type {
  BulkPickerOption,
  BulkTemplateOption,
  BulkSequenceOption,
} from '@/components/admin/crm/bulk/types'
import type { BulkPickerOption, BulkTemplateOption, BulkSequenceOption } from '@/components/admin/crm/bulk/types'

export type BulkActionsProps = {
  /** The explicit checkbox set the operator ticked. */
  selectedIds: number[]
  /** Clear the parent's selection (called after a successful enqueue). */
  onClear: () => void
  /** Extra classes on the fixed bar root — e.g. lift above the mobile tab bar. */
  barClassName?: string
  /** The active list filter, so "select all matching" can carry it to the server. */
  activeFilters: LegacyFilters
  /**
   * The active saved view id (from ?view=), or null. When set, the "all matching"
   * scope targets the WHOLE view via { mode: 'view', viewId } so the audience
   * resolves through the view's stored AST (scope-clamped at run time) rather than
   * re-deriving from the legacy filter bag. Null falls back to Wave-3 behavior.
   */
  activeViewId?: number | null
  /** Total contacts matching the active filter (server count) — the "all N" label. */
  matchingTotal: number
  /** Whether the caller may reassign brokers (superuser only). */
  canAssignBroker: boolean
  /** Broker pickers. */
  brokers: BulkPickerOption[]
  /** Active stages for the stage picker. */
  stages: BulkPickerOption[]
  /** Active tags for the tag pickers (autocomplete is a plain select here). */
  tags: BulkPickerOption[]
  /** Market-report areas for the subscription action. */
  reportAreas: BulkPickerOption[]
  /** Email templates for the email-cohort action. */
  emailTemplates: BulkTemplateOption[]
  /** Active sequences for the enroll-workflow action. */
  sequences: BulkSequenceOption[]
  /** Ponds for the §14.3 Assign Ponds action. */
  ponds?: BulkPickerOption[]
  /** Configured lead sources for the §14.3 Update Source action. */
  sources?: BulkPickerOption[]
  /** The selected rows (id + name), for the Merge People survivor picker. */
  selectedRows?: Array<{ id: number; name: string | null }>
  /** Called by the §14.5 export icon — opens the Export Selected People modal. */
  onExport?: () => void
}

/** Imperative handle exposed via forwardRef so the icon toolbar can open actions. */
export type BulkActionsHandle = { openAction: (id: ActionId) => void }

const BulkActions = forwardRef<BulkActionsHandle, BulkActionsProps>(function BulkActions(props, ref) {
  const {
    selectedIds, onClear, barClassName, activeFilters, activeViewId, matchingTotal, canAssignBroker,
    brokers, stages, tags, reportAreas, emailTemplates, sequences,
    ponds = [], sources = [], selectedRows = [], onExport,
  } = props

  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Which selection the next action acts on. Default to the explicit checkbox set.
  const [scope, setScope] = useState<'ids' | 'matching'>('ids')
  const [open, setOpen] = useState<ActionId | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [jobId, setJobId] = useState<number | null>(null)

  // Preflight (run when a dialog opens).
  const [preflight, setPreflight] = useState<{ total: number; skip: number } | null>(null)
  const [preflightLoading, setPreflightLoading] = useState(false)

  // The open action's form values — one slot, typed per-spec via the registry.
  // Replaces the old pool of 25+ per-field useState hooks; each spec's Fields
  // component owns the shape of its own value object.
  const [values, setValues] = useState<any>(undefined)

  // Result feedback for legacy actions (newsletter / merge_people) that return counts.
  const [legacyResult, setLegacyResult] = useState<{ assigned: number; skipped: number } | null>(null)

  const idCount = selectedIds.length
  const hasIds = idCount > 0
  const hasMatching = matchingTotal > 0

  // The "all matching" selection. When a saved view is active, the whole view is
  // the audience (resolved through its stored AST, scope-clamped at run time);
  // otherwise the active legacy filter bag is upgraded to an AST server-side.
  const matchingSelection = (): BulkActionSelection =>
    activeViewId != null
      ? { mode: 'view', viewId: activeViewId }
      : { mode: 'matching', filters: activeFilters }

  // The selection the active scope produces for an action / preflight.
  const buildSelection = (): BulkActionSelection =>
    scope === 'ids'
      ? { mode: 'ids', ids: selectedIds }
      : matchingSelection()

  const closeDialog = () => {
    setOpen(null)
    setError(null)
    setPreflight(null)
    setLegacyResult(null)
    setValues(undefined)
  }

  const openAction = (id: ActionId) => {
    const spec = BULK_ACTION_REGISTRY[id]
    setOpen(id)
    setError(null)
    setPreflight(null)
    setLegacyResult(null)
    setValues(spec.initialValue)
    if (!spec.jobKind) {
      // Legacy actions (newsletter, merge_people) act on ids only.
      setScope('ids')
      return
    }
    // Opening from the §5 icon strip with nothing checked targets the whole
    // matching cohort; a checked selection targets the ids by default.
    const nextScope: 'ids' | 'matching' = selectedIds.length > 0 ? 'ids' : 'matching'
    setScope(nextScope)
    runPreflightForScope(spec.jobKind, nextScope)
  }

  // Expose openAction so PeopleListView's §5 icon strip can trigger actions.
  // Must be declared after openAction to satisfy the reference, and before any
  // conditional return so React's hooks rules are satisfied.
  useImperativeHandle(ref, () => ({ openAction }), [])

  // Bar shows only when there is something to act on. Placed AFTER all hooks.
  if (!hasIds && !hasMatching) return null

  // Switch scope while a dialog is open re-runs the preflight for the new scope.
  const switchScope = (next: 'ids' | 'matching') => {
    setScope(next)
    if (open) {
      const spec = BULK_ACTION_REGISTRY[open]
      if (spec.jobKind) {
        const kind = spec.jobKind
        // Defer to the next render so buildSelection reads the new scope.
        queueMicrotask(() => runPreflightForScope(kind, next))
      }
    }
  }

  const runPreflightForScope = (kind: BulkKind, nextScope: 'ids' | 'matching') => {
    setPreflightLoading(true)
    setPreflight(null)
    const selection: BulkActionSelection =
      nextScope === 'ids'
        ? { mode: 'ids', ids: selectedIds }
        : matchingSelection()
    startTransition(async () => {
      const res = await bulkPreflightCount(selection, kind)
      setPreflightLoading(false)
      if (!res.ok) { setError(res.error); return }
      setPreflight({ total: res.total, skip: res.suppressedEstimate })
    })
  }

  const onEnqueued = (res: BulkEnqueueResult) => {
    if (!res.ok) { setError(res.error); return }
    setJobId(res.jobId)
    closeDialog()
    onClear()
    startTransition(() => router.refresh())
  }

  // Context every spec's Fields / validate / run reads from — the picker data
  // this component already receives as props, plus the live selection state.
  const ctx: BulkCtx = {
    selectedIds,
    selectedRows,
    brokers,
    stages,
    tags,
    reportAreas,
    emailTemplates,
    sequences,
    ponds,
    sources,
    legacyResult,
  }

  const run = () => {
    if (!open) return
    const spec = BULK_ACTION_REGISTRY[open]
    setError(null)
    const sel = buildSelection()
    startTransition(async () => {
      const validationError = spec.validate ? spec.validate(values, ctx) : null
      if (validationError) { setError(validationError); return }
      const outcome = await spec.run(values, sel, ctx)
      if (outcome.mode === 'job') {
        onEnqueued(outcome.result)
        return
      }
      // Legacy actions (newsletter, merge_people): report the count, clear the
      // selection, and refresh — but leave the dialog open showing "Done."
      if (!outcome.result.ok) { setError(outcome.result.error); return }
      setError(null)
      setLegacyResult({ assigned: outcome.result.assigned, skipped: outcome.result.skipped })
      onClear()
      startTransition(() => router.refresh())
    })
  }

  const currentSpec = open ? BULK_ACTION_REGISTRY[open] : null
  const actingCount = scope === 'ids' ? idCount : matchingTotal
  const isLegacy = currentSpec ? !currentSpec.jobKind : false
  const isDelete = currentSpec?.dangerous === true

  return (
    <>
    {/* §14.1: the bar appears when rows are selected (or a job is running). The
        dialogs stay mounted outside so the §5 icon strip can open them with an
        empty selection (they then default to the whole matching cohort). */}
    {hasIds || jobId ? (
    <div className={`fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/80 sm:px-6 ${barClassName ?? ''}`}>
      {/* pr clears the global quick-action FAB (bottom-right) so the §14 icons stay clickable */}
      <div className="mx-auto max-w-screen-2xl md:pr-24">
        {hasIds ? (
        <div className="flex flex-wrap items-center gap-2">
          {/* §14.1: "Selected N people — Deselect all" + scope toggle */}
          <span className="text-sm tabular-nums text-foreground">
            Selected <span className="font-semibold">{(scope === 'ids' ? idCount : matchingTotal).toLocaleString('en-US')}</span>{' '}
            {actingCount === 1 ? 'person' : 'people'}
          </span>
          {hasIds ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => { onClear(); setJobId(null) }}
              disabled={isPending}
            >
              <X className="mr-1 h-3.5 w-3.5" aria-hidden />
              Deselect all
            </Button>
          ) : null}
          {/* In-house extra: act on the page's checkbox set or on ALL matching the filter/view */}
          {hasMatching ? (
            <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
              <Button
                size="sm"
                variant={scope === 'ids' ? 'default' : 'ghost'}
                className="h-7 px-2 text-xs tabular-nums"
                onClick={() => switchScope('ids')}
                disabled={!hasIds || isPending}
              >
                Checked ({idCount})
              </Button>
              <Button
                size="sm"
                variant={scope === 'matching' ? 'default' : 'ghost'}
                className="h-7 px-2 text-xs tabular-nums"
                onClick={() => switchScope('matching')}
                disabled={isPending}
              >
                {activeViewId != null ? 'Whole list' : 'All'} {matchingTotal.toLocaleString('en-US')}
              </Button>
            </div>
          ) : null}

          <div className="ml-auto flex flex-wrap items-center gap-1">
            {/* §14.5 bar icons: Batch Email · Import · Delete · Export */}
            <Button
              size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground"
              aria-label="Batch Email" title="Batch Email"
              onClick={() => openAction('email_cohort')} disabled={isPending}
            >
              <Mail className="h-4 w-4" aria-hidden />
            </Button>
            <Link
              href="/admin/crm/import"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              aria-label="Import" title="Import"
            >
              <Upload className="h-4 w-4" aria-hidden />
            </Link>
            {canAssignBroker ? (
              <Button
                size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground"
                aria-label="Delete" title="Delete"
                onClick={() => openAction('delete_contacts')} disabled={isPending}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            ) : null}
            {onExport ? (
              <Button
                size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground"
                aria-label="Export Selected People" title="Export Selected People"
                onClick={onExport} disabled={isPending}
              >
                <Download className="h-4 w-4" aria-hidden />
              </Button>
            ) : null}

            {/* §14.4 tag icon sub-dropdown: Add Tags / Remove Tags */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" aria-label="Tag actions" title="Tags" disabled={isPending}>
                  <Tag className="h-4 w-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onSelect={() => openAction('add_tag')}>Add Tags</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => openAction('remove_tag')}>Remove Tags</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* §14.3 main bulk-action dropdown — the 11 items, exact order */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" aria-label="Bulk actions" title="Bulk actions" disabled={isPending}>
                  <MoreHorizontal className="h-4 w-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Apply to {actingCount.toLocaleString('en-US')} contacts</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => openAction('set_stage')}>Update Stage</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => openAction('set_source')}>Update Source</DropdownMenuItem>
                {canAssignBroker ? (
                  <DropdownMenuItem onSelect={() => openAction('assign_broker')}>Assign Agent</DropdownMenuItem>
                ) : null}
                <DropdownMenuItem onSelect={() => openAction('assign_pond')}>Assign Ponds</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => openAction('set_lender')}>Assign Lender</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => openAction('add_collaborator')}>Add Collaborators</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => openAction('remove_collaborator')}>Remove Collaborators</DropdownMenuItem>
                <DropdownMenuItem
                  disabled={idCount < 2 || idCount > 10}
                  onSelect={() => openAction('merge_people')}
                >
                  Merge People
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => openAction('set_timeframe')}>Update Timeframe</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => openAction('enroll_workflow')}>Apply Automation</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => openAction('set_report_subscription')}>Market report subscription</DropdownMenuItem>
                <DropdownMenuItem disabled={!hasIds} onSelect={() => openAction('newsletter')}>Add to newsletter</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => openAction('saved_search')}>Assign a saved search</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        ) : null}

        {/* Progress poller appears after a job is enqueued */}
        {jobId ? <BulkProgress jobId={jobId} /> : null}
      </div>
    </div>
    ) : null}

      {/* Confirm + form dialog */}
      <Dialog open={open !== null} onOpenChange={(o) => { if (!o) closeDialog() }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{currentSpec?.title ?? ''}</DialogTitle>
            <DialogDescription>
              {legacyResult
                ? `Done. ${legacyResult.assigned} ${open === 'merge_people' ? 'merged' : 'added'}, ${legacyResult.skipped} skipped.`
                : isDelete
                  ? `This will soft-delete the selected contacts — they will disappear from all lists. This cannot be undone in bulk.`
                  : isLegacy
                    ? `Acts on the ${idCount} selected ${idCount === 1 ? 'contact' : 'contacts'}.`
                    : preflightLoading
                      ? 'Counting the cohort'
                      : preflight
                        ? `${preflight.total.toLocaleString('en-US')} ${preflight.total === 1 ? 'contact' : 'contacts'}${preflight.skip > 0 ? `, ${preflight.skip.toLocaleString('en-US')} will be skipped (suppressed)` : ''}.`
                        : `Acts on ${actingCount.toLocaleString('en-US')} ${actingCount === 1 ? 'contact' : 'contacts'}.`}
            </DialogDescription>
          </DialogHeader>

          {/* Scope chooser inside the dialog for the non-legacy actions */}
          {!isLegacy && hasIds && hasMatching ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Apply to</span>
              <Select value={scope} onValueChange={(v) => switchScope(v as 'ids' | 'matching')}>
                <SelectTrigger className="h-8 w-auto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ids">{idCount} selected</SelectItem>
                  <SelectItem value="matching">{activeViewId != null ? 'Whole view' : 'All'} {matchingTotal.toLocaleString('en-US')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {/* Per-action form body — one small colocated spec per action, see
              bulk/registry.tsx. */}
          <div className="space-y-3">
            {currentSpec?.Fields ? (
              <currentSpec.Fields value={values} onChange={setValues} ctx={ctx} />
            ) : null}

            {error ? <p className="text-xs text-destructive" role="alert">{error}</p> : null}
          </div>

          <DialogFooter>
            {legacyResult ? (
              <Button variant="outline" size="sm" onClick={closeDialog}>Close</Button>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={closeDialog} disabled={isPending}>Cancel</Button>
                <Button
                  size="sm"
                  variant={isDelete ? 'destructive' : 'default'}
                  onClick={run}
                  disabled={isPending}
                >
                  {isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : null}
                  {isDelete ? 'Delete' : 'Run'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
})

export default BulkActions
