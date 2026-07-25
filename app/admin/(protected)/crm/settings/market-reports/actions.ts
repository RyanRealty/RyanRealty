'use server'

/**
 * Market-report BULK SEND actions (W8.6) — the admin surface over
 * lib/newsletter/market-report-bulk.
 *
 * Two actions, one shape:
 *   previewMarketReportBulkAction  dry run. Resolves the chosen audience, renders
 *                                  the issue from §0 cache data, returns counts +
 *                                  a sample + the citation trace. Writes NOTHING.
 *   queueMarketReportBulkAction    hands the issue to the newsletter delivery
 *                                  ledger. Refuses without an approver, outside
 *                                  the send window, or when the audience changed
 *                                  size since the preview the approver saw.
 *
 * Neither action sends mail. The newsletter drain cron does, re-checking
 * suppression and subscriber status on every recipient row.
 *
 * AUTHZ: superuser only, both actions. Same bar as the newsletter bulk tools
 * (check-newsletter-authz's rule): these reach the company-wide book, so a
 * broker-scoped admin must not be able to fire them.
 */

import { revalidatePath } from 'next/cache'
import { getCrmAccess } from '@/app/actions/crm'
import {
  runMarketReportBulkSend,
  type BulkPreviewResult,
  type BulkQueuedResult,
} from '@/lib/newsletter/market-report-bulk'

export type BulkSendFormInput = {
  /** Raw audience descriptor from the picker; validated server-side, fail-closed. */
  audience: unknown
  areas: string[]
  /** Queue only: the count shown in the preview the approver acted on. */
  expectedRecipientCount?: number
}

export type PreviewActionResult =
  | { ok: true; preview: BulkPreviewResult }
  | { ok: false; error: string }

export type QueueActionResult =
  | { ok: true; queued: BulkQueuedResult }
  | { ok: false; error: string }

async function requireSuperuser(): Promise<{ ok: true; email: string } | { ok: false }> {
  const access = await getCrmAccess()
  if (!access || access.role !== 'superuser') return { ok: false }
  return { ok: true, email: access.email }
}

/** Human message per typed router error. */
const MESSAGES: Record<string, string> = {
  invalid_audience: 'Pick a valid audience first.',
  no_areas: 'Pick at least one area.',
  no_recipients: 'That audience resolves to nobody with an email on file.',
  no_market_data: 'None of the selected areas have verified market data right now, so there is nothing to send.',
  too_many_recipients: 'That audience is over the 5,000-recipient cap for one send. Split it.',
  count_changed: 'The audience changed size since you previewed it. Preview again before queueing.',
  voice_failed: 'The rendered issue failed the brand-voice check.',
  approval_required: 'Only a signed-in superuser can queue a send.',
  outside_send_window: 'Bulk sends start between 8am and 8pm market time. Queue it when the window opens.',
  draft_failed: 'Could not write the draft.',
  enqueue_failed: 'The newsletter queue refused the send.',
}

function message(error: string, detail?: string): string {
  const base = MESSAGES[error] ?? error
  return detail ? `${base} (${detail})` : base
}

/** Dry run. No draft, no queue row, no subscriber row, no send. */
export async function previewMarketReportBulkAction(input: BulkSendFormInput): Promise<PreviewActionResult> {
  const gate = await requireSuperuser()
  if (!gate.ok) return { ok: false, error: 'Not authorized' }

  const result = await runMarketReportBulkSend({
    audience: input.audience,
    areas: Array.isArray(input.areas) ? input.areas : [],
    mode: 'preview',
  })
  if (!result.ok) return { ok: false, error: message(result.error, result.detail) }
  if (result.mode !== 'preview') return { ok: false, error: 'Unexpected result' }
  return { ok: true, preview: result }
}

/**
 * Hand the issue to the newsletter delivery ledger. This is the per-action
 * approval moment: the signed-in superuser IS the approver and their email is
 * stamped on the draft (newsletters.created_by) as the audit record.
 */
export async function queueMarketReportBulkAction(input: BulkSendFormInput): Promise<QueueActionResult> {
  const gate = await requireSuperuser()
  if (!gate.ok) return { ok: false, error: 'Not authorized' }

  const result = await runMarketReportBulkSend({
    audience: input.audience,
    areas: Array.isArray(input.areas) ? input.areas : [],
    mode: 'queue',
    approvedBy: gate.email,
    expectedRecipientCount: input.expectedRecipientCount,
  })
  if (!result.ok) return { ok: false, error: message(result.error, result.detail) }
  if (result.mode !== 'queue') return { ok: false, error: 'Unexpected result' }

  revalidatePath('/admin/crm/settings/market-reports')
  revalidatePath('/admin/newsletters')
  return { ok: true, queued: result }
}
