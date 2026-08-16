/**
 * Stage GBP review-ask drafts for recently closed TC deals.
 *
 * tc_deals.stage is SkySlope-sourced (read-only here — no SkySlope writes).
 * When a deal shows closed with an actual close in the last 14 days, each
 * buyer/seller party gets a draft if they do not already have one.
 */
import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { stageReviewAskDraft } from '@/lib/data/crm/stageReviewAskDraft'

const WINDOW_DAYS = 14

export type RecentCloseAskSummary = {
  dealsScanned: number
  partiesConsidered: number
  created: number
  already: number
  skippedExisting: number
  errors: number
}

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function slugFromBrokerName(name: string | null, roster: Array<{ name: string; slug: string }>): string | null {
  const n = (name ?? '').trim().toLowerCase()
  if (!n) return null
  const hit = roster.find((b) => n.includes(b.name.toLowerCase()) || b.name.toLowerCase().includes(n))
  return hit?.slug ?? null
}

export async function stageReviewAsksForRecentCloses(): Promise<RecentCloseAskSummary> {
  const sb = createServiceClient()
  const since = isoDaysAgo(WINDOW_DAYS)
  const summary: RecentCloseAskSummary = {
    dealsScanned: 0,
    partiesConsidered: 0,
    created: 0,
    already: 0,
    skippedExisting: 0,
    errors: 0,
  }

  const { data: deals, error: dealErr } = await sb
    .from('tc_deals')
    .select('id, address, broker_name, stage')
    .eq('stage', 'closed')
  if (dealErr) {
    console.error('[stageReviewAsksForRecentCloses] tc_deals', dealErr.message)
    return summary
  }
  const closed = deals ?? []
  if (closed.length === 0) return summary

  const dealIds = closed.map((d) => d.id as string)
  const { data: cycles, error: cycleErr } = await sb
    .from('tc_cycles')
    .select('deal_id, actual_closing_date, created_at')
    .in('deal_id', dealIds)
  if (cycleErr) {
    console.error('[stageReviewAsksForRecentCloses] tc_cycles', cycleErr.message)
    return summary
  }

  const newestClose = new Map<string, string | null>()
  for (const c of cycles ?? []) {
    const id = String(c.deal_id)
    const prev = newestClose.get(id)
    const stamp = (c.actual_closing_date as string | null) ?? (c.created_at as string | null)
    if (!prev || String(stamp ?? '') > prev) newestClose.set(id, stamp ?? null)
  }

  const recent = closed.filter((d) => {
    const stamp = newestClose.get(String(d.id))
    if (!stamp) return false
    return stamp.slice(0, 10) >= since
  })
  summary.dealsScanned = recent.length
  if (recent.length === 0) return summary

  const { data: brokers } = await sb
    .from('brokers')
    .select('display_name, crm_slug')
    .eq('crm_active', true)
  const roster = (brokers ?? [])
    .map((b) => ({ name: String(b.display_name ?? ''), slug: String(b.crm_slug ?? '') }))
    .filter((b) => b.name && b.slug)

  const { data: parties, error: partyErr } = await sb
    .from('tc_deal_people')
    .select('deal_id, person_id, role')
    .in(
      'deal_id',
      recent.map((d) => d.id),
    )
    .in('role', ['buyer', 'seller'])
  if (partyErr) {
    console.error('[stageReviewAsksForRecentCloses] tc_deal_people', partyErr.message)
    return summary
  }

  const byDeal = new Map(recent.map((d) => [String(d.id), d]))
  for (const p of parties ?? []) {
    const deal = byDeal.get(String(p.deal_id))
    const personId = Number(p.person_id)
    if (!deal || !Number.isFinite(personId) || personId <= 0) continue
    summary.partiesConsidered += 1
    const staged = await stageReviewAskDraft({
      personId,
      brokerSlug: slugFromBrokerName((deal.broker_name as string | null) ?? null, roster),
      address: (deal.address as string | null) ?? null,
    })
    if (!staged.ok) {
      summary.errors += 1
      console.error('[stageReviewAsksForRecentCloses] draft', staged.error)
      continue
    }
    if (staged.action === 'created') summary.created += 1
    else if (staged.action === 'already') summary.already += 1
    else summary.skippedExisting += 1
  }
  return summary
}
