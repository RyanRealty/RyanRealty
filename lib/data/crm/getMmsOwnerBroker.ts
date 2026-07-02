import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * The broker who owns the contact a given inbound MMS belongs to (the `broker`
 * on the crm_timeline sms_in row whose payload.sid matches this MessageSid).
 * Scopes the MMS media proxy to the assigned broker. Returns null when no match.
 * Accepts classic MMS sids (MM/SM) and Conversations message sids (IM — group
 * texts recorded by app/api/twilio/conversations-events).
 */
export async function getMmsOwnerBroker(messageSid: string): Promise<string | null> {
  if (!/^(MM|SM|IM)[a-f0-9]{32}$/.test(messageSid)) return null
  const sb = createServiceClient()
  const { data } = await sb
    .from('crm_timeline')
    .select('broker')
    .filter('payload->>sid', 'eq', messageSid)
    .limit(1)
    .maybeSingle()
  return (data?.broker as string | null) ?? null
}

/**
 * The Conversations chat-service sid stored on a group-text timeline row —
 * required to fetch that message's media from the Media Content Service
 * (mcs.us1.twilio.com needs Services/<chatServiceSid>/Media/<sid>).
 */
export async function getConversationChatServiceSid(messageSid: string): Promise<string | null> {
  if (!/^IM[a-f0-9]{32}$/.test(messageSid)) return null
  const sb = createServiceClient()
  const { data } = await sb
    .from('crm_timeline')
    .select('payload')
    .filter('payload->>sid', 'eq', messageSid)
    .limit(1)
    .maybeSingle()
  const payload = (data?.payload ?? {}) as Record<string, unknown>
  return typeof payload.chatServiceSid === 'string' ? payload.chatServiceSid : null
}
