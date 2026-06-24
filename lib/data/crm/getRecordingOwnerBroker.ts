import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * The broker who owns the contact a given Twilio recording belongs to (the
 * `broker` on the crm_timeline call/voicemail row whose payload carries this
 * recordingSid). Used by the recording proxy to scope playback to the assigned
 * broker. Returns null when no row matches.
 */
export async function getRecordingOwnerBroker(recordingSid: string): Promise<string | null> {
  if (!/^RE[a-f0-9]{32}$/.test(recordingSid)) return null
  const sb = createServiceClient()
  const { data } = await sb
    .from('crm_timeline')
    .select('broker')
    .filter('payload->>recordingSid', 'eq', recordingSid)
    .limit(1)
    .maybeSingle()
  return (data?.broker as string | null) ?? null
}
