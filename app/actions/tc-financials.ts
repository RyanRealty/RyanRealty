'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { TC_EXPENSE_CATEGORIES, type TcExpenseCategory } from '@/lib/tc/expense-categories'

/**
 * Brokerage financials (TC rung 12) — revenue from tc_commissions
 * (settlement-verified + paid only), expenses from tc_expenses, plus the
 * auto ads-spend line from marketing_channel_daily so the P&L reflects the
 * real ad ledger without manual double entry. Records duty: OAR 863-015-0250
 * (vouchers / bills / client expenses are retained transaction records).
 * Every mutation appends a tc_events row; delete = archive.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- PostgREST rows narrow at mapping sites
type DbRow = Record<string, any>

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) throw new Error('Supabase service role not configured')
  return createClient(url, key, { auth: { persistSession: false } })
}

async function requireBrokerRole(): Promise<{ email: string } | { error: string }> {
  const session = await getSession()
  const email = session?.user?.email ?? null
  const role = await getAdminRoleForEmail(email)
  if (!email || !role || (role.role !== 'superuser' && role.role !== 'broker')) {
    return { error: 'Not authorized' }
  }
  return { email }
}


export type TcExpense = {
  id: string
  deal_id: string | null
  deal_address: string | null
  deal_property_key: string | null
  broker_slug: string | null
  category: TcExpenseCategory
  description: string
  vendor: string | null
  amount: number
  incurred_on: string
  archived: boolean
  created_by: string | null
}

export type TcFinancialsYear = {
  year: string
  gci: number
  agentShare: number
  brokerageRetained: number
  expensesByCategory: Record<string, number>
  manualExpenses: number
  adsSpend: number
  totalExpenses: number
  net: number
  closings: number
}

export type TcFinancials = {
  years: TcFinancialsYear[]
  expenses: TcExpense[]
}

/** The P&L: per-year revenue (verified commissions), expenses, ads spend, net. */
export async function getTcFinancials(): Promise<TcFinancials> {
  const supabase = getServiceSupabase()
  const [{ data: commissions }, { data: expenses }, { data: ads }] = await Promise.all([
    supabase
      .from('tc_commissions')
      .select('gci, agent_net, brokerage_net, status, tc_cycles(actual_closing_date, escrow_closing_date)')
      .in('status', ['settlement_verified', 'paid']),
    supabase
      .from('tc_expenses')
      .select('*, tc_deals(address, property_key)')
      .order('incurred_on', { ascending: false }),
    supabase
      .from('marketing_channel_daily')
      .select('date, value')
      .eq('metric', 'spend')
      .eq('scope', 'account'),
  ])

  const years = new Map<string, TcFinancialsYear>()
  const yearOf = (d: string | null | undefined) => (d ? String(d).slice(0, 4) : null)
  const bucket = (year: string): TcFinancialsYear => {
    const b = years.get(year) ?? {
      year,
      gci: 0,
      agentShare: 0,
      brokerageRetained: 0,
      expensesByCategory: {},
      manualExpenses: 0,
      adsSpend: 0,
      totalExpenses: 0,
      net: 0,
      closings: 0,
    }
    years.set(year, b)
    return b
  }

  for (const r of (commissions ?? []) as DbRow[]) {
    const year = yearOf(r.tc_cycles?.actual_closing_date ?? r.tc_cycles?.escrow_closing_date)
    if (!year) continue
    const b = bucket(year)
    b.gci += Number(r.gci ?? 0)
    b.agentShare += Number(r.agent_net ?? 0)
    b.brokerageRetained += Number(r.brokerage_net ?? 0)
    b.closings += 1
  }

  const expenseRows: TcExpense[] = ((expenses ?? []) as DbRow[]).map((e) => ({
    id: e.id,
    deal_id: e.deal_id,
    deal_address: e.tc_deals?.address ?? null,
    deal_property_key: e.tc_deals?.property_key ?? null,
    broker_slug: e.broker_slug,
    category: e.category,
    description: e.description,
    vendor: e.vendor,
    amount: Number(e.amount),
    incurred_on: e.incurred_on,
    archived: e.archived,
    created_by: e.created_by,
  }))

  for (const e of expenseRows) {
    if (e.archived) continue
    const year = yearOf(e.incurred_on)
    if (!year) continue
    const b = bucket(year)
    b.expensesByCategory[e.category] = (b.expensesByCategory[e.category] ?? 0) + e.amount
    b.manualExpenses += e.amount
  }

  for (const a of (ads ?? []) as DbRow[]) {
    const year = yearOf(a.date)
    if (!year) continue
    bucket(year).adsSpend += Number(a.value ?? 0)
  }

  for (const b of years.values()) {
    b.totalExpenses = b.manualExpenses + b.adsSpend
    b.net = b.brokerageRetained - b.totalExpenses
  }

  return {
    years: [...years.values()].sort((a, b) => b.year.localeCompare(a.year)),
    expenses: expenseRows,
  }
}

const CATEGORY_VALUES = TC_EXPENSE_CATEGORIES.map((c) => c.value) as string[]

export async function addTcExpense(input: {
  category: string
  description: string
  amount: number
  incurred_on: string
  vendor?: string | null
  dealPropertyKey?: string | null
}): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireBrokerRole()
  if ('error' in auth) return { ok: false, error: auth.error }

  const { category, description, amount, incurred_on, vendor, dealPropertyKey } = input
  if (!CATEGORY_VALUES.includes(category)) return { ok: false, error: 'Pick a category' }
  if (!description.trim()) return { ok: false, error: 'Describe the expense' }
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'Amount must be a positive number' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(incurred_on)) return { ok: false, error: 'Pick the date it was incurred' }

  const supabase = getServiceSupabase()
  let dealId: string | null = null
  if (dealPropertyKey?.trim()) {
    const { data: deal } = await supabase
      .from('tc_deals')
      .select('id')
      .eq('property_key', dealPropertyKey.trim())
      .maybeSingle()
    if (!deal) return { ok: false, error: `No deal found for "${dealPropertyKey.trim()}"` }
    dealId = deal.id
  }

  const { data: inserted, error: insErr } = await supabase
    .from('tc_expenses')
    .insert({
      deal_id: dealId,
      category,
      description: description.trim(),
      vendor: vendor?.trim() || null,
      amount,
      incurred_on,
      created_by: auth.email,
      source: { origin: 'manual_entry', entered_by: auth.email },
    })
    .select('id')
    .single()
  if (insErr) return { ok: false, error: insErr.message }

  await supabase.from('tc_events').insert({
    deal_id: dealId,
    actor: auth.email,
    action: 'expense_recorded',
    detail: { expense_id: inserted.id, category, description: description.trim(), amount, incurred_on },
  })

  revalidatePath('/admin/financials')
  return { ok: true }
}

/** Delete = archive (stays inside the records window, drops out of the P&L). */
export async function archiveTcExpense(id: string, reason: string): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireBrokerRole()
  if ('error' in auth) return { ok: false, error: auth.error }

  const supabase = getServiceSupabase()
  const { data: row } = await supabase.from('tc_expenses').select('id, deal_id, description, amount').eq('id', id).maybeSingle()
  if (!row) return { ok: false, error: 'Expense not found' }

  const { error: upErr } = await supabase
    .from('tc_expenses')
    .update({ archived: true, archived_reason: reason || 'archived by user', archived_at: new Date().toISOString() })
    .eq('id', id)
  if (upErr) return { ok: false, error: upErr.message }

  await supabase.from('tc_events').insert({
    deal_id: row.deal_id,
    actor: auth.email,
    action: 'expense_archived',
    detail: { expense_id: row.id, description: row.description, amount: Number(row.amount), reason },
  })

  revalidatePath('/admin/financials')
  return { ok: true }
}
