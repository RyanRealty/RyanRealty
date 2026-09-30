/**
 * market-report-deliver — one market report, from figures to a settled
 * crm_report_sends row, for all three kinds of send (Matt's decisions
 * 2026-09-29; the review fixes of 2026-09-30):
 *
 *   scheduled  the cadence cron (lib/crm/market-report-send.ts), approved
 *              subscriptions only, inside 8am to 8pm Pacific
 *   manual     a broker's "Send now" on the contact (app/actions/crm-send-now.ts)
 *   preview    "Send a preview to me": the exact email, to the broker's own
 *              mailbox, with none of the contact's tokens, subject "[Preview] …"
 *
 * The order, and why each step is where it is:
 *   1. Fetch the §0 figures (getMarketReportData). No usable area: hold.
 *   2. Freshness (lib/crm/market-report-freshness): any stale source holds the
 *      whole report, named in the row. A report never mails old numbers.
 *   3. Scheduled only: a contact who already received a report inside the
 *      cadence window (a stamp write that failed after a send, a broker's
 *      manual send, or a live attempt still IN FLIGHT, which counts as
 *      delivered) is not sent again; the stamp is repaired for a delivery.
 *      An attempt ABANDONED in flight (older than IN_FLIGHT_SETTLE_MS) is
 *      never presumed delivered: it is settled from evidence (below).
 *   4. Scheduled only: suppressed contacts are held once per due cycle. Her
 *      record AND her address are checked (the newsletter writes address-only
 *      suppression rows). The send leaf re-checks both anyway; this keeps one
 *      row instead of one a tick.
 *   5. Render with the signed links (web view, manage, report-scoped
 *      unsubscribe, one-click) and the figures trace.
 *   6. The §0 Spark gate (lib/crm/market-report-spark-gate.ts), for EVERY kind
 *      of send: every printed figure rebuilt from Spark, strict 1% rule. A
 *      STOP or a figure it cannot rebuild HOLDS the report: a held row with
 *      the rendered copy, both values, the delta and the queries, and Matt is
 *      paged so a person decides. Nothing reaches the wire unreconciled.
 *   7. Re-read the subscription and the contact just before the wire: a stop,
 *      a pause, a withdrawn approval, a deleted contact, a change of areas or
 *      interval, or another run's send made while this one was building
 *      cancels this send. (Manual: her own stop made meanwhile refuses it.)
 *      Then the latest delivery is read AGAIN, for a scheduled and a manual
 *      send alike (review 2026-09-30): a report that went out, or is going
 *      out, while this one was built wins, so a broker's "Send now" and the
 *      cron never both send.
 *   8. Build the exact provider request ONCE (prepareReportEmail) and CLAIM
 *      the send key with it before the wire: the stored copy, the trace and
 *      the request exist before the email does, so "View this report online"
 *      never points at nothing, and a row that cannot be written means no
 *      send (no trace, no ship). A scheduled key is one per subscription per
 *      due cycle, so two overlapping runs cannot both send. A retry takes
 *      over only an attempt that settled (a failure the provider answered, or
 *      an unexpected held row, which pages Matt), and inside the replay
 *      window it REPLAYS the stored request byte for byte under its own
 *      idempotency key (Resend answers a same-key, same-payload repeat with
 *      its first result and sends nothing twice); a new render gets a new key.
 *   9. sendOneSubscriber (the one gated send call), then settle the row:
 *      sent; a failure the provider answered; or, when no answer came, the
 *      row STAYS in flight marked unknown and Matt is paged, never a failure a
 *      retry would re-send. A suppression caught at the wire holds under the
 *      cycle's own hold key and settles the send key as a settled failure, so
 *      the subscription is never frozen on it.
 *  10. Sent (not a preview): the email_out timeline row with the message id,
 *      and last_sent_at stamped from the manual path too (a "Send now +
 *      subscribe" no longer double-sends).
 *
 * An in-flight attempt abandoned by a process that died is settled from
 * evidence, never presumed: Resend's message id on record (the 'sent' event
 * the send wrote), confirmed with Resend; else, inside the replay window, one
 * run takes the recovery and replays the stored request under its key (Resend
 * returns the first result if it was delivered, or sends it now); else Matt is
 * paged and nothing is sent or stamped.
 *
 * Never throws; every path returns an outcome.
 */
import 'server-only'

import { getMarketReportData, type MarketReportAreaBlock } from '@/lib/data/crm/getMarketReportData'
import {
  claimInFlightRecovery,
  claimMarketReportSend,
  getLatestDeliveredReport,
  getMarketReportSendState,
  getMarketReportSentEvidence,
  inFlightAbandoned,
  insertMarketReportSend,
  isInFlightSend,
  isReplayable,
  markMarketReportSendUnknown,
  settleMarketReportSend,
  type ReportHoldReason,
  type ReportSendKind,
  type ReportSendPayload,
  type ReportSendState,
} from '@/lib/data/crm/marketReportSends'
import {
  getMarketReportContact,
  getReportSubscriptionRecord,
  logReportTimeline,
  stampReportSubscriptionSentForPerson,
} from '@/lib/data/crm/marketReportSubscription'
import { stampMarketReportSent } from '@/lib/data/crm/stampMarketReportSent'
import { isDue } from '@/lib/crm/market-report-cadence'
import { describeStaleSources, findStaleSources } from '@/lib/crm/market-report-freshness'
import { renderMarketReportEmail, type ReportFigure } from '@/lib/crm/market-report-email'
import { isSuppressed, isSuppressedByEmail } from '@/lib/crm/suppressions'
import { reportEmailLinks } from '@/lib/email/report-link-token'
import { shellBrokerFor } from '@/lib/email/broker-identity'
import { normalizeReportFrequency } from '@/lib/data/crm/getContactReportSubscriptions'
import { isContactHeld, isContactStopped, sameAreaSet } from '@/lib/crm/market-report-subscription-control'
import { holdKey } from '@/lib/crm/market-report-keys'
import {
  describeSparkGate,
  runSparkGate,
  SPARK_GATE_RULE,
  type SparkGateMemo,
  type SparkGateResult,
} from '@/lib/crm/market-report-spark-gate'
import { queueBrokerHealthAlert, BROKER_ALERT_ORIGIN } from '@/lib/crm/broker-alerts'
import {
  prepareReportEmail,
  reportIdempotencyKey,
  sendOneSubscriber,
  type ScheduledDeliverInput,
  type ScheduledDeliverOutcome,
} from '@/lib/crm/market-report-send'
import { getSentEmail } from '@/lib/resend'

export { holdKey, reportCycle, scheduledSendKey } from '@/lib/crm/market-report-keys'

/** What a held row may carry beyond its reason: the copy it would have sent, and the Spark check. */
type HoldCopy = {
  subject?: string | null
  html?: string | null
  plainText?: string | null
  figures?: readonly unknown[]
  recipientEmail?: string | null
  sparkCheck?: unknown | null
}

/**
 * Record that a report did not go out. A scheduled hold is keyed once per
 * reason per due cycle (the cron's next tick is a no-op, or, with `refresh`,
 * rewrites the row with the latest numbers); a manual or preview hold is
 * keyed by that send's own key. Never throws.
 */
export async function recordReportHold(
  input: {
    subscriptionId: number | null
    personId: number
    lastSentAt: string | null
    broker: string | null
    frequency: string | null
    areas: readonly string[]
    reason: ReportHoldReason
    detail?: string | null
    now: Date
    kind?: ReportSendKind
    /** The row's key; defaults to the scheduled per-cycle hold key. */
    emailKey?: string
    copy?: HoldCopy
    refresh?: boolean
  },
  insert: typeof insertMarketReportSend = insertMarketReportSend,
): Promise<void> {
  const emailKey =
    input.emailKey ?? (input.subscriptionId != null ? holdKey(input.reason, input.subscriptionId, input.lastSentAt) : null)
  if (!emailKey) return
  const res = await insert(
    {
      subscriptionId: input.subscriptionId,
      personId: input.personId,
      emailKey,
      broker: input.broker,
      kind: input.kind ?? 'scheduled',
      status: 'held',
      holdReason: input.reason,
      error: input.detail ?? null,
      attemptedAt: input.now.toISOString(),
      frequency: input.frequency,
      areas: input.areas,
      subject: input.copy?.subject ?? null,
      html: input.copy?.html ?? null,
      plainText: input.copy?.plainText ?? null,
      figures: input.copy?.figures ?? [],
      recipientEmail: input.copy?.recipientEmail ?? null,
      sparkCheck: input.copy?.sparkCheck ?? null,
    },
    { refresh: input.refresh === true },
  )
  if (!res.ok) console.error('[recordReportHold]', input.reason, input.subscriptionId, res.error)
}

export type DeliverReportInput = {
  kind: ReportSendKind
  personId: number
  contactName: string | null
  /** The contact's address, or the broker's own mailbox for a preview. */
  to: string
  /**
   * The CONTACT's own address, whatever `to` is: her suppression is checked by
   * address as well as by record (a preview included: a report she can never
   * receive has nothing to preview). Null when she has none on file.
   */
  contactEmail: string | null
  /** The broker the email is from (the contact's assigned broker). */
  brokerSlug: string
  /** The subscription the report belongs to; null for a one-off manual send. */
  subscription: { id: number; frequency: string; areas: string[]; lastSentAt: string | null } | null
  areaSlugs: readonly string[]
  emailKey: string
  now: Date
  /** One cron run's shared Spark reads; a one-off send pulls its own. */
  sparkMemo?: SparkGateMemo
}

export type DeliverHoldReason = 'stale-data' | 'no-data' | 'suppressed' | 'spark-stop' | 'spark-unreconciled'

export type DeliverReportOutcome =
  /**
   * `replayed`: the stored request of an earlier attempt of this key went out
   * (a retry or a recovery), not this run's render; `figures` and `spark` are
   * this run's, the replayed copy's own are on its row.
   */
  | { status: 'sent'; messageId: string | null; subject: string; figures: ReportFigure[]; spark: SparkGateResult; replayed: boolean }
  | { status: 'held'; reason: DeliverHoldReason; detail: string }
  | { status: 'already-sent'; sentAt: string }
  /** Nothing went out: the subscription or the contact changed while the report was built. */
  | { status: 'cancelled'; reason: 'stopped' | 'changed' | 'contact-deleted'; detail: string }
  | { status: 'failed'; detail: string }
  /** The provider never answered: it may have gone out. Held in flight (never re-sent on a guess); Matt is paged. */
  | { status: 'unknown'; detail: string }

/** Injectable for the unit test; production uses the real modules. */
export type DeliverDeps = {
  fetchAreas: (slugs: readonly string[]) => Promise<MarketReportAreaBlock[]>
  latestDelivered: typeof getLatestDeliveredReport
  isSuppressed: typeof isSuppressed
  isSuppressedByEmail: typeof isSuppressedByEmail
  insertSend: typeof insertMarketReportSend
  claimSend: typeof claimMarketReportSend
  settleSend: typeof settleMarketReportSend
  sendOne: typeof sendOneSubscriber
  timeline: typeof logReportTimeline
  stampScheduled: typeof stampMarketReportSent
  stampManual: typeof stampReportSubscriptionSentForPerson
  sparkGate: typeof runSparkGate
  readSubscription: typeof getReportSubscriptionRecord
  readContact: typeof getMarketReportContact
  alert: typeof queueBrokerHealthAlert
  markUnknown: typeof markMarketReportSendUnknown
  sentEvidence: typeof getMarketReportSentEvidence
  providerEmail: typeof getSentEmail
  recoveryClaim: typeof claimInFlightRecovery
  readSendState: typeof getMarketReportSendState
}

const REAL: DeliverDeps = {
  fetchAreas: (slugs) => getMarketReportData(slugs),
  latestDelivered: getLatestDeliveredReport,
  isSuppressed,
  isSuppressedByEmail,
  insertSend: insertMarketReportSend,
  claimSend: claimMarketReportSend,
  settleSend: settleMarketReportSend,
  sendOne: sendOneSubscriber,
  timeline: logReportTimeline,
  stampScheduled: stampMarketReportSent,
  stampManual: stampReportSubscriptionSentForPerson,
  sparkGate: runSparkGate,
  readSubscription: getReportSubscriptionRecord,
  readContact: getMarketReportContact,
  alert: queueBrokerHealthAlert,
  markUnknown: markMarketReportSendUnknown,
  sentEvidence: getMarketReportSentEvidence,
  providerEmail: getSentEmail,
  recoveryClaim: claimInFlightRecovery,
  readSendState: getMarketReportSendState,
}

function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

function sameInstant(a: string | null, b: string | null): boolean {
  if (!a || !b) return !a && !b
  return Date.parse(a) === Date.parse(b)
}

/** Her suppression, by record and by address. Fail closed: a read error suppresses. */
async function suppressionOf(
  deps: DeliverDeps,
  personId: number,
  email: string | null,
): Promise<{ suppressed: boolean; reasons: string[] }> {
  const gate = await deps.isSuppressed(personId, 'email')
  if (gate.suppressed) return gate
  const address = (email ?? '').trim()
  if (!address) return gate
  return deps.isSuppressedByEmail(address, 'email')
}

/** One report, end to end. See the file comment for the order. Never throws. */
export async function deliverMarketReport(
  input: DeliverReportInput,
  depsIn: Partial<DeliverDeps> = {},
): Promise<DeliverReportOutcome> {
  const deps: DeliverDeps = { ...REAL, ...depsIn }
  const { kind, subscription, now } = input
  const scheduled = kind === 'scheduled'
  const who = input.contactName ?? `contact ${input.personId}`
  const review = `${BROKER_ALERT_ORIGIN}/admin/people/${input.personId}#market-report`
  const hold = async (reason: ReportHoldReason, detail: string, copy?: HoldCopy) => {
    if (scheduled && subscription) {
      await recordReportHold(
        {
          subscriptionId: subscription.id,
          personId: input.personId,
          lastSentAt: subscription.lastSentAt,
          broker: input.brokerSlug,
          frequency: subscription.frequency,
          areas: subscription.areas,
          reason,
          detail,
          now,
          copy,
        },
        deps.insertSend,
      )
    }
  }
  /** Page Matt on the ops channel. Best-effort: the row is the record. */
  const page = async (key: string, body: string, cooldownMinutes = 24 * 60) => {
    try {
      await deps.alert({ key, cooldownMinutes, body })
    } catch {
      // best-effort only
    }
  }

  // 1. The figures.
  let blocks: MarketReportAreaBlock[]
  try {
    blocks = await deps.fetchAreas(input.areaSlugs)
  } catch (e) {
    return { status: 'failed', detail: 'fetch-areas-failed: ' + errText(e) }
  }
  if (!blocks || blocks.length === 0) {
    const detail = 'No verified market data for the subscribed areas.'
    await hold('no-data', detail)
    return { status: 'held', reason: 'no-data', detail }
  }

  // 2. Freshness.
  const stale = findStaleSources(blocks, now)
  if (stale.length > 0) {
    const detail = `Stale data: ${describeStaleSources(stale)}`
    await hold('stale-data', detail)
    return { status: 'held', reason: 'stale-data', detail }
  }

  const areaSlugs = blocks.map((b) => b.slug)
  const areaNames = blocks.map((b) => b.areaLabel).join(', ')

  /**
   * A delivery is known (sent now, or settled from evidence): the thread's
   * email_out row (deduped per key) and the stamps.
   */
  const recordDelivered = async (emailKey: string, messageId: string | null, sentIso: string, subject: string, stampAt: Date) => {
    if (kind === 'preview') {
      await deps.timeline(input.personId, {
        kind: 'system',
        title: `Market report preview sent to ${input.to}`,
        body: `Preview of the ${areaNames} report. Not sent to the contact.`,
        payload: { emailKey, messageId, kind },
        broker: input.brokerSlug,
        source: 'app',
        dedupeKey: `market-report:${emailKey}`,
      })
      return
    }
    // (k) the thread shows every report that went out, with its message id.
    await deps.timeline(input.personId, {
      kind: 'email_out',
      title: subject,
      body: `Market report sent (${areaNames})`,
      payload: { to: input.to, emailKey, messageId, kind, areas: areaSlugs },
      broker: input.brokerSlug,
      source: 'app',
      dedupeKey: `market-report:${emailKey}`,
    })
    // (d) last_sent_at from every real send, manual included.
    if (scheduled && subscription) {
      const stamp = await deps.stampScheduled(subscription.id, stampAt)
      if (!stamp.ok) {
        console.error(
          `[market-report-deliver] last_sent_at stamp FAILED for subscription ${subscription.id} after a real send (${stamp.error}); ` +
            'the crm_report_sends backstop keeps the next tick from re-sending.',
        )
      }
    } else if (kind === 'manual') {
      await deps.stampManual(input.personId, sentIso)
    }
  }

  /** Send one stored request under its key, and settle the row from the answer. */
  const sendAndSettle = async (
    emailKey: string,
    payload: ReportSendPayload,
    built: { figures: ReportFigure[]; spark: SparkGateResult },
    replayed: boolean,
  ): Promise<DeliverReportOutcome> => {
    const out = await deps.sendOne({
      kind,
      personId: input.personId,
      brokerSlug: input.brokerSlug,
      contactEmail: input.contactEmail,
      emailKey,
      payload,
    })
    if (out.status === 'suppressed') {
      if (scheduled && subscription) {
        // Never a held row at the send key (review 2026-09-30): that froze the
        // subscription, since no later run could take a held key over and the
        // cycle key never changes. The key settles as a failure a later run
        // takes over (and holds again, before any send, while the suppression
        // stands); the hold is recorded under the cycle's own hold key.
        await deps.settleSend(emailKey, { status: 'failed', error: `suppressed at send: ${out.detail}` })
        await hold('suppressed', out.detail)
      } else {
        await deps.settleSend(emailKey, { status: 'held', holdReason: 'suppressed', error: out.detail })
      }
      return { status: 'held', reason: 'suppressed', detail: out.detail }
    }
    if (out.status === 'unknown') {
      // It may have been delivered: stay in flight (counted as delivered),
      // never a failure a retry would re-send on a guess.
      await deps.markUnknown(emailKey, out.detail)
      await page(
        `market-report-send:unknown:${emailKey}`,
        `Market report to ${who} may or may not have gone out: the email provider did not answer (${out.detail.slice(0, 160)}). ` +
          `It is held so it is never sent twice; the next run asks Resend again with the same request and key. Review: ${review}`,
      )
      return { status: 'unknown', detail: out.detail }
    }
    if (out.status === 'failed') {
      await deps.settleSend(emailKey, { status: 'failed', error: out.detail })
      return { status: 'failed', detail: out.detail }
    }
    const sentIso = new Date().toISOString()
    const settled = await deps.settleSend(emailKey, { status: 'sent', messageId: out.messageId, sentAt: sentIso })
    if (!settled.ok) console.error('[deliverMarketReport] settle failed after a real send', emailKey, settled.error)
    await recordDelivered(emailKey, out.messageId, sentIso, payload.request.subject, now)
    return { status: 'sent', messageId: out.messageId, subject: payload.request.subject, figures: built.figures, spark: built.spark, replayed }
  }

  /**
   * An attempt abandoned in flight (its process died): settled from evidence,
   * never presumed delivered or failed (review 2026-09-30). 1) Resend's id on
   * record, confirmed with Resend. 2) Inside the replay window, ONE run takes
   * the recovery and replays the stored request under its key: Resend answers
   * a delivered one with its first result and sends nothing, or sends it now.
   * 3) Otherwise Matt is paged, and nothing is sent or stamped.
   */
  const recoverAbandoned = async (ex: ReportSendState, built: { figures: ReportFigure[]; spark: SparkGateResult }): Promise<DeliverReportOutcome> => {
    let evidence: { messageId: string; at: string } | null = ex.messageId ? { messageId: ex.messageId, at: ex.sentAt ?? ex.attemptedAt } : null
    if (!evidence) {
      try {
        evidence = await deps.sentEvidence(ex.emailKey)
      } catch {
        evidence = null
      }
    }
    if (evidence) {
      let sentIso = evidence.at
      try {
        const held = await deps.providerEmail(evidence.messageId)
        if (held.ok) {
          if (held.createdAt) sentIso = held.createdAt
        } else if (held.notFound) {
          await page(
            `market-report-send:unresolved:${ex.emailKey}`,
            `A market report attempt to ${who} (${ex.emailKey}) recorded Resend id ${evidence.messageId}, but Resend has no such email. ` +
              `It is held and nothing is re-sent until someone checks Resend. Review: ${review}`,
          )
          return { status: 'failed', detail: `unresolved: Resend has no email ${evidence.messageId}` }
        }
      } catch {
        // The id came from Resend's own acceptance; an unreachable Resend does not unmake it.
      }
      await deps.settleSend(ex.emailKey, { status: 'sent', messageId: evidence.messageId, sentAt: sentIso })
      await recordDelivered(ex.emailKey, evidence.messageId, sentIso, ex.payload?.request.subject ?? `Market report (${areaNames})`, new Date(sentIso))
      return { status: 'already-sent', sentAt: sentIso }
    }
    if (isReplayable(ex.payload, now)) {
      const won = await deps.recoveryClaim(ex.emailKey, ex.attemptedAt, now.toISOString())
      if (!won) return { status: 'already-sent', sentAt: ex.attemptedAt }
      return sendAndSettle(ex.emailKey, ex.payload, built, true)
    }
    await page(
      `market-report-send:unresolved:${ex.emailKey}`,
      `A market report attempt to ${who} (${ex.emailKey}, ${ex.attemptedAt}) was left in flight and there is no record it reached Resend ` +
        `${ex.payload ? 'and its stored request is past the replay window' : 'and no stored request to replay'}. ` +
        `Nothing is re-sent or stamped until someone checks Resend for it. Review: ${review}`,
    )
    return { status: 'failed', detail: `unresolved: an abandoned attempt (${ex.emailKey}) has no evidence and cannot be replayed safely` }
  }

  const noneBuilt = { figures: [] as ReportFigure[], spark: null as unknown as SparkGateResult }

  if (scheduled && subscription) {
    // 3. Already received one inside the window (the durable backstop for a
    //    last_sent_at stamp that failed after a real send, or a live attempt
    //    in flight: both count as delivered). The stamp is repaired for a
    //    delivery. An attempt ABANDONED in flight is settled from evidence:
    //    this key's own attempt at the claim below, another key's here.
    try {
      const latest = await deps.latestDelivered(input.personId)
      if (latest && !isDue({ frequency: normalizeReportFrequency(subscription.frequency), lastSentAt: latest.at, now })) {
        if (!latest.inFlight) {
          await deps.stampScheduled(subscription.id, new Date(latest.at))
          return { status: 'already-sent', sentAt: latest.at }
        }
        if (!inFlightAbandoned(latest.at, now)) return { status: 'already-sent', sentAt: latest.at }
        if (latest.emailKey && latest.emailKey !== input.emailKey) {
          const other = await deps.readSendState(latest.emailKey)
          if (other && isInFlightSend(other)) {
            const resolved = await recoverAbandoned(other, noneBuilt)
            if (resolved.status === 'sent') return { status: 'already-sent', sentAt: new Date().toISOString() }
            if (resolved.status === 'already-sent' || resolved.status === 'unknown') return resolved
            if (resolved.status === 'failed' && resolved.detail.startsWith('unresolved')) return resolved
            // Settled as not delivered (a failure or a hold): go on with this cycle.
          }
        }
      }
    } catch {
      // The backstop is best-effort; the per-cycle claim below still refuses a repeat.
    }
    // 4. Suppressed (her record or her address): one held row per cycle.
    const gate = await suppressionOf(deps, input.personId, input.contactEmail)
    if (gate.suppressed) {
      const detail = gate.reasons.join(', ') || 'suppressed'
      await hold('suppressed', detail)
      return { status: 'held', reason: 'suppressed', detail }
    }
  }

  // 5. Render, with the signed links and the trace.
  let links: ReturnType<typeof reportEmailLinks>
  try {
    links = reportEmailLinks({
      personId: input.personId,
      subscriptionId: subscription?.id ?? null,
      emailKey: input.emailKey,
      preview: kind === 'preview',
    })
  } catch (e) {
    return { status: 'failed', detail: 'link-signing-failed: ' + errText(e) }
  }
  let rendered: ReturnType<typeof renderMarketReportEmail>
  try {
    rendered = renderMarketReportEmail({
      contactName: input.contactName,
      brokerSlug: input.brokerSlug,
      areas: blocks,
      unsubscribeUrl: links.unsubscribeUrl,
      viewUrl: links.viewUrl,
      manageUrl: links.manageUrl,
      senderBroker: shellBrokerFor(input.brokerSlug),
      asOf: now,
    })
  } catch (e) {
    // The chart signs its values with the email secret: a missing secret refuses.
    return { status: 'failed', detail: 'render-failed: ' + errText(e) }
  }
  const subject = kind === 'preview' ? `[Preview] ${rendered.subject}` : rendered.subject
  const rowAreas = kind === 'preview' && subscription ? subscription.areas : areaSlugs

  // 6. The §0 Spark gate, for every kind of send.
  let spark: SparkGateResult
  try {
    spark = await deps.sparkGate({ blocks, figures: rendered.figures, memo: input.sparkMemo, now })
  } catch (e) {
    spark = {
      verdict: 'not-reconciled',
      rule: SPARK_GATE_RULE,
      checkedAt: now.toISOString(),
      since: null,
      checks: [],
      queries: [],
      polygonGaps: [],
      error: errText(e),
    }
  }
  if (spark.verdict !== 'ok') {
    const reason: DeliverHoldReason = spark.verdict === 'STOP' ? 'spark-stop' : 'spark-unreconciled'
    const detail = describeSparkGate(spark)
    await recordReportHold(
      {
        subscriptionId: subscription?.id ?? null,
        personId: input.personId,
        lastSentAt: subscription?.lastSentAt ?? null,
        broker: input.brokerSlug,
        frequency: subscription?.frequency ?? null,
        areas: rowAreas,
        reason,
        detail,
        now,
        kind,
        // A scheduled hold is one row per cycle, refreshed each tick with the
        // latest numbers; a broker's manual send or preview holds under its
        // own key.
        emailKey: scheduled && subscription ? undefined : input.emailKey,
        refresh: scheduled,
        copy: {
          subject,
          html: rendered.html,
          plainText: rendered.text,
          figures: rendered.figures,
          recipientEmail: input.to,
          sparkCheck: spark,
        },
      },
      deps.insertSend,
    )
    await page(
      `market-report-send:spark-hold:${subscription ? `s${subscription.id}` : `p${input.personId}`}`,
      [`Market report ${kind === 'preview' ? 'preview ' : ''}held for ${who}:`, detail.slice(0, 300), `Review: ${review}`].join(' '),
    )
    return { status: 'held', reason, detail }
  }
  const built = { figures: rendered.figures, spark }

  // 7. Re-read just before the wire: a change made while this report was
  //    being built cancels it. A preview goes to the broker and is not re-read.
  if (kind !== 'preview') {
    let fresh: Awaited<ReturnType<typeof getReportSubscriptionRecord>>
    let contactNow: Awaited<ReturnType<typeof getMarketReportContact>>
    try {
      ;[fresh, contactNow] = await Promise.all([
        subscription ? deps.readSubscription({ id: subscription.id }) : deps.readSubscription({ personId: input.personId }),
        deps.readContact(input.personId),
      ])
    } catch (e) {
      return { status: 'failed', detail: 'could not re-read the subscription before sending, so it was not sent: ' + errText(e) }
    }
    if (!contactNow || contactNow.deleted) {
      return { status: 'cancelled', reason: 'contact-deleted', detail: 'The contact was deleted while the report was being built.' }
    }
    if (scheduled && subscription) {
      if (!fresh || fresh.personId !== input.personId || !fresh.isActive || fresh.stoppedAt || !fresh.firstSendApprovedAt) {
        return {
          status: 'cancelled',
          reason: 'stopped',
          detail: 'The report was stopped, paused or unapproved while it was being built.',
        }
      }
      if (!sameInstant(fresh.lastSentAt, subscription.lastSentAt)) {
        // Another run sent this cycle's report while this one was building.
        return { status: 'already-sent', sentAt: fresh.lastSentAt ?? now.toISOString() }
      }
      if (!sameAreaSet(fresh.areas, subscription.areas) || fresh.frequency !== normalizeReportFrequency(subscription.frequency)) {
        return {
          status: 'cancelled',
          reason: 'changed',
          detail: 'The areas or the interval changed while the report was being built; the next run sends the new one.',
        }
      }
    } else if (fresh && isContactHeld(fresh)) {
      return {
        status: 'cancelled',
        reason: 'stopped',
        detail: isContactStopped(fresh)
          ? 'The contact stopped market reports while the report was being built.'
          : 'The contact paused market reports while the report was being built.',
      }
    }

    //    ...and the latest delivery AGAIN, right before the claim (review
    //    2026-09-30): the Spark check takes seconds, and a broker's "Send now"
    //    and the cron must never both send. Scheduled: a delivery inside the
    //    window (or one in flight) wins. Manual: one in flight, or one begun
    //    after this one began, wins; an earlier report does not (a broker may
    //    send again on purpose).
    let latest: Awaited<ReturnType<typeof getLatestDeliveredReport>> = null
    try {
      latest = await deps.latestDelivered(input.personId)
    } catch {
      latest = null
    }
    if (latest) {
      const live = latest.inFlight && !inFlightAbandoned(latest.at, now)
      if (scheduled && subscription) {
        if (!isDue({ frequency: normalizeReportFrequency(subscription.frequency), lastSentAt: latest.at, now }) && (!latest.inFlight || live)) {
          if (!latest.inFlight) await deps.stampScheduled(subscription.id, new Date(latest.at))
          return { status: 'already-sent', sentAt: latest.at }
        }
      } else if (live || Date.parse(latest.at) >= now.getTime()) {
        return { status: 'already-sent', sentAt: latest.at }
      }
    }
  }

  // 8. The exact request, built once, then the claim with it stored.
  const prepared = prepareReportEmail({
    kind,
    personId: input.personId,
    brokerSlug: input.brokerSlug,
    to: input.to,
    subject,
    html: rendered.html,
    text: rendered.text,
    unsubscribeUrl: links.unsubscribeUrl,
    oneClickUrl: links.oneClickUrl,
    emailKey: input.emailKey,
  })
  const payload: ReportSendPayload = {
    v: 1,
    idempotencyKey: reportIdempotencyKey(input.emailKey, prepared.request),
    builtAt: now.toISOString(),
    request: prepared.request,
  }
  const claim = await deps.claimSend(
    {
      subscriptionId: subscription?.id ?? null,
      personId: input.personId,
      emailKey: input.emailKey,
      broker: input.brokerSlug,
      kind,
      recipientEmail: input.to,
      attemptedAt: now.toISOString(),
      frequency: subscription?.frequency ?? null,
      areas: rowAreas,
      subject,
      html: prepared.cleanHtml,
      plainText: prepared.cleanText,
      figures: rendered.figures,
      sparkCheck: spark,
      payload,
    },
    now,
  )
  if (!claim.ok) return { status: 'failed', detail: 'could not record the send, so it was not sent: ' + claim.error }
  if (!claim.claimed) {
    const ex = claim.existing
    if (ex.status === 'sent') {
      const at = ex.sentAt ?? ex.attemptedAt
      if (scheduled && subscription) await deps.stampScheduled(subscription.id, new Date(at))
      return { status: 'already-sent', sentAt: at }
    }
    if (isInFlightSend(ex)) {
      // A live attempt is left to settle (no stamp: if it fails, the next run
      // retries it); an abandoned one is settled from evidence.
      if (!inFlightAbandoned(ex.attemptedAt, now)) return { status: 'already-sent', sentAt: ex.attemptedAt }
      return recoverAbandoned(ex, built)
    }
    await page(
      `market-report-send:unexpected:${input.emailKey}`,
      `The market report send key ${input.emailKey} (${who}) is ${ex.status}${ex.error ? ` (${ex.error.slice(0, 120)})` : ''} and could not be claimed. Nothing was sent. Review: ${review}`,
    )
    return { status: 'failed', detail: `a send with this key is recorded as ${ex.status}${ex.error ? ` (${ex.error})` : ''}` }
  }
  if (claim.from === 'held') {
    // Holds use their own keys, so a held send key is unexpected. Nothing went
    // out under it, so it was taken over; a person should know it happened.
    await page(
      `market-report-send:unexpected:${input.emailKey}`,
      `The market report send key ${input.emailKey} (${who}) was found held, which only holds under their own keys should be. It was taken over and sent (nothing had gone out under it). Review: ${review}`,
    )
  }

  // 9. The wire: this render, or the stored request a retry replays byte for byte.
  return sendAndSettle(input.emailKey, claim.replay ?? payload, built, claim.replay != null)
}

/** The cron's per-contact call: a scheduled delivery for one due subscriber. */
export async function deliverScheduledReport(input: ScheduledDeliverInput): Promise<ScheduledDeliverOutcome> {
  const sub = input.subscriber
  const outcome = await deliverMarketReport({
    kind: 'scheduled',
    personId: sub.personId,
    contactName: sub.personName,
    to: input.email,
    contactEmail: input.email,
    brokerSlug: input.brokerSlug,
    subscription: { id: sub.subscriptionId, frequency: sub.frequency, areas: sub.areas, lastSentAt: sub.lastSentAt },
    areaSlugs: sub.areas,
    emailKey: input.emailKey,
    now: input.now,
    sparkMemo: input.sparkMemo,
  })
  if (outcome.status === 'sent') return { status: 'sent', messageId: outcome.messageId }
  if (outcome.status === 'held') return { status: 'held', reason: outcome.reason, detail: outcome.detail }
  if (outcome.status === 'already-sent') return { status: 'already-sent', sentAt: outcome.sentAt }
  if (outcome.status === 'cancelled') return { status: 'cancelled', reason: outcome.reason, detail: outcome.detail }
  if (outcome.status === 'unknown') return { status: 'unknown', detail: outcome.detail }
  return { status: 'failed', detail: outcome.detail }
}
