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
import {
  Button, Dialog, IconButton, Menu, ToolbarSelect, type AdminMenuItem,
} from '@/components/admin/v2'
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
    selection: buildSelection(),
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

  // §14.3 main bulk-action list — the 11 items, exact order. The v2 Menu takes
  // its items as data rather than as children, and it has no non-interactive
  // header row, so the shadcn DropdownMenuLabel keeps its exact words as a
  // permanently-disabled first item: same string, still unclickable, and
  // arrow-key navigation skips it. The Menu's trigger has no `disabled` of its
  // own either, so `isPending` rides on every item — the guarantee that mattered
  // (no action fires mid-transition) is unchanged.
  const bulkMenuItems: AdminMenuItem[] = [
    { label: `Apply to ${actingCount.toLocaleString('en-US')} contacts`, disabled: true },
    { label: 'Update Stage', onSelect: () => openAction('set_stage'), disabled: isPending },
    { label: 'Update Source', onSelect: () => openAction('set_source'), disabled: isPending },
    ...(canAssignBroker
      ? [{ label: 'Assign Agent', onSelect: () => openAction('assign_broker'), disabled: isPending }]
      : []),
    { label: 'Assign Ponds', onSelect: () => openAction('assign_pond'), disabled: isPending },
    { label: 'Assign Lender', onSelect: () => openAction('set_lender'), disabled: isPending },
    { label: 'Add Collaborators', onSelect: () => openAction('add_collaborator'), disabled: isPending },
    { label: 'Remove Collaborators', onSelect: () => openAction('remove_collaborator'), disabled: isPending },
    {
      label: 'Merge People',
      onSelect: () => openAction('merge_people'),
      disabled: isPending || idCount < 2 || idCount > 10,
    },
    { label: 'Update Timeframe', onSelect: () => openAction('set_timeframe'), disabled: isPending },
    { label: 'Apply Automation', onSelect: () => openAction('enroll_workflow'), disabled: isPending },
    {
      label: 'Market report subscription',
      onSelect: () => openAction('set_report_subscription'),
      disabled: isPending,
    },
    { label: 'Add to newsletter', onSelect: () => openAction('newsletter'), disabled: isPending || !hasIds },
    { label: 'Assign a saved search', onSelect: () => openAction('saved_search'), disabled: isPending },
  ]

  return (
    <>
    {/* §14.1: the bar appears when rows are selected (or a job is running). The
        dialogs stay mounted outside so the §5 icon strip can open them with an
        empty selection (they then default to the whole matching cohort). */}
    {hasIds || jobId ? (
    // The bar was `bg-card/95` + backdrop-blur, then `bg-card/80` where
    // backdrop-filter is supported. The locked tokens carry no translucent
    // surface and color-mix() is banned here, so the bar is now the opaque
    // --a-surface with the overlay shadow the language reserves for exactly
    // this — a layer floating over the page.
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t px-4 py-3 sm:px-6 ${barClassName ?? ''}`}
      style={{
        background: 'var(--a-surface)',
        borderColor: 'var(--a-border)',
        boxShadow: 'var(--a-shadow-overlay)',
      }}
    >
      {/* pr clears the global quick-action FAB (bottom-right) so the §14 icons stay clickable */}
      <div className="mx-auto max-w-screen-2xl md:pr-24">
        {hasIds ? (
        <div className="flex flex-wrap items-center gap-2">
          {/* §14.1: "Selected N people — Deselect all" + scope toggle */}
          <span className="text-sm tabular-nums" style={{ color: 'var(--a-text)' }}>
            Selected <span className="font-semibold">{(scope === 'ids' ? idCount : matchingTotal).toLocaleString('en-US')}</span>{' '}
            {actingCount === 1 ? 'person' : 'people'}
          </span>
          {hasIds ? (
            <Button
              variant="quiet"
              className="h-8 px-2 text-xs"
              onClick={() => { onClear(); setJobId(null) }}
              disabled={isPending}
            >
              <X className="mr-1 h-3.5 w-3.5" aria-hidden />
              Deselect all
            </Button>
          ) : null}
          {/* In-house extra: act on the page's checkbox set or on ALL matching the filter/view */}
          {hasMatching ? (
            <div className="flex items-center gap-1 rounded-md border p-0.5" style={{ borderColor: 'var(--a-border)' }}>
              <Button
                variant={scope === 'ids' ? 'primary' : 'quiet'}
                className="h-7 px-2 text-xs tabular-nums"
                onClick={() => switchScope('ids')}
                disabled={!hasIds || isPending}
              >
                Checked ({idCount})
              </Button>
              <Button
                variant={scope === 'matching' ? 'primary' : 'quiet'}
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
            <IconButton
              label="Batch Email"
              onClick={() => openAction('email_cohort')} disabled={isPending}
            >
              <Mail className="h-4 w-4" aria-hidden />
            </IconButton>
            <Link
              href="/admin/crm/import"
              className="av2-iconbtn"
              aria-label="Import" title="Import"
            >
              <Upload className="h-4 w-4" aria-hidden />
            </Link>
            {canAssignBroker ? (
              <IconButton
                label="Delete"
                onClick={() => openAction('delete_contacts')} disabled={isPending}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </IconButton>
            ) : null}
            {onExport ? (
              <IconButton
                label="Export Selected People"
                onClick={onExport} disabled={isPending}
              >
                <Download className="h-4 w-4" aria-hidden />
              </IconButton>
            ) : null}

            {/* §14.4 tag icon sub-dropdown: Add Tags / Remove Tags.
                title on the WRAPPER: Menu owns its trigger button, so the hover
                tooltip every other icon in this strip shows is attached to the
                ancestor the browser walks up to. The accessible name stays the
                trigger's aria-label. */}
            <span title="Tags" className="inline-flex">
              <Menu
                label="Tag actions"
                align="end"
                trigger={<Tag className="h-4 w-4" aria-hidden />}
                items={[
                  { label: 'Add Tags', onSelect: () => openAction('add_tag'), disabled: isPending },
                  { label: 'Remove Tags', onSelect: () => openAction('remove_tag'), disabled: isPending },
                ]}
              />
            </span>

            {/* §14.3 main bulk-action dropdown — items built above */}
            <span title="Bulk actions" className="inline-flex">
              <Menu
                label="Bulk actions"
                align="end"
                trigger={<MoreHorizontal className="h-4 w-4" aria-hidden />}
                items={bulkMenuItems}
              />
            </span>
          </div>
        </div>
        ) : null}

        {/* Progress poller appears after a job is enqueued */}
        {jobId ? <BulkProgress jobId={jobId} /> : null}
      </div>
    </div>
    ) : null}

      {/* Confirm + form dialog */}
      <Dialog
        open={open !== null}
        onClose={closeDialog}
        title={currentSpec?.title ?? ''}
        description={
          legacyResult
            ? `Done. ${legacyResult.assigned} ${open === 'merge_people' ? 'merged' : 'added'}, ${legacyResult.skipped} skipped.`
            : isDelete
              ? `This will soft-delete the selected contacts — they will disappear from all lists. This cannot be undone in bulk.`
              : isLegacy
                ? `Acts on the ${idCount} selected ${idCount === 1 ? 'contact' : 'contacts'}.`
                : preflightLoading
                  ? 'Counting the cohort'
                  : preflight
                    ? `${preflight.total.toLocaleString('en-US')} ${preflight.total === 1 ? 'contact' : 'contacts'}${preflight.skip > 0 ? `, ${preflight.skip.toLocaleString('en-US')} will be skipped (suppressed)` : ''}.`
                    : `Acts on ${actingCount.toLocaleString('en-US')} ${actingCount === 1 ? 'contact' : 'contacts'}.`
        }
        footer={
          legacyResult ? (
            <Button variant="quiet" onClick={closeDialog}>Close</Button>
          ) : (
            <>
              <Button variant="quiet" onClick={closeDialog} disabled={isPending}>Cancel</Button>
              <Button
                variant={isDelete ? 'danger' : 'primary'}
                onClick={run}
                disabled={isPending}
              >
                {isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : null}
                {isDelete ? 'Delete' : 'Run'}
              </Button>
            </>
          )
        }
      >
        {/* Scope chooser inside the dialog for the non-legacy actions */}
        {!isLegacy && hasIds && hasMatching ? (
          <div className="flex items-center gap-2 text-xs">
            <span style={{ color: 'var(--a-text-2)' }}>Apply to</span>
            {/* The visible caption sits beside the control rather than above it,
                so this is the toolbar select — and its aria-label repeats the
                caption so the accessible name is never lost. */}
            <ToolbarSelect
              aria-label="Apply to"
              value={scope}
              onChange={(e) => switchScope(e.target.value as 'ids' | 'matching')}
            >
              <option value="ids">{idCount} selected</option>
              <option value="matching">
                {activeViewId != null ? 'Whole view' : 'All'} {matchingTotal.toLocaleString('en-US')}
              </option>
            </ToolbarSelect>
          </div>
        ) : null}

        {/* Per-action form body — one small colocated spec per action, see
            bulk/registry.tsx. */}
        <div className="space-y-3">
          {currentSpec?.Fields ? (
            <currentSpec.Fields value={values} onChange={setValues} ctx={ctx} />
          ) : null}

          {error ? <p className="text-xs" style={{ color: 'var(--a-danger)' }} role="alert">{error}</p> : null}
        </div>
      </Dialog>
    </>
  )
})

export default BulkActions
