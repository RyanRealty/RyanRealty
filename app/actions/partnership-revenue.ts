'use server'

import { createClient } from '@supabase/supabase-js'

function serviceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createClient(url, key)
}

export async function recordPartnerReferral(input: {
  partnerSlug: 'lender_referral' | 'relocation_referral' | 'annual_report_sponsorship' | 'vendor_membership'
  leadSource: string
  leadIdentifier?: string | null
  campaignSource?: string | null
  campaignMedium?: string | null
  estimatedValue?: number | null
  notes?: string | null
}) {
  const supabase = serviceSupabase()
  if (!supabase) return { ok: false, error: 'Supabase service not configured' }

  const { error } = await supabase.from('partner_referrals').insert({
    partner_slug: input.partnerSlug,
    lead_source: input.leadSource,
    lead_identifier: input.leadIdentifier ?? null,
    campaign_source: input.campaignSource ?? null,
    campaign_medium: input.campaignMedium ?? null,
    estimated_value: input.estimatedValue ?? null,
    notes: input.notes ?? null,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export type RevenueDashboardData = {
  revenueLast30d: number
  partnerPipelineValue: number
  partnerReferralsLast30d: number
  leadsLast30d: number
  leadsBySource: Array<{ source: string; count: number }>
  revenueByPageCluster: Array<{ pageCluster: string; amount: number }>
}

export async function getRevenueDashboardData(): Promise<RevenueDashboardData> {
  const supabase = serviceSupabase()
  if (!supabase) {
    return {
      revenueLast30d: 0,
      partnerPipelineValue: 0,
      partnerReferralsLast30d: 0,
      leadsLast30d: 0,
      leadsBySource: [],
      revenueByPageCluster: [],
    }
  }

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 30)
  const startIso = startDate.toISOString()
  const startDateOnly = startIso.slice(0, 10)

  const [revenueRes, referralsRes, visitsRes] = await Promise.all([
    supabase
      .from('revenue_events')
      .select('amount, page_cluster')
      .gte('event_date', startDateOnly),
    supabase
      .from('partner_referrals')
      .select('estimated_value, lead_source')
      .gte('created_at', startIso),
    supabase
      .from('visits')
      .select('path')
      .gte('created_at', startIso),
  ])

  const revenueRows = (revenueRes.data ?? []) as Array<{ amount?: number; page_cluster?: string | null }>
  const referralRows = (referralsRes.data ?? []) as Array<{ estimated_value?: number | null; lead_source?: string | null }>
  const visitRows = (visitsRes.data ?? []) as Array<{ path?: string | null }>

  const revenueLast30d = revenueRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
  const partnerPipelineValue = referralRows.reduce((sum, row) => sum + (Number(row.estimated_value) || 0), 0)
  const partnerReferralsLast30d = referralRows.length
  const leadsLast30d = visitRows.length

  const leadsBySourceMap = new Map<string, number>()
  for (const row of referralRows) {
    const source = row.lead_source?.trim() || 'unknown'
    leadsBySourceMap.set(source, (leadsBySourceMap.get(source) ?? 0) + 1)
  }

  const revenueByClusterMap = new Map<string, number>()
  for (const row of revenueRows) {
    const cluster = row.page_cluster?.trim() || 'unknown'
    revenueByClusterMap.set(cluster, (revenueByClusterMap.get(cluster) ?? 0) + (Number(row.amount) || 0))
  }

  return {
    revenueLast30d,
    partnerPipelineValue,
    partnerReferralsLast30d,
    leadsLast30d,
    leadsBySource: [...leadsBySourceMap.entries()]
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count),
    revenueByPageCluster: [...revenueByClusterMap.entries()]
      .map(([pageCluster, amount]) => ({ pageCluster, amount }))
      .sort((a, b) => b.amount - a.amount),
  }
}
