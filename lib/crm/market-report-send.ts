/**
 * market-report-send — the cadence send engine for the market-report
 * subscription product (Wave 8).
 *
 * The cron (app/api/cron/crm-market-report-send) is a thin auth + invoke shell
 * over runMarketReportSend() here. This module owns the whole per-contact send
 * path so the §0 data-accuracy + suppression + attribution + measurement rules
 * live in ONE tested place:
 *
 *   For each active, due subscriber (isDue from lib/crm/market-report-cadence):
 *     1. Resolve the recipient email (skip + stamp-attempt when none on file —
 *        never fabricate an address).
 *     2. Fetch §0-accurate blocks via getMarketReportData(areas). Every figure
 *        traces to the canonical cache; an area with no cache data is omitted by
 *        the data layer. If ALL areas resolve unavailable -> SKIP (no empty
 *        email, no fabricated stat) + stamp-attempt so we do not retry every
 *        tick.
 *     3. Render via renderMarketReportEmail (pure; brand-voice clean).
 *     4. sendOneSubscriber(): in the SAME function, isSuppressed('email')
 *        (fail-closed) BEFORE sendEmail. prepareDeliverableEmail (multipart +
 *        List-Unsubscribe + CAN-SPAM) -> attributeOutbound (broker + tracking)
 *        -> sendEmail -> recordEmailEvent(sendType 'market-report').
 *     5. On a successful send, stamp last_sent_at so the contact is not re-sent
 *        inside their cadence window; on any earlier exit, stamp last_attempt_at.
 *
 * Never throws to the caller — every contact's outcome is captured in the
 * returned summary so the cron always returns a clean JSON status (a Vercel
 * retry never thunders against a 500).
 *
 * DAL boundary (G1): this module performs NO raw .from() — it reads/writes
 * exclusively through lib/data/crm functions. The suppression check is
 * isSuppressed (lib/crm/suppressions), called inline next to sendEmail so the
 * ci:email-send-gated gate sees the chokepoint.
 */
import 'server-only'

import { isDue } from '@/lib/crm/market-report-cadence'
import { isSuppressed } from '@/lib/crm/suppressions'
import { prepareDeliverableEmail } from '@/lib/email/prepare'
import { buildUnsubscribeUrl } from '@/lib/email/unsubscribe-token'
import { attributeOutbound } from '@/lib/crm/attributed-links'
import { brokerSendIdentity } from '@/lib/email/broker-identity'
import { recordEmailEvent } from '@/lib/crm/email-events'
import { sendEmail } from '@/lib/resend'
import { renderMarketReportEmail } from '@/lib/crm/market-report-email'
import { getMarketReportData } from '@/lib/data/crm/getMarketReportData'
import {
  getActiveMarketReportSubscriptions,
  type MarketReportSubscriber,
} from '@/lib/data/crm/getMarketReportSubscribers'
import { getPersonPrimaryEmail } from '@/lib/data/crm/getPersonPrimaryEmail'
import { stampMarketReportAttempt, stampMarketReportSent } from '@/lib/data/crm/stampMarketReportSent'

/** The default broker a contact's reports attribute to when none is assigned. */
const DEFAULT_BROKER = 'matt'

/** Why a contact was skipped (not sent) this run. */
export type SkipReason =
  | 'not-due'
  | 'no-email'
  | 'no-areas' // all subscribed areas resolved unavailable in the cache
  | 'suppressed'
  | 'send-error'

export type ContactSendOutcome =
  | { personId: number; status: 'sent'; messageId: string | null }
  | { personId: number; status: 'skipped'; reason: SkipReason; detail?: string }

export interface RunSendSummary {
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
  /** Evaluation moment for the cadence math + the cadence stamps. */
  now?: Date
  /** A unique id for this run, used to make the attribution emailKey unique. */
  runId?: string
  /**
   * Injected dependencies — defaulted to the real implementations. Present so the
   * orchestration (due filter, skip taxonomy, chunk cap) is unit-tested with mocks
   * without any DB or network. Production calls pass none.
   */
  deps?: Partial<SendDeps>
}

/** The seam the orchestrator depends on. Production wires the real fns. */
export interface SendDeps {
  fetchSubscribers: typeof getActiveMarketReportSubscriptions
  resolveEmail: typeof getPersonPrimaryEmail
  fetchAreas: typeof getMarketReportData
  sendOne: typeof sendOneSubscriber
  stampAttempt: typeof stampMarketReportAttempt
  stampSent: typeof stampMarketReportSent
}

const REAL_DEPS: SendDeps = {
  fetchSubscribers: getActiveMarketReportSubscriptions,
  resolveEmail: getPersonPrimaryEmail,
  fetchAreas: getMarketReportData,
  sendOne: sendOneSubscriber,
  stampAttempt: stampMarketReportAttempt,
  stampSent: stampMarketReportSent,
}

function emptyReasonCounts(): Record<SkipReason, number> {
  return { 'not-due': 0, 'no-email': 0, 'no-areas': 0, suppressed: 0, 'send-error': 0 }
}

/**
 * Send ONE subscriber's already-rendered, already-fetched report. The suppression
 * chokepoint (isSuppressed, fail-closed) runs in THIS function immediately before
 * sendEmail, so ci:email-send-gated sees the gate in the same scope as the send.
 *
 * Returns the outcome; never throws (a send error is captured, not propagated).
 *
 * @param input.html  the rendered HTML (BEFORE prepare/attribution)
 * @param input.text  the rendered plain-text alternative
 */
export async function sendOneSubscriber(input: {
  personId: number
  fubPersonId: number | null
  brokerSlug: string
  email: string
  subject: string
  html: string
  text: string
  unsubscribeUrl: string
  emailKey: string
}): Promise<ContactSendOutcome> {
  const { personId } = input

  // ── Suppression chokepoint — fail-closed, BEFORE any send. ──────────────────
  const gate = await isSuppressed(personId, 'email')
  if (gate.suppressed) {
    return { personId, status: 'skipped', reason: 'suppressed', detail: gate.reasons.join(', ') }
  }

  // Multipart + List-Unsubscribe + CAN-SPAM footer (same unsubscribeUrl so the
  // header, the prepare footer, and the render footer all match).
  const prepared = prepareDeliverableEmail({
    subject: input.subject,
    html: input.html,
    text: input.text,
    personId,
    unsubscribeUrl: input.unsubscribeUrl,
  })

  // Broker attribution (?agent=) + open/click instrumentation on the HTML.
  const finalHtml = attributeOutbound(prepared.html, {
    brokerSlug: input.brokerSlug,
    personId,
    fubPersonId: input.fubPersonId,
    emailKey: input.emailKey,
    label: input.subject,
  })

  // Named broker sender + monitored reply-to (lib/email/broker-identity): a
  // reply to a market report must reach the assigned broker, never noreply@.
  const identity = brokerSendIdentity(input.brokerSlug)
  const res = await sendEmail({
    to: input.email,
    from: identity.from,
    replyTo: identity.replyTo,
    subject: prepared.subject,
    html: finalHtml,
    text: prepared.text,
    headers: prepared.headers,
  })

  if (res.error) {
    return { personId, status: 'skipped', reason: 'send-error', detail: res.error }
  }

  // Measurement — best-effort; a reporting write must never undo a real send.
  await recordEmailEvent({
    messageId: res.id ?? null,
    recipientEmail: input.email,
    personId,
    broker: input.brokerSlug,
    sendType: 'market-report',
    event: 'sent',
    emailKey: input.emailKey,
    subject: input.subject,
  })

  return { personId, status: 'sent', messageId: res.id ?? null }
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
  const runId = options.runId ?? new Date().toISOString().slice(0, 10)

  const summary: RunSendSummary = {
    scanned: 0,
    due: 0,
    sent: 0,
    skipped: 0,
    skippedByReason: emptyReasonCounts(),
    outcomes: [],
    durationMs: 0,
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
    // person-scoped alert on, and crm_timeline's NOT NULL person_id FK rejects a
    // placeholder id (the dead personId:0 pattern fixed in the portal-lead-intake
    // cron). The stable per-subject key + default 6h cooldown dedupes repeat
    // pages while the outage persists. Best-effort: an alert failure must never
    // break the summary contract (this function never throws to the cron).
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
    summary.outcomes.push({
      personId: 0,
      status: 'skipped',
      reason: 'send-error',
      detail,
    })
    summary.skipped += 1
    summary.skippedByReason['send-error'] += 1
    return summary
  }

  summary.scanned = subscribers.length

  for (const sub of subscribers) {
    if (summary.sent >= maxSends) break

    // Cadence gate — not-due contacts are not even attempt-stamped (no work done).
    if (!isDue({ frequency: sub.frequency, lastSentAt: sub.lastSentAt, now })) {
      recordSkip({ personId: sub.personId, status: 'skipped', reason: 'not-due' })
      continue
    }
    summary.due += 1

    // From here we are doing real work for this contact → stamp the attempt so a
    // skip (no email / no areas / suppressed / error) does not retry next tick.
    await deps.stampAttempt(sub.subscriptionId, now)

    if (!sub.personId || sub.personId <= 0) {
      recordSkip({ personId: sub.personId, status: 'skipped', reason: 'no-email', detail: 'invalid person' })
      continue
    }

    const email = (await deps.resolveEmail(sub.personId)) ?? ''
    if (!email) {
      recordSkip({ personId: sub.personId, status: 'skipped', reason: 'no-email' })
      continue
    }

    // §0: fetch the verified blocks. Unavailable areas are omitted by the data
    // layer; if NONE survive there is nothing accurate to send → skip.
    let areas
    try {
      areas = await deps.fetchAreas(sub.areas)
    } catch (e) {
      recordSkip({
        personId: sub.personId,
        status: 'skipped',
        reason: 'send-error',
        detail: 'fetch-areas-failed: ' + (e instanceof Error ? e.message : String(e)),
      })
      continue
    }
    if (!areas || areas.length === 0) {
      recordSkip({ personId: sub.personId, status: 'skipped', reason: 'no-areas' })
      continue
    }

    const brokerSlug = (sub.assignedBroker ?? '').trim() || DEFAULT_BROKER
    const unsubscribeUrl = buildUnsubscribeUrl(sub.personId)
    const emailKey = `market-report:${runId}:${sub.personId}`

    const { subject, html, text } = renderMarketReportEmail({
      contactName: sub.personName,
      brokerSlug,
      areas,
      unsubscribeUrl,
    })

    const outcome = await deps.sendOne({
      personId: sub.personId,
      fubPersonId: sub.fubPersonId,
      brokerSlug,
      email,
      subject,
      html,
      text,
      unsubscribeUrl,
      emailKey,
    })

    if (outcome.status === 'sent') {
      summary.sent += 1
      summary.outcomes.push(outcome)
      // Cadence stamp. If THIS write fails after a successful send, isDue() has no
      // fresh last_sent_at to gate on, so the next daily tick would re-send inside
      // the cadence window (a double-send to a real client). stampSent fails soft
      // (never throws), so its result must be checked here and logged loudly — the
      // stamp is what makes the send idempotent across ticks. A durable idempotency
      // backstop that survives a stamp-write outage needs a schema change (a unique
      // sent-ledger key); see decisionsOrBlockers.
      const stamp = await deps.stampSent(sub.subscriptionId, now)
      if (!stamp.ok) {
        console.error(
          `[market-report-send] DOUBLE-SEND RISK: report sent to person ${sub.personId} ` +
            `(subscription ${sub.subscriptionId}) but last_sent_at stamp FAILED (${stamp.error}); ` +
            `the next cadence tick may re-send this contact.`,
        )
      }
    } else {
      recordSkip(outcome)
    }
  }

  summary.durationMs = Date.now() - startMs
  return summary
}
