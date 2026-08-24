'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { checkAdminAction } from '@/lib/admin/require-admin'
import {
  EMPTY_PROPERTY_FACTS,
  anticipateDocuments,
  missingChecklistSeeds,
  missingReferralW9,
  unknownFacts,
  type AnticipatedDoc,
  type BrokerRole,
  type PropertyFacts,
} from '@/lib/tc/required-documents'
import { getPropertyFactsByMls } from '@/lib/data/listings/getPropertyFactsByMls'
import { getTcCycleRawById } from '@/lib/data/tc/getTcCycleRawById'
import { overlayPropertyFacts, parseSavedPropertyFacts } from '@/lib/tc/property-facts'

/**
 * Anticipated-documents surface for a deal cycle. Reads the cycle's role +
 * property facts, evaluates the Oregon compliance matrix
 * (lib/tc/required-documents.ts ← docs/TC_OREGON_COMPLIANCE.md), and marks each
 * applicable document present/missing against what's already on the deal.
 */

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) throw new Error('Supabase service role not configured')
  return createClient(url, key, { auth: { persistSession: false } })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw SkySlope snapshot is untyped
type Raw = Record<string, any>

/** SkySlope saleTypeId: 31 Listing · 32 Purchase · 33 Both. */
function roleFromRaw(kind: string, raw: Raw): BrokerRole {
  if (kind === 'listing') return 'listing'
  const t = raw?.saleTypeId ?? raw?.dealType
  if (t === 31 || /listing/i.test(String(raw?.dealType ?? ''))) return 'listing'
  if (t === 32 || /purchase|buyer/i.test(String(raw?.dealType ?? ''))) return 'buyer'
  if (t === 33 || /both|dual/i.test(String(raw?.dealType ?? ''))) return 'dual'
  return 'unknown'
}

function factsFromRaw(raw: Raw, mlsYearBuilt: number | null): PropertyFacts {
  const yb =
    Number(raw?.property?.yearBuilt) ||
    Number(raw?.yearBuilt) ||
    mlsYearBuilt ||
    null
  return {
    yearBuilt: Number.isFinite(yb) && yb ? yb : null,
    hasWell: null,
    hasSeptic: null,
    hasHOA: null,
    isCondo: null,
    isManufactured: null,
    isVacantLand: null,
    hasSolar: null,
    isTenantOccupied: null,
    isShortSale: null,
    isSellerCarried: null,
    hasTeam: null,
    financing: null,
  }
}

export type AnticipatedDocsResult = {
  role: BrokerRole
  facts: PropertyFacts
  documents: AnticipatedDoc[]
  unknown: string[]
  missingRequired: number
  missingConditional: number
  dealId: string
  presentNames: string[]
}

export async function getAnticipatedDocuments(cycleId: string): Promise<AnticipatedDocsResult | null> {
  const supabase = getServiceSupabase()
  const { data: cycle } = await supabase
    .from('tc_cycles')
    .select('id, deal_id, kind, raw, mls_number')
    .eq('id', cycleId)
    .maybeSingle()
  if (!cycle) return null

  // present = checklist activity names + live (non-archived) document names
  const [{ data: items }, { data: docs }] = await Promise.all([
    supabase.from('tc_checklist_items').select('name').eq('cycle_id', cycleId),
    supabase.from('tc_documents').select('name, archived').eq('cycle_id', cycleId),
  ])
  const presentNames = [
    ...(items ?? []).map((i: { name: string }) => i.name),
    ...((docs ?? []) as Array<{ name: string; archived: boolean }>)
      .filter((d) => !d.archived)
      .map((d) => d.name),
  ]

  const role = roleFromRaw(cycle.kind, cycle.raw ?? {})
  let facts = factsFromRaw(cycle.raw ?? {}, null)
  if (cycle.mls_number) {
    const lf = await getPropertyFactsByMls(cycle.mls_number).catch(() => null)
    if (lf) {
      const fromMls: Partial<PropertyFacts> = {}
      for (const key of Object.keys(lf) as (keyof typeof lf)[]) {
        if (lf[key] != null) (fromMls as Record<string, unknown>)[key] = lf[key]
      }
      facts = overlayPropertyFacts(facts, fromMls)
    }
  }
  const savedFacts = parseSavedPropertyFacts((cycle.raw as Raw)?.propertyFacts)
  facts = overlayPropertyFacts(facts, savedFacts)
  if (savedFacts?.hasTeam === undefined && cycle.deal_id) {
    const { data: contactRows } = await supabase
      .from('tc_deal_contacts')
      .select('role')
      .eq('deal_id', cycle.deal_id)
    if ((contactRows ?? []).some((r: { role?: string }) => r.role === 'co_agent')) {
      facts = overlayPropertyFacts(facts, { hasTeam: true })
    }
  }
  const documents = anticipateDocuments(role, facts, presentNames)

  return {
    role,
    facts,
    documents,
    unknown: unknownFacts(facts),
    missingRequired: documents.filter((d) => d.severity === 'required' && !d.present).length,
    missingConditional: documents.filter((d) => d.severity === 'conditional' && !d.present).length,
    dealId: String(cycle.deal_id),
    presentNames,
  }
}

export async function addMissingAnticipatedChecklist(
  cycleId: string,
): Promise<{ ok: boolean; added?: number; error?: string }> {
  const gate = await checkAdminAction('transactions.edit')
  if (!gate.ok) return { ok: false, error: gate.error }
  const preview = await getAnticipatedDocuments(cycleId)
  if (!preview) return { ok: false, error: 'Cycle not found' }
  const supabase = getServiceSupabase()
  const { data: commissionRows } = await supabase
    .from('tc_commissions')
    .select('referral_fee')
    .eq('cycle_id', cycleId)
  const referralFee = (commissionRows ?? []).reduce(
    (sum: number, r: { referral_fee?: number }) => sum + Number(r.referral_fee ?? 0),
    0,
  )
  const missing = [
    ...missingChecklistSeeds(preview.role, preview.facts, preview.presentNames),
    ...missingReferralW9(preview.presentNames, referralFee),
  ]
  if (!missing.length) return { ok: true, added: 0 }
  const start = preview.presentNames.length
  const { error } = await supabase.from('tc_checklist_items').insert(
    missing.map((row, i) => ({
      cycle_id: cycleId,
      name: row.name,
      type_name: row.type_name,
      status: row.status,
      sort_order: start + i,
      group_name: row.group,
    })),
  )
  if (error) return { ok: false, error: error.message }
  await supabase.from('tc_events').insert({
    deal_id: preview.dealId,
    cycle_id: cycleId,
    actor: gate.ctx.email,
    action: 'checklist_facts_synced',
    detail: { added: missing.length, facts: preview.facts },
  })
  revalidatePath('/admin/deals')
  return { ok: true, added: missing.length }
}

export async function saveCyclePropertyFacts(
  cycleId: string,
  patch: Partial<PropertyFacts>,
): Promise<{ ok: boolean; error?: string; added?: number }> {
  const gate = await checkAdminAction('transactions.edit')
  if (!gate.ok) return { ok: false, error: gate.error }
  const supabase = getServiceSupabase()
  const cycle = await getTcCycleRawById(cycleId)
  if (!cycle) return { ok: false, error: 'Cycle not found' }
  const raw = (cycle.raw && typeof cycle.raw === 'object' ? cycle.raw : {}) as Raw
  const nextFacts = overlayPropertyFacts(
    overlayPropertyFacts(
      { ...EMPTY_PROPERTY_FACTS },
      parseSavedPropertyFacts(raw.propertyFacts),
    ),
    patch,
  )
  const { error } = await supabase
    .from('tc_cycles')
    .update({ raw: { ...raw, propertyFacts: nextFacts } })
    .eq('id', cycleId)
  if (error) return { ok: false, error: error.message }
  await supabase.from('tc_events').insert({
    deal_id: cycle.deal_id,
    cycle_id: cycleId,
    actor: gate.ctx.email,
    action: 'property_facts_saved',
    detail: { patch },
  })
  revalidatePath('/admin/deals')
  const added = await addMissingAnticipatedChecklist(cycleId)
  return { ok: true, added: added.ok ? added.added : 0 }
}
