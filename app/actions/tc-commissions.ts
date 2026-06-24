'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { computeCommissionNets } from '@/lib/tc/commission-math'

/**
 * Commission tracking (TC rung 11) — per-cycle, per-agent commission records.
 * Figures originate settlement-verified (SkySlope migration backfill keyed to
 * office gross) or as projections on open deals. Commission figures trace to
 * closing statements the brokerage retains per OAR 863-015-0250 / -0260.
 * Every mutation appends a tc_events row.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- PostgREST rows narrow at mapping sites
type DbRow = Record<string, any>

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) throw new Error('Supabase service role not configured')
  return createClient(url, key, { auth: { persistSession: false } })
}

export type TcCommission = {
  id: string
  cycle_id: string
  broker_slug: string | null
  broker_name: string
  side: 'listing' | 'buyer' | 'both' | 'unknown'
  basis: 'percent' | 'flat'
  commission_percent: number | null
  gci: number | null
  referral_fee: number
  tc_fee: number
  other_deductions: number
  split_percent: number
  agent_net: number | null
  brokerage_net: number | null
  status: 'projected' | 'settlement_verified' | 'paid'
  paid_at: string | null
  notes: string | null
}

function mapRow(r: DbRow): TcCommission {
  return {
    id: r.id,
    cycle_id: r.cycle_id,
    broker_slug: r.broker_slug,
    broker_name: r.broker_name,
    side: r.side,
    basis: r.basis,
    commission_percent: r.commission_percent == null ? null : Number(r.commission_percent),
    gci: r.gci == null ? null : Number(r.gci),
    referral_fee: Number(r.referral_fee ?? 0),
    tc_fee: Number(r.tc_fee ?? 0),
    other_deductions: Number(r.other_deductions ?? 0),
    split_percent: Number(r.split_percent ?? 100),
    agent_net: r.agent_net == null ? null : Number(r.agent_net),
    brokerage_net: r.brokerage_net == null ? null : Number(r.brokerage_net),
    status: r.status,
    paid_at: r.paid_at,
    notes: r.notes,
  }
}

/** Commission rows for a set of cycles (deal page). */
export async function getCommissionsForCycles(cycleIds: string[]): Promise<TcCommission[]> {
  if (!cycleIds.length) return []
  const supabase = getServiceSupabase()
  const { data } = await supabase.from('tc_commissions').select('*').in('cycle_id', cycleIds)
  return ((data ?? []) as DbRow[]).map(mapRow)
}

export type TcCommissionRollupRow = TcCommission & {
  address: string | null
  property_key: string | null
  cycle_status: string | null
  sale_price: number | null
  closing_date: string | null
}

/** Every commission row joined to its deal, for /admin/commissions. */
export async function getCommissionsRollup(): Promise<TcCommissionRollupRow[]> {
  const supabase = getServiceSupabase()
  const { data } = await supabase
    .from('tc_commissions')
    .select('*, tc_cycles(status, sale_price, actual_closing_date, escrow_closing_date, tc_deals(address, property_key))')
    .order('created_at', { ascending: false })
  return ((data ?? []) as DbRow[]).map((r) => ({
    ...mapRow(r),
    address: r.tc_cycles?.tc_deals?.address ?? null,
    property_key: r.tc_cycles?.tc_deals?.property_key ?? null,
    cycle_status: r.tc_cycles?.status ?? null,
    sale_price: r.tc_cycles?.sale_price == null ? null : Number(r.tc_cycles.sale_price),
    closing_date: r.tc_cycles?.actual_closing_date ?? r.tc_cycles?.escrow_closing_date ?? null,
  }))
}

const COMMISSION_STATUSES = ['projected', 'settlement_verified', 'paid'] as const
const COMMISSION_SIDES = ['listing', 'buyer', 'both', 'unknown'] as const

export type TcCommissionPatch = {
  side?: (typeof COMMISSION_SIDES)[number]
  commission_percent?: number | null
  referral_fee?: number
  tc_fee?: number
  other_deductions?: number
  split_percent?: number
  status?: (typeof COMMISSION_STATUSES)[number]
  paid_at?: string | null
  notes?: string | null
}

/**
 * Correct a commission row (split, fees, status, side, paid date). Nets are
 * recomputed server-side from gci - fees so they can never drift from the
 * inputs. Appends a tc_events row with the before/after diff.
 */
export async function updateTcCommission(
  id: string,
  patch: TcCommissionPatch
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession()
  const role = await getAdminRoleForEmail(session?.user?.email ?? null)
  if (!role || (role.role !== 'superuser' && role.role !== 'broker')) {
    return { ok: false, error: 'Not authorized' }
  }
  if (patch.status && !COMMISSION_STATUSES.includes(patch.status)) return { ok: false, error: 'Invalid status' }
  if (patch.side && !COMMISSION_SIDES.includes(patch.side)) return { ok: false, error: 'Invalid side' }
  for (const k of ['referral_fee', 'tc_fee', 'other_deductions', 'split_percent'] as const) {
    const v = patch[k]
    if (v != null && (!Number.isFinite(v) || v < 0)) return { ok: false, error: `Invalid ${k.replace('_', ' ')}` }
  }
  if (patch.split_percent != null && patch.split_percent > 100) return { ok: false, error: 'Split cannot exceed 100%' }

  const supabase = getServiceSupabase()
  const { data: row } = await supabase
    .from('tc_commissions')
    .select('*, tc_cycles(deal_id)')
    .eq('id', id)
    .maybeSingle()
  if (!row) return { ok: false, error: 'Commission row not found' }

  const next = {
    side: patch.side ?? row.side,
    commission_percent: patch.commission_percent === undefined ? row.commission_percent : patch.commission_percent,
    referral_fee: patch.referral_fee ?? Number(row.referral_fee ?? 0),
    tc_fee: patch.tc_fee ?? Number(row.tc_fee ?? 0),
    other_deductions: patch.other_deductions ?? Number(row.other_deductions ?? 0),
    split_percent: patch.split_percent ?? Number(row.split_percent ?? 100),
    status: patch.status ?? row.status,
    paid_at: patch.paid_at === undefined ? row.paid_at : patch.paid_at,
    notes: patch.notes === undefined ? row.notes : patch.notes,
  }

  const gci = row.gci == null ? null : Number(row.gci)
  const { agentNet: agent_net, brokerageNet: brokerage_net } = computeCommissionNets({
    gci,
    referralFee: next.referral_fee,
    tcFee: next.tc_fee,
    otherDeductions: next.other_deductions,
    splitPercent: next.split_percent,
  })

  const { error: upErr } = await supabase
    .from('tc_commissions')
    .update({ ...next, agent_net, brokerage_net, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (upErr) return { ok: false, error: upErr.message }

  const changed: Record<string, { from: unknown; to: unknown }> = {}
  for (const k of Object.keys(next) as Array<keyof typeof next>) {
    const before = row[k] == null ? null : typeof next[k] === 'number' ? Number(row[k]) : row[k]
    if (before !== next[k]) changed[k] = { from: before, to: next[k] }
  }

  await supabase.from('tc_events').insert({
    deal_id: (row as DbRow).tc_cycles?.deal_id ?? null,
    cycle_id: row.cycle_id,
    actor: session?.user?.email ?? 'admin',
    action: 'commission_updated',
    detail: { broker: row.broker_name, changed, agent_net, brokerage_net },
  })

  revalidatePath('/admin/deals')
  revalidatePath('/admin/commissions')
  return { ok: true }
}
