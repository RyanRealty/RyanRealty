/**
 * stampMarketReportSent / stampMarketReportAttempt — the cadence-stamp writers
 * the market-report send engine calls after each contact (Wave 8).
 *
 * Two stamps, two meanings:
 *   - attempt: set last_attempt_at on every per-contact pass (success, skip, or
 *     transient failure) so an unavailable/suppressed/errored contact is not
 *     retried on every single cron tick.
 *   - sent: set BOTH last_attempt_at and last_sent_at after a successful send so
 *     isDue() will not re-send the contact inside their cadence window.
 *
 * DAL boundary (G1): the raw .from('crm_report_subscriptions') update lives here,
 * inside lib/data/. The cron calls these; it never writes the table directly.
 * Both fail SOFT (return ok:false, never throw) so a stamp write error can never
 * crash the cron mid-batch — the worst case is one extra look next tick, never a
 * lost send or a thrown 500.
 */
import { createServiceClient } from '@/lib/supabase/service'

export type StampResult = { ok: true } | { ok: false; error: string }

/** Stamp last_attempt_at = now() for one subscription. */
export async function stampMarketReportAttempt(subscriptionId: number, at?: Date): Promise<StampResult> {
  if (!Number.isFinite(subscriptionId) || subscriptionId <= 0) {
    return { ok: false, error: 'invalid subscriptionId' }
  }
  const sb = createServiceClient()
  const iso = (at ?? new Date()).toISOString()
  const { error } = await sb
    .from('crm_report_subscriptions')
    .update({ last_attempt_at: iso })
    .eq('id', Math.trunc(subscriptionId))
  if (error) {
    console.error('[stampMarketReportAttempt]', error.message)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

/** Stamp last_sent_at AND last_attempt_at = now() after a successful send. */
export async function stampMarketReportSent(subscriptionId: number, at?: Date): Promise<StampResult> {
  if (!Number.isFinite(subscriptionId) || subscriptionId <= 0) {
    return { ok: false, error: 'invalid subscriptionId' }
  }
  const sb = createServiceClient()
  const iso = (at ?? new Date()).toISOString()
  const { error } = await sb
    .from('crm_report_subscriptions')
    .update({ last_sent_at: iso, last_attempt_at: iso })
    .eq('id', Math.trunc(subscriptionId))
  if (error) {
    console.error('[stampMarketReportSent]', error.message)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}
