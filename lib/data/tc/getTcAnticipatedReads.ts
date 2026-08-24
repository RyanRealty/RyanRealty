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

export type TcAnticipateChecklistItem = {
  id: string
  name: string
  status: string
  assignedDocumentCount: number
}

export type TcAnticipatePresence = {
  checklistItems: TcAnticipateChecklistItem[]
  documents: Array<{ name: string; archived: boolean }>
}

export async function getTcAnticipatePresence(cycleId: string): Promise<TcAnticipatePresence> {
  const sb = createServiceClient()
  const [{ data: items }, { data: docs }] = await Promise.all([
    sb.from('tc_checklist_items').select('id, name, status').eq('cycle_id', cycleId),
    sb.from('tc_documents').select('name, archived').eq('cycle_id', cycleId),
  ])
  const baseItems = (items ?? []).map((row: { id?: string; name?: string; status?: string }) => ({
    id: String(row.id ?? ''),
    name: String(row.name ?? ''),
    status: String(row.status ?? ''),
  }))
  const assignedCount = new Map<string, number>()
  if (baseItems.length) {
    const { data: assigned } = await sb
      .from('tc_checklist_assignments')
      .select('item_id')
      .in(
        'item_id',
        baseItems.map((i) => i.id),
      )
    for (const row of assigned ?? []) {
      const id = String((row as { item_id?: string }).item_id ?? '')
      if (!id) continue
      assignedCount.set(id, (assignedCount.get(id) ?? 0) + 1)
    }
  }
  return {
    checklistItems: baseItems.map((i) => ({
      ...i,
      assignedDocumentCount: assignedCount.get(i.id) ?? 0,
    })),
    documents: (docs ?? []).map((row: { name?: string; archived?: boolean }) => ({
      name: String(row.name ?? ''),
      archived: row.archived === true,
    })),
  }
}
