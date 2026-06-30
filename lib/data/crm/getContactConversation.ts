/**
 * getContactConversation — the FULL message history for a contact's Comms tab:
 * every text, email, and call, newest first, cursor-paginated on `ts`. Replaces
 * the old "slice the last 40 of the 100-row timeline" cap that hid older messages
 * (including group texts) on long-running contacts.
 *
 * Raw .from() lives here per the DAL boundary (G1).
 */
import { createServiceClient } from '@/lib/data/client'

/** crm_timeline kinds that are a real message/call (what the Comms thread shows). */
export const CONVERSATION_KINDS = ['sms_in', 'sms_out', 'email_in', 'email_out', 'call', 'voicemail'] as const

export type ConversationMessage = {
  id: number
  ts: string
  kind: string
  title: string | null
  body: string | null
  broker: string | null
  payload: Record<string, unknown> | null
}

export type ContactConversationResult = { items: ConversationMessage[]; nextCursor: string | null }

export async function getContactConversation(
  personId: number,
  opts: { before?: string | null; limit?: number } = {},
): Promise<ContactConversationResult> {
  if (!Number.isFinite(personId) || personId <= 0) return { items: [], nextCursor: null }
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200)
  const sb = createServiceClient()

  let q = sb
    .from('crm_timeline')
    .select('id,ts,kind,title,body,payload,broker')
    .eq('person_id', personId)
    .in('kind', CONVERSATION_KINDS as unknown as string[])
    .order('ts', { ascending: false })
    .limit(limit + 1)
  if (opts.before) q = q.lt('ts', opts.before)

  const { data, error } = await q
  if (error || !data) return { items: [], nextCursor: null }

  const hasMore = data.length > limit
  const page = (data as Array<Record<string, unknown>>).slice(0, limit)
  const items: ConversationMessage[] = page.map((r) => ({
    id: Number(r.id),
    ts: String(r.ts),
    kind: String(r.kind),
    title: (r.title as string | null) ?? null,
    body: (r.body as string | null) ?? null,
    broker: (r.broker as string | null) ?? null,
    payload: (r.payload as Record<string, unknown> | null) ?? null,
  }))
  const nextCursor = hasMore && page.length ? String(page[page.length - 1]!.ts) : null
  return { items, nextCursor }
}
