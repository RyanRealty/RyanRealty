/**
 * market-report-keys — the email_key shapes the market-report sender writes
 * to crm_report_sends (email_key is UNIQUE there), in one pure place.
 *
 *   held       market-report:held:<reason>:<subscription>:<cycle>
 *              one row per hold reason per due cycle
 *   scheduled  market-report:scheduled:<subscription>:<cycle>
 *              ONE send per subscription per due cycle (review 2026-09-30):
 *              two cron runs that overlap compute the same key, so the second
 *              finds the first's claim and never sends. The key moves on only
 *              when a send stamps last_sent_at. It is also the email_events key
 *              and the provider's idempotency key.
 *   manual / preview keep their own per-click keys (their callers mint them).
 *
 * A cycle is named by the subscription's last send (digits of last_sent_at),
 * or 'first' before any. Pure.
 */
import type { ReportHoldReason } from '@/lib/data/crm/marketReportSends'

/** The due cycle a subscription is in: its last send, or 'first'. */
export function reportCycle(lastSentAt: string | null): string {
  return lastSentAt ? lastSentAt.replace(/[^0-9]/g, '').slice(0, 14) : 'first'
}

/** The key of a held row: one per reason per subscription per due cycle. */
export function holdKey(reason: ReportHoldReason, subscriptionId: number, lastSentAt: string | null): string {
  return `market-report:held:${reason}:${subscriptionId}:${reportCycle(lastSentAt)}`
}

/** The key of a scheduled send: one per subscription per due cycle. */
export function scheduledSendKey(subscriptionId: number, lastSentAt: string | null): string {
  return `market-report:scheduled:${subscriptionId}:${reportCycle(lastSentAt)}`
}
