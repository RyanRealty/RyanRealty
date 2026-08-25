/**
 * Shared types for the declarative bulk-action registry (audit finding #7b).
 *
 * BulkActions.tsx used to drive 17 unrelated dialogs through one mega-switch +
 * a shared pool of 25+ per-field useState hooks. This registry gives each
 * action a small, colocated `BulkActionSpec`: its form (`Fields`), its client
 * validation, and its dispatch (`run`) to the exact same server action the
 * original switch branch called — same import, same args.
 *
 * NOT extracted here (stays in BulkActions.tsx as shared "chrome" — it applies
 * across every action, not to any one of them): the sticky bar + icon strip,
 * the scope toggle (checked ids vs "all matching"), the preflight count, the
 * confirm dialog shell, and the enqueue -> BulkProgress hookup.
 */

import type { ReactNode } from 'react'
import type { BulkActionSelection, BulkEnqueueResult, BulkKind } from '@/lib/crm/bulk-helpers'

// ── Picker option shapes (unchanged — re-exported by BulkActions.tsx so the
//    parent's import path stays identical). ──────────────────────────────────
export type BulkPickerOption = { key: string; label: string }
export type BulkTemplateOption = { id: number; name: string; channel: 'email' | 'sms' }
export type BulkSequenceOption = { id: number; name: string }

// One discriminated action the dialog renders a form for. 17 members — the
// codebase's own name for this ("16 actions") groups add_tag/remove_tag and
// add_collaborator/remove_collaborator as one bucket each; each still maps to
// its own server action below.
export type ActionId =
  | 'assign_broker'
  | 'add_tag'
  | 'remove_tag'
  | 'set_stage'
  | 'enroll_workflow'
  | 'set_report_subscription'
  | 'email_cohort'
  | 'newsletter'
  | 'saved_search'
  | 'delete_contacts'
  | 'set_source'
  | 'set_timeframe'
  | 'set_lender'
  | 'assign_pond'
  | 'add_collaborator'
  | 'remove_collaborator'
  | 'merge_people'

/** The two legacy (ids-only, non-job) actions return this shape. */
export type BulkLegacyResult =
  | { ok: true; assigned: number; skipped: number }
  | { ok: false; error: string }

/** What a spec's `run` resolves to — the dispatcher branches on `mode`. */
export type BulkRunOutcome =
  | { mode: 'job'; result: BulkEnqueueResult }
  | { mode: 'legacy'; result: BulkLegacyResult }

/**
 * Read-only context every spec's Fields / validate / run can read. Assembled
 * once per render in BulkActions.tsx from its own props + top-level state.
 */
export type BulkCtx = {
  /**
   * The selection the active scope toggle produces right now — the same value
   * `run` receives. Fields need it too: the email cohort resolves it to a real
   * recipient list so the operator can see and edit who is getting the send.
   */
  selection: BulkActionSelection
  selectedIds: number[]
  selectedRows: Array<{ id: number; name: string | null }>
  brokers: BulkPickerOption[]
  stages: BulkPickerOption[]
  tags: BulkPickerOption[]
  reportAreas: BulkPickerOption[]
  emailTemplates: BulkTemplateOption[]
  sequences: BulkSequenceOption[]
  ponds: BulkPickerOption[]
  sources: BulkPickerOption[]
  /**
   * Set once a legacy action has completed. Only merge_people's Fields reads
   * this (to hide the survivor picker once done, matching the original
   * `open === 'merge_people' && !legacyResult` guard). newsletter's original
   * form had no such guard and keeps rendering — preserved by simply not
   * checking this flag in newsletter's Fields.
   */
  legacyResult: { assigned: number; skipped: number } | null
}

export type BulkFieldsProps<V> = {
  value: V
  onChange: (next: V) => void
  ctx: BulkCtx
}

export type BulkActionSpec<V> = {
  id: ActionId
  title: string
  /**
   * The bulk-job kind this action enqueues. Present for the 15 actions that
   * run through the suppression-gated bulk-job framework (scope toggle +
   * preflight count). Absent for the 2 legacy ids-only actions (newsletter,
   * merge_people) — mirrors the original `ACTION_KIND[id]` lookup exactly.
   */
  jobKind?: BulkKind
  /** delete_contacts only — destructive styling + confirm copy. */
  dangerous?: boolean
  initialValue: V
  /** null when the action has no form body (delete_contacts). */
  Fields: ((props: BulkFieldsProps<V>) => ReactNode) | null
  /** Returns an error string to block the run, or null/undefined to proceed. */
  validate?: (value: V, ctx: BulkCtx) => string | null | undefined
  /** Calls the exact server action the original switch branch called. */
  run: (value: V, selection: BulkActionSelection, ctx: BulkCtx) => Promise<BulkRunOutcome>
}

/** Identity helper that lets each spec below infer its own `V` while still
 *  being stored in a heterogeneous `Record<ActionId, BulkActionSpec<any>>`. */
export function defineBulkAction<V>(spec: BulkActionSpec<V>): BulkActionSpec<V> {
  return spec
}
