/**
 * getConversationTriageState — one thread's triage row (status + explicit
 * assignee) for the Messages thread header (fold final slice). Defaults to
 * 'unread' with no assignee when no state row exists yet — the same effective
 * rule the inbox queue uses. DAL boundary (G1): raw .from() lives here.
 */
import 'server-only'
import { createServiceClient } from '@/lib/data/client'

export type ConversationTriageState = {
  status: 'unread' | 'open' | 'handled' | 'closed'
  assignedBroker: string | null
}

export async function getConversationTriageState(personId: number): Promise<ConversationTriageState> {
  const fallback: ConversationTriageState = { status: 'unread', assignedBroker: null }
  if (!Number.isFinite(personId) || personId <= 0) return fallback
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('crm_conversation_state')
    .select('status,assigned_broker')
    .eq('person_id', personId)
    .maybeSingle()
  if (error) {
    console.error('[getConversationTriageState]', error.message)
    return fallback
  }
  const raw = String(data?.status ?? 'unread')
  const status =
    raw === 'open' || raw === 'handled' || raw === 'closed' ? (raw as ConversationTriageState['status']) : 'unread'
  return { status, assignedBroker: (data?.assigned_broker as string | null) ?? null }
}
