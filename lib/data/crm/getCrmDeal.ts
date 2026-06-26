import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'

export type CrmDealSplit = {
  id: number
  deal_id: number
  broker_slug: string
  split_pct: number
  split_dollars: number | null
  notes: string | null
  created_at: string
}

export type CrmDealFile = {
  id: number
  deal_id: number
  name: string
  storage_path: string | null
  url: string | null
  uploaded_by: string | null
  created_at: string
}

export type CrmDealDetail = {
  id: number
  name: string | null
  pipeline: string | null
  stage: string | null
  status: string | null
  value: number | null
  entered_stage_at: string | null
  person_id: number | null
  listing_key: string | null
  // New columns
  close_date: string | null
  earnest_money_due: string | null
  mutual_acceptance: string | null
  due_diligence: string | null
  final_walkthrough: string | null
  possession: string | null
  commission_dollars: number | null
  commission_percent: number | null
  description: string | null
  property_address: string | null
  assigned_broker: string | null
  // Relations
  person: { id: number; name: string | null; assigned_broker: string | null } | null
  splits: CrmDealSplit[]
  files: CrmDealFile[]
}

async function _getCrmDeal(id: number): Promise<CrmDealDetail | null> {
  const sb = createServiceClient()
  const [dealRes, splitsRes, filesRes] = await Promise.all([
    sb
      .from('crm_deals')
      .select(
        'id,name,pipeline,stage,status,value,entered_stage_at,person_id,listing_key,' +
          'close_date,earnest_money_due,mutual_acceptance,due_diligence,final_walkthrough,possession,' +
          'commission_dollars,commission_percent,description,property_address,assigned_broker,' +
          'crm_people(id,name,assigned_broker)',
      )
      .eq('id', id)
      .maybeSingle(),
    sb
      .from('crm_deal_splits')
      .select('id,deal_id,broker_slug,split_pct,split_dollars,notes,created_at')
      .eq('deal_id', id)
      .order('created_at'),
    sb
      .from('crm_deal_files')
      .select('id,deal_id,name,storage_path,url,uploaded_by,created_at')
      .eq('deal_id', id)
      .order('created_at'),
  ])

  if (!dealRes.data) return null

  const raw = dealRes.data as unknown as Record<string, unknown> & {
    crm_people: { id: number; name: string | null; assigned_broker: string | null } | null
  }

  return {
    id: raw.id as number,
    name: (raw.name as string | null) ?? null,
    pipeline: (raw.pipeline as string | null) ?? null,
    stage: (raw.stage as string | null) ?? null,
    status: (raw.status as string | null) ?? null,
    value: (raw.value as number | null) ?? null,
    entered_stage_at: (raw.entered_stage_at as string | null) ?? null,
    person_id: (raw.person_id as number | null) ?? null,
    listing_key: (raw.listing_key as string | null) ?? null,
    close_date: (raw.close_date as string | null) ?? null,
    earnest_money_due: (raw.earnest_money_due as string | null) ?? null,
    mutual_acceptance: (raw.mutual_acceptance as string | null) ?? null,
    due_diligence: (raw.due_diligence as string | null) ?? null,
    final_walkthrough: (raw.final_walkthrough as string | null) ?? null,
    possession: (raw.possession as string | null) ?? null,
    commission_dollars: (raw.commission_dollars as number | null) ?? null,
    commission_percent: (raw.commission_percent as number | null) ?? null,
    description: (raw.description as string | null) ?? null,
    property_address: (raw.property_address as string | null) ?? null,
    assigned_broker: (raw.assigned_broker as string | null) ?? null,
    person: raw.crm_people ?? null,
    splits: (splitsRes.data ?? []) as CrmDealSplit[],
    files: (filesRes.data ?? []) as CrmDealFile[],
  }
}

export const getCrmDeal = unstable_cache(
  _getCrmDeal,
  ['crm-deal-detail'],
  { revalidate: 30, tags: ['crm-deal-detail'] },
)
