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
 * The two legacy bulk actions (add-to-newsletter, assign-saved-search) live here
 * too so there is one bulk surface. They run on the explicit id set only (they
 * are not part of the suppression-gated bulk-job framework — newsletter
 * subscription has its own double-opt-in path).
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, X, ChevronDown } from 'lucide-react'
import {
  bulkAssignBrokerAction,
  bulkAddTagAction,
  bulkRemoveTagAction,
  bulkSetStageAction,
  bulkEnrollWorkflowAction,
  bulkSetReportSubscriptionAction,
  bulkEmailCohortAction,
  bulkPreflightCount,
  type BulkActionSelection,
  type BulkKind,
  type BulkEnqueueResult,
} from '@/app/actions/crm-bulk'
import {
  adminBulkAssignNewsletterAction,
  adminBulkAssignSavedSearchAction,
} from '@/app/actions/newsletter'
import type { LegacyFilters } from '@/lib/crm/segment-ast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
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

// ── Picker option shapes (passed from the server page's Wave-2 readers) ───────

export type BulkPickerOption = { key: string; label: string }
export type BulkTemplateOption = { id: number; name: string; channel: 'email' | 'sms' }
export type BulkSequenceOption = { id: number; name: string }

export type BulkActionsProps = {
  /** The explicit checkbox set the operator ticked. */
  selectedIds: number[]
  /** Clear the parent's selection (called after a successful enqueue). */
  onClear: () => void
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
}

// One discriminated action the dialog renders a form for.
type ActionId =
  | 'assign_broker'
  | 'add_tag'
  | 'remove_tag'
  | 'set_stage'
  | 'enroll_workflow'
  | 'set_report_subscription'
  | 'email_cohort'
  | 'newsletter'
  | 'saved_search'

// The bulk-job kind each action maps to (legacy two have no job kind).
const ACTION_KIND: Partial<Record<ActionId, BulkKind>> = {
  assign_broker: 'crm:assign-broker',
  add_tag: 'crm:add-tag',
  remove_tag: 'crm:remove-tag',
  set_stage: 'crm:set-stage',
  enroll_workflow: 'crm:enroll-workflow',
  set_report_subscription: 'crm:set-report-subscription',
  email_cohort: 'email-cohort',
}

const ACTION_TITLE: Record<ActionId, string> = {
  assign_broker: 'Reassign broker',
  add_tag: 'Add a tag',
  remove_tag: 'Remove a tag',
  set_stage: 'Set stage',
  enroll_workflow: 'Enroll in a workflow',
  set_report_subscription: 'Market report subscription',
  email_cohort: 'Email this cohort',
  newsletter: 'Add to newsletter',
  saved_search: 'Assign a saved search',
}

const NEWSLETTER_SEGMENTS: BulkPickerOption[] = [
  { key: 'general', label: 'General' },
  { key: 'buyer', label: 'Buyer' },
  { key: 'seller', label: 'Seller' },
  { key: 'past-client', label: 'Past client' },
]

export default function BulkActions(props: BulkActionsProps) {
  const {
    selectedIds, onClear, activeFilters, activeViewId, matchingTotal, canAssignBroker,
    brokers, stages, tags, reportAreas, emailTemplates, sequences,
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

  // Per-action form state.
  const [broker, setBroker] = useState('')
  const [tag, setTag] = useState('')
  const [stage, setStage] = useState('')
  const [sequenceId, setSequenceId] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [reportAreaKeys, setReportAreaKeys] = useState<Set<string>>(new Set())
  const [reportActive, setReportActive] = useState(true)
  const [reportFrequency, setReportFrequency] = useState('monthly')
  const [segment, setSegment] = useState('general')
  const [ssName, setSsName] = useState('')

  const idCount = selectedIds.length
  const hasIds = idCount > 0
  const hasMatching = matchingTotal > 0

  // Bar shows whenever there is anything to act on (a checkbox set OR a non-empty
  // filtered list the operator can "select all" of).
  if (!hasIds && !hasMatching) return null

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

  const resetForm = () => {
    setBroker(''); setTag(''); setStage(''); setSequenceId(''); setTemplateId('')
    setSubject(''); setBody(''); setReportAreaKeys(new Set()); setReportActive(true)
    setReportFrequency('monthly'); setSegment('general'); setSsName('')
  }

  const closeDialog = () => {
    setOpen(null)
    setError(null)
    setPreflight(null)
    resetForm()
  }

  const openAction = (id: ActionId) => {
    setOpen(id)
    setError(null)
    setPreflight(null)
    resetForm()
    const kind = ACTION_KIND[id]
    if (!kind) {
      // Legacy actions act on ids only; force ids scope and skip the preflight.
      setScope('ids')
      return
    }
    runPreflight(kind)
  }

  const runPreflight = (kind: BulkKind) => {
    setPreflightLoading(true)
    setPreflight(null)
    startTransition(async () => {
      const res = await bulkPreflightCount(buildSelection(), kind)
      setPreflightLoading(false)
      if (!res.ok) { setError(res.error); return }
      setPreflight({ total: res.total, skip: res.suppressedEstimate })
    })
  }

  // Switch scope while a dialog is open re-runs the preflight for the new scope.
  const switchScope = (next: 'ids' | 'matching') => {
    setScope(next)
    if (open) {
      const kind = ACTION_KIND[open]
      if (kind) {
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

  const run = () => {
    if (!open) return
    setError(null)
    const sel = buildSelection()
    startTransition(async () => {
      switch (open) {
        case 'assign_broker': {
          if (!broker) { setError('Pick a broker'); return }
          onEnqueued(await bulkAssignBrokerAction(sel, broker))
          return
        }
        case 'add_tag': {
          if (!tag.trim()) { setError('Pick or type a tag'); return }
          onEnqueued(await bulkAddTagAction(sel, tag.trim()))
          return
        }
        case 'remove_tag': {
          if (!tag.trim()) { setError('Pick or type a tag'); return }
          onEnqueued(await bulkRemoveTagAction(sel, tag.trim()))
          return
        }
        case 'set_stage': {
          if (!stage) { setError('Pick a stage'); return }
          onEnqueued(await bulkSetStageAction(sel, stage))
          return
        }
        case 'enroll_workflow': {
          const id = Number(sequenceId)
          if (!id) { setError('Pick a workflow'); return }
          onEnqueued(await bulkEnrollWorkflowAction(sel, id))
          return
        }
        case 'set_report_subscription': {
          const areas = Array.from(reportAreaKeys)
          if (reportActive && areas.length === 0) { setError('Pick at least one area'); return }
          onEnqueued(await bulkSetReportSubscriptionAction(sel, {
            areas, frequency: reportFrequency, isActive: reportActive,
          }))
          return
        }
        case 'email_cohort': {
          const tId = templateId.trim()
          if (!tId && !(subject.trim() && body.trim())) {
            setError('Pick a template, or write a subject and body')
            return
          }
          onEnqueued(await bulkEmailCohortAction(sel, {
            templateId: tId || undefined,
            subject: subject.trim() || undefined,
            body: body || undefined,
          }))
          return
        }
        // Legacy — ids only, not a bulk-job kind.
        case 'newsletter': {
          const res = await adminBulkAssignNewsletterAction(
            selectedIds,
            segment as 'general' | 'buyer' | 'seller' | 'past-client',
          )
          if (!res.ok) { setError(res.error ?? 'Could not add to the newsletter'); return }
          setError(null)
          closeDialog(); onClear()
          startTransition(() => router.refresh())
          return
        }
        case 'saved_search': {
          const name = ssName.trim()
          if (!name) { setError('Name the saved search'); return }
          const res = await adminBulkAssignSavedSearchAction(selectedIds, name, {})
          if (!res.ok) { setError(res.error ?? 'Could not assign the saved search'); return }
          setError(null)
          closeDialog(); onClear()
          startTransition(() => router.refresh())
          return
        }
      }
    })
  }

  const toggleArea = (key: string) => {
    setReportAreaKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const actingCount = scope === 'ids' ? idCount : matchingTotal
  const isLegacy = open === 'newsletter' || open === 'saved_search'

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/80 sm:px-6">
      <div className="mx-auto max-w-screen-2xl">
        <div className="flex flex-wrap items-center gap-2">
          {/* Scope toggle — explicit checkbox set vs "all matching this filter" */}
          <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
            <Button
              size="sm"
              variant={scope === 'ids' ? 'default' : 'ghost'}
              className="h-8 tabular-nums"
              onClick={() => switchScope('ids')}
              disabled={!hasIds || isPending}
            >
              {idCount} selected
            </Button>
            <Button
              size="sm"
              variant={scope === 'matching' ? 'default' : 'ghost'}
              className="h-8 tabular-nums"
              onClick={() => switchScope('matching')}
              disabled={!hasMatching || isPending}
            >
              {activeViewId != null ? 'Whole view' : 'All'} {matchingTotal.toLocaleString('en-US')}
            </Button>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="h-10 md:h-8" disabled={isPending}>
                  Bulk action
                  <ChevronDown className="ml-1 h-4 w-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Apply to {actingCount.toLocaleString('en-US')} contacts</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => openAction('add_tag')}>Add a tag</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => openAction('remove_tag')}>Remove a tag</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => openAction('set_stage')}>Set stage</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => openAction('enroll_workflow')}>Enroll in a workflow</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => openAction('email_cohort')}>Email this cohort</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => openAction('set_report_subscription')}>Market report subscription</DropdownMenuItem>
                {canAssignBroker ? (
                  <DropdownMenuItem onSelect={() => openAction('assign_broker')}>Reassign broker</DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled={!hasIds} onSelect={() => openAction('newsletter')}>Add to newsletter</DropdownMenuItem>
                <DropdownMenuItem disabled={!hasIds} onSelect={() => openAction('saved_search')}>Assign a saved search</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              size="sm"
              variant="ghost"
              className="h-10 md:h-8"
              onClick={() => { onClear(); setJobId(null) }}
              disabled={isPending}
            >
              <X className="mr-1 h-4 w-4" aria-hidden />
              Clear
            </Button>
          </div>
        </div>

        {/* Progress poller appears after a job is enqueued */}
        {jobId ? <BulkProgress jobId={jobId} /> : null}
      </div>

      {/* Confirm + form dialog */}
      <Dialog open={open !== null} onOpenChange={(o) => { if (!o) closeDialog() }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{open ? ACTION_TITLE[open] : ''}</DialogTitle>
            <DialogDescription>
              {isLegacy
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

          {/* Per-action form body */}
          <div className="space-y-3">
            {open === 'assign_broker' ? (
              <FormSelect label="Broker" value={broker} onChange={setBroker} placeholder="Pick a broker" options={brokers} />
            ) : null}

            {open === 'add_tag' || open === 'remove_tag' ? (
              <FormSelect label="Tag" value={tag} onChange={setTag} placeholder="Pick a tag" options={tags} />
            ) : null}

            {open === 'set_stage' ? (
              <FormSelect label="Stage" value={stage} onChange={setStage} placeholder="Pick a stage" options={stages} />
            ) : null}

            {open === 'enroll_workflow' ? (
              <FormSelect
                label="Workflow"
                value={sequenceId}
                onChange={setSequenceId}
                placeholder="Pick a workflow"
                options={sequences.map((s) => ({ key: String(s.id), label: s.name }))}
              />
            ) : null}

            {open === 'email_cohort' ? (
              <>
                <FormSelect
                  label="Template (optional)"
                  value={templateId}
                  onChange={setTemplateId}
                  placeholder="Pick a template, or write below"
                  options={emailTemplates.filter((t) => t.channel === 'email').map((t) => ({ key: String(t.id), label: t.name }))}
                />
                {!templateId ? (
                  <>
                    <div>
                      <Label htmlFor="bulk-email-subject" className="mb-1.5 block text-xs text-muted-foreground">Subject</Label>
                      <Input id="bulk-email-subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="h-10 md:h-9" />
                    </div>
                    <div>
                      <Label htmlFor="bulk-email-body" className="mb-1.5 block text-xs text-muted-foreground">Body</Label>
                      <Textarea id="bulk-email-body" value={body} onChange={(e) => setBody(e.target.value)} rows={5} />
                    </div>
                  </>
                ) : null}
              </>
            ) : null}

            {open === 'set_report_subscription' ? (
              <>
                <Label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={reportActive} onCheckedChange={(v) => setReportActive(v === true)} />
                  Turn the subscription on
                </Label>
                {reportActive ? (
                  <>
                    <div>
                      <Label className="mb-1.5 block text-xs text-muted-foreground">Areas</Label>
                      <div className="max-h-40 space-y-1.5 overflow-y-auto no-scrollbar rounded-md border border-border p-2">
                        {reportAreas.map((a) => (
                          <Label key={a.key} className="flex items-center gap-2 text-sm font-normal">
                            <Checkbox checked={reportAreaKeys.has(a.key)} onCheckedChange={() => toggleArea(a.key)} />
                            {a.label}
                          </Label>
                        ))}
                      </div>
                    </div>
                    <FormSelect
                      label="Frequency"
                      value={reportFrequency}
                      onChange={setReportFrequency}
                      placeholder="Frequency"
                      options={[{ key: 'monthly', label: 'Monthly' }, { key: 'weekly', label: 'Weekly' }]}
                    />
                  </>
                ) : null}
              </>
            ) : null}

            {open === 'newsletter' ? (
              <FormSelect label="Segment" value={segment} onChange={setSegment} placeholder="Segment" options={NEWSLETTER_SEGMENTS} />
            ) : null}

            {open === 'saved_search' ? (
              <div>
                <Label htmlFor="bulk-ss-name" className="mb-1.5 block text-xs text-muted-foreground">Search name</Label>
                <Input id="bulk-ss-name" value={ssName} onChange={(e) => setSsName(e.target.value)} placeholder="Bend under 600k" className="h-10 md:h-9" />
              </div>
            ) : null}

            {error ? <p className="text-xs text-destructive" role="alert">{error}</p> : null}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={closeDialog} disabled={isPending}>Cancel</Button>
            <Button size="sm" onClick={run} disabled={isPending}>
              {isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : null}
              Run
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** A small labeled select used by most action forms. */
function FormSelect({
  label, value, onChange, placeholder, options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  options: BulkPickerOption[]
}) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-10 md:h-9">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.length === 0 ? (
            <SelectItem value="__none" disabled>None available</SelectItem>
          ) : (
            options.map((o) => (
              <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  )
}
