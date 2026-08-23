import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'

export type EnvelopeSigningRosterRow = {
  role: string
  action_required: string | null
  signing_order: number
  completed_at: string | null
}

/** Signing-order roster for ordered routing. G1: raw read lives here. */
export async function listEnvelopeSigningRoster(envelopeId: string): Promise<EnvelopeSigningRosterRow[]> {
  const { data, error } = await createServiceClient()
    .from('tc_envelope_recipients')
    .select('role, action_required, signing_order, completed_at')
    .eq('envelope_id', envelopeId)
  if (error) {
    console.error('[listEnvelopeSigningRoster]', error.message)
    return []
  }
  return (data ?? []).map((r) => ({
    role: String(r.role ?? ''),
    action_required: r.action_required == null ? null : String(r.action_required),
    signing_order: Number(r.signing_order ?? 1) || 1,
    completed_at: r.completed_at == null ? null : String(r.completed_at),
  }))
}
