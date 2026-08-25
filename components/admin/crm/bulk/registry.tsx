'use client'

/**
 * The declarative bulk-action registry (audit finding #7b decomposition of the
 * 977-line BulkActions.tsx god-component). One `BulkActionSpec` per action —
 * its form (`Fields`), its client-side `validate`, and its `run`, which calls
 * the EXACT same server action, with the EXACT same payload, that the original
 * mega-switch called. Behavior-preserving only — see BulkActions.tsx for the
 * shared "chrome" (scope toggle, preflight, confirm dialog, enqueue handling)
 * every spec here plugs into.
 */

import { useEffect, useRef } from 'react'
import {
  bulkAssignBrokerAction,
  bulkAddTagAction,
  bulkRemoveTagAction,
  bulkSetStageAction,
  bulkEnrollWorkflowAction,
  bulkSetReportSubscriptionAction,
  bulkAssignSavedSearchAction,
  bulkEmailCohortAction,
  bulkDeleteAction,
  bulkSetSourceAction,
  bulkSetTimeframeAction,
  bulkSetLenderAction,
  bulkAssignPondAction,
  bulkAddCollaboratorAction,
  bulkRemoveCollaboratorAction,
} from '@/app/actions/crm-bulk'
import { bulkMergePeopleAction } from '@/app/actions/crm-person-gaps'
import { adminBulkAssignNewsletterAction } from '@/app/actions/newsletter'
import { TIMEFRAME_OPTIONS } from '@/components/admin/shared/people-list/people-list-utils'
import { getFiltersSummary } from '@/lib/search-filters'
import { PROPERTY_TYPES } from '@/lib/property-type'
import { EmailBodyEditor } from '@/components/admin/crm/EmailBodyEditor'
import {
  AttachmentChips,
  AttachmentControl,
  useComposerAttachments,
} from '@/components/admin/crm/ComposerAttachments'
import { Combobox, SelectField, TextField, ToolbarCheck } from '@/components/admin/v2'
import { FormSelect } from './FormSelect'
import { TagCombo, bulkTagError, normalizeBulkTag } from './TagCombo'
import { BatchRecipients, EMPTY_RECIPIENTS, type BatchRecipientsState } from './BatchRecipients'
import {
  defineBulkAction,
  type ActionId,
  type BulkActionSpec,
  type BulkFieldsProps,
  type BulkPickerOption,
} from './types'

/**
 * `.av2-check` is inline-flex — the shadcn rows it replaces were `flex`, i.e.
 * block-level, so without this each option would flow onto the same line as the
 * next. ToolbarCheck's own `labelStyle` hook carries it; a className would not
 * reach the wrapping <label>.
 */
const CHECK_ROW = { display: 'flex' } as const
const QUIET_LABEL = { color: 'var(--a-text-2)' }

const NEWSLETTER_SEGMENTS: BulkPickerOption[] = [
  { key: 'general', label: 'General' },
  { key: 'buyer', label: 'Buyer' },
  { key: 'seller', label: 'Seller' },
  { key: 'past-client', label: 'Past client' },
]

// ── assign_broker ─────────────────────────────────────────────────────────────

type AssignBrokerValue = { broker: string }

function AssignBrokerFields({ value, onChange, ctx }: BulkFieldsProps<AssignBrokerValue>) {
  return (
    <FormSelect
      label="Broker" value={value.broker} onChange={(v) => onChange({ broker: v })}
      placeholder="Pick a broker" options={ctx.brokers}
    />
  )
}

const assignBroker = defineBulkAction<AssignBrokerValue>({
  id: 'assign_broker',
  title: 'Assign Agent',
  jobKind: 'crm:assign-broker',
  initialValue: { broker: '' },
  Fields: AssignBrokerFields,
  validate: (v) => (!v.broker ? 'Pick a broker' : null),
  run: async (v, sel) => ({ mode: 'job', result: await bulkAssignBrokerAction(sel, v.broker) }),
})

// ── add_tag / remove_tag ──────────────────────────────────────────────────────

type TagValue = { tag: string }

function TagFields({ value, onChange, ctx }: BulkFieldsProps<TagValue>) {
  return <TagCombo value={value.tag} onChange={(v) => onChange({ tag: v })} options={ctx.tags} />
}

const addTag = defineBulkAction<TagValue>({
  id: 'add_tag',
  title: 'Add Tags',
  jobKind: 'crm:add-tag',
  initialValue: { tag: '' },
  Fields: TagFields,
  validate: (v) => bulkTagError(v.tag),
  run: async (v, sel) => ({ mode: 'job', result: await bulkAddTagAction(sel, normalizeBulkTag(v.tag)) }),
})

const removeTag = defineBulkAction<TagValue>({
  id: 'remove_tag',
  title: 'Remove Tags',
  jobKind: 'crm:remove-tag',
  initialValue: { tag: '' },
  Fields: TagFields,
  validate: (v) => bulkTagError(v.tag),
  run: async (v, sel) => ({ mode: 'job', result: await bulkRemoveTagAction(sel, normalizeBulkTag(v.tag)) }),
})

// ── set_stage ──────────────────────────────────────────────────────────────────

type StageValue = { stage: string }

function SetStageFields({ value, onChange, ctx }: BulkFieldsProps<StageValue>) {
  return (
    <FormSelect
      label="Stage" value={value.stage} onChange={(v) => onChange({ stage: v })}
      placeholder="Pick a stage" options={ctx.stages}
    />
  )
}

const setStage = defineBulkAction<StageValue>({
  id: 'set_stage',
  title: 'Update Stage',
  jobKind: 'crm:set-stage',
  initialValue: { stage: '' },
  Fields: SetStageFields,
  validate: (v) => (!v.stage ? 'Pick a stage' : null),
  run: async (v, sel) => ({ mode: 'job', result: await bulkSetStageAction(sel, v.stage) }),
})

// ── enroll_workflow ────────────────────────────────────────────────────────────

type EnrollWorkflowValue = { sequenceId: string }

function EnrollWorkflowFields({ value, onChange, ctx }: BulkFieldsProps<EnrollWorkflowValue>) {
  return (
    <FormSelect
      label="Workflow" value={value.sequenceId} onChange={(v) => onChange({ sequenceId: v })}
      placeholder="Pick a workflow"
      options={ctx.sequences.map((s) => ({ key: String(s.id), label: s.name }))}
    />
  )
}

const enrollWorkflow = defineBulkAction<EnrollWorkflowValue>({
  id: 'enroll_workflow',
  title: 'Apply Automation',
  jobKind: 'crm:enroll-workflow',
  initialValue: { sequenceId: '' },
  Fields: EnrollWorkflowFields,
  validate: (v) => (!Number(v.sequenceId) ? 'Pick a workflow' : null),
  run: async (v, sel) => ({ mode: 'job', result: await bulkEnrollWorkflowAction(sel, Number(v.sequenceId)) }),
})

// ── set_report_subscription ───────────────────────────────────────────────────

type ReportSubscriptionValue = { areaKeys: Set<string>; active: boolean; frequency: string }

function SetReportSubscriptionFields({ value, onChange, ctx }: BulkFieldsProps<ReportSubscriptionValue>) {
  const toggleArea = (key: string) => {
    const next = new Set(value.areaKeys)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    onChange({ ...value, areaKeys: next })
  }
  return (
    <>
      <ToolbarCheck
        label="Turn the subscription on"
        labelStyle={CHECK_ROW}
        checked={value.active}
        onChange={(e) => onChange({ ...value, active: e.target.checked })}
      />
      {value.active ? (
        <>
          <div>
            {/* A group caption, not a control label — it never carried htmlFor. */}
            <span className="mb-1.5 block text-xs" style={QUIET_LABEL}>Areas</span>
            <div
              className="max-h-40 space-y-1.5 overflow-y-auto no-scrollbar rounded-md border p-2"
              style={{ borderColor: 'var(--a-border)' }}
            >
              {ctx.reportAreas.map((a) => (
                <ToolbarCheck
                  key={a.key}
                  label={a.label}
                  labelStyle={CHECK_ROW}
                  checked={value.areaKeys.has(a.key)}
                  onChange={() => toggleArea(a.key)}
                />
              ))}
            </div>
          </div>
          <FormSelect
            label="Frequency" value={value.frequency} onChange={(v) => onChange({ ...value, frequency: v })}
            placeholder="Frequency"
            options={[{ key: 'monthly', label: 'Monthly' }, { key: 'weekly', label: 'Weekly' }]}
          />
        </>
      ) : null}
    </>
  )
}

const setReportSubscription = defineBulkAction<ReportSubscriptionValue>({
  id: 'set_report_subscription',
  title: 'Market report subscription',
  jobKind: 'crm:set-report-subscription',
  initialValue: { areaKeys: new Set<string>(), active: true, frequency: 'monthly' },
  Fields: SetReportSubscriptionFields,
  validate: (v) => {
    const areas = Array.from(v.areaKeys)
    return v.active && areas.length === 0 ? 'Pick at least one area' : null
  },
  run: async (v, sel) => {
    const areas = Array.from(v.areaKeys)
    return {
      mode: 'job',
      result: await bulkSetReportSubscriptionAction(sel, { areas, frequency: v.frequency, isActive: v.active }),
    }
  },
})

// ── email_cohort ───────────────────────────────────────────────────────────────

/** Sentinel for "an attachment upload is still in flight" (see validate). */
const UPLOADING = '__uploading__'

type EmailCohortValue = {
  templateId: string
  subject: string
  body: string
  attachments: string
  recipients: BatchRecipientsState
}

function EmailCohortFields({ value, onChange, ctx }: BulkFieldsProps<EmailCohortValue>) {
  // Batch mode: a cohort has no single contact, so the upload grant is
  // namespaced by the signed-in broker instead. Same bucket, same limits, same
  // client-direct upload the one-to-one composer uses — the dialog only ever
  // posts storage paths.
  const attachments = useComposerAttachments({ batch: true, channel: 'email' })
  // The hook owns the pending list; mirror the uploaded refs onto the action's
  // value so validate/run read one source of truth. In an effect, not during
  // render — onChange sets parent state, and calling it from a render body is
  // the classic "cannot update a component while rendering another" loop.
  // One sentinel the validator can see: while anything is uploading the value
  // is not a valid ref list, so Run is blocked with a reason.
  const readyJson = attachments.uploading ? UPLOADING : JSON.stringify(attachments.ready)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const valueRef = useRef(value)
  valueRef.current = value
  useEffect(() => {
    if (valueRef.current.attachments !== readyJson) {
      onChangeRef.current({ ...valueRef.current, attachments: readyJson })
    }
  }, [readyJson])
  return (
    <>
      <BatchRecipients
        selection={ctx.selection}
        state={value.recipients}
        onChange={(recipients) => onChangeRef.current({ ...valueRef.current, recipients })}
      />
      {/* 51 email templates in a native select is a scroll-and-squint. The v2
          Combobox is the barrel's answer for exactly this ("reach for it when
          the list is long enough to need a search") and keeps APG arrow-key
          selection, which a hand-rolled search panel loses. */}
      <Combobox
        label="Template (optional)"
        placeholder="Search templates, or leave blank and write below"
        emptyText="No template matches."
        value={value.templateId}
        onSelect={(v) => onChange({ ...value, templateId: v === value.templateId ? '' : v })}
        options={ctx.emailTemplates
          .filter((t) => t.channel === 'email')
          .map((t) => ({ value: String(t.id), label: t.name }))}
      />
      {!value.templateId ? (
        // The canonical email editing surface — same interface as every other
        // email send. The merge dropdown used to be hidden here on the premise
        // that "the bulk pipeline resolves its own tokens"; it does not. The
        // cohort handler calls the SAME renderCrmMerge with the same
        // buildMergeContext the one-to-one composer uses, so %contact_first_name%
        // and friends work in a batch and the broker should be able to insert
        // them.
        <EmailBodyEditor
          subject={value.subject}
          onSubjectChange={(v) => onChange({ ...value, subject: v })}
          body={value.body}
          onBodyChange={(v) => onChange({ ...value, body: v })}
          signatureHtml={null}
          mergeMode="template"
          // The editor's default placeholder describes the one-to-one composer,
          // which does send from the broker's own mailbox. A batch goes out over
          // Resend from the verified sending domain, with the sender set as the
          // reply address. Saying otherwise on a send surface is worse than
          // saying nothing.
          bodyPlaceholder="Message. Sends from Ryan Realty's sending address; replies come back to you."
        />
      ) : null}
      {/* Outside the template branch on purpose: a template send needs to be
          able to carry a flyer just as much as a typed one does. */}
      <div className="flex flex-wrap items-center gap-2">
        <AttachmentControl attachments={attachments} ariaLabel="Attach files" />
        <span style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
          {attachments.items.length === 0
            ? 'Attach files'
            : `Every recipient gets the same ${attachments.items.length === 1 ? 'file' : 'files'}.`}
        </span>
      </div>
      <AttachmentChips items={attachments.items} onRemove={attachments.remove} />
    </>
  )
}

const emailCohort = defineBulkAction<EmailCohortValue>({
  id: 'email_cohort',
  title: 'Batch Email',
  jobKind: 'email-cohort',
  initialValue: { templateId: '', subject: '', body: '', attachments: '', recipients: EMPTY_RECIPIENTS },
  Fields: EmailCohortFields,
  validate: (v) => {
    const tId = v.templateId.trim()
    if (!tId && !(v.subject.trim() && v.body.trim())) {
      return 'Pick a template, or write a subject and body'
    }
    // A file still uploading has no storage path yet, so enqueueing now would
    // send the cohort without it — silently, and to everyone.
    if (v.attachments === UPLOADING) return 'Wait for the attachments to finish uploading'
    // An edited cohort that ends up empty would enqueue a job with no one in it.
    if (v.recipients.edited && (v.recipients.people ?? []).length === 0) {
      return 'No recipients left — add someone, or cancel'
    }
    return null
  },
  run: async (v, sel) => {
    const tId = v.templateId.trim()
    // Untouched, the original selection passes through so a saved-view or
    // "all matching" send still resolves at run time. Edited, the send becomes
    // exactly the people on screen.
    const selection =
      v.recipients.edited && !v.recipients.capped
        ? { mode: 'ids' as const, ids: (v.recipients.people ?? []).map((p) => p.id) }
        : sel
    return {
      mode: 'job',
      result: await bulkEmailCohortAction(selection, {
        templateId: tId || undefined,
        subject: v.subject.trim() || undefined,
        body: v.body || undefined,
        attachments: v.attachments && v.attachments !== UPLOADING ? v.attachments : undefined,
      }),
    }
  },
})

// ── newsletter (legacy — ids only) ────────────────────────────────────────────

type NewsletterValue = { segment: string }

function NewsletterFields({ value, onChange }: BulkFieldsProps<NewsletterValue>) {
  return (
    <FormSelect
      label="Segment" value={value.segment} onChange={(v) => onChange({ segment: v })}
      placeholder="Segment" options={NEWSLETTER_SEGMENTS}
    />
  )
}

const newsletter = defineBulkAction<NewsletterValue>({
  id: 'newsletter',
  title: 'Add to newsletter',
  initialValue: { segment: 'general' },
  Fields: NewsletterFields,
  run: async (v, _sel, ctx) => {
    const res = await adminBulkAssignNewsletterAction(
      ctx.selectedIds,
      v.segment as 'general' | 'buyer' | 'seller' | 'past-client',
    )
    if (!res.ok) {
      return { mode: 'legacy', result: { ok: false, error: res.error ?? 'Could not add to the newsletter' } }
    }
    return { mode: 'legacy', result: { ok: true, assigned: res.assigned ?? 0, skipped: res.skipped ?? 0 } }
  },
})

// ── saved_search ───────────────────────────────────────────────────────────────

type SavedSearchValue = {
  name: string
  frequency: string
  city: string
  minPrice: string
  maxPrice: string
  beds: string
  baths: string
  propertyType: string
}

/** The filters object for Assign a saved search — EXACT FILTER_KEYS names from
 *  lib/search-filters.ts (city, minPrice, maxPrice, beds, baths, propertyType)
 *  so the alert cron + search URL builders read them natively. Verbatim move. */
function buildSavedSearchFilters(v: SavedSearchValue): Record<string, unknown> {
  const filters: Record<string, unknown> = {}
  if (v.city.trim()) filters.city = v.city.trim()
  const minPrice = Number(v.minPrice)
  if (v.minPrice.trim() && Number.isFinite(minPrice) && minPrice > 0) filters.minPrice = minPrice
  const maxPrice = Number(v.maxPrice)
  if (v.maxPrice.trim() && Number.isFinite(maxPrice) && maxPrice > 0) filters.maxPrice = maxPrice
  if (v.beds !== 'any') filters.beds = Number(v.beds)
  if (v.baths !== 'any') filters.baths = Number(v.baths)
  if (v.propertyType !== 'any') filters.propertyType = v.propertyType
  return filters
}

function SavedSearchFields({ value, onChange }: BulkFieldsProps<SavedSearchValue>) {
  return (
    <>
      {/* TextField owns the label<->input association (useId + htmlFor), so the
          hand-written ids these fields carried are no longer needed; nothing
          referenced them. */}
      <TextField
        label="Search name (optional)"
        value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })}
        placeholder="Bend under 600k"
      />
      <FormSelect
        label="Alert frequency" value={value.frequency} onChange={(v) => onChange({ ...value, frequency: v })}
        placeholder="Frequency" options={[{ key: 'daily', label: 'Daily' }, { key: 'weekly', label: 'Weekly' }]}
      />
      <TextField
        label="City"
        value={value.city} onChange={(e) => onChange({ ...value, city: e.target.value })}
        placeholder="Bend"
      />
      <div className="grid grid-cols-2 gap-2">
        <TextField
          label="Min price"
          type="number" inputMode="numeric" min={0}
          value={value.minPrice} onChange={(e) => onChange({ ...value, minPrice: e.target.value })}
          placeholder="500000"
        />
        <TextField
          label="Max price"
          type="number" inputMode="numeric" min={0}
          value={value.maxPrice} onChange={(e) => onChange({ ...value, maxPrice: e.target.value })}
          placeholder="900000"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <FormSelect
          label="Min beds" value={value.beds} onChange={(v) => onChange({ ...value, beds: v })}
          placeholder="Any"
          options={[
            { key: 'any', label: 'Any' },
            { key: '1', label: '1+' },
            { key: '2', label: '2+' },
            { key: '3', label: '3+' },
            { key: '4', label: '4+' },
            { key: '5', label: '5+' },
          ]}
        />
        <FormSelect
          label="Min baths" value={value.baths} onChange={(v) => onChange({ ...value, baths: v })}
          placeholder="Any"
          options={[
            { key: 'any', label: 'Any' },
            { key: '1', label: '1+' },
            { key: '2', label: '2+' },
            { key: '3', label: '3+' },
            { key: '4', label: '4+' },
          ]}
        />
      </div>
      <FormSelect
        label="Property type" value={value.propertyType} onChange={(v) => onChange({ ...value, propertyType: v })}
        placeholder="All types"
        options={[
          { key: 'any', label: 'All types' },
          ...PROPERTY_TYPES.filter((t) => t.value !== '').map((t) => ({ key: t.value, label: t.label })),
        ]}
      />
      <p className="text-xs" style={QUIET_LABEL} aria-live="polite">
        Alerts will match {getFiltersSummary(buildSavedSearchFilters(value))}
      </p>
    </>
  )
}

const savedSearch = defineBulkAction<SavedSearchValue>({
  id: 'saved_search',
  title: 'Assign a saved search',
  jobKind: 'crm:assign-saved-search',
  initialValue: {
    name: '', frequency: 'daily', city: '', minPrice: '', maxPrice: '', beds: 'any', baths: 'any', propertyType: 'any',
  },
  Fields: SavedSearchFields,
  validate: (v) => (Object.keys(buildSavedSearchFilters(v)).length === 0 ? 'Add at least one search filter first' : null),
  run: async (v, sel) => ({
    mode: 'job',
    result: await bulkAssignSavedSearchAction(sel, {
      filters: buildSavedSearchFilters(v),
      name: v.name.trim() || undefined,
      frequency: v.frequency,
    }),
  }),
})

// ── delete_contacts ────────────────────────────────────────────────────────────

const deleteContacts = defineBulkAction<undefined>({
  id: 'delete_contacts',
  title: 'Delete contacts',
  jobKind: 'crm:delete',
  dangerous: true,
  initialValue: undefined,
  Fields: null,
  run: async (_v, sel) => ({ mode: 'job', result: await bulkDeleteAction(sel) }),
})

// ── set_source ─────────────────────────────────────────────────────────────────

type SourceValue = { source: string }

function SetSourceFields({ value, onChange, ctx }: BulkFieldsProps<SourceValue>) {
  return ctx.sources.length > 0 ? (
    <FormSelect
      label="Lead source" value={value.source} onChange={(v) => onChange({ source: v })}
      placeholder="Pick a source" options={ctx.sources}
    />
  ) : (
    <TextField
      label="Lead source"
      value={value.source} onChange={(e) => onChange({ source: e.target.value })}
      placeholder="Referral"
    />
  )
}

const setSource = defineBulkAction<SourceValue>({
  id: 'set_source',
  title: 'Update Source',
  jobKind: 'crm:set-source',
  initialValue: { source: '' },
  Fields: SetSourceFields,
  validate: (v) => (!v.source.trim() ? 'Pick or type a source' : null),
  run: async (v, sel) => ({ mode: 'job', result: await bulkSetSourceAction(sel, v.source.trim()) }),
})

// ── set_timeframe ──────────────────────────────────────────────────────────────

type TimeframeValue = { timeframe: string }

function SetTimeframeFields({ value, onChange }: BulkFieldsProps<TimeframeValue>) {
  return (
    <FormSelect
      label="Timeframe" value={value.timeframe} onChange={(v) => onChange({ timeframe: v })}
      placeholder="Pick a timeframe" options={TIMEFRAME_OPTIONS.map((t) => ({ key: t, label: t }))}
    />
  )
}

const setTimeframe = defineBulkAction<TimeframeValue>({
  id: 'set_timeframe',
  title: 'Update Timeframe',
  jobKind: 'crm:set-timeframe',
  initialValue: { timeframe: '' },
  Fields: SetTimeframeFields,
  validate: (v) => (!v.timeframe ? 'Pick a timeframe' : null),
  run: async (v, sel) => ({ mode: 'job', result: await bulkSetTimeframeAction(sel, v.timeframe) }),
})

// ── set_lender ─────────────────────────────────────────────────────────────────

type LenderValue = { lender: string }

function SetLenderFields({ value, onChange }: BulkFieldsProps<LenderValue>) {
  return (
    <TextField
      label="Lender name"
      value={value.lender} onChange={(e) => onChange({ lender: e.target.value })}
      placeholder="Lender or loan officer"
    />
  )
}

const setLender = defineBulkAction<LenderValue>({
  id: 'set_lender',
  title: 'Assign Lender',
  jobKind: 'crm:set-lender',
  initialValue: { lender: '' },
  Fields: SetLenderFields,
  validate: (v) => (!v.lender.trim() ? 'Type a lender name' : null),
  run: async (v, sel) => ({ mode: 'job', result: await bulkSetLenderAction(sel, v.lender.trim()) }),
})

// ── assign_pond ────────────────────────────────────────────────────────────────

type PondValue = { pondId: string }

function AssignPondFields({ value, onChange, ctx }: BulkFieldsProps<PondValue>) {
  return (
    <FormSelect
      label="Pond" value={value.pondId} onChange={(v) => onChange({ pondId: v })}
      placeholder="Pick a pond" options={ctx.ponds}
    />
  )
}

const assignPond = defineBulkAction<PondValue>({
  id: 'assign_pond',
  title: 'Assign Ponds',
  jobKind: 'crm:assign-pond',
  initialValue: { pondId: '' },
  Fields: AssignPondFields,
  validate: (v) => (!Number(v.pondId) ? 'Pick a pond' : null),
  run: async (v, sel) => ({ mode: 'job', result: await bulkAssignPondAction(sel, Number(v.pondId)) }),
})

// ── add_collaborator / remove_collaborator ────────────────────────────────────

type CollaboratorValue = { collabBroker: string }

function CollaboratorFields({ value, onChange, ctx }: BulkFieldsProps<CollaboratorValue>) {
  return (
    <FormSelect
      label="Broker" value={value.collabBroker} onChange={(v) => onChange({ collabBroker: v })}
      placeholder="Pick a broker" options={ctx.brokers}
    />
  )
}

const addCollaborator = defineBulkAction<CollaboratorValue>({
  id: 'add_collaborator',
  title: 'Add Collaborators',
  jobKind: 'crm:add-collaborator',
  initialValue: { collabBroker: '' },
  Fields: CollaboratorFields,
  validate: (v) => (!v.collabBroker ? 'Pick a broker' : null),
  run: async (v, sel) => ({ mode: 'job', result: await bulkAddCollaboratorAction(sel, v.collabBroker) }),
})

const removeCollaborator = defineBulkAction<CollaboratorValue>({
  id: 'remove_collaborator',
  title: 'Remove Collaborators',
  jobKind: 'crm:remove-collaborator',
  initialValue: { collabBroker: '' },
  Fields: CollaboratorFields,
  validate: (v) => (!v.collabBroker ? 'Pick a broker' : null),
  run: async (v, sel) => ({ mode: 'job', result: await bulkRemoveCollaboratorAction(sel, v.collabBroker) }),
})

// ── merge_people (legacy — ids only, custom result shape) ────────────────────

type MergePeopleValue = { survivorId: string }

function MergePeopleFields({ value, onChange, ctx }: BulkFieldsProps<MergePeopleValue>) {
  // Matches the original `open === 'merge_people' && !legacyResult` guard —
  // the survivor picker disappears once the merge has completed.
  if (ctx.legacyResult) return null
  const idCount = ctx.selectedIds.length
  return (
    <SelectField
      label={`Surviving contact (the ${idCount - 1} other ${idCount === 2 ? 'contact keeps' : 'contacts keep'} nothing. Timeline, tasks and workflows move to the survivor, duplicates are archived to Trash)`}
      value={value.survivorId}
      onChange={(e) => onChange({ survivorId: e.target.value })}
    >
      <option value="" disabled>Pick the survivor</option>
      {ctx.selectedRows
        .filter((r) => ctx.selectedIds.includes(r.id))
        .map((r) => (
          <option key={r.id} value={String(r.id)}>{r.name ?? `Contact #${r.id}`}</option>
        ))}
    </SelectField>
  )
}

const mergePeople = defineBulkAction<MergePeopleValue>({
  id: 'merge_people',
  title: 'Merge People',
  initialValue: { survivorId: '' },
  Fields: MergePeopleFields,
  validate: (v) => (!Number(v.survivorId) ? 'Pick the surviving contact' : null),
  run: async (v, _sel, ctx) => {
    const survivorId = Number(v.survivorId)
    const mergedIds = ctx.selectedIds.filter((id) => id !== survivorId)
    const res = await bulkMergePeopleAction({ survivorId, mergedIds })
    if (!res.ok) return { mode: 'legacy', result: { ok: false, error: res.error } }
    return {
      mode: 'legacy',
      result: { ok: true, assigned: res.merged, skipped: ctx.selectedIds.length - 1 - res.merged },
    }
  },
})

// ── Registry ───────────────────────────────────────────────────────────────────

export const BULK_ACTION_REGISTRY: Record<ActionId, BulkActionSpec<any>> = {
  assign_broker: assignBroker,
  add_tag: addTag,
  remove_tag: removeTag,
  set_stage: setStage,
  enroll_workflow: enrollWorkflow,
  set_report_subscription: setReportSubscription,
  email_cohort: emailCohort,
  newsletter,
  saved_search: savedSearch,
  delete_contacts: deleteContacts,
  set_source: setSource,
  set_timeframe: setTimeframe,
  set_lender: setLender,
  assign_pond: assignPond,
  add_collaborator: addCollaborator,
  remove_collaborator: removeCollaborator,
  merge_people: mergePeople,
}
