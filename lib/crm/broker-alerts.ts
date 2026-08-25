/**
 * Instant new-lead alerts to brokers (Matt directive 2026-06-10: "we cannot
 * miss out on new leads" — text the assigned broker the moment one arrives,
 * like CRM did, or smarter).
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

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { recentHealthAlertExists, insertHealthAlert } from '@/lib/data/crm/healthAlertQueue'
import { getBrokerTelephony } from '@/lib/data/crm/getBrokerTelephony'
import {
  getBrokerNotifyPrefs,
  countBrokerAlertsLast24h,
} from '@/lib/data/crm/getBrokerNotifyPrefs'
import {
  categoryForAlertKind,
  decideBrokerAlert,
  DEFAULT_BROKER_NOTIFY_PREFS,
} from '@/lib/crm/broker-notify-prefs'
import { hourInTimeZone, DEFAULT_SMS_TIMEZONE } from '@/lib/crm/quiet-hours'
import {
  BROKER_ALERT_MAILBOXES,
  addressFromListingUrl,
  formatLookingAtAddress,
  lookingAtAlertBody,
  lookingAtCanQueue,
  lookingAtDedupeKind,
} from '@/lib/crm/looking-at'

/**
 * Canonical host for every broker deep link. The vercel.app alias redirects and
 * STRIPS AUTH COOKIES (memory project_domain), so a broker tapping a
 * non-canonical link lands logged out.
 */
export const BROKER_ALERT_ORIGIN = 'https://ryan-realty.com'

const ALERT_PHONE_BY_BROKER: Record<string, string | undefined> = {
  matt: process.env.TWILIO_FORWARD_MATT,
  rebecca: process.env.TWILIO_FORWARD_REBECCA,
  paul: process.env.TWILIO_FORWARD_PAUL,
}

/**
 * Looking-at wake (D3): identified person + a specific home. Same rail as a
 * new-lead alert. One ping per person+listing per session. Key is
 * crm_people.id. Unidentified = no SMS. Unassigned broker → Matt (inside
 * queueBrokerAlert). Overnight OK. Broker SMS opt-in still applies.
 * GPC is fail-closed at /api/visitors/track (no event, no call).
 * Draft-first: this only QUEUES. It does not send.
 */
export async function queueReturnVisitAlert(params: {
  crmPersonId: number
  sessionId: string
  listingKey: string
  address?: string | null
  pageUrl?: string | null
  who?: string | null
}): Promise<boolean> {
  try {
    const crmPersonId = Number(params.crmPersonId)
    const sessionId = params.sessionId?.trim() ?? ''
    const listingKey = params.listingKey?.trim() ?? ''
    if (!Number.isFinite(crmPersonId) || crmPersonId <= 0 || !sessionId || !listingKey) return false

    const sb = createServiceClient()
    const { data: person } = await sb
      .from('crm_people')
      .select('id,name,assigned_broker')
      .eq('id', crmPersonId)
      .maybeSingle()
    if (!person) return false
    // Brokers browsing their own site are not leads. No self-texts.
    const { data: emails } = await sb
      .from('crm_contact_points')
      .select('value')
      .eq('person_id', person.id as number)
      .eq('kind', 'email')
    if ((emails ?? []).some((e) => BROKER_ALERT_MAILBOXES.has(String(e.value).toLowerCase()))) {
      return false
    }

    let address = formatLookingAtAddress({ street: params.address })
    if (!address) {
      const { data: listing } = await sb
        .from('listings')
        .select('StreetNumber,StreetName')
        .eq('ListNumber', listingKey)
        .maybeSingle()
      address = formatLookingAtAddress({
        streetNumber: (listing?.StreetNumber as string | null) ?? null,
        streetName: (listing?.StreetName as string | null) ?? null,
      })
    }
    if (!address) address = addressFromListingUrl(params.pageUrl, listingKey)
    if (
      !lookingAtCanQueue({
        crmPersonId: person.id as number,
        sessionId,
        listingKey,
        address,
      })
    ) {
      return false
    }

    const name = ((person.name as string | null) ?? params.who ?? '').trim() || 'Someone'
    return queueBrokerAlert({
      broker: person.assigned_broker as string | null,
      personId: person.id as number,
      kind: lookingAtDedupeKind(sessionId, listingKey),
      body: lookingAtAlertBody(name, address as string, person.id as number),
    })
  } catch (err) {
    console.warn('[broker-alerts] return-visit queue error:', err)
    return false
  }
}

/**
 * Does this broker have at least one live web-push device? (W5.5 leg b.)
 * Read here rather than imported from app/api/push/_lib/store to keep the
 * queue module free of a route-tree dependency; the shape is one boolean.
 */
async function brokerHasActivePushDevice(broker: string): Promise<boolean> {
  try {
    const sb = createServiceClient()
    const { data } = await sb
      .from('push_subscriptions')
      .select('id')
      .eq('broker', broker)
      .is('disabled_at', null)
      .limit(1)
    return (data ?? []).length > 0
  } catch {
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

    // Per-broker preferences decide BOTH whether this alert exists and which
    // channel carries it. Every gate below runs HERE, at queue time, because
    // both SMS drainers (the serverless drain's listPendingAlerts and the
    // legacy relay) select status='pending' — so what is never queued as
    // 'pending' can never be texted.
    //
    //   - notify_sms — the SMS opt-in, default OFF (Matt 2026-06-28).
    //   - the CATEGORY switches on /admin/settings/account (Matt 2026-08-25).
    //     Until then only notify_sms was read and those switches were
    //     decorative: turning "New lead assigned" off still sent the text.
    //   - the personal quiet window + daily cap, which downgrade rather than
    //     drop — a preference may silence a text, never lose a lead.
    //
    // W5.5 leg b: an SMS opt-out used to mean NO row at all, which silently
    // killed web push for that broker too. A broker with a registered push
    // device still gets the alert, queued 'push_only' — a status NEITHER SMS
    // drainer selects, so it can only ever leave as a notification.
    //
    // Ops health alarms bypass all of it (queueBrokerHealthAlert, and the
    // 'health' branch in decideBrokerAlert). See lib/crm/broker-notify-prefs.
    const prefsBySlug = await getBrokerNotifyPrefs()
    const prefs = prefsBySlug[broker] ?? DEFAULT_BROKER_NOTIFY_PREFS
    const category = categoryForAlertKind(params.kind)
    const hasPushDevice = prefs.smsOptIn ? false : await brokerHasActivePushDevice(broker)
    const decision = decideBrokerAlert({
      category,
      prefs,
      hour: hourInTimeZone(new Date(), DEFAULT_SMS_TIMEZONE),
      // Only pay for the count when a cap is actually configured.
      sentLast24h: prefs.maxPerDay != null ? await countBrokerAlertsLast24h(broker) : 0,
      hasPushDevice,
    })
    if (!decision.queue) return false

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
      status: decision.status,
    })
    return true
  } catch (err) {
    console.warn('[broker-alerts] queue error:', err)
    return false
  }
}

/**
 * "CMA draft ready — review and send" text (D8 kick-off + notify). One body,
 * one kind, two callers: the build worker texts every entry on the action
 * row's notify list when the build finishes, and the kick-off attach path
 * texts directly when it loses the race to a build that finished mid-attach.
 * queueBrokerAlert's crm_timeline dedupe (`alert:cma-ready:<slug>:<personId>`)
 * makes the two paths safe to overlap — one text per (slug, person).
 */
export async function queueCmaReadyAlert(params: {
  slug: string
  subjectAddress: string | null
  personId: number
  broker: string | null
}): Promise<boolean> {
  return queueBrokerAlert({
    broker: params.broker,
    personId: params.personId,
    kind: `cma-ready:${params.slug}`,
    body: [
      `CMA ready: ${params.subjectAddress ?? params.slug}`,
      // Canonical host, matching newLeadAlertBody — the vercel.app alias
      // redirects and STRIPS AUTH COOKIES (memory project_domain), so a broker
      // tapping a non-canonical deep link lands logged out.
      `View CMA: ${BROKER_ALERT_ORIGIN}/admin/cmas/${params.slug}`,
    ].join('\n'),
  })
}

/**
 * System health alert (Contact-360 Phase 9.6 crm-health-check). Unlike
 * queueBrokerAlert, a health alarm is NOT person-scoped — a broken mirror or a
 * stale webhook has no crm_people row to hang a dedupe crm_timeline row off
 * (person_id is NOT NULL there). So this dedupes directly against
 * crm_broker_alerts: it suppresses a re-alert when a row with the same stable
 * `[crm-health:<key>]` body prefix was queued within `cooldownMinutes`. That
 * keeps a persistently-broken vital from texting the broker on every 30-minute
 * run while still re-paging once the cooldown lapses (the problem is still live).
 *
 * Health alerts always route to Matt — they are operational, not lead-routing.
 * Returns true when an alert was queued, false when deduped or unconfigured.
 */
export async function queueBrokerHealthAlert(params: {
  key: string
  body: string
  cooldownMinutes?: number
}): Promise<boolean> {
  try {
    const toPhone = ALERT_PHONE_BY_BROKER.matt
    if (!toPhone) return false

    const marker = `[crm-health:${params.key}]`
    const cooldownMs = (params.cooldownMinutes ?? 360) * 60 * 1000
    const since = new Date(Date.now() - cooldownMs).toISOString()

    // Dedupe: a same-key health alert queued inside the cooldown window
    // suppresses this one. The read + write live in the DAL (G1) so this module
    // stays free of raw .from() (boundary baseline holds at 213).
    if (await recentHealthAlertExists(marker, since)) return false
    await insertHealthAlert({ toPhone, body: `${marker} ${params.body}` })
    return true
  } catch (err) {
    console.warn('[broker-alerts] health queue error:', err)
    return false
  }
}

/**
 * Compose the standard new-lead alert text.
 *
 * TWO LINES, always: what happened, then the labelled link (Matt 2026-08-25 —
 * "a simple link about what's going on, and then View Lead"). `source`, `stage`
 * and `detail` stay in the signature because callers pass them and they are
 * worth having on the record, but they no longer ride the text: all three are
 * on the lead page the link opens, one tap away.
 */
export function newLeadAlertBody(p: {
  name?: string | null
  source?: string | null
  stage?: string | null
  personId: number
  detail?: string | null
  /** Deep-link intent (D8): 'cma' lands the broker on the person page with the
   *  CMA kick-off sheet open + pre-filled — one tap from Build. Set when the
   *  inbound message reads as seller intent (hasSellerIntent). */
  intent?: 'cma'
}): string {
  const query = p.intent ? `?intent=${p.intent}` : ''
  return [
    `New lead: ${p.name ?? 'Unknown'}`,
    `View lead: ${BROKER_ALERT_ORIGIN}/admin/people/${p.personId}${query}`,
  ].join('\n')
}
