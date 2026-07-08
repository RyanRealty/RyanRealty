import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

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
   * When the next send is expected (last send + cadence). Null when paused.
   * An active, never-sent subscription is dueNow with a null timestamp.
   */
  nextExpectedAtIso: string | null
  dueNow: boolean
  /** Honest caveat, e.g. listing alerts only send when new listings match. */
  note: string | null
}

/** Cadence length in days for a stored frequency value. PURE. */
export function cadenceDays(frequency: string | null | undefined, kind: 'market-report' | 'listing-alert'): number {
  const f = (frequency ?? '').trim().toLowerCase()
  if (f === 'daily' || f === 'instant') return 1
  if (f === 'weekly') return 7
  if (f === 'monthly') return 30
  if (f === 'quarterly') return 90
  return kind === 'market-report' ? 30 : 1
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

/** "bend" -> "Bend", "awbrey-butte" -> "Awbrey Butte" — no raw slugs in the UI. */
function prettyArea(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

const ALERT_NOTE = 'Alerts only go out when new listings match this search.'

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
      .select('areas, frequency, is_active, last_sent_at')
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
  } | null
  if (reportRes.error) console.error('[getPersonSubscriptionOutlook] report', reportRes.error.message)
  if (report) {
    const freq = report.frequency ?? 'monthly'
    const areas = Array.isArray(report.areas) ? report.areas.filter((a): a is string => typeof a === 'string') : []
    const next = nextExpectedSendIso(report.last_sent_at, freq, 'market-report')
    const active = report.is_active === true
    out.push({
      kind: 'market-report',
      label: `${titleCaseFrequency(freq)} market report${areas.length > 0 ? ` — ${areas.map(prettyArea).join(', ')}` : ''}`,
      cadence: freq,
      active,
      lastSentAtIso: report.last_sent_at,
      nextExpectedAtIso: active ? next : null,
      dueNow: active && (!next || new Date(next).getTime() <= nowMs),
      note: null,
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
