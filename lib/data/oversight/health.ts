import 'server-only'

/**
 * Oversight health reads (P9 roll:oversight, IA lock 2026-08-05).
 *
 * The supervision view's OWN reads: sync freshness, the broker-alert delivery
 * queue, and the principal's sign-off waits. Everything else Oversight renders
 * comes from existing DAL reads (getWorkflowAnalytics, getSpeedToLeadReport,
 * getTaskQueue, getBrokerActionQueue, getCrmSignalFreshness).
 *
 * Every read here fails LOUD into its result shape (`unreadable: true`) rather
 * than returning a healthy-looking zero — an unreadable health surface must
 * never render as "all clear" (§0: unreadable ≠ 0).
 */

import { createServiceClient } from '@/lib/supabase/service'

export interface SyncFreshness {
  lastDeltaAt: string | null
  lastFullAt: string | null
  unreadable: boolean
}

/** sync_state singleton → when the MLS delta/full sync last completed. */
export async function getSyncFreshness(): Promise<SyncFreshness> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('sync_state')
    .select('last_delta_sync_at, last_full_sync_at')
    .eq('id', 'default')
    .maybeSingle()
  if (error) {
    console.error('[oversight] sync_state read failed:', error.message)
    return { lastDeltaAt: null, lastFullAt: null, unreadable: true }
  }
  return {
    lastDeltaAt: (data?.last_delta_sync_at as string | null) ?? null,
    lastFullAt: (data?.last_full_sync_at as string | null) ?? null,
    unreadable: false,
  }
}

export interface AlertQueueHealth {
  pending: number
  oldestPendingAt: string | null
  failed24h: number
  unreadable: boolean
}

/** crm_broker_alerts delivery health: what's queued, what failed today. */
export async function getAlertQueueHealth(nowMs: number = Date.now()): Promise<AlertQueueHealth> {
  const sb = createServiceClient()
  const dayAgo = new Date(nowMs - 24 * 3600_000).toISOString()
  const [pendingRes, failedRes] = await Promise.all([
    sb
      .from('crm_broker_alerts')
      .select('created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(200),
    sb
      .from('crm_broker_alerts')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('created_at', dayAgo),
  ])
  if (pendingRes.error || failedRes.error) {
    console.error(
      '[oversight] alert queue read failed:',
      pendingRes.error?.message ?? failedRes.error?.message,
    )
    return { pending: 0, oldestPendingAt: null, failed24h: 0, unreadable: true }
  }
  const pendingRows = pendingRes.data ?? []
  return {
    pending: pendingRows.length,
    oldestPendingAt: (pendingRows[0]?.created_at as string | undefined) ?? null,
    failed24h: failedRes.count ?? 0,
    unreadable: false,
  }
}

export interface SignoffWaitRow {
  dealId: string
  address: string
  brokerName: string | null
  items: number
}

export interface SignoffWaits {
  deals: SignoffWaitRow[]
  totalItems: number
  unreadable: boolean
}

/** Stages a deal can be in while checklist items still gather PB review. */
const LIVE_STAGES = ['pending', 'pre_contract', 'active_listing']

/**
 * The principal's sign-off backlog: live deals whose checklist items sit in
 * `in_review`. Same join chain the sign-off queue action walks, reduced to the
 * per-deal counts the Oversight attention list needs.
 */
export async function getSignoffWaits(): Promise<SignoffWaits> {
  const sb = createServiceClient()
  const { data: deals, error: dealsErr } = await sb
    .from('tc_deals')
    .select('id, address, broker_name')
    .in('stage', LIVE_STAGES)
  if (dealsErr) {
    console.error('[oversight] tc_deals read failed:', dealsErr.message)
    return { deals: [], totalItems: 0, unreadable: true }
  }
  if (!deals?.length) return { deals: [], totalItems: 0, unreadable: false }

  const dealById = new Map(deals.map((d) => [d.id as string, d]))
  const { data: cycles, error: cyclesErr } = await sb
    .from('tc_cycles')
    .select('id, deal_id')
    .in('deal_id', [...dealById.keys()])
  if (cyclesErr) {
    console.error('[oversight] tc_cycles read failed:', cyclesErr.message)
    return { deals: [], totalItems: 0, unreadable: true }
  }
  if (!cycles?.length) return { deals: [], totalItems: 0, unreadable: false }

  const cycleToDeal = new Map(cycles.map((c) => [c.id as string, c.deal_id as string]))
  const { data: items, error: itemsErr } = await sb
    .from('tc_checklist_items')
    .select('cycle_id')
    .in('cycle_id', [...cycleToDeal.keys()])
    .eq('status', 'in_review')
  if (itemsErr) {
    console.error('[oversight] tc_checklist_items read failed:', itemsErr.message)
    return { deals: [], totalItems: 0, unreadable: true }
  }

  const counts = new Map<string, number>()
  for (const it of items ?? []) {
    const dealId = cycleToDeal.get(it.cycle_id as string)
    if (dealId) counts.set(dealId, (counts.get(dealId) ?? 0) + 1)
  }
  const rows: SignoffWaitRow[] = [...counts.entries()].map(([dealId, n]) => {
    const d = dealById.get(dealId)
    return {
      dealId,
      address: String(d?.address ?? 'Unknown property'),
      brokerName: (d?.broker_name as string | null) ?? null,
      items: n,
    }
  })
  rows.sort((a, b) => b.items - a.items)
  return { deals: rows, totalItems: (items ?? []).length, unreadable: false }
}
