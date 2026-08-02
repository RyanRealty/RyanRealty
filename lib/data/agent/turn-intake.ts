/**
 * lib/data/agent/turn-intake.ts — DAL for public.broker_agent_turns (R1.2/R1.3).
 *
 * The only file allowed to touch broker_agent_turns with a raw `.from()` call
 * (G1 DAL boundary — lib/agent/ingress.ts and lib/agent/runtime.ts call these
 * functions, never the table directly).
 *
 * Idempotency: message_sid carries a unique PARTIAL index (where message_sid
 * is not null — see supabase/migrations/20260801051000_broker_sms_agent_tables.sql).
 * Twilio retries inbound webhooks, so insertInboundTurn treats Postgres 23505
 * (unique_violation) as a normal outcome, not an error.
 *
 * "Unprocessed" has no dedicated column — role='broker' turns carry
 * `content.processed` (boolean, default false on insert) and
 * markTurnsProcessed flips it true. This is the debounce mechanism's ledger
 * (Amendment R1.2): a broker's rapid-fire texts sit unprocessed until the
 * 20s-later webhook that is still the latest one claims and flips all of them
 * at once.
 */

import { createServiceClient } from '@/lib/supabase/service'
import type { BrokerSlug } from '@/lib/agent/types'

const UNIQUE_VIOLATION = '23505'

export interface InsertInboundTurnParams {
  sessionId: string
  brokerSlug: BrokerSlug
  messageSid: string
  body: string
  mediaUrls?: string[]
}

export type InsertInboundTurnResult =
  | { duplicate: true }
  | { duplicate: false; turnId: string }

/** Persist one inbound broker turn. Dedupes on message_sid — a Twilio retry
 *  of the same webhook returns { duplicate: true } instead of a second row. */
export async function insertInboundTurn(params: InsertInboundTurnParams): Promise<InsertInboundTurnResult> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('broker_agent_turns')
    .insert({
      session_id: params.sessionId,
      role: 'broker',
      message_sid: params.messageSid,
      content: {
        text: params.body,
        mediaUrls: params.mediaUrls ?? [],
        brokerSlug: params.brokerSlug,
        processed: false,
      },
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === UNIQUE_VIOLATION) return { duplicate: true }
    throw new Error(`[insertInboundTurn] ${error.message}`)
  }
  return { duplicate: false, turnId: data.id as string }
}

export interface UnprocessedInboundTurn {
  id: string
  messageSid: string | null
  text: string
  mediaUrls: string[]
  createdAt: string
}

/** Every role='broker' turn in the session not yet flagged processed, oldest first. */
export async function listUnprocessedInbound(sessionId: string): Promise<UnprocessedInboundTurn[]> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('broker_agent_turns')
    .select('id, message_sid, content, created_at')
    .eq('session_id', sessionId)
    .eq('role', 'broker')
    .order('created_at', { ascending: true })

  if (error) throw new Error(`[listUnprocessedInbound] ${error.message}`)

  return (data ?? [])
    .map((row) => ({
      id: row.id as string,
      messageSid: (row.message_sid as string | null) ?? null,
      createdAt: row.created_at as string,
      content: (row.content ?? {}) as Record<string, unknown>,
    }))
    .filter((row) => row.content.processed !== true)
    .map((row) => ({
      id: row.id,
      messageSid: row.messageSid,
      createdAt: row.createdAt,
      text: typeof row.content.text === 'string' ? row.content.text : '',
      mediaUrls: Array.isArray(row.content.mediaUrls) ? (row.content.mediaUrls as string[]) : [],
    }))
}

/** Flip content.processed = true on every listed turn id (read-modify-write —
 *  content is jsonb, so this preserves text/mediaUrls/brokerSlug on each row). */
export async function markTurnsProcessed(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const sb = createServiceClient()
  const { data, error } = await sb.from('broker_agent_turns').select('id, content').in('id', ids)
  if (error) throw new Error(`[markTurnsProcessed] ${error.message}`)

  await Promise.all(
    (data ?? []).map((row) => {
      const content = { ...((row.content ?? {}) as Record<string, unknown>), processed: true }
      return sb.from('broker_agent_turns').update({ content }).eq('id', row.id)
    }),
  )
}

export interface InsertAgentTurnParams {
  sessionId: string
  role: 'agent' | 'system' | 'tool'
  content: Record<string, unknown>
  toolCalls?: unknown[]
  citations?: unknown[]
  costUsd?: number
  messageSid?: string | null
}

/** Persist the agent's (or a system/tool) turn — the audit trail R1.3's
 *  "turns visible after a test conversation" acceptance bar and the R3.5
 *  supervision digest both read from. */
export async function insertAgentTurn(params: InsertAgentTurnParams): Promise<{ turnId: string }> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('broker_agent_turns')
    .insert({
      session_id: params.sessionId,
      role: params.role,
      content: params.content,
      tool_calls: params.toolCalls ?? [],
      citations: params.citations ?? [],
      cost_usd: params.costUsd ?? null,
      message_sid: params.messageSid ?? null,
    })
    .select('id')
    .single()

  if (error) throw new Error(`[insertAgentTurn] ${error.message}`)
  return { turnId: data.id as string }
}
