/**
 * lib/data/agent/sessions.ts — DAL for the broker SMS agent's session store
 * (docs/plans/BROKER_SMS_AGENT_2026-07-31.md R1.3/R2.1/R2.4).
 *
 * Owns `public.broker_agent_sessions` end to end (idle-expiry, state jsonb,
 * active-action handles) and provides read/append helpers over
 * `public.broker_agent_turns` for lib/agent/session.ts's conversation-history
 * builder and lib/agent/runtime.ts's per-tool-call audit rows.
 *
 * INTEGRATION NOTE (discovered mid-build, recorded so the seam is not
 * accidentally re-litigated): lib/data/agent/turn-intake.ts — built in
 * parallel by the R1.2/R1.3 rung — already owns insertInboundTurn (the
 * broker's inbound turn) and insertAgentTurn, and lib/agent/ingress.ts
 * already calls insertAgentTurn itself immediately after runAgentTurn
 * returns, to persist the FINAL role='agent' reply row. So:
 *   - appendTurn() here is used by runtime.ts ONLY for per-tool-call audit
 *     rows (role='tool') — never for the final agent reply, which would
 *     double-write it once ingress.ts's own insertAgentTurn call lands.
 *   - recentTurns() here is the one generic "every role, oldest first"
 *     reader (turn-intake.ts only exposes an unprocessed-broker-turns
 *     reader), so lib/agent/session.ts's buildModelHistory uses this one. It
 *     reads the same table turn-intake.ts writes to — same column shapes,
 *     so rows from either writer come back correctly either way.
 */
import { createServiceClient } from '@/lib/supabase/service'
import type { AgentCitation, AgentSessionRow, BrokerSlug } from '@/lib/agent/types'

const IDLE_EXPIRE_MS = 4 * 60 * 60 * 1000 // 4h, per R1.3

const SESSION_COLUMNS = 'id, broker_slug, state, active_action_ids, last_activity_at, created_at, expired_at'

function rowToSession(row: Record<string, unknown>): AgentSessionRow {
  return {
    id: row.id as string,
    broker_slug: row.broker_slug as BrokerSlug,
    state: (row.state as Record<string, unknown>) ?? {},
    active_action_ids: (row.active_action_ids as string[]) ?? [],
    last_activity_at: row.last_activity_at as string,
    created_at: row.created_at as string,
    expired_at: (row.expired_at as string | null) ?? null,
  }
}

/** Force a session to expire now. Used by RESET and by idle-expiry below. */
export async function expireSession(sessionId: string): Promise<void> {
  const sb = createServiceClient()
  const { error } = await sb
    .from('broker_agent_sessions')
    .update({ expired_at: new Date().toISOString() })
    .eq('id', sessionId)
    .is('expired_at', null)
  if (error) throw new Error(`[expireSession] ${error.message}`)
}

/**
 * The broker's active (non-expired) session, idle-expiring anything last
 * touched more than 4h ago and creating a fresh one in its place — including
 * on a broker's very first-ever message, where no row exists yet.
 */
export async function getOrCreateActiveSession(brokerSlug: BrokerSlug): Promise<AgentSessionRow> {
  const sb = createServiceClient()
  const { data: existing, error } = await sb
    .from('broker_agent_sessions')
    .select(SESSION_COLUMNS)
    .eq('broker_slug', brokerSlug)
    .is('expired_at', null)
    .order('last_activity_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`[getOrCreateActiveSession] select failed: ${error.message}`)

  if (existing) {
    const ageMs = Date.now() - new Date(existing.last_activity_at as string).getTime()
    if (ageMs <= IDLE_EXPIRE_MS) return rowToSession(existing as Record<string, unknown>)
    await expireSession(existing.id as string)
  }

  const { data: created, error: insertError } = await sb
    .from('broker_agent_sessions')
    .insert({ broker_slug: brokerSlug })
    .select(SESSION_COLUMNS)
    .single()
  if (insertError || !created) {
    throw new Error(`[getOrCreateActiveSession] insert failed: ${insertError?.message ?? 'no row returned'}`)
  }
  return rowToSession(created as Record<string, unknown>)
}

/** Bump last_activity_at — call at the start of every turn so a mid-flight
 *  conversation never idle-expires under the broker while they're using it. */
export async function touchSession(sessionId: string): Promise<void> {
  const sb = createServiceClient()
  const { error } = await sb
    .from('broker_agent_sessions')
    .update({ last_activity_at: new Date().toISOString() })
    .eq('id', sessionId)
  if (error) throw new Error(`[touchSession] ${error.message}`)
}

/** Shallow-merge `patch` into the session's state jsonb (read-modify-write —
 *  Supabase has no jsonb merge operator over PostgREST). */
export async function updateSessionState(sessionId: string, patch: Record<string, unknown>): Promise<void> {
  const sb = createServiceClient()
  const { data, error } = await sb.from('broker_agent_sessions').select('state').eq('id', sessionId).single()
  if (error) throw new Error(`[updateSessionState] read failed: ${error.message}`)
  const nextState = { ...((data?.state as Record<string, unknown>) ?? {}), ...patch }
  const { error: updateError } = await sb
    .from('broker_agent_sessions')
    .update({ state: nextState })
    .eq('id', sessionId)
  if (updateError) throw new Error(`[updateSessionState] write failed: ${updateError.message}`)
}

async function readActiveActionIds(sessionId: string): Promise<string[]> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('broker_agent_sessions')
    .select('active_action_ids')
    .eq('id', sessionId)
    .single()
  if (error) throw new Error(`[activeActionIds] read failed: ${error.message}`)
  return (data?.active_action_ids as string[] | null) ?? []
}

/** Add an action id to the session's active set (no-op if already present). */
export async function addActiveAction(sessionId: string, actionId: string): Promise<void> {
  const current = await readActiveActionIds(sessionId)
  if (current.includes(actionId)) return
  const sb = createServiceClient()
  const { error } = await sb
    .from('broker_agent_sessions')
    .update({ active_action_ids: [...current, actionId] })
    .eq('id', sessionId)
  if (error) throw new Error(`[addActiveAction] write failed: ${error.message}`)
}

/** Remove an action id from the session's active set (no-op if absent). */
export async function removeActiveAction(sessionId: string, actionId: string): Promise<void> {
  const current = await readActiveActionIds(sessionId)
  const next = current.filter((id) => id !== actionId)
  if (next.length === current.length) return
  const sb = createServiceClient()
  const { error } = await sb.from('broker_agent_sessions').update({ active_action_ids: next }).eq('id', sessionId)
  if (error) throw new Error(`[removeActiveAction] write failed: ${error.message}`)
}

// ── Turns ────────────────────────────────────────────────────────────────

export type AgentTurnRole = 'broker' | 'agent' | 'system' | 'tool'

export interface AppendTurnInput {
  sessionId: string
  role: AgentTurnRole
  content: unknown
  toolCalls?: unknown[]
  citations?: AgentCitation[]
  costUsd?: number | null
  messageSid?: string | null
}

export interface AgentTurnRow {
  id: string
  sessionId: string
  role: AgentTurnRole
  content: unknown
  messageSid: string | null
  toolCalls: unknown[]
  citations: AgentCitation[]
  costUsd: number | null
  createdAt: string
}

const TURN_COLUMNS = 'id, session_id, role, content, message_sid, tool_calls, citations, cost_usd, created_at'

function rowToTurn(row: Record<string, unknown>): AgentTurnRow {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    role: row.role as AgentTurnRole,
    content: row.content,
    messageSid: (row.message_sid as string | null) ?? null,
    toolCalls: (row.tool_calls as unknown[]) ?? [],
    citations: (row.citations as AgentCitation[]) ?? [],
    costUsd: row.cost_usd != null ? Number(row.cost_usd) : null,
    createdAt: row.created_at as string,
  }
}

/**
 * Append one turn. Twilio-retried inbound webhooks would collide on
 * message_sid's unique partial index — treat 23505 as "already recorded",
 * not a failure, and return the existing row.
 */
export async function appendTurn(input: AppendTurnInput): Promise<AgentTurnRow> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('broker_agent_turns')
    .insert({
      session_id: input.sessionId,
      role: input.role,
      content: input.content ?? {},
      message_sid: input.messageSid ?? null,
      tool_calls: input.toolCalls ?? [],
      citations: input.citations ?? [],
      cost_usd: input.costUsd ?? null,
    })
    .select(TURN_COLUMNS)
    .single()

  if (error) {
    if (error.code === '23505' && input.messageSid) {
      const { data: existing, error: selectError } = await sb
        .from('broker_agent_turns')
        .select(TURN_COLUMNS)
        .eq('message_sid', input.messageSid)
        .single()
      if (!selectError && existing) return rowToTurn(existing as Record<string, unknown>)
    }
    throw new Error(`[appendTurn] ${error.message}`)
  }
  return rowToTurn(data as Record<string, unknown>)
}

/** Every turn in the session, oldest first, capped at `limit` (default 30). */
export async function recentTurns(sessionId: string, limit = 30): Promise<AgentTurnRow[]> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('broker_agent_turns')
    .select(TURN_COLUMNS)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(Math.max(1, Math.min(limit, 200)))
  if (error) throw new Error(`[recentTurns] ${error.message}`)
  return (data ?? []).map((row) => rowToTurn(row as Record<string, unknown>)).reverse()
}
