/**
 * The rollups a crm_conversation row carries over its messages, computed the way
 * `recompute_conversation_rollups()` does in Postgres (migration
 * 20260716240000_conversation_denorm.sql): clocks per direction, the channel and
 * outbound-broker sets, an exact count, and the newest message's display fields
 * (newest by created_at, then id, both descending). For a repair that removes
 * messages from a few conversations and must leave them as the recompute would,
 * without touching every other conversation. Pure.
 */

export type RollupMessage = {
  id: string
  direction: string
  channel: string
  body: string | null
  subject: string | null
  meta: Record<string, unknown> | null
  sent_by: string | null
  created_at: string
}

export type ConversationRollups = {
  last_message_at: string
  last_inbound_at: string | null
  last_outbound_at: string | null
  channel_set: string[]
  outbound_brokers: string[]
  needs_reply: boolean
  message_count: number
  last_snippet: string | null
  last_direction: string
  last_channel: string
  last_subject: string | null
  last_call_duration_sec: number | null
}

const at = (iso: string) => Date.parse(iso)

/** Null for a conversation with no messages: the recompute leaves those alone. */
export function conversationRollups(messages: readonly RollupMessage[]): ConversationRollups | null {
  if (!messages.length) return null
  const newest = [...messages].sort((a, b) => at(b.created_at) - at(a.created_at) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0))[0]
  const latest = (direction: string | null): string | null => {
    let best: RollupMessage | null = null
    for (const m of messages) {
      if (direction != null && m.direction !== direction) continue
      if (!best || at(m.created_at) > at(best.created_at)) best = m
    }
    return best?.created_at ?? null
  }
  const call = newest.channel === 'call' || newest.channel === 'voicemail'
  const meta = newest.meta ?? {}
  const raw = meta.durationSec ?? meta.duration ?? meta.RecordingDuration
  const duration = call && raw != null && raw !== '' ? Number.parseInt(String(raw), 10) : NaN
  return {
    last_message_at: latest(null)!,
    last_inbound_at: latest('in'),
    last_outbound_at: latest('out'),
    channel_set: [...new Set(messages.map((m) => m.channel))],
    outbound_brokers: [...new Set(messages.filter((m) => m.direction === 'out' && m.sent_by).map((m) => String(m.sent_by)))],
    needs_reply: newest.direction === 'in',
    message_count: messages.length,
    last_snippet: newest.body,
    last_direction: newest.direction,
    last_channel: newest.channel,
    last_subject: newest.subject,
    last_call_duration_sec: Number.isFinite(duration) ? duration : null,
  }
}
