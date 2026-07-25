/**
 * store — the broker web-push subscription store (W5.5 leg b).
 *
 * Rows live in public.push_subscriptions with `broker` set to a Ryan Realty
 * broker slug. The table was created 2026-03-10 for public PWA listing alerts
 * and was empty; a NULL broker still means "public subscription", so the two
 * uses never collide.
 *
 * DAL boundary (G1): app/api/** is a write-path prefix, so the service-client
 * reads/writes here are in-policy. Every one of them uses the memoized
 * createServiceClient singleton (G-service-client).
 */
import { createServiceClient } from '@/lib/supabase/service'
import type { PushSubscriptionKeys } from './web-push'

/** The three broker slugs the alert queue routes to. */
export const PUSH_BROKERS = ['matt', 'rebecca', 'paul'] as const
export type PushBroker = (typeof PUSH_BROKERS)[number]

export function isPushBroker(v: string | null | undefined): v is PushBroker {
  return !!v && (PUSH_BROKERS as readonly string[]).includes(v)
}

export interface BrokerPushSubscription {
  id: string
  broker: string
  endpoint: string
  keys: PushSubscriptionKeys
  label: string | null
  created_at: string
  last_success_at: string | null
  failure_count: number
}

const COLS = 'id, broker, endpoint, keys, label, created_at, last_success_at, failure_count'

/** Active (not disabled) broker subscriptions, optionally scoped to one broker. */
export async function listActiveSubscriptions(broker?: string): Promise<BrokerPushSubscription[]> {
  const sb = createServiceClient()
  let q = sb.from('push_subscriptions').select(COLS).not('broker', 'is', null).is('disabled_at', null)
  if (broker) q = q.eq('broker', broker)
  const { data, error } = await q.order('created_at').limit(200)
  if (error) throw new Error(`[push/store] listActive: ${error.message}`)
  return (data ?? []) as unknown as BrokerPushSubscription[]
}

/**
 * Register (or re-activate) one device subscription for one broker.
 * Keyed on the endpoint, which is globally unique per browser install — a
 * re-subscribe after a permission reset lands on the same row.
 */
export async function upsertSubscription(params: {
  broker: PushBroker
  endpoint: string
  keys: PushSubscriptionKeys
  label: string | null
  email: string
}): Promise<void> {
  const sb = createServiceClient()
  const { error } = await sb
    .from('push_subscriptions')
    .upsert(
      {
        broker: params.broker,
        endpoint: params.endpoint,
        keys: params.keys,
        label: params.label?.slice(0, 120) ?? null,
        created_by_email: params.email,
        disabled_at: null,
        failure_count: 0,
      },
      { onConflict: 'endpoint' },
    )
  if (error) throw new Error(`[push/store] upsert: ${error.message}`)
}

/** Broker-scoped delete — a broker can only remove their own device. */
export async function deleteSubscription(broker: string, endpoint: string): Promise<number> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('push_subscriptions')
    .delete()
    .eq('broker', broker)
    .eq('endpoint', endpoint)
    .select('id')
  if (error) throw new Error(`[push/store] delete: ${error.message}`)
  return (data ?? []).length
}

/** A push service said 404/410 Gone — retire the endpoint, never retry it. */
export async function disableSubscription(id: string, reason: string): Promise<void> {
  const sb = createServiceClient()
  const { error } = await sb
    .from('push_subscriptions')
    .update({ disabled_at: new Date().toISOString(), label: reason.slice(0, 120) })
    .eq('id', id)
  if (error) throw new Error(`[push/store] disable #${id}: ${error.message}`)
}

export async function markSubscriptionSuccess(id: string): Promise<void> {
  const sb = createServiceClient()
  const { error } = await sb
    .from('push_subscriptions')
    .update({ last_success_at: new Date().toISOString(), failure_count: 0 })
    .eq('id', id)
  if (error) throw new Error(`[push/store] success #${id}: ${error.message}`)
}

export async function markSubscriptionFailure(id: string, failureCount: number): Promise<void> {
  const sb = createServiceClient()
  const { error } = await sb
    .from('push_subscriptions')
    .update({ failure_count: failureCount })
    .eq('id', id)
  if (error) throw new Error(`[push/store] failure #${id}: ${error.message}`)
}

export interface PushCandidateAlert {
  id: number
  broker: string
  body: string
  person_id: number | null
  push_attempts: number
  created_at: string
}

/**
 * Alerts eligible for a web push: never push-claimed, inside the lookback
 * window. Deliberately NOT filtered on `status` — an alert already texted by
 * the SMS drain still gets its push, because web-push is a parallel durable
 * channel, not a fallback. The lookback keeps a newly-subscribed device from
 * being buried under the 843-row history.
 */
export async function listPushCandidates(lookbackMinutes: number, limit = 20): Promise<PushCandidateAlert[]> {
  const sb = createServiceClient()
  const since = new Date(Date.now() - lookbackMinutes * 60 * 1000).toISOString()
  const { data, error } = await sb
    .from('crm_broker_alerts')
    .select('id, broker, body, person_id, push_attempts, created_at')
    .is('pushed_at', null)
    .gte('created_at', since)
    .order('id')
    .limit(limit)
  if (error) throw new Error(`[push/store] listPushCandidates: ${error.message}`)
  return (data ?? []) as unknown as PushCandidateAlert[]
}

/**
 * Compare-and-set the PUSH claim. Mirrors claimAlert's first-writer-wins model
 * (lib/data/crm/brokerAlertDrain.ts) but on `pushed_at` instead of `status`, so
 * the SMS claim and the push claim are independent and neither channel can
 * consume the other's row. Returns true only when THIS caller won.
 */
export async function claimPushDelivery(id: number): Promise<boolean> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('crm_broker_alerts')
    .update({ pushed_at: new Date().toISOString() })
    .eq('id', id)
    .is('pushed_at', null)
    .select('id')
  if (error) throw new Error(`[push/store] claimPush #${id}: ${error.message}`)
  return (data ?? []).length > 0
}

/** Record the push outcome on the alert row (observable in the queue itself). */
export async function recordPushResult(id: number, result: string): Promise<void> {
  const sb = createServiceClient()
  const { error } = await sb
    .from('crm_broker_alerts')
    .update({ push_result: result.slice(0, 200) })
    .eq('id', id)
  if (error) throw new Error(`[push/store] recordPushResult #${id}: ${error.message}`)
}

/** Release a claim so the next run retries (transient push-service failure). */
export async function releasePushClaim(id: number, attempts: number, result: string): Promise<void> {
  const sb = createServiceClient()
  const { error } = await sb
    .from('crm_broker_alerts')
    .update({ pushed_at: null, push_attempts: attempts, push_result: result.slice(0, 200) })
    .eq('id', id)
  if (error) throw new Error(`[push/store] releasePushClaim #${id}: ${error.message}`)
}
