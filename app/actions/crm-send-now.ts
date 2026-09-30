'use server'
import { revalidatePerson } from '@/lib/crm/revalidate-person'

/**
 * One-off "send it to this contact NOW" market report on the person page
 * (Matt directive 2026-07-09: opening a client must let you send them CMAs,
 * newsletters, and market reports, not just manage subscriptions). Reached
 * only through the deliverable chokepoint (app/actions/send-deliverable.ts).
 *
 * Rebuilt 2026-09-29 on the same delivery path as the cadence
 * (lib/crm/market-report-deliver.ts): fresh §0 figures with a stale-data hold,
 * the stored copy and figures trace in crm_report_sends, the report's own
 * View online / Manage / Unsubscribe links and the RFC 8058 one-click header,
 * the suppression chokepoint, the email_out timeline row with the message id,
 * and last_sent_at stamped on her subscription so a "Send now + subscribe"
 * does not send the same report twice.
 *
 * The sender is the contact's assigned broker (Matt 2026-09-29: the report
 * rail, the assigned broker's identity), and a contact who stopped her own
 * reports is refused: a broker restarts them first, with her consent on
 * record, on the market report card.
 *
 * Like every send, a manual one runs the §0 Spark gate first (review
 * 2026-09-30): a figure that differs from Spark by more than 1%, or one Spark
 * cannot rebuild, holds it (recorded on the card, Matt paged), and the broker
 * is told which figure. Her own stop made while it was being built refuses it.
 */

import { revalidatePath } from 'next/cache'
import { requireCrmAccess, requirePersonInScope, type CrmActionResult } from '@/app/actions/crm'
import { sanitizeAdminAreas } from '@/lib/crm/market-report-admin'
import { isContactStopped } from '@/lib/crm/market-report-subscription-control'
import { deliverMarketReport, type DeliverReportOutcome } from '@/lib/crm/market-report-deliver'
import {
  getMarketReportContact,
  getReportSubscriptionRecord,
  type MarketReportContact,
  type ReportSubscriptionRecord,
} from '@/lib/data/crm/marketReportSubscription'

/** Why a manual send did not go out, in the broker's words. Pure. */
function manualNotSentReason(outcome: Exclude<DeliverReportOutcome, { status: 'sent' }>): string {
  switch (outcome.status) {
    case 'held':
      switch (outcome.reason) {
        case 'suppressed':
          return 'email is turned off for this contact'
        case 'stale-data':
          return `the market data is not fresh (${outcome.detail})`
        case 'no-data':
          return 'no verified market data for these areas right now'
        case 'spark-stop':
        case 'spark-unreconciled':
          return `the numbers did not pass the Spark check, so the report is held for Matt. ${outcome.detail}`
      }
      break
    case 'cancelled':
      return outcome.detail
    case 'failed':
      return outcome.detail
    case 'already-sent':
      return 'already sent'
  }
  return 'not sent'
}

export async function sendMarketReportNowAction(
  personId: number,
  formData: FormData,
): Promise<CrmActionResult> {
  const access = await requireCrmAccess()
  if (!access.ok) return access
  const pid = Number(personId)
  if (!Number.isFinite(pid) || pid <= 0) return { ok: false, error: 'Bad person id' }
  const scoped = await requirePersonInScope(pid, access.access)
  if (!scoped.ok) return scoped

  // Validate + de-dupe against the live registry. A bogus slug (stale UI or a
  // typo) is refused with its name, never silently dropped into an empty report.
  const { areas, unknown } = sanitizeAdminAreas(formData.getAll('areas').map((a) => String(a)))
  if (unknown.length > 0) {
    return { ok: false, error: `Unknown area${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}` }
  }
  if (areas.length === 0) return { ok: false, error: 'Pick at least one area first' }

  let contact: MarketReportContact | null
  let subscription: ReportSubscriptionRecord | null
  try {
    ;[contact, subscription] = await Promise.all([
      getMarketReportContact(pid),
      getReportSubscriptionRecord({ personId: pid }),
    ])
  } catch (e) {
    // Fail closed: without her subscription we cannot tell whether she stopped
    // these reports herself.
    return { ok: false, error: `Could not read this contact's report settings (${e instanceof Error ? e.message : String(e)})` }
  }
  if (!contact || contact.deleted) return { ok: false, error: 'Person not found' }
  if (!contact.primaryEmail) return { ok: false, error: 'No email address on file' }
  if (subscription && isContactStopped(subscription)) {
    return {
      ok: false,
      error:
        'This contact stopped market reports themselves. Turn them back on from the market report card, with a note of how they asked, before sending one.',
    }
  }

  const brokerSlug = contact.assignedBroker ?? access.access.brokerSlug ?? 'matt'
  const now = new Date()
  const outcome = await deliverMarketReport({
    kind: 'manual',
    personId: pid,
    contactName: contact.firstName ?? contact.name,
    to: contact.primaryEmail,
    brokerSlug,
    contactEmail: contact.primaryEmail,
    subscription: subscription
      ? {
          id: subscription.id,
          frequency: subscription.frequency,
          areas: subscription.areas,
          lastSentAt: subscription.lastSentAt,
        }
      : null,
    areaSlugs: areas,
    emailKey: `market-report:manual:${pid}:${now.getTime()}`,
    now,
  })

  if (outcome.status !== 'sent') return { ok: false, error: `Not sent: ${manualNotSentReason(outcome)}` }

  revalidatePath('/admin/crm')
  revalidatePerson(pid)
  return { ok: true }
}
