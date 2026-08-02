/**
 * lib/agent/session.ts — session resolution + Anthropic message-history
 * construction for the broker SMS agent (R2.1/R2.4).
 *
 * resolveAgentSession is what lib/agent/ingress.ts calls to get/create the
 * broker's active session before persisting the inbound turn and building the
 * AgentContext. buildModelHistory is what lib/agent/runtime.ts calls to seed
 * the Opus 5 tool loop with prior conversation — see
 * lib/data/agent/sessions.ts's module doc for why `recentTurns` (not
 * turn-intake.ts) is the reader used here.
 */
import type Anthropic from '@anthropic-ai/sdk'
import { getOrCreateActiveSession, recentTurns } from '@/lib/data/agent/sessions'
import type { AgentSessionRow, BrokerSlug } from '@/lib/agent/types'

export async function resolveAgentSession(brokerSlug: BrokerSlug): Promise<AgentSessionRow> {
  return getOrCreateActiveSession(brokerSlug)
}

const HISTORY_TURN_LIMIT = 30

function turnText(content: unknown): string {
  if (typeof content === 'string') return content
  if (content && typeof content === 'object') {
    const record = content as Record<string, unknown>
    if (typeof record.text === 'string') return record.text
  }
  return content == null ? '' : JSON.stringify(content)
}

/**
 * Map the session's recent turns onto the Anthropic Messages API shape:
 * broker -> user, agent -> assistant. Tool and system rows are bookkeeping
 * (per-tool-call audit rows, keyword confirmations) — never replayed into
 * the model's own conversation, so the model is never shown a fabricated
 * "assistant said this" for something it did not actually say as a reply.
 */
export async function buildModelHistory(sessionId: string): Promise<Anthropic.MessageParam[]> {
  const turns = await recentTurns(sessionId, HISTORY_TURN_LIMIT)
  const messages: Anthropic.MessageParam[] = []
  for (const turn of turns) {
    if (turn.role === 'broker') {
      messages.push({ role: 'user', content: turnText(turn.content) })
    } else if (turn.role === 'agent') {
      const text = turnText(turn.content)
      if (text) messages.push({ role: 'assistant', content: text })
    }
  }
  return messages
}
