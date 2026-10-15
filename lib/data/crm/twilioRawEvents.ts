/**
 * twilio_webhook_raw_events — the one fast durable write on the Twilio
 * inbound webhook hot path (docs/DATABASE_FOR_AI_AGENTS.md §0 / §2k).
 *
 * DAL boundary (G1): the only `.from('twilio_webhook_raw_events')` / RPC
 * lives here. lib/crm/twilio-webhook-ack.ts calls these helpers.
 *
 * Insert races a 2s abort plus the RPC's own statement_timeout so a stalled
 * pooler cannot hold Twilio past its 15s 11200/11203 deadline.
 */

import { createServiceClient } from '@/lib/supabase/service'

export const TWILIO_RAW_PERSIST_MS = 2_000
export const TWILIO_RAW_STALE_LOCK_MS = 10 * 60_000

export type TwilioWebhookKind = 'inbound-sms' | 'voice' | 'voice-complete' | 'recording'

export type TwilioRawEventRow = {
  id: number
  kind: TwilioWebhookKind
  provider_sid: string
  payload: Record<string, string>
  received_at: string
  processed_at: string | null
  processing_started_at: string | null
  process_attempts: number
  last_error: string | null
}

export type PersistTwilioRawResult =
  | { ok: true; id: number; persisted: true }
  | { ok: false; persisted: false; error: string }

function asPayload(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === 'string') out[k] = v
  }
  return out
}

function abortSignal(): AbortSignal {
  return AbortSignal.timeout(TWILIO_RAW_PERSIST_MS)
}

/**
 * One idempotent insert keyed on (kind, provider_sid). Never throws.
 * A timeout or error is { ok: false } so the webhook can still ack.
 */
export async function insertTwilioRawEvent(input: {
  kind: TwilioWebhookKind
  providerSid: string
  payload: Record<string, string>
}): Promise<PersistTwilioRawResult> {
  const sid = input.providerSid.trim()
  if (!sid) return { ok: false, persisted: false, error: 'missing provider_sid' }
  try {
    const sb = createServiceClient()
    const { data, error } = await sb
      .rpc('insert_twilio_webhook_raw_event', {
        p_kind: input.kind,
        p_provider_sid: sid,
        p_payload: input.payload,
      })
      .abortSignal(abortSignal())
    if (error) return { ok: false, persisted: false, error: error.message }
    const id = typeof data === 'number' ? data : Number(data)
    if (!Number.isFinite(id)) return { ok: false, persisted: false, error: 'insert returned no id' }
    return { ok: true, id, persisted: true }
  } catch (e) {
    return { ok: false, persisted: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function listUnprocessedTwilioRawEvents(limit = 25): Promise<TwilioRawEventRow[]> {
  try {
    const sb = createServiceClient()
    const staleBefore = new Date(Date.now() - TWILIO_RAW_STALE_LOCK_MS).toISOString()
    const { data, error } = await sb
      .from('twilio_webhook_raw_events')
      .select('id,kind,provider_sid,payload,received_at,processed_at,processing_started_at,process_attempts,last_error')
      .is('processed_at', null)
      .order('received_at', { ascending: true })
      .limit(Math.max(limit * 2, 25))
    if (error || !data) return []
    return data
      .filter((row) => !row.processing_started_at || row.processing_started_at < staleBefore)
      .slice(0, limit)
      .map((row) => ({
        ...row,
        kind: row.kind as TwilioWebhookKind,
        payload: asPayload(row.payload),
      }))
  } catch {
    return []
  }
}

/**
 * CAS claim so after() and the cron re-processor cannot both run the same
 * MessageSid/CallSid. Returns false when another worker holds a fresh lock
 * or the row is already processed.
 */
export async function claimTwilioRawEvent(id: number): Promise<boolean> {
  try {
    const sb = createServiceClient()
    const staleBefore = new Date(Date.now() - TWILIO_RAW_STALE_LOCK_MS).toISOString()
    const { data: current } = await sb
      .from('twilio_webhook_raw_events')
      .select('process_attempts,processed_at,processing_started_at')
      .eq('id', id)
      .maybeSingle()
    if (!current || current.processed_at) return false
    if (current.processing_started_at && current.processing_started_at > staleBefore) return false
    const { data, error } = await sb
      .from('twilio_webhook_raw_events')
      .update({
        processing_started_at: new Date().toISOString(),
        process_attempts: Number(current.process_attempts ?? 0) + 1,
      })
      .eq('id', id)
      .is('processed_at', null)
      .select('id')
      .maybeSingle()
    if (error || !data) return false
    return true
  } catch {
    return false
  }
}

export async function markTwilioRawEventProcessed(id: number): Promise<void> {
  try {
    const sb = createServiceClient()
    await sb
      .from('twilio_webhook_raw_events')
      .update({ processed_at: new Date().toISOString(), last_error: null, processing_started_at: null })
      .eq('id', id)
  } catch (e) {
    console.error('[twilioRawEvents] mark processed failed', e)
  }
}

export async function markTwilioRawEventError(id: number, error: string): Promise<void> {
  try {
    const sb = createServiceClient()
    await sb
      .from('twilio_webhook_raw_events')
      .update({ last_error: error.slice(0, 1000), processing_started_at: null })
      .eq('id', id)
      .is('processed_at', null)
  } catch (e) {
    console.error('[twilioRawEvents] mark error failed', e)
  }
}

export async function findTwilioRawEvent(kind: TwilioWebhookKind, providerSid: string): Promise<TwilioRawEventRow | null> {
  try {
    const sb = createServiceClient()
    const { data, error } = await sb
      .from('twilio_webhook_raw_events')
      .select('id,kind,provider_sid,payload,received_at,processed_at,processing_started_at,process_attempts,last_error')
      .eq('kind', kind)
      .eq('provider_sid', providerSid)
      .maybeSingle()
    if (error || !data) return null
    return { ...data, kind: data.kind as TwilioWebhookKind, payload: asPayload(data.payload) }
  } catch {
    return null
  }
}
