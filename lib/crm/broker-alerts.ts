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

/**
 * Live-visit alert: an identified lead is on the site RIGHT NOW. Texts the
 * assigned broker with what they are viewing plus the deep link to the CRM
 * person page, where the live-activity banner + composers let the broker
 * contact them in the moment. Throttled to one text per person per day via
 * the date-stamped dedupe kind.
 */
export async function queueReturnVisitAlert(params: {
  fubPersonId: number
  who: string
  pageUrl: string
  pageTitle?: string | null
}): Promise<boolean> {
  try {
    const sb = createServiceClient()
    const { data: person } = await sb
      .from('crm_people')
      .select('id,name,assigned_broker')
      .eq('fub_legacy_id', params.fubPersonId)
      .maybeSingle()
    if (!person) return false
    const day = new Date().toISOString().slice(0, 10)
    const name = (person.name as string | null) ?? params.who
    const title = params.pageTitle?.trim() ? ` (${params.pageTitle.trim().slice(0, 60)})` : ''
    const path = params.pageUrl.replace(/^https?:\/\/[^/]+/, '') || '/'
    return queueBrokerAlert({
      broker: person.assigned_broker as string | null,
      personId: person.id as number,
      kind: `return-visit:${day}`,
      body: `${name} is on the site right now — viewing ${path}${title}. Open the lead: https://ryan-realty.com/admin/crm/${person.id}`,
    })
  } catch (err) {
    console.warn('[broker-alerts] return-visit queue error:', err)
    return false
  }
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
