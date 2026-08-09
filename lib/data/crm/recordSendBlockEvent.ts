/**
 * Per-attempt send block ledger (P12 send-integrity).
 *
 * Best-effort insert — a ledger write must NEVER block or fail a send path.
 * If the table is not migrated yet, swallow the error and return false.
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
    const { error } = await sb.from('crm_send_block_events').insert({
      person_id: input.personId,
      channel: input.channel,
      stage: input.stage,
      reasons: input.reasons ?? [],
      source: input.source ?? null,
    })
    if (error) {
      // Table may not exist until migration lands — never fail the send guard.
      console.warn('[recordSendBlockEvent]', error.message)
      return false
    }
    return true
  } catch (e) {
    console.warn('[recordSendBlockEvent]', e instanceof Error ? e.message : e)
    return false
  }
}
