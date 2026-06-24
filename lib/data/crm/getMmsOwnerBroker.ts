import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * The broker who owns the contact a given inbound MMS belongs to (the `broker`
 * on the crm_timeline sms_in row whose payload.sid matches this MessageSid).
 * Scopes the MMS media proxy to the assigned broker. Returns null when no match.
 */
export async function getMmsOwnerBroker(messageSid: string): Promise<string | null> {
  if (!/^(MM|SM)[a-f0-9]{32}$/.test(messageSid)) return null
  const sb = createServiceClient()
  const { data } = await sb
    .from('crm_timeline')
    .select('broker')
    .filter('payload->>sid', 'eq', messageSid)
    .limit(1)
    .maybeSingle()
  return (data?.broker as string | null) ?? null
}
