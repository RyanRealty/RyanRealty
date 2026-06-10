/**
 * Instant new-lead alerts to brokers (Matt directive 2026-06-10: "we cannot
 * miss out on new leads" — text the assigned broker the moment one arrives,
 * like FUB did, or smarter).
 *
 * Design: this module only QUEUES (insert into crm_broker_alerts) and
 * dedupes. Delivery happens on the mac mini via the crm-alert-relay
 * LaunchAgent: iMessage from Matt's Messages today, Twilio SMS automatically
 * once the A2P campaign verifies. Email alerts continue on their existing
 * paths — this is the instant channel on top.
 *
 * Dedupe: one alert per person per kind, enforced with a crm_timeline system
 * row keyed `alert:<kind>:<personId>` so the instant site hook and the
 * 15-minute catch-all cron never double-text a broker.
 */

import { createServiceClient } from '@/lib/supabase/service'

const ALERT_PHONE_BY_BROKER: Record<string, string | undefined> = {
  matt: process.env.TWILIO_FORWARD_MATT,
  rebecca: process.env.TWILIO_FORWARD_REBECCA,
  paul: process.env.TWILIO_FORWARD_PAUL,
}

export async function queueBrokerAlert(params: {
  broker: string | null | undefined
  personId: number
  kind: string
  body: string
}): Promise<boolean> {
  try {
    const sb = createServiceClient()
    const broker = params.broker && ALERT_PHONE_BY_BROKER[params.broker] ? params.broker : 'matt'
    const toPhone = ALERT_PHONE_BY_BROKER[broker]
    if (!toPhone) return false

    // dedupe gate — first writer wins
    const { error: dedupeErr } = await sb.from('crm_timeline').insert({
      person_id: params.personId,
      kind: 'system',
      title: `Broker alert queued (${params.kind})`,
      body: null,
      payload: { kind: params.kind, broker },
      source: 'broker-alert',
      dedupe_key: `alert:${params.kind}:${params.personId}`,
    })
    if (dedupeErr) return false // duplicate (or transient) — do not double-alert

    await sb.from('crm_broker_alerts').insert({
      broker,
      to_phone: toPhone,
      body: params.body.slice(0, 600),
      person_id: params.personId,
    })
    return true
  } catch (err) {
    console.warn('[broker-alerts] queue error:', err)
    return false
  }
}

/** Compose the standard new-lead alert text. */
export function newLeadAlertBody(p: {
  name?: string | null
  source?: string | null
  stage?: string | null
  personId: number
  detail?: string | null
}): string {
  const lines = [
    `New lead: ${p.name ?? 'Unknown'}${p.source ? ` (${p.source})` : ''}`,
    p.detail ?? null,
    `ryan-realty.com/admin/crm/${p.personId}`,
  ].filter(Boolean)
  return lines.join('\n')
}
