/**
 * Suppression chokepoint — EVERY outbound send path checks here first
 * (blueprint §6). One function, one table, no per-path tag logic.
 */

import { createServiceClient } from '@/lib/supabase/service'

export type SendChannel = 'email' | 'sms' | 'call'

export async function isSuppressed(personId: number, channel: SendChannel): Promise<{ suppressed: boolean; reasons: string[] }> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('crm_suppressions')
    .select('channel,reason')
    .eq('person_id', personId)
    .in('channel', ['all', channel])
  if (error) {
    // fail CLOSED: if the compliance table is unreadable, do not send
    return { suppressed: true, reasons: ['suppression-check-failed: ' + error.message] }
  }
  const reasons = (data ?? []).map((r) => `${r.channel}:${r.reason}`)
  return { suppressed: reasons.length > 0, reasons }
}

export async function addSuppression(params: {
  personId: number
  channel: 'all' | SendChannel
  reason: string
  source?: string
  value?: string | null
}): Promise<void> {
  const sb = createServiceClient()
  await sb.from('crm_suppressions').insert({
    person_id: params.personId,
    channel: params.channel,
    reason: params.reason,
    source: params.source ?? 'app',
    value: params.value ?? null,
  })
}
