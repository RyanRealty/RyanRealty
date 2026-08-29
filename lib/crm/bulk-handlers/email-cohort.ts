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
 * attributeOutbound.
 *
 * DOUBLE-SEND SAFETY: between the suppression check and the wire, each recipient is
 * CLAIMED via an idempotent insert of its `sent` email_events row keyed on a stable
 * per-(jobId, personId) dedupe key (cohortSendDedupeKey). Two overlapping worker
 * runs draining the same job build the SAME key — only one insert lands; the other
 * collapses (inserted=false) and skips the wire. So a cron retry firing mid-run can
 * never mail the same person twice. The claim row IS the measurement row (one `sent`
 * per delivered recipient); on a wire failure it is rolled back so a later run can
 * retry.
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
import { type EmailSendType } from '@/lib/crm/email-events'
import {
  insertEmailEvent,
  deleteEmailEventByDedupeKey,
  stampEmailEventMessageId,
} from '@/lib/data/crm/insertEmailEvent'
import { renderCrmMerge } from '@/lib/crm/merge'
import type { CrmAttachmentRef } from '@/lib/crm/attachment-limits'
import { loadEmailAttachments } from '@/lib/crm/attachments'
import { composeOutboundHtml } from '@/lib/crm/email-body'
import { buildMergeContext } from '@/lib/crm/merge-context'
import { getSignatureForMailbox } from '@/lib/crm/email-signature'
import { sendGovernedEmail } from '@/lib/comms/sendGovernedEmail'
import {
  brokerSlugFromActorEmail,
  freezeBulkEmailSendParams,
} from '@/lib/crm/bulk-email-identity'
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
 * fromIdentity is the verified Resend sender; replyTo defaults to the acting
 * broker so a reply reaches a person; emailKey anchors open/click + event
 * dedupe across the whole cohort.
 */
export type EmailCohortParams = {
  /** A crm_templates id to render; mutually exclusive with subject+body. */
  templateId?: number | null
  /** Inline subject (used when no templateId). */
  subject?: string | null
  /** Inline HTML body (used when no templateId). */
  body?: string | null
  /** Verified From address; falls back to the named broker identity, never noreply. */
  fromIdentity?: string | null
  /** Where replies go; falls back to the acting broker's real mailbox. */
  replyTo?: string | null
  /**
   * Append the actor's Gmail-matched signature (lib/crm/email-signature).
   * Default ON — the 1:1 composer already does this; a batch that omitted it
   * was the defect. Explicit false is the off toggle.
   */
  includeSignature?: boolean | null
  /**
   * 'gmail' sends from the actor's Workspace mailbox (true From). Default
   * 'resend' uses the named mail.ryan-realty.com identity with Reply-To the
   * real mailbox — the volume-safe path for a list of thousands.
   */
  sendVia?: 'resend' | 'gmail' | null
  /**
   * Files to attach to every recipient's copy, as crm-files storage refs the
   * enqueue action already validated. The bytes are loaded ONCE per chunk and
   * reused — a 10MB PDF must not be re-downloaded 18,000 times.
   */
  attachments?: CrmAttachmentRef[] | null
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

/**
 * The per-(jobId, personId) idempotency / claim key for a cohort send. STABLE +
 * independent of any provider message id, so two overlapping worker runs draining
 * the same job both build the SAME key for the same recipient. The first run's
 * idempotent insert wins the claim; the second collapses on the unique dedupe_key
 * and skips the wire send — so an overlapping run can never double-send. PURE.
 */
export function cohortSendDedupeKey(jobId: number, personId: number): string {
  return `bulk:email-cohort:${jobId}:p:${personId}:sent`
}

/** Empty per-chunk result accumulator. */
function emptyResult(): BulkResult {
  return { processed: 0, skipped: 0, breakdown: {} }
}

function bump(result: BulkResult, key: string, n = 1): void {
  result.breakdown[key] = (result.breakdown[key] ?? 0) + n
}

// ── The per-recipient send (holds BOTH isSuppressed + sendEmail) ───────────────

type SendOneOutcome =
  | { kind: 'processed' }
  | { kind: 'skipped'; bucket: string }

/**
 * Send the cohort email to ONE recipient. Suppression-checked, claimed
 * (idempotent), attributed, CAN-SPAM-prepared, sent, and recorded. Returns an
 * outcome the chunk loop tallies.
 *
 * Double-send safety (the overlap class): between the suppression check and the
 * wire send, this CLAIMS the (jobId, personId) via an idempotent insert of the
 * `sent` email_events row keyed on cohortSendDedupeKey. Two overlapping worker
 * runs draining the same job build the SAME key for the same recipient — only one
 * insert lands; the other collapses (inserted=false) and skips the wire send. So a
 * cron retry firing mid-run can never mail the same person twice. The claim row IS
 * the measurement row, so no separate `sent` event is written after the send (that
 * would be a second, differently-keyed row). On a genuine wire failure the claim
 * is rolled back so a later run can re-attempt.
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
  extras?: {
    /** Attachment bytes, loaded once for the whole chunk by the handler. */
    attachments?: Array<{ filename: string; content: Buffer }>
    /**
     * Pre-resolved signature HTML (one fetch per chunk). Undefined means
     * "resolve here"; null means "signature off / none on file".
     */
    signatureHtml?: string | null
  },
): Promise<SendOneOutcome> {
  const email = recipient.email.trim()
  if (!email) return { kind: 'skipped', bucket: 'no-email' }

  // 1) SUPPRESSION CHOKEPOINT — fail-closed. Skip + count any suppressed contact.
  const gate = await isSuppressed(recipient.id, 'email')
  if (gate.suppressed) {
    return { kind: 'skipped', bucket: suppressionBucket(gate.reasons) }
  }

  // 2) Render: merge the contact's fields into subject + body. The context
  // resolves %agent_*%/%sender_*%/%company_*% from real data; bulk cohort
  // sends come "from" the assigned broker, so sender = agent. Cheap
  // per-recipient — the context builder reads cached DALs.
  const mergeContext = await buildMergeContext({
    person: recipient,
    senderSlug: recipient.assigned_broker ?? null,
  })
  const subject = renderCrmMerge(content.subject, recipient, mergeContext)
  // composeOutboundHtml is the module's "what you see is byte-equal to what
  // sends" primitive, and the one-to-one path (lib/crm/gmail.ts sendCrmEmail)
  // already routes through it. The cohort did not: a typed plain-text body went
  // out as raw text inside a text/html part, so every newline collapsed and the
  // one URL in it was never an anchor — unclickable for the reader and
  // invisible to click tracking, while the composer preview showed the wrapped
  // version. 'auto' is the shared default: a crm_templates HTML body passes
  // through untouched, a typed message gets the wrapper.
  const frozen = freezeBulkEmailSendParams(ctx.actorEmail, params)
  let signatureHtml: string | null = extras?.signatureHtml ?? null
  if (frozen.includeSignature && extras?.signatureHtml === undefined) {
    signatureHtml = (await getSignatureForMailbox(ctx.actorEmail))?.html ?? null
  } else if (!frozen.includeSignature) {
    signatureHtml = null
  }
  const renderedBody = composeOutboundHtml(
    renderCrmMerge(content.body, recipient, mergeContext),
    signatureHtml,
    'auto',
  )

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

  const sendType: EmailSendType = params.sendType ?? 'campaign'

  // 5) CLAIM — idempotent insert of the `sent` row BEFORE the wire. If the row
  //    already exists (another overlapping run got here first), inserted=false and
  //    we skip the send entirely. The claim doubles as the measurement row.
  const dedupeKey = cohortSendDedupeKey(ctx.jobId, recipient.id)
  const claim = await insertEmailEvent({
    message_id: null,
    recipient_email: email.toLowerCase(),
    person_id: recipient.id,
    broker: recipient.assigned_broker ?? null,
    send_type: sendType,
    event: 'sent',
    email_key: emailKey,
    subject,
    occurred_at: new Date().toISOString(),
    meta: { source: 'bulk:email-cohort', jobId: ctx.jobId },
    dedupe_key: dedupeKey,
  })
  // A failed claim WRITE (DB error) is treated as "do not send" — better to skip
  // than risk an unrecorded, undeduped send. A successful-but-not-inserted claim
  // means a sibling run already owns this recipient.
  if (!claim.ok) return { kind: 'skipped', bucket: 'claim-error' }
  if (!claim.inserted) return { kind: 'skipped', bucket: 'already-sent' }

  // 6) SEND.
  //
  // Default rail is Resend from the named broker identity on the verified
  // send domain, with Reply-To the real Workspace mailbox. A bare RESEND_FROM
  // (noreply@) is how replies used to vanish and how Gmail filed the mail as
  // machine bulk. The Gmail rail is the explicit "send from my mailbox"
  // option — true From, but Workspace will not send a multi-thousand list in
  // one day, so it is never the silent default.
  const fromIdentity = params.fromIdentity?.trim() || frozen.fromIdentity
  const replyTo = params.replyTo?.trim() || frozen.replyTo
  const attachments = extras?.attachments

  if (frozen.sendVia === 'gmail') {
    const gmailRes = await sendGovernedEmail({
      personId: recipient.id,
      purpose: 'crm:bulk-email-cohort',
      initiator: {
        kind: 'broker',
        broker: brokerSlugFromActorEmail(ctx.actorEmail),
        source: 'email-cohort',
      },
      payload: {
        rail: 'gmail',
        to: [email],
        subject: prepared.subject,
        bodyText: prepared.html,
        bodyFormat: 'html',
        withSignature: false,
        attachments: attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          mimeType: 'application/octet-stream',
        })),
      },
    })
    if (!gmailRes.ok) {
      await deleteEmailEventByDedupeKey(dedupeKey)
      console.error('[email-cohort] gmail send failed', {
        jobId: ctx.jobId,
        personId: recipient.id,
        error: gmailRes.error,
      })
      return { kind: 'skipped', bucket: 'send-error' }
    }
    if (gmailRes.providerId) await stampEmailEventMessageId(dedupeKey, gmailRes.providerId)
    return { kind: 'processed' }
  }

  const res = await sendEmail({
    to: email,
    subject: prepared.subject,
    html: prepared.html,
    text: prepared.text,
    from: fromIdentity,
    replyTo,
    headers: prepared.headers,
    attachments,
  })
  if (res.error) {
    // Roll the claim back so a later run can re-attempt (no false `sent` left).
    await deleteEmailEventByDedupeKey(dedupeKey)
    // The breakdown key stays coarse on purpose (one bucket, not one per Resend
    // message, which would explode across 18K recipients) — but the reason has
    // to land SOMEWHERE. Without this line a whole cohort could fail on an
    // unverified sender and the job would report "18000 send-error" with no way
    // to find out why.
    console.error('[email-cohort] send failed', {
      jobId: ctx.jobId,
      personId: recipient.id,
      error: res.error,
    })
    return { kind: 'skipped', bucket: 'send-error' }
  }

  // The claim row was written before the wire, so it carries no provider id.
  // Stamp it now: Resend keys its delivered / bounce / complaint webhooks on the
  // message id, and without it those rows cannot be joined back to this campaign.
  if (res.id) await stampEmailEventMessageId(dedupeKey, res.id)

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

  // Attachment bytes once per chunk, never per recipient. A failed load fails
  // the WHOLE chunk rather than sending a body that says "see attached" with
  // nothing attached — every id is counted so the worker offset still advances,
  // and the next run retries (no `sent` row was claimed for any of them).
  let attachmentBytes: Array<{ filename: string; content: Buffer }> | undefined
  const refs = params.attachments ?? []
  if (refs.length > 0) {
    const loaded = await loadEmailAttachments(refs)
    if (!loaded.ok) {
      result.skipped += ids.length
      bump(result, 'attachment-load-failed', ids.length)
      console.error('[email-cohort] attachment load failed', { jobId: ctx.jobId, error: loaded.error })
      return result
    }
    attachmentBytes = (loaded.attachments ?? []).map((a) => ({ filename: a.filename, content: a.content }))
  }

  const recipients = await getEmailCohortRecipients(ids)
  const byId = new Map(recipients.map((r) => [r.id, r]))

  // Signature HTML once per chunk, never per recipient — getBrokers is cached
  // but 18k identical lookups in a tight loop is still a waste, and the
  // bytes must be the same for every person in the cohort.
  const frozen = freezeBulkEmailSendParams(ctx.actorEmail, params)
  const signatureHtml = frozen.includeSignature
    ? (await getSignatureForMailbox(ctx.actorEmail))?.html ?? null
    : null

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
    const outcome = await sendOneCohortEmail(recipient, content, params, ctx, {
      attachments: attachmentBytes,
      signatureHtml,
    })
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
