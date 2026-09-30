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
 *      manual send, or an attempt still IN FLIGHT, which counts as delivered)
 *      is not sent again; the stamp is repaired instead.
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
 *   8. CLAIM the send key before the wire: the stored copy and the trace exist
 *      before the email does, so "View this report online" never points at
 *      nothing, and a row that cannot be written means no send (no trace, no
 *      ship). A scheduled key is one per subscription per due cycle, so two
 *      overlapping runs cannot both send; a retry takes over only an attempt
 *      that settled as a failure; an attempt in flight counts as delivered.
 *   9. sendOneSubscriber (the one gated send call; the send key is also the
 *      provider's idempotency key), then settle the row.
 *  10. Sent (not a preview): the email_out timeline row with the message id,
 *      and last_sent_at stamped from the manual path too (a "Send now +
 *      subscribe" no longer double-sends).
 *
 * Never throws; every path returns an outcome.
 */
import 'server-only'

import { getMarketReportData, type MarketReportAreaBlock } from '@/lib/data/crm/getMarketReportData'
import {
  claimMarketReportSend,
  getLatestDeliveredReport,
  inFlightAbandoned,
  insertMarketReportSend,
  isInFlightSend,
  settleMarketReportSend,
  type ReportHoldReason,
  type ReportSendKind,
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
import { isContactStopped } from '@/lib/crm/market-report-subscription-control'
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
  sendOneSubscriber,
  type ScheduledDeliverInput,
  type ScheduledDeliverOutcome,
} from '@/lib/crm/market-report-send'

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
  | { status: 'sent'; messageId: string | null; subject: string; figures: ReportFigure[]; spark: SparkGateResult }
  | { status: 'held'; reason: DeliverHoldReason; detail: string }
  | { status: 'already-sent'; sentAt: string }
  /** Nothing went out: the subscription or the contact changed while the report was built. */
  | { status: 'cancelled'; reason: 'stopped' | 'changed' | 'contact-deleted'; detail: string }
  | { status: 'failed'; detail: string }

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
}

function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  const s = new Set(a)
  return b.every((x) => s.has(x))
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
  const hold = async (reason: ReportHoldReason, detail: string) => {
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
        },
        deps.insertSend,
      )
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

  if (scheduled && subscription) {
    // 3. Already received one inside the window (the durable backstop for a
    //    last_sent_at stamp that failed after a real send, or an attempt in
    //    flight: both count as delivered). The stamp is repaired, except for
    //    an attempt another process may still be sending (IN_FLIGHT_SETTLE_MS):
    //    if that one fails, the next tick must be free to retry it.
    try {
      const latest = await deps.latestDelivered(input.personId)
      if (latest && !isDue({ frequency: normalizeReportFrequency(subscription.frequency), lastSentAt: latest.at, now })) {
        if (!latest.inFlight || inFlightAbandoned(latest.at, now)) await deps.stampScheduled(subscription.id, new Date(latest.at))
        return { status: 'already-sent', sentAt: latest.at }
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
  const rendered = renderMarketReportEmail({
    contactName: input.contactName,
    brokerSlug: input.brokerSlug,
    areas: blocks,
    unsubscribeUrl: links.unsubscribeUrl,
    viewUrl: links.viewUrl,
    manageUrl: links.manageUrl,
    senderBroker: shellBrokerFor(input.brokerSlug),
    asOf: now,
  })
  const subject = kind === 'preview' ? `[Preview] ${rendered.subject}` : rendered.subject
  const areaSlugs = blocks.map((b) => b.slug)
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
    try {
      await deps.alert({
        key: `market-report-send:spark-hold:${subscription ? `s${subscription.id}` : `p${input.personId}`}`,
        cooldownMinutes: 24 * 60,
        body: [
          `Market report ${kind === 'preview' ? 'preview ' : ''}held for ${input.contactName ?? `contact ${input.personId}`}:`,
          detail.slice(0, 300),
          `Review: ${BROKER_ALERT_ORIGIN}/admin/people/${input.personId}#market-report`,
        ].join(' '),
      })
    } catch {
      // best-effort: the held row is the record
    }
    return { status: 'held', reason, detail }
  }

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
      if (!sameSet(fresh.areas, subscription.areas) || fresh.frequency !== normalizeReportFrequency(subscription.frequency)) {
        return {
          status: 'cancelled',
          reason: 'changed',
          detail: 'The areas or the interval changed while the report was being built; the next run sends the new one.',
        }
      }
    } else if (fresh && isContactStopped(fresh)) {
      return { status: 'cancelled', reason: 'stopped', detail: 'The contact stopped market reports while the report was being built.' }
    }
  }

  // 8. Claim the send key before the wire.
  const claim = await deps.claimSend({
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
    html: rendered.html,
    plainText: rendered.text,
    figures: rendered.figures,
    sparkCheck: spark,
  })
  if (!claim.ok) return { status: 'failed', detail: 'could not record the send, so it was not sent: ' + claim.error }
  if (!claim.claimed) {
    const ex = claim.existing
    if (ex.status === 'sent' || isInFlightSend(ex)) {
      // Delivered, or in flight (which may have gone out): never sent again.
      // The stamp moves on for a delivery, or for an attempt no live process
      // can still be sending; a younger in-flight attempt is left to settle.
      const at = ex.sentAt ?? ex.attemptedAt
      if (scheduled && subscription && (ex.status === 'sent' || inFlightAbandoned(ex.attemptedAt, now))) {
        await deps.stampScheduled(subscription.id, new Date(at))
      }
      return { status: 'already-sent', sentAt: at }
    }
    return { status: 'failed', detail: `a send with this key is already recorded as ${ex.status}${ex.error ? ` (${ex.error})` : ''}` }
  }

  // 9. The wire.
  const out = await deps.sendOne({
    kind,
    personId: input.personId,
    brokerSlug: input.brokerSlug,
    to: input.to,
    contactEmail: input.contactEmail,
    subject,
    html: rendered.html,
    text: rendered.text,
    unsubscribeUrl: links.unsubscribeUrl,
    oneClickUrl: links.oneClickUrl,
    emailKey: input.emailKey,
  })

  if (out.status === 'suppressed') {
    await deps.settleSend(input.emailKey, { status: 'held', holdReason: 'suppressed', error: out.detail })
    return { status: 'held', reason: 'suppressed', detail: out.detail }
  }
  if (out.status === 'failed') {
    await deps.settleSend(input.emailKey, {
      status: 'failed',
      error: out.detail,
      html: out.preparedHtml,
      plainText: out.preparedText,
    })
    return { status: 'failed', detail: out.detail }
  }

  const sentIso = new Date().toISOString()
  const settled = await deps.settleSend(input.emailKey, {
    status: 'sent',
    messageId: out.messageId,
    sentAt: sentIso,
    html: out.preparedHtml,
    plainText: out.preparedText,
  })
  if (!settled.ok) console.error('[deliverMarketReport] settle failed after a real send', input.emailKey, settled.error)

  // 10. The record.
  const areaNames = blocks.map((b) => b.areaLabel).join(', ')
  if (kind === 'preview') {
    await deps.timeline(input.personId, {
      kind: 'system',
      title: `Market report preview sent to ${input.to}`,
      body: `Preview of the ${areaNames} report. Not sent to the contact.`,
      payload: { emailKey: input.emailKey, messageId: out.messageId, kind },
      broker: input.brokerSlug,
      source: 'app',
      dedupeKey: `market-report:${input.emailKey}`,
    })
  } else {
    // (k) the thread shows every report that went out, with its message id.
    await deps.timeline(input.personId, {
      kind: 'email_out',
      title: subject,
      body: `Market report sent (${areaNames})`,
      payload: { to: input.to, emailKey: input.emailKey, messageId: out.messageId, kind, areas: areaSlugs },
      broker: input.brokerSlug,
      source: 'app',
      dedupeKey: `market-report:${input.emailKey}`,
    })
    // (d) last_sent_at from every real send, manual included.
    if (scheduled && subscription) {
      const stamp = await deps.stampScheduled(subscription.id, now)
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

  return { status: 'sent', messageId: out.messageId, subject, figures: rendered.figures, spark }
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
  return { status: 'failed', detail: outcome.detail }
}
