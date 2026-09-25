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

export type EnvelopeAddressRow = {
  id: string
  name: string | null
  email: string | null
  role: string | null
  action_required: string | null
  completed_at: string | null
  declined_at: string | null
}

/** Who is on an envelope and at which address: a couple sharing one inbox is told so. */
export async function listEnvelopeAddressBook(envelopeId: string): Promise<EnvelopeAddressRow[]> {
  const { data, error } = await createServiceClient()
    .from('tc_envelope_recipients')
    .select('id, name, email, role, action_required, completed_at, declined_at')
    .eq('envelope_id', envelopeId)
  if (error) {
    console.error('[listEnvelopeAddressBook]', error.message)
    return []
  }
  return (data ?? []).map((r) => ({
    id: String(r.id),
    name: r.name == null ? null : String(r.name),
    email: r.email == null ? null : String(r.email),
    role: r.role == null ? null : String(r.role),
    action_required: r.action_required == null ? null : String(r.action_required),
    completed_at: r.completed_at == null ? null : String(r.completed_at),
    declined_at: r.declined_at == null ? null : String(r.declined_at),
  }))
}
