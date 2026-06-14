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
const BROKER_MAILBOXES = new Set(['matt@ryan-realty.com', 'rebeccapeterson@ryan-realty.com', 'paul@ryan-realty.com'])

/** Plain-language "why are they here" from the page they are on. */
function describeWhy(path: string, title?: string | null): string {
  const p = path.toLowerCase()
  const t = title?.trim() ? ` "${title.trim().slice(0, 60)}"` : ''
  if (/\/listing|\/homes\/|\/property|\/mls/.test(p)) return `looking at a listing${t}`
  if (/sell|home-valuation|home-value|whats-my-home|what-is-my-home/.test(p)) return `on a home-value / sell page, seller intent${t}`
  if (/search|homes-for-sale|\/map/.test(p)) return `browsing the home search${t}`
  if (/\/cmas?\/|\/drafts\/cma/.test(p)) return `viewing their CMA report${t}`
  if (p === '/' || p === '') return `on your homepage${t}`
  return `viewing ${path}${t}`
}

/** Plain-language "from where" they arrived — utm channel first, then referrer. */
function describeFrom(referrer?: string | null, utmSource?: string | null, utmMedium?: string | null, utmCampaign?: string | null): string {
  const camp = utmCampaign?.trim() ? ` (${utmCampaign.trim()})` : ''
  const s = (utmSource ?? '').toLowerCase()
  if (s) {
    const med = (utmMedium ?? '').toLowerCase()
    if (s.includes('facebook') || s.includes('instagram') || s === 'fb' || s === 'ig') return `a Facebook or Instagram ad${camp}`
    if (s.includes('google') && (med.includes('cpc') || med.includes('paid'))) return `a Google ad${camp}`
    if (med.includes('email') || s.includes('email') || s.includes('klaviyo') || s.includes('fub')) return `a link in one of your emails${camp}`
    return `${utmSource}${camp}`
  }
  const r = (referrer ?? '').trim().toLowerCase()
  if (!r) return `direct, they typed the address or used a saved bookmark`
  try {
    const host = new URL(r.startsWith('http') ? r : `https://${r}`).hostname.replace(/^www\./, '')
    if (host.includes('google')) return `a Google search`
    if (host.includes('bing')) return `a Bing search`
    if (host.includes('facebook') || host.includes('instagram') || host.startsWith('fb.') || host.includes('l.facebook')) return `Facebook or Instagram`
    if (host.includes('fub.direct') || host.includes('followupboss')) return `a link in one of your emails or texts`
    if (host.endsWith('ryan-realty.com') || host.includes('ryanrealty')) return `another page on your own site`
    return host
  } catch {
    return r.slice(0, 60)
  }
}

export async function queueReturnVisitAlert(params: {
  fubPersonId: number
  who: string
  pageUrl: string
  pageTitle?: string | null
  referrer?: string | null
  utmSource?: string | null
  utmMedium?: string | null
  utmCampaign?: string | null
}): Promise<boolean> {
  try {
    const sb = createServiceClient()
    const { data: person } = await sb
      .from('crm_people')
      .select('id,name,assigned_broker')
      .eq('fub_legacy_id', params.fubPersonId)
      .maybeSingle()
    if (!person) return false
    // Brokers browsing their own site are not leads. No self-texts.
    const { data: emails } = await sb
      .from('crm_contact_points')
      .select('value')
      .eq('person_id', person.id as number)
      .eq('kind', 'email')
    if ((emails ?? []).some((e) => BROKER_MAILBOXES.has(String(e.value).toLowerCase()))) return false
    const day = new Date().toISOString().slice(0, 10)
    const name = (person.name as string | null) ?? params.who
    const path = params.pageUrl.replace(/^https?:\/\/[^/]+/, '') || '/'
    const body = [
      `${name} is back on your site right now.`,
      `Why: ${describeWhy(path, params.pageTitle)}`,
      `From: ${describeFrom(params.referrer, params.utmSource, params.utmMedium, params.utmCampaign)}`,
      `Open the lead: https://ryan-realty.com/admin/crm/${person.id}`,
    ].join('\n')
    return queueBrokerAlert({
      broker: person.assigned_broker as string | null,
      personId: person.id as number,
      kind: `return-visit:${day}`,
      body,
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
