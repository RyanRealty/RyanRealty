import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * Resolve the lead number + caller ID for an in-flight outbound click-to-call,
 * keyed by the parent Twilio CallSid. The start-call action pre-inserts a
 * crm_timeline `call` row (dedupe_key twilio:call:<sid>:p<id>) carrying the lead
 * + broker number in its payload; the outbound-bridge TwiML reads it here so no
 * phone number ever travels in a webhook URL. Returns null when no row matches.
 */
export async function getOutboundCallLead(
  callSid: string,
): Promise<{ leadE164: string; callerId: string | null } | null> {
  if (!/^CA[a-f0-9]{32}$/.test(callSid)) return null
  const sb = createServiceClient()
  const { data } = await sb
    .from('crm_timeline')
    .select('payload')
    .like('dedupe_key', `twilio:call:${callSid}:%`)
    .limit(1)
    .maybeSingle()
  const payload = (data?.payload ?? {}) as { toNumber?: string; fromNumber?: string }
  const leadE164 = typeof payload.toNumber === 'string' ? payload.toNumber : ''
  if (!/^\+1\d{10}$/.test(leadE164)) return null
  return { leadE164, callerId: typeof payload.fromNumber === 'string' ? payload.fromNumber : null }
}
