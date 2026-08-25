import 'server-only'
import { supabaseAnon } from '@/lib/data/client'
import { CRM_BROKER_BY_EMAIL } from '@/lib/crm/constants'
import {
  DEFAULT_BROKER_NOTIFY_PREFS,
  type BrokerNotifyPrefs,
} from '@/lib/crm/broker-notify-prefs'

/**
 * Per-broker notification preferences, keyed by CRM slug (matt / rebecca / paul).
 *
 * Deliberately NOT wrapped in unstable_cache: queueBrokerAlert consults this on
 * the instant-alert path, and a broker who switches an alert off expects the
 * next one to obey — a 60s cache window would text them after they opted out.
 * The read is one indexed row set on a three-row table.
 *
 * A missing row or a failed read falls back to DEFAULT_BROKER_NOTIFY_PREFS
 * (everything on, nothing capped), so a database hiccup can never silence a
 * lead alert.
 */
export async function getBrokerNotifyPrefs(): Promise<Record<string, BrokerNotifyPrefs>> {
  const out: Record<string, BrokerNotifyPrefs> = {}
  const sb = supabaseAnon()
  if (!sb) return out

  const { data, error } = await sb
    .from('brokers')
    .select(
      'email, notify_sms, notify_new_leads, notify_deal_activity, notify_task_due, notify_return_visit, notify_cma_ready, notify_quiet_start_hour, notify_quiet_end_hour, notify_max_per_day',
    )
    .eq('is_active', true)

  if (error || !data) {
    if (error) console.error('[getBrokerNotifyPrefs]', error.message)
    return out
  }

  for (const row of data as Array<Record<string, unknown>>) {
    const slug = CRM_BROKER_BY_EMAIL[String(row.email ?? '').trim().toLowerCase()]
    if (!slug) continue
    const bool = (v: unknown, dflt: boolean) => (typeof v === 'boolean' ? v : dflt)
    const hour = (v: unknown) => (typeof v === 'number' && v >= 0 && v <= 23 ? v : null)
    out[slug] = {
      smsOptIn: row.notify_sms === true,
      newLeads: bool(row.notify_new_leads, DEFAULT_BROKER_NOTIFY_PREFS.newLeads),
      dealActivity: bool(row.notify_deal_activity, DEFAULT_BROKER_NOTIFY_PREFS.dealActivity),
      taskDue: bool(row.notify_task_due, DEFAULT_BROKER_NOTIFY_PREFS.taskDue),
      returnVisit: bool(row.notify_return_visit, DEFAULT_BROKER_NOTIFY_PREFS.returnVisit),
      cmaReady: bool(row.notify_cma_ready, DEFAULT_BROKER_NOTIFY_PREFS.cmaReady),
      quietStartHour: hour(row.notify_quiet_start_hour),
      quietEndHour: hour(row.notify_quiet_end_hour),
      maxPerDay:
        typeof row.notify_max_per_day === 'number' && row.notify_max_per_day > 0
          ? row.notify_max_per_day
          : null,
    }
  }
  return out
}

/** Alerts queued for `broker` in the trailing 24h — the daily-cap denominator. */
export async function countBrokerAlertsLast24h(broker: string): Promise<number> {
  const sb = supabaseAnon()
  if (!sb) return 0
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count, error } = await sb
    .from('crm_broker_alerts')
    .select('id', { count: 'exact', head: true })
    .eq('broker', broker)
    .gte('created_at', since)
  if (error) {
    console.error('[countBrokerAlertsLast24h]', error.message)
    return 0
  }
  return count ?? 0
}
