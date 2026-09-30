/**
 * market-report-deliver — one market report, from figures to a settled
 * crm_report_sends row, for all three kinds of send (Matt's decisions
 * 2026-09-29):
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
 *      cadence window (a stamp write that failed after a send, or a broker's
 *      manual send) is not sent again; the stamp is repaired instead.
 *   4. Scheduled only: suppressed contacts are held once per due cycle (the
 *      send leaf re-checks anyway; this keeps one row instead of one a tick).
 *   5. Render with the signed links (web view, manage, report-scoped
 *      unsubscribe, one-click) and the figures trace.
 *   6. CLAIM the send row before the wire: the stored copy and the trace exist
 *      before the email does, so "View this report online" never points at
 *      nothing, and a row that cannot be written means no send (no trace, no
 *      ship). A duplicate email_key refuses the send.
 *   7. sendOneSubscriber (the one gated send call), then settle the row.
 *   8. Sent (not a preview): the email_out timeline row with the message id
 *      (the cron wrote none before), and last_sent_at stamped from the
 *      manual path too (a "Send now + subscribe" no longer double-sends).
 *
 * Never throws; every path returns an outcome.
 */
import 'server-only'

import { getMarketReportData, type MarketReportAreaBlock } from '@/lib/data/crm/getMarketReportData'
import {
  getLatestDeliveredReportAt,
  insertMarketReportSend,
  settleMarketReportSend,
  type ReportHoldReason,
  type ReportSendKind,
} from '@/lib/data/crm/marketReportSends'
import {
  logReportTimeline,
  stampReportSubscriptionSentForPerson,
} from '@/lib/data/crm/marketReportSubscription'
import { stampMarketReportSent } from '@/lib/data/crm/stampMarketReportSent'
import { isDue } from '@/lib/crm/market-report-cadence'
import { describeStaleSources, findStaleSources } from '@/lib/crm/market-report-freshness'
import { renderMarketReportEmail, type ReportFigure } from '@/lib/crm/market-report-email'
import { isSuppressed } from '@/lib/crm/suppressions'
import { reportEmailLinks } from '@/lib/email/report-link-token'
import { shellBrokerFor } from '@/lib/email/broker-identity'
import { normalizeReportFrequency } from '@/lib/data/crm/getContactReportSubscriptions'
import {
  sendOneSubscriber,
  type ScheduledDeliverInput,
  type ScheduledDeliverOutcome,
} from '@/lib/crm/market-report-send'

/** The key of a held row: one per reason per subscription per due cycle. Pure. */
export function holdKey(reason: ReportHoldReason, subscriptionId: number, lastSentAt: string | null): string {
  const cycle = lastSentAt ? lastSentAt.replace(/[^0-9]/g, '').slice(0, 14) : 'first'
  return `market-report:held:${reason}:${subscriptionId}:${cycle}`
}

/**
 * Record that a due report did not go out, once per reason per due cycle
 * (the email_key is unique, so the cron's next tick is a no-op). Never throws.
 */
export async function recordReportHold(
  input: {
    subscriptionId: number
    personId: number
    lastSentAt: string | null
    broker: string | null
    frequency: string | null
    areas: readonly string[]
    reason: ReportHoldReason
    detail?: string | null
    now: Date
  },
  insert: typeof insertMarketReportSend = insertMarketReportSend,
): Promise<void> {
  const res = await insert({
    subscriptionId: input.subscriptionId,
    personId: input.personId,
    emailKey: holdKey(input.reason, input.subscriptionId, input.lastSentAt),
    broker: input.broker,
    kind: 'scheduled',
    status: 'held',
    holdReason: input.reason,
    error: input.detail ?? null,
    attemptedAt: input.now.toISOString(),
    frequency: input.frequency,
    areas: input.areas,
  })
  if (!res.ok) console.error('[recordReportHold]', input.reason, input.subscriptionId, res.error)
}

export type DeliverReportInput = {
  kind: ReportSendKind
  personId: number
  contactName: string | null
  /** The contact's address, or the broker's own mailbox for a preview. */
  to: string
  /** The broker the email is from (the contact's assigned broker). */
  brokerSlug: string
  /** The subscription the report belongs to; null for a one-off manual send. */
  subscription: { id: number; frequency: string; areas: string[]; lastSentAt: string | null } | null
  areaSlugs: readonly string[]
  emailKey: string
  now: Date
}

export type DeliverReportOutcome =
  | { status: 'sent'; messageId: string | null; subject: string; figures: ReportFigure[] }
  | { status: 'held'; reason: 'stale-data' | 'no-data' | 'suppressed'; detail: string }
  | { status: 'already-sent'; sentAt: string }
  | { status: 'failed'; detail: string }

/** Injectable for the unit test; production uses the real modules. */
export type DeliverDeps = {
  fetchAreas: (slugs: readonly string[]) => Promise<MarketReportAreaBlock[]>
  latestDeliveredAt: (personId: number) => Promise<string | null>
  isSuppressed: typeof isSuppressed
  insertSend: typeof insertMarketReportSend
  settleSend: typeof settleMarketReportSend
  sendOne: typeof sendOneSubscriber
  timeline: typeof logReportTimeline
  stampScheduled: typeof stampMarketReportSent
  stampManual: typeof stampReportSubscriptionSentForPerson
}

const REAL: DeliverDeps = {
  fetchAreas: (slugs) => getMarketReportData(slugs),
  latestDeliveredAt: getLatestDeliveredReportAt,
  isSuppressed,
  insertSend: insertMarketReportSend,
  settleSend: settleMarketReportSend,
  sendOne: sendOneSubscriber,
  timeline: logReportTimeline,
  stampScheduled: stampMarketReportSent,
  stampManual: stampReportSubscriptionSentForPerson,
}

function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
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
    //    last_sent_at stamp that failed after a real send).
    try {
      const latest = await deps.latestDeliveredAt(input.personId)
      if (latest && !isDue({ frequency: normalizeReportFrequency(subscription.frequency), lastSentAt: latest, now })) {
        await deps.stampScheduled(subscription.id, new Date(latest))
        return { status: 'already-sent', sentAt: latest }
      }
    } catch {
      // The backstop is best-effort; the cadence stamp already gated this run.
    }
    // 4. Suppressed: one held row per cycle.
    const gate = await deps.isSuppressed(input.personId, 'email')
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

  // 6. Claim the row before the wire.
  const claim = await deps.insertSend({
    subscriptionId: subscription?.id ?? null,
    personId: input.personId,
    emailKey: input.emailKey,
    broker: input.brokerSlug,
    kind,
    status: 'failed',
    error: 'sending',
    recipientEmail: input.to,
    attemptedAt: now.toISOString(),
    frequency: subscription?.frequency ?? null,
    areas: kind === 'preview' && subscription ? subscription.areas : areaSlugs,
    subject,
    html: rendered.html,
    plainText: rendered.text,
    figures: rendered.figures,
  })
  if (!claim.ok) return { status: 'failed', detail: 'could not record the send, so it was not sent: ' + claim.error }
  if (!claim.inserted) return { status: 'failed', detail: `a send with this key already exists (${input.emailKey})` }

  // 7. The wire.
  const out = await deps.sendOne({
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

  return { status: 'sent', messageId: out.messageId, subject, figures: rendered.figures }
}

/** The cron's per-contact call: a scheduled delivery for one due subscriber. */
export async function deliverScheduledReport(input: ScheduledDeliverInput): Promise<ScheduledDeliverOutcome> {
  const sub = input.subscriber
  const outcome = await deliverMarketReport({
    kind: 'scheduled',
    personId: sub.personId,
    contactName: sub.personName,
    to: input.email,
    brokerSlug: input.brokerSlug,
    subscription: { id: sub.subscriptionId, frequency: sub.frequency, areas: sub.areas, lastSentAt: sub.lastSentAt },
    areaSlugs: sub.areas,
    emailKey: input.emailKey,
    now: input.now,
  })
  if (outcome.status === 'sent') return { status: 'sent', messageId: outcome.messageId }
  if (outcome.status === 'held') return { status: 'held', reason: outcome.reason, detail: outcome.detail }
  if (outcome.status === 'already-sent') return { status: 'already-sent', sentAt: outcome.sentAt }
  return { status: 'failed', detail: outcome.detail }
}
