/**
 * Bulk handler: 'email-cohort' — the marquee bulk SEND. Mails ONE templated email
 * to every contact in a selection / filter, run through the chunked bulk worker so
 * an 18K-recipient cohort never blocks a single request.
 *
 * THIS IS A SEND PATH. Every recipient is gated through the suppression chokepoint
 * (lib/crm/suppressions.ts isSuppressed, FAIL-CLOSED) BEFORE the wire — an
 * unsubscribed / complained / bounced / compliance:hard-stop contact is skipped
 * and counted, never mailed. CAN-SPAM + List-Unsubscribe come from
 * prepareDeliverableEmail; broker attribution + open/click tracking from
 * attributeOutbound; and one email_events 'sent' row is written per delivered
 * recipient (recordEmailEvent) so the send is measured.
 *
 * Gate note (ci:email-send-gated): isSuppressed(...) and sendEmail(...) are both
 * inline in sendOneCohortEmail() — the per-recipient send function — so the static
 * gate sees the suppression check at-or-before the send in the SAME scope. Do not
 * factor the send out of the function that holds the isSuppressed call.
 *
 * DAL boundary (G1): the crm_people / crm_templates reads live in
 * lib/data/crm/getEmailCohortRecipients.ts. This file holds the send orchestration
 * + the pure helpers (unit-tested).
 */
import 'server-only'
import {
  registerBulkHandler,
  type BulkContext,
  type BulkResult,
} from '@/lib/crm/bulk-jobs'
import { isSuppressed } from '@/lib/crm/suppressions'
import { sendEmail } from '@/lib/resend'
import { prepareDeliverableEmail } from '@/lib/email/prepare'
import { attributeOutbound } from '@/lib/crm/attributed-links'
import { recordEmailEvent, type EmailSendType } from '@/lib/crm/email-events'
import { renderCrmMerge } from '@/lib/crm/merge'
import {
  getEmailCohortRecipients,
  getCrmTemplateForSend,
  type EmailCohortRecipient,
} from '@/lib/data/crm/getEmailCohortRecipients'

/** The job kind this handler registers under. */
export const EMAIL_COHORT_KIND = 'email-cohort' as const

/**
 * Params the enqueue action freezes onto the job. Either a saved templateId OR an
 * inline subject+body (one or the other — validated by the enqueue action). The
 * fromIdentity is the verified Resend sender; emailKey anchors open/click + event
 * dedupe across the whole cohort.
 */
export type EmailCohortParams = {
  /** A crm_templates id to render; mutually exclusive with subject+body. */
  templateId?: number | null
  /** Inline subject (used when no templateId). */
  subject?: string | null
  /** Inline HTML body (used when no templateId). */
  body?: string | null
  /** Verified From address; falls back to RESEND_FROM in lib/resend when omitted. */
  fromIdentity?: string | null
  /** Per-send instrumentation key, e.g. 'bulk:campaign:<jobId>'. */
  emailKey?: string | null
  /** Reporting bucket for the email_events rows. Defaults to 'campaign'. */
  sendType?: EmailSendType | null
}

/** The resolved subject+body for the cohort after template/inline resolution. */
export type ResolvedCohortContent = { subject: string; body: string }

// ── Pure helpers (unit-tested) ────────────────────────────────────────────────

/**
 * Resolve the send content from params + (optionally) a loaded template. Inline
 * subject+body wins only when no templateId was given. Returns null when neither
 * a usable template nor inline content is present (the chunk then skips every id
 * with reason 'no-content').
 */
export function resolveCohortContent(
  params: EmailCohortParams,
  template: { subject: string | null; body: string } | null,
): ResolvedCohortContent | null {
  if (params.templateId != null) {
    if (!template) return null
    const subject = (template.subject ?? params.subject ?? '').trim()
    const body = (template.body ?? '').trim()
    if (!subject || !body) return null
    return { subject, body }
  }
  const subject = (params.subject ?? '').trim()
  const body = (params.body ?? '').trim()
  if (!subject || !body) return null
  return { subject, body }
}

/**
 * Collapse a suppression's reason list into ONE stable breakdown bucket, so the
 * job's breakdown stays a small, fixed key set across 18K recipients instead of
 * exploding into per-reason cardinality. Ordered by severity: a hard-stop wins
 * over a channel opt-out, which wins over a generic suppression.
 */
export function suppressionBucket(reasons: string[]): string {
  const joined = reasons.join(' ').toLowerCase()
  if (joined.includes('hard-stop') || joined.includes('check-failed')) return 'suppressed-hard-stop'
  if (joined.includes('unsubscrib') || joined.includes('do_not_email')) return 'suppressed-unsubscribed'
  if (joined.includes('bounce')) return 'suppressed-bounced'
  if (joined.includes('complain')) return 'suppressed-complained'
  return 'suppressed'
}

/** The broker slug to attribute a recipient's links to (assigned broker, else Matt). */
export function attributionSlug(assignedBroker: string | null | undefined): string {
  const s = (assignedBroker ?? '').trim()
  return s || 'matt'
}

/** The stable per-send emailKey for this cohort job (params override, else jobId). */
export function cohortEmailKey(params: EmailCohortParams, jobId: number): string {
  const k = (params.emailKey ?? '').trim()
  return k || `bulk:email-cohort:${jobId}`
}

/** Empty per-chunk result accumulator. */
function emptyResult(): BulkResult {
  return { processed: 0, skipped: 0, breakdown: {} }
}

function bump(result: BulkResult, key: string): void {
  result.breakdown[key] = (result.breakdown[key] ?? 0) + 1
}

// ── The per-recipient send (holds BOTH isSuppressed + sendEmail) ───────────────

type SendOneOutcome =
  | { kind: 'processed' }
  | { kind: 'skipped'; bucket: string }

/**
 * Send the cohort email to ONE recipient. Suppression-checked, attributed,
 * CAN-SPAM-prepared, and recorded. Returns an outcome the chunk loop tallies.
 *
 * The isSuppressed(...) call and the sendEmail(...) call live together in this
 * one function (the ci:email-send-gated invariant): the gate verifies the
 * suppression check precedes the send in the SAME enclosing scope.
 */
export async function sendOneCohortEmail(
  recipient: EmailCohortRecipient,
  content: ResolvedCohortContent,
  params: EmailCohortParams,
  ctx: BulkContext,
): Promise<SendOneOutcome> {
  const email = recipient.email.trim()
  if (!email) return { kind: 'skipped', bucket: 'no-email' }

  // 1) SUPPRESSION CHOKEPOINT — fail-closed. Skip + count any suppressed contact.
  const gate = await isSuppressed(recipient.id, 'email')
  if (gate.suppressed) {
    return { kind: 'skipped', bucket: suppressionBucket(gate.reasons) }
  }

  // 2) Render: merge the contact's fields into subject + body.
  const mergeCtx = {
    first_name: recipient.first_name,
    name: recipient.name,
    custom: recipient.custom,
  }
  const subject = renderCrmMerge(content.subject, mergeCtx)
  const renderedBody = renderCrmMerge(content.body, mergeCtx)

  // 3) Attribution + open/click instrumentation (broker routing + tracking).
  const emailKey = cohortEmailKey(params, ctx.jobId)
  const attributed = attributeOutbound(renderedBody, {
    brokerSlug: attributionSlug(recipient.assigned_broker),
    personId: recipient.id,
    fubPersonId: recipient.fub_legacy_id,
    emailKey,
    label: subject,
  })

  // 4) CAN-SPAM + List-Unsubscribe preflight (multipart, footer, RFC 8058 header).
  const prepared = prepareDeliverableEmail({
    subject,
    html: attributed,
    personId: recipient.id,
  })

  // 5) SEND.
  const sendType: EmailSendType = params.sendType ?? 'campaign'
  const fromIdentity = params.fromIdentity?.trim() || undefined
  const res = await sendEmail({
    to: email,
    subject: prepared.subject,
    html: prepared.html,
    text: prepared.text,
    from: fromIdentity,
    headers: prepared.headers,
  })
  if (res.error) {
    return { kind: 'skipped', bucket: 'send-error' }
  }

  // 6) Measure — one email_events 'sent' row per delivered recipient.
  //    Never throws; a reporting failure must not fail the chunk.
  await recordEmailEvent({
    messageId: res.id ?? null,
    recipientEmail: email,
    personId: recipient.id,
    broker: recipient.assigned_broker,
    sendType,
    event: 'sent',
    emailKey,
    subject,
  })

  return { kind: 'processed' }
}

// ── The bulk handler (chunk of ids) ───────────────────────────────────────────

/**
 * Process one chunk of ids: load the recipients in one query, resolve content
 * once, then send to each recipient sequentially (so a Resend rate limit / per-id
 * failure isolates to that recipient and never aborts the chunk). Ids with no
 * person row are counted no-person.
 */
export async function emailCohortHandler(
  ids: number[],
  rawParams: Record<string, unknown>,
  ctx: BulkContext,
): Promise<Partial<BulkResult>> {
  const params = rawParams as EmailCohortParams
  const result = emptyResult()
  if (ids.length === 0) return result

  // Resolve content once per chunk (cheap; the template read is one row).
  const template =
    params.templateId != null ? await getCrmTemplateForSend(params.templateId) : null
  const content = resolveCohortContent(params, template)

  const recipients = await getEmailCohortRecipients(ids)
  const byId = new Map(recipients.map((r) => [r.id, r]))

  for (const id of ids) {
    const recipient = byId.get(id)
    if (!recipient) {
      result.skipped += 1
      bump(result, 'no-person')
      continue
    }
    if (!content) {
      result.skipped += 1
      bump(result, 'no-content')
      continue
    }
    const outcome = await sendOneCohortEmail(recipient, content, params, ctx)
    if (outcome.kind === 'processed') {
      result.processed += 1
      bump(result, 'sent')
    } else {
      result.skipped += 1
      bump(result, outcome.bucket)
    }
  }
  return result
}

/**
 * Register the email-cohort handler. Called by the bulk-handlers index (the
 * integrator wires it; this file does NOT edit index.ts to avoid a write-conflict
 * with the mutation-handlers agent). Idempotent — last registration wins.
 */
export function registerEmailCohortHandler(): void {
  registerBulkHandler(EMAIL_COHORT_KIND, emailCohortHandler)
}
