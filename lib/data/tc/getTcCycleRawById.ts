import { createServiceClient } from '@/lib/data/client'

export async function getTcCycleRawById(cycleId: string): Promise<{
  id: string
  deal_id: string
  raw: unknown
} | null> {
  const { data } = await createServiceClient()
    .from('tc_cycles')
    .select('id, deal_id, raw')
    .eq('id', cycleId)
    .maybeSingle()
  if (!data) return null
  return { id: String(data.id), deal_id: String(data.deal_id), raw: data.raw }
}
