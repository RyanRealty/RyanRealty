/**
 * One-shot / periodic backfill of custom.first_broker_action_at from timeline
 * for people created in a window who still lack the stamp (P12 measurement).
 *
 * Safe to re-run: only fills empty stamps; never overwrites.
 */

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { stampFirstBrokerActionIfEmpty } from '@/lib/crm/first-broker-action'

const OUTBOUND = ['call', 'email_out', 'sms_out', 'voicemail', 'mms_out'] as const

export async function backfillFirstBrokerActionStamps(opts?: {
  /** How far back to look for people missing the stamp. Default 30 days. */
  sinceDays?: number
  limit?: number
}): Promise<{ scanned: number; stamped: number }> {
  const sinceDays = Math.min(Math.max(opts?.sinceDays ?? 30, 1), 180)
  const limit = Math.min(Math.max(opts?.limit ?? 200, 1), 1000)
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString()
  const sb = createServiceClient()

  const { data: people, error } = await sb
    .from('crm_people')
    .select('id, custom')
    .eq('deleted', false)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`backfill people read: ${error.message}`)

  let stamped = 0
  let scanned = 0
  for (const p of people ?? []) {
    scanned += 1
    const custom = (p.custom as Record<string, unknown> | null) ?? {}
    if (typeof custom.first_broker_action_at === 'string' && custom.first_broker_action_at) continue

    const { data: events, error: tlErr } = await sb
      .from('crm_timeline')
      .select('kind, ts, broker')
      .eq('person_id', p.id)
      .in('kind', [...OUTBOUND])
      .order('ts', { ascending: true })
      .limit(1)
    if (tlErr || !events?.length) continue

    const e = events[0]!
    const ok = await stampFirstBrokerActionIfEmpty(sb, Number(p.id), {
      kind: String(e.kind),
      at: String(e.ts),
      broker: (e.broker as string | null) ?? null,
    })
    if (ok) stamped += 1
  }

  return { scanned, stamped }
}
