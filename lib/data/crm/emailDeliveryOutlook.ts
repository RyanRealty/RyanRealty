import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { CADENCE_WINDOW_MS, isDue, nextReportSendAt } from '@/lib/crm/market-report-cadence'
import { reportAreaLabel } from '@/lib/crm/market-report-areas'
import { normalizeReportFrequency } from '@/lib/data/crm/getContactReportSubscriptions'

/**
 * emailDeliveryOutlook — a person's subscriptions with their next-expected-send
 * (split from lib/data/crm/emailDelivery.ts, 600-LOC file budget). Powers the
 * "What they're subscribed to" section of ContactDeliveryPanel: cadence, last
 * send, and when the next one should arrive, per subscription.
 *
 * DAL boundary (G1): the raw .from() reads of crm_report_subscriptions and
 * listing_alerts (the unified alert table) live here, inside lib/data/.
 */

export type SubscriptionOutlookRow = {
  kind: 'market-report' | 'listing-alert'
  /** "Monthly market report — Bend, Redmond" / the saved search's name. */
  label: string
  cadence: string
  active: boolean
  lastSentAtIso: string | null
  /**
   * When the next send is expected. Null when nothing will send (off, or a
   * market report waiting on its first-send approval).
   */
  nextExpectedAtIso: string | null
  /**
   * The cadence window has already elapsed: it goes at the next send run
   * (for a market report, the first 8am to 8pm Pacific cron run, which is
   * nextExpectedAtIso). An active, approved, never-sent market report is due.
   */
  dueNow: boolean
  /** Honest caveat, e.g. listing alerts only send when new listings match. */
  note: string | null
}

/**
 * Cadence length in days for a stored frequency value. PURE. A market report
 * uses the send engine's own window (lib/crm/market-report-cadence.ts: weekly
 * 7, monthly 30, quarterly 89), so the panel never promises a date the engine
 * does not keep.
 */
export function cadenceDays(frequency: string | null | undefined, kind: 'market-report' | 'listing-alert'): number {
  const f = (frequency ?? '').trim().toLowerCase()
  if (kind === 'market-report') return CADENCE_WINDOW_MS[normalizeReportFrequency(f || 'monthly')] / 86_400_000
  if (f === 'daily' || f === 'instant') return 1
  if (f === 'weekly') return 7
  if (f === 'monthly') return 30
  if (f === 'quarterly') return 90
  return 1
}

/** last send + cadence, as ISO. Null in = null out. PURE. */
export function nextExpectedSendIso(
  lastSentAtIso: string | null,
  frequency: string | null | undefined,
  kind: 'market-report' | 'listing-alert',
): string | null {
  if (!lastSentAtIso) return null
  const t = new Date(lastSentAtIso).getTime()
  if (Number.isNaN(t)) return null
  return new Date(t + cadenceDays(frequency, kind) * 86_400_000).toISOString()
}

function titleCaseFrequency(f: string): string {
  const v = f.trim().toLowerCase()
  return v ? v.charAt(0).toUpperCase() + v.slice(1) : 'Monthly'
}

const ALERT_NOTE = 'Alerts only go out when new listings match this search.'

/** The market-report row's fields the outlook reads. */
export type MarketReportOutlookInput = {
  frequency: string | null
  is_active: boolean
  last_sent_at: string | null
  first_send_approved_at: string | null
  stopped_at: string | null
  stopped_via: string | null
}

/**
 * A market report's next send, whether it is due now, and the note. PURE.
 *
 * `nextExpectedAtIso` is the engine's own answer: the cadence window from the
 * last send, then the first 8am to 8pm Pacific cron run (nextReportSendAt),
 * which is never earlier than now. So "due now" cannot be read off it (a
 * comparison with now was never true: review 2026-09-30); it is whether the
 * cadence window has already elapsed (isDue, the check the sender itself
 * makes), for a report that is on and approved.
 */
export function marketReportOutlook(
  report: MarketReportOutlookInput,
  now: Date,
): { nextExpectedAtIso: string | null; dueNow: boolean; note: string | null } {
  const frequency = normalizeReportFrequency(report.frequency ?? 'monthly')
  const active = report.is_active === true
  const approved = Boolean(report.first_send_approved_at)
  const next = nextReportSendAt({ isActive: active, approved, frequency, lastSentAt: report.last_sent_at, now })
  const note = !active
    ? report.stopped_at
      ? report.stopped_via === 'admin'
        ? 'Stopped by a broker.'
        : 'Stopped by the contact.'
      : null
    : !approved
      ? 'Waits for a broker to approve the first send after a preview.'
      : 'Goes out at the first 8am to 8pm Pacific run once due.'
  return {
    nextExpectedAtIso: next ? next.toISOString() : null,
    dueNow: active && approved && isDue({ frequency, lastSentAt: report.last_sent_at, now }),
    note,
  }
}

/**
 * The person's subscriptions with their next-expected-send: the market report
 * row (crm_report_subscriptions) + every listing alert (the unified
 * listing_alerts table, joined by crm_person_id / email).
 */
export async function getPersonSubscriptionOutlook(
  personId: number,
  email?: string | null,
): Promise<SubscriptionOutlookRow[]> {
  if (!Number.isFinite(personId) || personId <= 0) return []
  const pid = Math.trunc(personId)
  const safeEmail = (email ?? '').trim().toLowerCase().replace(/[,()"\\]/g, '')
  const sb = createServiceClient()
  const nowMs = Date.now()

  const ALERT_COLS = 'id, name, notification_frequency, is_active, last_notified_at, crm_person_id'
  const [reportRes, alertRes] = await Promise.all([
    sb
      .from('crm_report_subscriptions')
      .select('areas, frequency, is_active, last_sent_at, first_send_approved_at, stopped_at, stopped_via')
      .eq('person_id', pid)
      .maybeSingle(),
    safeEmail
      ? sb
          .from('listing_alerts')
          .select(ALERT_COLS)
          .or(`crm_person_id.eq.${pid},email.eq.${safeEmail}`)
          .limit(50)
      : sb
          .from('listing_alerts')
          .select(ALERT_COLS)
          .eq('crm_person_id', pid)
          .limit(50),
  ])

  const out: SubscriptionOutlookRow[] = []

  const report = reportRes.data as {
    areas: string[] | null
    frequency: string | null
    is_active: boolean
    last_sent_at: string | null
    first_send_approved_at: string | null
    stopped_at: string | null
    stopped_via: string | null
  } | null
  if (reportRes.error) console.error('[getPersonSubscriptionOutlook] report', reportRes.error.message)
  if (report) {
    const freq = report.frequency ?? 'monthly'
    const areas = Array.isArray(report.areas) ? report.areas.filter((a): a is string => typeof a === 'string') : []
    const outlook = marketReportOutlook(report, new Date(nowMs))
    out.push({
      kind: 'market-report',
      label: `${titleCaseFrequency(freq)} market report${areas.length > 0 ? `: ${areas.map(reportAreaLabel).join(', ')}` : ''}`,
      cadence: freq,
      active: report.is_active === true,
      lastSentAtIso: report.last_sent_at,
      nextExpectedAtIso: outlook.nextExpectedAtIso,
      dueNow: outlook.dueNow,
      note: outlook.note,
    })
  }

  if (alertRes.error) console.error('[getPersonSubscriptionOutlook] alerts', alertRes.error.message)
  for (const r of (alertRes.data ?? []) as Array<{
    id: string; name: string | null; notification_frequency: string | null
    is_active: boolean | null; last_notified_at: string | null
  }>) {
    const freq = r.notification_frequency ?? 'daily'
    const active = r.is_active === true
    const next = nextExpectedSendIso(r.last_notified_at, freq, 'listing-alert')
    out.push({
      kind: 'listing-alert',
      label: (r.name ?? '').trim() || 'Listing alert',
      cadence: freq,
      active,
      lastSentAtIso: r.last_notified_at,
      nextExpectedAtIso: active ? next : null,
      dueNow: active && (!next || new Date(next).getTime() <= nowMs),
      note: ALERT_NOTE,
    })
  }

  // Active first, then most-recently-sent.
  return out.sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1
    return (a.lastSentAtIso ?? '') < (b.lastSentAtIso ?? '') ? 1 : -1
  })
}
