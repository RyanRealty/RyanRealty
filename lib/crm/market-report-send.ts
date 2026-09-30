/**
 * market-report-send — the cadence send engine for the market-report
 * subscription product (Wave 8; rebuilt 2026-09-29 on Matt's decisions).
 *
 * The cron (app/api/cron/crm-market-report-send) is a thin auth + invoke shell
 * over runMarketReportSend() here. This module holds the cadence orchestration
 * and the ONE send call of the product (sendOneSubscriber): the scheduled
 * cadence, a broker's manual send and a broker's preview all reach the wire
 * through it, so the suppression chokepoint, the broker attribution and the
 * event record live in one tested place.
 *
 *   The cron, per run:
 *     0. Outside 8am to 8pm America/Los_Angeles: do nothing (no reads, no
 *        writes). The cron fires at 04, 10, 16 and 22 UTC; only the 16:00 and
 *        22:00 runs fall inside the window, year round.
 *     For each active subscriber (isDue from lib/crm/market-report-cadence):
 *     1. Not approved (first_send_approved_at null): record ONE held row per
 *        due cycle ('awaiting-approval'), send nothing. A broker approves
 *        after the preview reached their own inbox.
 *     2. No email on file: one held row per cycle ('no-email').
 *     3. deliverMarketReport (lib/crm/market-report-deliver.ts): fetch the §0
 *        figures, hold on stale data, render, claim the crm_report_sends row,
 *        then sendOneSubscriber, then settle the row, write the email_out
 *        timeline row and stamp last_sent_at.
 *
 * sendOneSubscriber, the leaf: isSuppressed('email') fail-closed BEFORE
 * sendEmail (ci:email-send-gated reads that order in this function) ->
 * prepareDeliverableEmail (multipart, one CAN-SPAM footer, RFC 8058 headers at
 * the report-scoped one-click endpoint) -> attributeOutbound (broker ?agent=,
 * the signed person token, open/click tracking with the broker on every event)
 * -> sendEmail -> recordEmailEvent('sent'). A PREVIEW goes to the broker's own
 * mailbox and carries none of the contact's tokens: no person token, no open
 * pixel, no click wraps, and no event row, so a broker opening it never counts
 * as the contact.
 *
 * Never throws to the caller — every contact's outcome is captured in the
 * returned summary so the cron always returns a clean JSON status.
 *
 * DAL boundary (G1): no raw .from() here; reads and writes go through
 * lib/data/crm. The suppression check is isSuppressed (lib/crm/suppressions),
 * inline next to sendEmail.
 */
import 'server-only'

import { inReportSendWindow, isDue } from '@/lib/crm/market-report-cadence'
import { isSuppressed } from '@/lib/crm/suppressions'
import { prepareDeliverableEmail } from '@/lib/email/prepare'
import { attributeOutbound } from '@/lib/crm/attributed-links'
import { brokerSendIdentity } from '@/lib/email/broker-identity'
import { recordEmailEvent } from '@/lib/crm/email-events'
import { sendEmail } from '@/lib/resend'
import {
  getActiveMarketReportSubscriptions,
  type MarketReportSubscriber,
} from '@/lib/data/crm/getMarketReportSubscribers'
import { getPersonPrimaryEmail } from '@/lib/data/crm/getPersonPrimaryEmail'
import { stampMarketReportAttempt } from '@/lib/data/crm/stampMarketReportSent'
import type { ReportSendKind } from '@/lib/data/crm/marketReportSends'

/** The default broker a contact's reports attribute to when none is assigned. */
const DEFAULT_BROKER = 'matt'

/** Why a contact was not sent this run. */
export type SkipReason =
  | 'not-due'
  | 'awaiting-approval'
  | 'no-email'
  | 'no-areas' // all subscribed areas resolved unavailable in the cache
  | 'stale-data'
  | 'suppressed'
  | 'send-error'

export type ContactSendOutcome =
  | { personId: number; status: 'sent'; messageId: string | null }
  | { personId: number; status: 'skipped'; reason: SkipReason; detail?: string }

export interface RunSendSummary {
  /** True when the run fell outside 8am to 8pm Pacific and did nothing. */
  outsideWindow: boolean
  scanned: number
  due: number
  sent: number
  skipped: number
  skippedByReason: Record<SkipReason, number>
  outcomes: ContactSendOutcome[]
  durationMs: number
}

export interface RunSendOptions {
  /** Max subscriptions to SEND this run (chunk so the cron never times out). */
  maxSends?: number
  /** Max active rows to scan from the DB this run. */
  scanLimit?: number
  /** Evaluation moment for the cadence math, the window and the stamps. */
  now?: Date
  /** A unique id for this run, used to make the attribution emailKey unique. */
  runId?: string
  /**
   * Injected dependencies — defaulted to the real implementations. Present so the
   * orchestration (window, approval, due filter, skip taxonomy, chunk cap) is
   * unit-tested with mocks without any DB or network. Production passes none.
   */
  deps?: Partial<SendDeps>
}

/** What deliverMarketReport answers for one scheduled contact. */
export type ScheduledDeliverOutcome =
  | { status: 'sent'; messageId: string | null }
  | { status: 'held'; reason: 'stale-data' | 'no-data' | 'suppressed'; detail?: string }
  /** The contact already received a report inside the window; the stamp was repaired. */
  | { status: 'already-sent'; sentAt: string }
  | { status: 'failed'; detail: string }

export type ScheduledDeliverInput = {
  subscriber: MarketReportSubscriber
  email: string
  brokerSlug: string
  emailKey: string
  now: Date
}

/** Held rows the cron records itself (before any data is fetched). */
export type CronHoldReason = 'awaiting-approval' | 'no-email'

/** The seam the orchestrator depends on. Production wires the real fns. */
export interface SendDeps {
  fetchSubscribers: typeof getActiveMarketReportSubscriptions
  resolveEmail: typeof getPersonPrimaryEmail
  deliver: (input: ScheduledDeliverInput) => Promise<ScheduledDeliverOutcome>
  recordHold: (sub: MarketReportSubscriber, reason: CronHoldReason, now: Date) => Promise<void>
  stampAttempt: typeof stampMarketReportAttempt
}

async function realDeliver(input: ScheduledDeliverInput): Promise<ScheduledDeliverOutcome> {
  const { deliverScheduledReport } = await import('@/lib/crm/market-report-deliver')
  return deliverScheduledReport(input)
}

async function realRecordHold(sub: MarketReportSubscriber, reason: CronHoldReason, now: Date): Promise<void> {
  const { recordReportHold } = await import('@/lib/crm/market-report-deliver')
  await recordReportHold({
    subscriptionId: sub.subscriptionId,
    personId: sub.personId,
    lastSentAt: sub.lastSentAt,
    broker: (sub.assignedBroker ?? '').trim() || DEFAULT_BROKER,
    frequency: sub.frequency,
    areas: sub.areas,
    reason,
    now,
  })
}

const REAL_DEPS: SendDeps = {
  fetchSubscribers: getActiveMarketReportSubscriptions,
  resolveEmail: getPersonPrimaryEmail,
  deliver: realDeliver,
  recordHold: realRecordHold,
  stampAttempt: stampMarketReportAttempt,
}

function emptyReasonCounts(): Record<SkipReason, number> {
  return {
    'not-due': 0,
    'awaiting-approval': 0,
    'no-email': 0,
    'no-areas': 0,
    'stale-data': 0,
    suppressed: 0,
    'send-error': 0,
  }
}

/** The input the one send call takes. */
export type SendOneInput = {
  kind: ReportSendKind
  /** The contact the report is about. Previews still name the contact here (for the suppression check), never in the links. */
  personId: number
  brokerSlug: string
  /** The recipient: the contact, or the broker's own mailbox for a preview. */
  to: string
  subject: string
  /** The rendered html/text (BEFORE prepare and attribution). */
  html: string
  text: string
  /** The footer Unsubscribe (the report-scoped preferences link). */
  unsubscribeUrl: string
  /** The RFC 8058 one-click endpoint for the List-Unsubscribe header. */
  oneClickUrl: string
  emailKey: string
}

export type SendOneOutcome =
  | { status: 'sent'; messageId: string | null; preparedHtml: string; preparedText: string }
  | { status: 'suppressed'; detail: string }
  | { status: 'failed'; detail: string; preparedHtml: string; preparedText: string }

/**
 * Send ONE already-rendered report. The suppression chokepoint (isSuppressed,
 * fail-closed, on the CONTACT) runs in THIS function immediately before
 * sendEmail, so ci:email-send-gated sees the gate in the same scope as the
 * send. A preview is gated on the contact too: a report the contact can never
 * receive has nothing to preview.
 *
 * Returns the prepared html/text (still free of tracking) for the stored copy.
 * Never throws.
 */
export async function sendOneSubscriber(input: SendOneInput): Promise<SendOneOutcome> {
  const { personId } = input

  // ── Suppression chokepoint — fail-closed, BEFORE any send. ──────────────────
  const gate = await isSuppressed(personId, 'email')
  if (gate.suppressed) {
    return { status: 'suppressed', detail: gate.reasons.join(', ') || 'suppressed' }
  }

  // Multipart + ONE CAN-SPAM footer (the body already carries it) + the RFC
  // 8058 headers pointed at the report-scoped one-click endpoint.
  const prepared = prepareDeliverableEmail({
    subject: input.subject,
    html: input.html,
    text: input.text,
    personId,
    unsubscribeUrl: input.unsubscribeUrl,
    oneClickUnsubscribeUrl: input.oneClickUrl,
    footer: 'from-body',
  })

  // Broker attribution (?agent=) on every link. A real send also carries the
  // signed person token and open/click tracking, with the broker on every
  // event; a preview carries neither, so a broker opening their own preview
  // never reads as the contact.
  const isPreview = input.kind === 'preview'
  const finalHtml = attributeOutbound(prepared.html, {
    brokerSlug: input.brokerSlug,
    personId: isPreview ? null : personId,
    emailKey: input.emailKey,
    label: input.subject,
    broker: input.brokerSlug,
  })

  // Named broker sender + monitored reply-to (lib/email/broker-identity): a
  // reply to a market report must reach the assigned broker, never noreply@.
  const identity = brokerSendIdentity(input.brokerSlug)
  const res = await sendEmail({
    to: input.to,
    from: identity.from,
    replyTo: identity.replyTo,
    subject: prepared.subject,
    html: finalHtml,
    text: prepared.text,
    headers: prepared.headers,
  })

  if (res.error) {
    return { status: 'failed', detail: res.error, preparedHtml: prepared.html, preparedText: prepared.text }
  }

  // Measurement — best-effort; a reporting write must never undo a real send.
  // A preview is the broker's own mail and records nothing against the contact.
  if (!isPreview) {
    await recordEmailEvent({
      messageId: res.id ?? null,
      recipientEmail: input.to,
      personId,
      broker: input.brokerSlug,
      sendType: 'market-report',
      event: 'sent',
      emailKey: input.emailKey,
      subject: input.subject,
    })
  }

  return { status: 'sent', messageId: res.id ?? null, preparedHtml: prepared.html, preparedText: prepared.text }
}

/**
 * Run one cadence send pass. Pure orchestration over injectable deps. Bounded by
 * maxSends (actual sends) and scanLimit (rows scanned) so the cron is safe.
 */
export async function runMarketReportSend(options: RunSendOptions = {}): Promise<RunSendSummary> {
  const startMs = Date.now()
  const deps: SendDeps = { ...REAL_DEPS, ...(options.deps ?? {}) }
  const now = options.now ?? new Date()
  const maxSends = Math.max(1, Math.trunc(options.maxSends ?? 200))
  const scanLimit = Math.max(maxSends, Math.trunc(options.scanLimit ?? 1000))
  const runId = options.runId ?? now.toISOString().slice(0, 19).replace(/[-:T]/g, '')

  const summary: RunSendSummary = {
    outsideWindow: false,
    scanned: 0,
    due: 0,
    sent: 0,
    skipped: 0,
    skippedByReason: emptyReasonCounts(),
    outcomes: [],
    durationMs: 0,
  }

  // ── The send window: 8am to 8pm America/Los_Angeles, same as the bulk path.
  if (!inReportSendWindow(now)) {
    summary.outsideWindow = true
    summary.durationMs = Date.now() - startMs
    return summary
  }

  const recordSkip = (outcome: Extract<ContactSendOutcome, { status: 'skipped' }>) => {
    summary.skipped += 1
    summary.skippedByReason[outcome.reason] += 1
    summary.outcomes.push(outcome)
  }

  let subscribers: MarketReportSubscriber[] = []
  try {
    subscribers = await deps.fetchSubscribers(scanLimit)
  } catch (e) {
    // A read failure leaves an empty summary — the cron reports it, never 500s.
    const detail = 'fetch-subscribers-failed: ' + (e instanceof Error ? e.message : String(e))
    // Page Matt on the ops channel: a subscriber-fetch outage idles the whole
    // cadence engine and the cron's JSON summary is not monitored by a human.
    // queueBrokerHealthAlert is the correct path — there is no person to hang a
    // person-scoped alert on. Best-effort: an alert failure must never break
    // the summary contract (this function never throws to the cron).
    try {
      const { queueBrokerHealthAlert } = await import('@/lib/crm/broker-alerts')
      await queueBrokerHealthAlert({
        key: 'market-report-send:fetch-subscribers-failed',
        body: `Market report send could not read its subscriber list (${detail.slice(0, 200)}). No reports went out this run.`,
      })
    } catch {
      // best-effort only
    }
    summary.durationMs = Date.now() - startMs
    summary.outcomes.push({ personId: 0, status: 'skipped', reason: 'send-error', detail })
    summary.skipped += 1
    summary.skippedByReason['send-error'] += 1
    return summary
  }

  summary.scanned = subscribers.length
  let staleAlerted = false

  for (const sub of subscribers) {
    if (summary.sent >= maxSends) break

    // Cadence gate — not-due contacts are not even attempt-stamped (no work done).
    if (!isDue({ frequency: sub.frequency, lastSentAt: sub.lastSentAt, now })) {
      recordSkip({ personId: sub.personId, status: 'skipped', reason: 'not-due' })
      continue
    }
    summary.due += 1

    // The first-send approval (Matt 2026-09-29): a subscription nobody has
    // approved after a preview never sends. One held row per due cycle, so
    // the admin card says why, without a new row every tick.
    if (!sub.firstSendApprovedAt) {
      await deps.recordHold(sub, 'awaiting-approval', now)
      recordSkip({ personId: sub.personId, status: 'skipped', reason: 'awaiting-approval' })
      continue
    }

    // From here we are doing real work for this contact → stamp the attempt.
    await deps.stampAttempt(sub.subscriptionId, now)

    if (!sub.personId || sub.personId <= 0) {
      recordSkip({ personId: sub.personId, status: 'skipped', reason: 'no-email', detail: 'invalid person' })
      continue
    }

    const email = (await deps.resolveEmail(sub.personId)) ?? ''
    if (!email) {
      await deps.recordHold(sub, 'no-email', now)
      recordSkip({ personId: sub.personId, status: 'skipped', reason: 'no-email' })
      continue
    }

    const brokerSlug = (sub.assignedBroker ?? '').trim() || DEFAULT_BROKER
    const emailKey = `market-report:${runId}:${sub.personId}`

    let outcome: ScheduledDeliverOutcome
    try {
      outcome = await deps.deliver({ subscriber: sub, email, brokerSlug, emailKey, now })
    } catch (e) {
      outcome = { status: 'failed', detail: 'deliver-threw: ' + (e instanceof Error ? e.message : String(e)) }
    }

    if (outcome.status === 'sent') {
      summary.sent += 1
      summary.outcomes.push({ personId: sub.personId, status: 'sent', messageId: outcome.messageId })
      continue
    }
    if (outcome.status === 'already-sent') {
      recordSkip({ personId: sub.personId, status: 'skipped', reason: 'not-due', detail: `already sent ${outcome.sentAt}` })
      continue
    }
    if (outcome.status === 'held') {
      const reason: SkipReason =
        outcome.reason === 'stale-data' ? 'stale-data' : outcome.reason === 'no-data' ? 'no-areas' : 'suppressed'
      recordSkip({ personId: sub.personId, status: 'skipped', reason, detail: outcome.detail })
      if (outcome.reason === 'stale-data' && !staleAlerted) {
        staleAlerted = true
        try {
          const { queueBrokerHealthAlert } = await import('@/lib/crm/broker-alerts')
          await queueBrokerHealthAlert({
            key: 'market-report-send:stale-data',
            body: `Market reports are on hold: the market data stopped refreshing (${(outcome.detail ?? '').slice(0, 200)}). They send again once it refreshes.`,
          })
        } catch {
          // best-effort only
        }
      }
      continue
    }
    recordSkip({ personId: sub.personId, status: 'skipped', reason: 'send-error', detail: outcome.detail })
  }

  summary.durationMs = Date.now() - startMs
  return summary
}
