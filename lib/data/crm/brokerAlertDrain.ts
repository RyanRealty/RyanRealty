/**
 * brokerAlertDrain — DAL for the serverless crm_broker_alerts drain (W5.5).
 *
 * All DB access for /api/cron/crm-alert-drain lives here (G1: no raw .from()
 * outside lib/data/). The claim is a per-row compare-and-set
 * (status 'pending' -> 'sending' guarded on status='pending'), so the drain and
 * the mac-mini relay can run concurrently without double-sending: whichever
 * writer claims first wins, the other sees zero updated rows.
 */

import { createServiceClient } from '@/lib/supabase/service'

export interface BrokerAlertRow {
  id: number
  broker: string | null
  to_phone: string
  body: string
  status: string
  attempts: number | null
}

const COLS = 'id, broker, to_phone, body, status, attempts'

/** Oldest pending alerts (the drain batch). */
export async function listPendingAlerts(limit = 20): Promise<BrokerAlertRow[]> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('crm_broker_alerts')
    .select(COLS)
    .eq('status', 'pending')
    .order('id')
    .limit(limit)
  if (error) throw new Error(`[brokerAlertDrain] listPending: ${error.message}`)
  return (data ?? []) as BrokerAlertRow[]
}

/**
 * Atomically claim one alert (CAS on status='pending'). Returns true when THIS
 * caller won the claim; false when another drainer already took it.
 */
export async function claimAlert(id: number): Promise<boolean> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('crm_broker_alerts')
    .update({ status: 'sending', claimed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending')
    .select('id')
  if (error) throw new Error(`[brokerAlertDrain] claim #${id}: ${error.message}`)
  return (data ?? []).length > 0
}

export async function markSent(id: number, channel: string): Promise<void> {
  const sb = createServiceClient()
  const { error } = await sb
    .from('crm_broker_alerts')
    .update({ status: 'sent', channel, sent_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(`[brokerAlertDrain] markSent #${id}: ${error.message}`)
}

/** Failure transition (retry -> pending, terminal -> failed) with the error recorded. */
export async function markFailure(id: number, attempts: number, status: 'pending' | 'failed', message: string): Promise<void> {
  const sb = createServiceClient()
  const { error } = await sb
    .from('crm_broker_alerts')
    .update({ status, attempts, error: message.slice(0, 300) })
    .eq('id', id)
  if (error) throw new Error(`[brokerAlertDrain] markFailure #${id}: ${error.message}`)
}

/** Policy refusal (non-broker to_phone): terminal failed, never sent. */
export async function refuseAlert(id: number, reason: string): Promise<void> {
  const sb = createServiceClient()
  const { error } = await sb
    .from('crm_broker_alerts')
    .update({ status: 'failed', error: reason })
    .eq('id', id)
  if (error) throw new Error(`[brokerAlertDrain] refuse #${id}: ${error.message}`)
}

/**
 * Reclaim stale 'sending' rows (a drainer that died mid-send): older than
 * 5 minutes go back to 'pending' so the next run retries them.
 */
export async function reclaimStaleSending(): Promise<number> {
  const sb = createServiceClient()
  const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString()
  const { data, error } = await sb
    .from('crm_broker_alerts')
    .update({ status: 'pending' })
    .eq('status', 'sending')
    .lt('claimed_at', cutoff)
    .select('id')
  if (error) throw new Error(`[brokerAlertDrain] reclaim: ${error.message}`)
  return (data ?? []).length
}
