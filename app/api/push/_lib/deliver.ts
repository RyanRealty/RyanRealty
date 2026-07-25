/**
 * deliver — the web-push pass over the crm_broker_alerts queue (W5.5 leg b).
 *
 * This is the DURABLE channel. It reads the SAME queue the SMS drain reads and
 * delivers in parallel with it:
 *
 *   SMS   drain: CAS on `status`    ('pending' -> 'sending' -> 'sent')
 *   push  drain: CAS on `pushed_at` (NULL -> now())
 *
 * Two axes, two first-writer-wins claims. A broker gets at most one text AND at
 * most one push per alert, and neither channel can swallow the other's row —
 * which is why the push pass must never touch `status` and must never be gated
 * behind the SMS cutover flag (CRM_SMS_ALERTS). scripts/check-web-push-durable.mjs
 * pins both of those properties.
 *
 * DEGRADATION: when the VAPID keypair is not provisioned this returns
 * mode:'unconfigured' with the count of alerts that WOULD have been pushed, and
 * leaves every row unclaimed so the backlog delivers the moment keys land. It
 * also pages Matt once a day, but only when a broker has actually subscribed —
 * silence while nobody is subscribed, a real alarm the moment the channel has
 * users and no keys. A silent `return` here is exactly how a notification
 * channel dies unnoticed, so there is no code path that no-ops quietly.
 */
import { queueBrokerHealthAlert } from '@/lib/crm/broker-alerts'
import { sendWebPush, vapidConfig, MAX_PAYLOAD_BYTES } from './web-push'
import {
  claimPushDelivery,
  disableSubscription,
  listActiveSubscriptions,
  listPushCandidates,
  markSubscriptionFailure,
  markSubscriptionSuccess,
  recordPushResult,
  releasePushClaim,
  type BrokerPushSubscription,
  type PushCandidateAlert,
} from './store'

/** How far back an unclaimed alert is still worth pushing. */
export const PUSH_LOOKBACK_MINUTES = 120
/** Retry budget per alert before the push is abandoned (mirrors the SMS drain's 3). */
export const PUSH_MAX_ATTEMPTS = 3

export interface WebPushDrainSummary {
  /** 'idle' nothing to do · 'sent' delivered · 'unconfigured' VAPID missing · 'error' */
  mode: 'idle' | 'sent' | 'unconfigured' | 'error'
  /** Alerts in the window whose broker has at least one live subscription. */
  candidates: number
  /** Active broker device subscriptions the pass could reach. */
  subscriptions: number
  claimed: number
  delivered: number
  failed: number
  /** Endpoints retired this run because the push service said 410 Gone. */
  retired: number
  reason?: string
}

/**
 * Turn the queued alert text into a notification. The queue writes a first line
 * that reads as the headline ("New lead: …", "CMA draft ready — …") followed by
 * detail lines and a deep link, so the split is title / rest / link.
 */
export function alertToNotification(alert: Pick<PushCandidateAlert, 'body' | 'person_id' | 'id'>): {
  title: string
  body: string
  url: string
  tag: string
} {
  const lines = alert.body.split('\n').map((l) => l.trim()).filter(Boolean)
  const title = lines[0] ?? 'Ryan Realty alert'
  const linkLine = lines.find((l) => /ryan-realty\.com\/admin\//.test(l))
  const rest = lines.slice(1).filter((l) => l !== linkLine)
  const url = linkLine
    ? `https://${linkLine.replace(/^.*?(ryan-realty\.com\/admin\/)/, '$1')}`
    : alert.person_id
      ? `https://ryan-realty.com/admin/crm/${alert.person_id}`
      : 'https://ryan-realty.com/admin'
  return {
    title: title.slice(0, 120),
    body: (rest.join('\n') || 'Open the CRM for the detail.').slice(0, 400),
    url,
    tag: `crm-alert-${alert.id}`,
  }
}

function payloadFor(alert: PushCandidateAlert): string {
  const n = alertToNotification(alert)
  const json = JSON.stringify(n)
  if (json.length <= MAX_PAYLOAD_BYTES) return json
  return JSON.stringify({ ...n, body: n.body.slice(0, 200) })
}

/** Run one web-push pass. Never throws — a push failure must not 500 the drain. */
export async function drainWebPush(limit = 20): Promise<WebPushDrainSummary> {
  const empty: WebPushDrainSummary = {
    mode: 'idle',
    candidates: 0,
    subscriptions: 0,
    claimed: 0,
    delivered: 0,
    failed: 0,
    retired: 0,
  }
  try {
    const subs = await listActiveSubscriptions()
    const byBroker = new Map<string, BrokerPushSubscription[]>()
    for (const s of subs) {
      const list = byBroker.get(s.broker) ?? []
      list.push(s)
      byBroker.set(s.broker, list)
    }

    const pending = await listPushCandidates(PUSH_LOOKBACK_MINUTES, limit)
    const candidates = pending.filter((a) => (byBroker.get(a.broker) ?? []).length > 0)
    const summary: WebPushDrainSummary = { ...empty, subscriptions: subs.length, candidates: candidates.length }

    // Degrade BEFORE claiming: unconfigured keys must never consume the queue.
    const cfg = vapidConfig()
    if (!cfg) {
      const reason =
        'VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are not provisioned — web-push is DARK. ' +
        'Rows are left unclaimed so the backlog delivers once the keypair is set.'
      console.warn(`[web-push] unconfigured: ${candidates.length} alert(s) waiting, ${subs.length} subscription(s). ${reason}`)
      if (candidates.length > 0) {
        await queueBrokerHealthAlert({
          key: 'web-push-unconfigured',
          body: `Web push is dark: ${subs.length} broker device(s) subscribed, ${candidates.length} alert(s) undelivered. Set VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY.`,
          cooldownMinutes: 1440,
        })
      }
      return { ...summary, mode: 'unconfigured', reason }
    }

    if (candidates.length === 0) return summary

    for (const alert of candidates) {
      const targets = byBroker.get(alert.broker) ?? []
      if (!(await claimPushDelivery(alert.id))) continue
      summary.claimed += 1

      let ok = 0
      const errors: string[] = []
      for (const sub of targets) {
        const res = await sendWebPush({ endpoint: sub.endpoint, keys: sub.keys }, payloadFor(alert), cfg)
        if (res.ok) {
          ok += 1
          await markSubscriptionSuccess(sub.id)
        } else if (res.gone) {
          summary.retired += 1
          await disableSubscription(sub.id, `gone ${res.status}`)
        } else {
          errors.push(`${sub.id.slice(0, 8)}:${res.error ?? res.status}`)
          await markSubscriptionFailure(sub.id, (sub.failure_count ?? 0) + 1)
        }
      }

      if (ok > 0) {
        summary.delivered += ok
        await recordPushResult(alert.id, `sent:${ok}/${targets.length}`)
      } else {
        summary.failed += 1
        const attempts = (alert.push_attempts ?? 0) + 1
        const detail = errors.join(' | ') || 'all endpoints retired'
        if (attempts < PUSH_MAX_ATTEMPTS && errors.length > 0) {
          // Transient — release the claim so the next minute retries.
          await releasePushClaim(alert.id, attempts, `retry ${attempts}/${PUSH_MAX_ATTEMPTS}: ${detail}`)
        } else {
          await recordPushResult(alert.id, `failed after ${attempts}: ${detail}`)
        }
      }
    }

    summary.mode = summary.delivered > 0 ? 'sent' : summary.claimed > 0 ? 'sent' : 'idle'
    return summary
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'web-push pass failed'
    console.error('[web-push] drain error:', reason)
    return { ...empty, mode: 'error', reason }
  }
}
