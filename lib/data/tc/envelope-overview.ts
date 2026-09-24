import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'
import { isSignableRole } from '@/lib/tc/signing'

/**
 * Envelopes still out for signature, for the transactions dashboard's Needs
 * you list: who has signed of the people who must, when it went out, and the
 * file it belongs to (with its broker, so the page can scope it).
 */
export type OutstandingEnvelope = {
  id: string
  name: string
  status: string
  sentAt: string | null
  dealKey: string | null
  dealAddress: string | null
  brokerName: string | null
  recipientCount: number
  signedCount: number
}

const OPEN = ['sent', 'partially_signed', 'awaiting_other_side']

export async function listOutstandingEnvelopes(): Promise<OutstandingEnvelope[]> {
  const sb = createServiceClient()
  const { data: envs, error } = await sb
    .from('tc_envelopes')
    .select('id, name, status, sent_at, tc_cycles(tc_deals(address, property_key, broker_name))')
    .in('status', OPEN)
    .order('sent_at', { ascending: true })
    .limit(100)
  if (error) {
    console.error('[envelope-overview] tc_envelopes read failed:', error.message)
    return []
  }
  const rows = (envs ?? []) as unknown as Array<{
    id: string
    name: string
    status: string
    sent_at: string | null
    tc_cycles: { tc_deals: { address: string | null; property_key: string | null; broker_name: string | null } | null } | null
  }>
  if (!rows.length) return []
  const { data: recips } = await sb
    .from('tc_envelope_recipients')
    .select('envelope_id, role, action_required, completed_at')
    .in('envelope_id', rows.map((r) => r.id))
  const byEnv = new Map<string, { total: number; signed: number }>()
  for (const r of (recips ?? []) as Array<{ envelope_id: string; role: string | null; action_required: string | null; completed_at: string | null }>) {
    if (!isSignableRole(r.role, r.action_required)) continue
    const c = byEnv.get(r.envelope_id) ?? { total: 0, signed: 0 }
    c.total++
    if (r.completed_at) c.signed++
    byEnv.set(r.envelope_id, c)
  }
  return rows.map((e) => {
    const deal = e.tc_cycles?.tc_deals ?? null
    const c = byEnv.get(e.id) ?? { total: 0, signed: 0 }
    return {
      id: e.id,
      name: e.name,
      status: e.status,
      sentAt: e.sent_at,
      dealKey: deal?.property_key ?? null,
      dealAddress: deal?.address ?? null,
      brokerName: deal?.broker_name ?? null,
      recipientCount: c.total,
      signedCount: c.signed,
    }
  })
}
