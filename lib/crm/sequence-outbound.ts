/**
 * Sequence-engine outbound chokepoint (G3).
 *
 * After a real email/SMS send the engine must (1) write the timeline row and
 * (2) stamp first-outbound so Lead → Nurture advances. Both live here so the
 * cron route does not grow past the file-size ratchet.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { stampFirstBrokerActionIfEmpty } from './first-broker-action'

export async function recordSequenceOutbound(
  sb: SupabaseClient,
  input: {
    personId: number
    kind: 'email_out' | 'sms_out'
    title: string
    body: string
    payload: Record<string, unknown>
    broker: string
    dedupeKey: string
  },
): Promise<void> {
  await sb.from('crm_timeline').insert({
    person_id: input.personId,
    kind: input.kind,
    title: input.title,
    body: input.body,
    payload: input.payload,
    broker: input.broker,
    source: 'sequence',
    dedupe_key: input.dedupeKey,
  })
  await stampFirstBrokerActionIfEmpty(sb, input.personId, {
    kind: input.kind,
    broker: input.broker,
  })
}
