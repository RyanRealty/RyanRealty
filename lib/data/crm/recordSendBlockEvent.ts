/**
 * Per-attempt send block ledger (P12 send-integrity).
 *
 * Writes into public.admin_actions (already in prod + audit-log UI) so a
 * refused governed send is queryable — no new table required. Best-effort:
 * a ledger write must NEVER block or fail the send-guard path.
 */

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type { SendChannel } from '@/lib/crm/suppressions'

export async function recordSendBlockEvent(input: {
  personId: number
  channel: SendChannel
  stage: string
  reasons: string[]
  source?: string
}): Promise<boolean> {
  try {
    if (!Number.isFinite(input.personId) || input.personId <= 0) return false
    const sb = createServiceClient()
    const { error } = await sb.from('admin_actions').insert({
      admin_email: 'system:send-guard',
      role: 'system',
      action_type: 'send_blocked',
      resource_type: 'crm_person',
      resource_id: String(input.personId),
      details: {
        channel: input.channel,
        stage: input.stage,
        reasons: input.reasons ?? [],
        source: input.source ?? null,
      },
    })
    if (error) {
      console.warn('[recordSendBlockEvent]', error.message)
      return false
    }
    return true
  } catch (e) {
    console.warn('[recordSendBlockEvent]', e instanceof Error ? e.message : e)
    return false
  }
}
