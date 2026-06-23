/**
 * Health-alert queue data access (CONTACT360 Phase 9.6).
 *
 * The crm-health-check cron alarms on a broken CRM vital (mirror off, stale
 * webhook, A2P regression) by writing a NON-person-scoped crm_broker_alerts row.
 * These two functions are the DAL for that — kept here (not inline in
 * lib/crm/broker-alerts.ts) so the raw .from() reads/writes stay inside the DAL
 * boundary (G1), exactly like every other crm_* access path.
 */
import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

/** True when a same-marker health alert was already queued within the cooldown window (dedup). */
export async function recentHealthAlertExists(marker: string, sinceIso: string): Promise<boolean> {
  const sb = createServiceClient()
  const { data } = await sb
    .from('crm_broker_alerts')
    .select('id')
    .eq('broker', 'matt')
    .gte('created_at', sinceIso)
    .like('body', `${marker}%`)
    .limit(1)
  return (data ?? []).length > 0
}

/** Insert a non-person-scoped health alert row (always routed to Matt — operational, not lead-routing). */
export async function insertHealthAlert(params: { toPhone: string; body: string }): Promise<void> {
  const sb = createServiceClient()
  await sb.from('crm_broker_alerts').insert({
    broker: 'matt',
    to_phone: params.toPhone,
    body: params.body.slice(0, 600),
    person_id: null,
  })
}
