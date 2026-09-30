/**
 * getMarketReportCard — everything the CRM's market-report card shows for one
 * contact (Matt's decisions 2026-09-29: admins see the same reports and the
 * same controls the contact has, on the CRM record).
 *
 *   - the subscription: area labels from the live registry, the interval,
 *     on / off / stopped (and who stopped it), the first-send approval, the
 *     last send, the next send with its named basis, the consent source, the
 *     requested-at stamp and the consent note;
 *   - the latest preview, and whether it still matches the current areas and
 *     interval (approval means "send what I previewed");
 *   - every send, held and failed included, newest first, with its lifecycle
 *     (delivered / opened / clicked / bounced) joined by email_key.
 *
 * Read-only. Reads go through the lib/data modules named below (G1).
 */
import 'server-only'

import {
  getReportSubscriptionRecord,
  type ReportSubscriptionRecord,
} from '@/lib/data/crm/marketReportSubscription'
import {
  emptySendEngagement,
  getReportSendEngagement,
  listMarketReportSendsForPerson,
  type ReportSendEngagement,
  type ReportSendSummary,
} from '@/lib/data/crm/marketReportSends'
import { nextReportSendAt } from '@/lib/crm/market-report-cadence'
import {
  isContactStopped,
  reportSubscriptionState,
  type ReportSubscriptionState,
} from '@/lib/crm/market-report-subscription-control'
import { reportAreaLabel, reportAreaOptions } from '@/lib/crm/market-report-areas'

export type MarketReportCardSend = ReportSendSummary & {
  engagement: ReportSendEngagement
  areaLabels: string[]
}

export type MarketReportCard = {
  subscription: ReportSubscriptionRecord | null
  state: ReportSubscriptionState | 'none'
  areas: Array<{ slug: string; label: string }>
  /** Every area the report can cover, for the picker. */
  areaOptions: Array<{ slug: string; label: string }>
  /** The contact stopped these reports herself; a restart needs a consent note. */
  contactStopped: boolean
  /** ISO time the next report can go out, or null (off, or not approved). */
  nextSendAt: string | null
  latestPreview: ReportSendSummary | null
  /** The latest preview covered the current areas and interval. */
  previewMatches: boolean
  sends: MarketReportCardSend[]
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  const s = new Set(a)
  return b.every((x) => s.has(x))
}

export async function getMarketReportCard(personId: number, now: Date = new Date()): Promise<MarketReportCard> {
  let subscription: ReportSubscriptionRecord | null = null
  try {
    subscription = await getReportSubscriptionRecord({ personId })
  } catch (e) {
    console.error('[getMarketReportCard] subscription read failed', e instanceof Error ? e.message : e)
  }

  const sends = await listMarketReportSendsForPerson(personId, { limit: 30 })
  const engagement = await getReportSendEngagement(sends.filter((s) => s.status === 'sent').map((s) => s.emailKey))
  const latestPreview = sends.find((s) => s.kind === 'preview' && s.status === 'sent') ?? null

  const next = subscription
    ? nextReportSendAt({
        isActive: subscription.isActive,
        approved: Boolean(subscription.firstSendApprovedAt),
        frequency: subscription.frequency,
        lastSentAt: subscription.lastSentAt,
        now,
      })
    : null

  return {
    subscription,
    state: subscription ? reportSubscriptionState(subscription) : 'none',
    areas: (subscription?.areas ?? []).map((slug) => ({ slug, label: reportAreaLabel(slug) })),
    areaOptions: reportAreaOptions(),
    contactStopped: Boolean(subscription && isContactStopped(subscription)),
    nextSendAt: next ? next.toISOString() : null,
    latestPreview,
    previewMatches: Boolean(
      subscription &&
        latestPreview &&
        sameSet(latestPreview.areas, subscription.areas) &&
        (latestPreview.frequency ?? '') === subscription.frequency,
    ),
    sends: sends.map((s) => ({
      ...s,
      engagement: engagement.get(s.emailKey) ?? emptySendEngagement(),
      areaLabels: s.areas.map(reportAreaLabel),
    })),
  }
}
