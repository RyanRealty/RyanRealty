import { createServiceClient } from '@/lib/data/client'

export async function getTcDealContactRoles(dealId: string): Promise<string[]> {
  const { data } = await createServiceClient()
    .from('tc_deal_contacts')
    .select('role')
    .eq('deal_id', dealId)
  return (data ?? []).map((row: { role?: string }) => String(row.role ?? ''))
}

export async function getTcCycleReferralFeeTotal(cycleId: string): Promise<number> {
  const { data } = await createServiceClient()
    .from('tc_commissions')
    .select('referral_fee')
    .eq('cycle_id', cycleId)
  return (data ?? []).reduce(
    (sum: number, row: { referral_fee?: number }) => sum + Number(row.referral_fee ?? 0),
    0,
  )
}

export async function getTcChecklistItemNames(cycleId: string): Promise<string[]> {
  const { data } = await createServiceClient()
    .from('tc_checklist_items')
    .select('name')
    .eq('cycle_id', cycleId)
  return (data ?? []).map((row: { name?: string }) => String(row.name ?? ''))
}
