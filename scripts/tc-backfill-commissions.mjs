#!/usr/bin/env node
/**
 * Backfill tc_commissions from the migrated SkySlope sale cycles (TC rung 11).
 *
 * Source of truth per cycle: tc_cycles.office_gross (settlement-era figure)
 * + raw.commission (SkySlope commission object) + raw.commissionSplits
 * (per-agent split percentage as recorded at the time of the deal — Matt 100,
 * Rebecca/Paul 90) + raw.dealType (Listing / Purchase / Both Purchase & Listing).
 *
 * Status mapping:
 *   Closed                      -> settlement_verified
 *   Pending / Pre-Contract      -> projected
 *   Canceled/* / dead           -> skipped (no commission was earned)
 *
 * Idempotent: existing (cycle_id, agent_guid) rows are left alone.
 * Every insert appends a tc_events row (actor 'commission-backfill').
 *
 * Usage: node --env-file=.env.local scripts/tc-backfill-commissions.mjs [--dry]
 */
import { createClient } from '@supabase/supabase-js'

const DRY = process.argv.includes('--dry')
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const SIDE_BY_DEALTYPE = {
  Listing: 'listing',
  Purchase: 'buyer',
  'Both Purchase & Listing': 'both',
}

const BROKER_SLUGS = {
  'Matt Ryan': 'matthew-ryan',
  'Rebecca Peterson': 'rebecca-peterson',
  'Paul Stevenson': 'paul-stevenson',
}

const { data: cycles, error } = await supabase
  .from('tc_cycles')
  .select('id, deal_id, kind, status, broker_name, sale_price, office_gross, commission_percent, raw')
  .eq('kind', 'sale')
if (error) throw error

const { data: existing } = await supabase.from('tc_commissions').select('cycle_id, agent_guid')
const have = new Set((existing ?? []).map((r) => `${r.cycle_id}:${r.agent_guid ?? ''}`))

let inserted = 0
let skipped = 0
for (const c of cycles) {
  const status = c.status === 'Closed' ? 'settlement_verified' : /^(Pending|Pre-Contract)/.test(c.status ?? '') ? 'projected' : null
  if (!status) {
    skipped++
    continue
  }
  if (c.office_gross == null) {
    skipped++
    continue
  }

  const com = c.raw?.commission ?? {}
  const rawSplits = Array.isArray(c.raw?.commissionSplits) ? c.raw.commissionSplits : []
  // Multi-split arrays carry null-percentage placeholder entries for agents
  // with no share (seen on 2edb3ada) — only keep entries with a real share.
  const realSplits = rawSplits.filter((sp) => Number(sp.percentage) > 0)
  const splits = realSplits.length ? realSplits : [{ agentGuid: c.raw?.agentGuid ?? null, percentage: 100 }]
  const side = SIDE_BY_DEALTYPE[c.raw?.dealType] ?? 'unknown'
  const pct = c.commission_percent ?? com.saleCommissionPercent ?? com.listingCommissionPercent ?? null
  const basis = pct == null && (com.saleCommissionAmount != null || com.listingCommissionAmount != null) ? 'flat' : 'percent'
  const referral = Number(c.raw?.commissionReferral?.amount ?? 0) || 0
  const tcFee = Number(com.transactionCoordinatorFee ?? 0) || 0
  const deductions = Number(com.otherDeductions ?? 0) || 0

  for (const split of splits) {
    const key = `${c.id}:${split.agentGuid ?? ''}`
    if (have.has(key)) {
      skipped++
      continue
    }
    // The office gross is per cycle; a sole split takes the full gross, real
    // multi-splits take their percentage share.
    const gci = splits.length === 1 ? c.office_gross : c.office_gross * ((split.percentage ?? 0) / 100)
    const net = gci - referral - tcFee - deductions
    const splitPct = split.percentage ?? 100
    const agentNet = Math.round(net * (splitPct / 100) * 100) / 100
    const brokerageNet = Math.round((net - agentNet) * 100) / 100

    const row = {
      cycle_id: c.id,
      agent_guid: split.agentGuid ?? null,
      broker_slug: BROKER_SLUGS[c.broker_name] ?? null,
      broker_name: c.broker_name ?? 'Unknown',
      side,
      basis,
      commission_percent: pct,
      gci,
      referral_fee: referral,
      tc_fee: tcFee,
      other_deductions: deductions,
      split_percent: splitPct,
      agent_net: agentNet,
      brokerage_net: brokerageNet,
      status,
      source: {
        origin: 'skyslope_migration_backfill',
        skyslope_commission: com,
        skyslope_splits: c.raw?.commissionSplits ?? null,
        deal_type: c.raw?.dealType ?? null,
        office_gross: c.office_gross,
        backfilled_at: new Date().toISOString(),
      },
    }

    if (DRY) {
      console.log(`[dry] ${c.broker_name} ${side} gci=$${gci} split=${splitPct}% agent=$${agentNet} brokerage=$${brokerageNet} status=${status}`)
      inserted++
      continue
    }

    const { error: insErr } = await supabase.from('tc_commissions').insert(row)
    if (insErr) {
      console.error(`FAIL cycle ${c.id}: ${insErr.message}`)
      continue
    }
    await supabase.from('tc_events').insert({
      deal_id: c.deal_id,
      cycle_id: c.id,
      actor: 'commission-backfill',
      action: 'commission_recorded',
      detail: { broker: c.broker_name, side, gci, split_percent: splitPct, agent_net: agentNet, brokerage_net: brokerageNet, status },
    })
    inserted++
  }
}

console.log(`${DRY ? '[dry] would insert' : 'inserted'} ${inserted} commission rows, skipped ${skipped} (canceled / no gross / existing)`)
