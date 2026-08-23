import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'
import { getAdminContext } from '@/lib/auth/guards'
import { reviewDeadline, type ReviewDeadline } from '@/lib/tc/banking-days'

type DbRow = Record<string, unknown>

const LIVE_STAGES = ['pending', 'pre_contract', 'active_listing']

export type SignOffItem = {
  itemId: string
  name: string
  docs: Array<{ id: string; name: string; thumbUrl: string | null }>
  deadline: ReviewDeadline | null
}

export type SignOffDeal = {
  propertyKey: string
  address: string
  broker: string | null
  stage: string
  cycleKind: string
  items: SignOffItem[]
}

export type SignOffQueue = {
  authorized: boolean
  deals: SignOffDeal[]
  totalItems: number
  overdueItems: number
}

export async function getPrincipalSignOffQueue(): Promise<SignOffQueue> {
  const ctx = await getAdminContext()
  if (ctx?.role !== 'superuser') {
    return { authorized: false, deals: [], totalItems: 0, overdueItems: 0 }
  }

  const supabase = createServiceClient()
  const now = new Date()

  const { data: deals } = await supabase
    .from('tc_deals')
    .select('id, property_key, address, broker_name, stage')
    .in('stage', LIVE_STAGES)
  if (!deals?.length) return { authorized: true, deals: [], totalItems: 0, overdueItems: 0 }

  const dealById = new Map((deals as DbRow[]).map((d) => [d.id, d]))
  const { data: cycles } = await supabase
    .from('tc_cycles')
    .select('id, deal_id, kind, contract_acceptance_date')
    .in('deal_id', Array.from(dealById.keys()))
  const cycleById = new Map((cycles ?? []).map((c: DbRow) => [c.id, c]))
  const cycleIds = (cycles ?? []).map((c: DbRow) => c.id)
  if (!cycleIds.length) return { authorized: true, deals: [], totalItems: 0, overdueItems: 0 }

  const { data: items } = await supabase
    .from('tc_checklist_items')
    .select('id, cycle_id, name, sort_order')
    .in('cycle_id', cycleIds)
    .eq('status', 'in_review')
    .order('sort_order', { ascending: true })
  if (!items?.length) return { authorized: true, deals: [], totalItems: 0, overdueItems: 0 }

  const itemIds = (items as DbRow[]).map((i) => i.id)
  const { data: assignments } = await supabase
    .from('tc_checklist_assignments')
    .select('item_id, document_id')
    .in('item_id', itemIds)
  const docIds = Array.from(new Set((assignments ?? []).map((a: DbRow) => a.document_id)))
  const { data: docs } = docIds.length
    ? await supabase.from('tc_documents').select('id, name').in('id', docIds)
    : { data: [] as DbRow[] }
  const docById = new Map((docs ?? []).map((d: DbRow) => [d.id, d]))

  const thumbPaths = docIds.map((id) => `tc-thumbs/${id}__plast.jpg`)
  const thumbByPath = new Map<string, string>()
  if (thumbPaths.length) {
    const { data: signed } = await supabase.storage.from('tc-documents').createSignedUrls(thumbPaths, 600)
    for (const s of signed ?? []) if (s.signedUrl && !s.error) thumbByPath.set(s.path ?? '', s.signedUrl)
  }

  const docsByItem = new Map<string, Array<{ id: string; name: string; thumbUrl: string | null }>>()
  for (const a of (assignments ?? []) as DbRow[]) {
    const d = docById.get(a.document_id)
    if (!d) continue
    const arr = docsByItem.get(a.item_id) ?? []
    arr.push({
      id: d.id as string,
      name: d.name as string,
      thumbUrl: thumbByPath.get(`tc-thumbs/${d.id}__plast.jpg`) ?? null,
    })
    docsByItem.set(a.item_id as string, arr)
  }

  const byDeal = new Map<string, SignOffDeal>()
  for (const it of items as DbRow[]) {
    const cyc = cycleById.get(it.cycle_id)
    if (!cyc) continue
    const deal = dealById.get(cyc.deal_id)
    if (!deal) continue
    const key = String(deal.property_key)
    if (!byDeal.has(key)) {
      byDeal.set(key, {
        propertyKey: String(deal.property_key),
        address: String(deal.address),
        broker: deal.broker_name == null ? null : String(deal.broker_name),
        stage: String(deal.stage),
        cycleKind: String(cyc.kind),
        items: [],
      })
    }
    byDeal.get(key)!.items.push({
      itemId: String(it.id),
      name: String(it.name),
      docs: docsByItem.get(String(it.id)) ?? [],
      deadline: reviewDeadline(
        cyc.contract_acceptance_date == null ? null : String(cyc.contract_acceptance_date),
        now,
      ),
    })
  }

  const dealsOut = Array.from(byDeal.values())
    .map((d) => ({
      ...d,
      items: d.items.sort(
        (a, b) => (a.deadline?.bankingDaysRemaining ?? 9999) - (b.deadline?.bankingDaysRemaining ?? 9999),
      ),
    }))
    .sort((a, b) => {
      const am = Math.min(...a.items.map((i) => i.deadline?.bankingDaysRemaining ?? 9999))
      const bm = Math.min(...b.items.map((i) => i.deadline?.bankingDaysRemaining ?? 9999))
      return am - bm
    })
  const totalItems = dealsOut.reduce((s, d) => s + d.items.length, 0)
  const overdueItems = dealsOut.reduce((s, d) => s + d.items.filter((i) => i.deadline?.overdue).length, 0)
  return { authorized: true, deals: dealsOut, totalItems, overdueItems }
}
