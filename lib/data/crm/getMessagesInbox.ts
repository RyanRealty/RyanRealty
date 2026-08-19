/**
 * Slim Messages inbox — last N conversations only.
 *
 * The full CRM inbox builder (getInboxFolderQueue) pages up to 4,000
 * crm_conversation rows plus folder counts. That is the 30–150s hang class
 * on /admin/messages. This reader is one ordered page so compose can paint.
 */
import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { isUnknownCaller } from '@/lib/crm/display-name'

export type MessagesInboxRow = {
  personId: number
  name: string | null
  snippet: string | null
  lastKindLabel: string
  lastMessageAt: string | null
  unread: boolean
}

function labelFor(channel: string | null, direction: string | null): string {
  if (channel === 'call') return 'Call'
  if (channel === 'voicemail') return 'Voicemail'
  const isEmail = channel === 'email'
  if (direction === 'out') return isEmail ? 'Email sent' : 'Text sent'
  if (direction === 'in') return isEmail ? 'Email received' : 'Text received'
  return ''
}

export async function getRecentMessageConversations(params: {
  brokerScope: string | null
  limit?: number
}): Promise<MessagesInboxRow[]> {
  const limit = Math.min(Math.max(params.limit ?? 40, 1), 80)
  const sb = createServiceClient()

  type PersonEmbed =
    | { name: string | null; assigned_broker: string | null; deleted: boolean }
    | Array<{ name: string | null; assigned_broker: string | null; deleted: boolean }>
    | null
  type ConvRow = {
    primary_person_id: number | null
    last_message_at: string | null
    last_snippet: string | null
    last_direction: string | null
    last_channel: string | null
    last_subject: string | null
    needs_reply: boolean
    crm_people: PersonEmbed
  }

  let q = sb
    .from('crm_conversation')
    .select(
      'primary_person_id,last_message_at,last_snippet,last_direction,last_channel,last_subject,needs_reply,crm_people!inner(name,assigned_broker,deleted)',
    )
    .not('last_message_at', 'is', null)
    .eq('crm_people.deleted', false)
    .order('last_message_at', { ascending: false })
    .limit(limit)
  if (params.brokerScope) q = q.eq('crm_people.assigned_broker', params.brokerScope)

  const { data, error } = await q
  if (error) {
    console.error('[getRecentMessageConversations]', error.message)
    return []
  }

  const seen = new Set<number>()
  const out: MessagesInboxRow[] = []
  for (const conv of (data ?? []) as unknown as ConvRow[]) {
    const person = Array.isArray(conv.crm_people) ? conv.crm_people[0] : conv.crm_people
    const pid = conv.primary_person_id
    if (!person || person.deleted || pid == null || seen.has(pid)) continue
    seen.add(pid)
    out.push({
      personId: pid,
      name: isUnknownCaller(person.name) ? 'Unknown contact' : person.name,
      snippet: (conv.last_snippet ?? conv.last_subject ?? '').slice(0, 160) || null,
      lastKindLabel: labelFor(conv.last_channel, conv.last_direction),
      lastMessageAt: conv.last_message_at,
      unread: Boolean(conv.needs_reply),
    })
  }
  return out
}
