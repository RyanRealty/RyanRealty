/**
 * Suppression chokepoint — EVERY outbound send path checks here first
 * (blueprint §6). One function, one table, no per-path tag logic.
 */

import { createServiceClient } from '@/lib/supabase/service'

export type SendChannel = 'email' | 'sms' | 'call'

/** Tag → channel suppression mapping (tags are live the instant they land on a person). */
const TAG_CHANNEL: Array<{ tag: string; channels: Array<'all' | SendChannel> }> = [
  { tag: 'compliance:hard-stop', channels: ['all'] },
  { tag: 'contact:do-not-text', channels: ['sms'] },
  // TCPA: a text message is legally a "call". A do-not-call contact must be
  // blocked from SMS as well as voice (incident 2026-06-16: do-not-call
  // homeowners were texted because this mapped to 'call' only).
  { tag: 'contact:do-not-call', channels: ['call', 'sms'] },
  { tag: 'do_not_email', channels: ['email'] },
  { tag: 'unsubscribed', channels: ['email'] },
  { tag: 'bounced', channels: ['email'] },
  { tag: 'complained', channels: ['email'] },
]

export async function isSuppressed(personId: number, channel: SendChannel): Promise<{ suppressed: boolean; reasons: string[] }> {
  const sb = createServiceClient()
  const [rows, person] = await Promise.all([
    sb.from('crm_suppressions').select('channel,reason').eq('person_id', personId).in('channel', ['all', channel]),
    sb.from('crm_people').select('tags').eq('id', personId).maybeSingle(),
  ])
  if (rows.error) {
    // fail CLOSED: if the compliance table is unreadable, do not send
    return { suppressed: true, reasons: ['suppression-check-failed: ' + rows.error.message] }
  }
  const reasons = (rows.data ?? []).map((r) => `${r.channel}:${r.reason}`)
  // tags are an equally authoritative source (set at lead creation by
  // owner-resolution / BatchData flags, before any suppression row exists)
  const tags = ((person.data?.tags as string[] | undefined) ?? [])
  const tagsLower = new Set(tags.map((t) => t.toLowerCase()))
  for (const m of TAG_CHANNEL) {
    if (tagsLower.has(m.tag.toLowerCase()) && (m.channels.includes('all') || m.channels.includes(channel))) {
      reasons.push(`tag:${m.tag}`)
    }
  }
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
