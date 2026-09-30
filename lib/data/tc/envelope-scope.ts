/**
 * Which deal file an envelope, a cycle or a recipient belongs to, named by the
 * file's broker (tc_deals.broker_name). Every envelope and packet action checks
 * it against the caller with dealVisibleToBroker (lib/tc/deal-scope.ts, tc-builder
 * rung 16): the principal broker reaches every file, a broker only their own.
 * Before this, any broker could open, send, edit or void any envelope by id,
 * and mint links to another broker's signed PDFs.
 *
 * Null when the row does not exist, so a caller answers "not found" alike for a
 * missing envelope and one outside its scope.
 */
import { createServiceClient } from '@/lib/supabase/service'

export type DealFileScope = { cycleId: string; brokerName: string | null }

type Embedded<T> = T | T[] | null | undefined

function one<T>(v: Embedded<T>): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null)
}

function brokerOfCycle(cycle: Embedded<{ tc_deals?: Embedded<{ broker_name: string | null }> }>): string | null {
  return one(one(cycle)?.tc_deals)?.broker_name ?? null
}

export async function getCycleScope(cycleId: string): Promise<DealFileScope | null> {
  if (!cycleId?.trim()) return null
  const { data } = await createServiceClient()
    .from('tc_cycles')
    .select('id, tc_deals(broker_name)')
    .eq('id', cycleId)
    .maybeSingle()
  if (!data) return null
  return { cycleId: String(data.id), brokerName: brokerOfCycle(data as never) }
}

export async function getEnvelopeScope(envelopeId: string): Promise<DealFileScope | null> {
  if (!envelopeId?.trim()) return null
  const { data } = await createServiceClient()
    .from('tc_envelopes')
    .select('cycle_id, tc_cycles(tc_deals(broker_name))')
    .eq('id', envelopeId)
    .maybeSingle()
  if (!data) return null
  const row = data as unknown as { cycle_id: string; tc_cycles: Embedded<{ tc_deals?: Embedded<{ broker_name: string | null }> }> }
  return { cycleId: String(row.cycle_id), brokerName: brokerOfCycle(row.tc_cycles) }
}

export async function getRecipientEnvelopeScope(recipientId: string): Promise<DealFileScope | null> {
  if (!recipientId?.trim()) return null
  const { data } = await createServiceClient()
    .from('tc_envelope_recipients')
    .select('envelope_id')
    .eq('id', recipientId)
    .maybeSingle()
  return data?.envelope_id ? getEnvelopeScope(String(data.envelope_id)) : null
}
