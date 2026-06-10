'use server'

import { createClient } from '@supabase/supabase-js'
import {
  anticipateDocuments,
  unknownFacts,
  type AnticipatedDoc,
  type BrokerRole,
  type PropertyFacts,
} from '@/lib/tc/required-documents'
import { getPropertyFactsByMls } from '@/lib/data/listings/getPropertyFactsByMls'

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
}

export async function getAnticipatedDocuments(cycleId: string): Promise<AnticipatedDocsResult | null> {
  const supabase = getServiceSupabase()
  const { data: cycle } = await supabase
    .from('tc_cycles')
    .select('id, kind, raw, mls_number')
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
  const facts = factsFromRaw(cycle.raw ?? {}, null)

  // Auto-populate facts from the synced listing (by MLS#) via the canonical DAL
  // function — well/septic/HOA/condo/manufactured/land/year-built light up
  // automatically instead of all-confirm. Listing data overrides only the
  // fields the feed actually knows; the rest stay null (confirm prompt).
  if (cycle.mls_number) {
    const lf = await getPropertyFactsByMls(cycle.mls_number).catch(() => null)
    if (lf) {
      for (const key of Object.keys(lf) as (keyof typeof lf)[]) {
        if (lf[key] != null) (facts as Record<string, unknown>)[key] = lf[key]
      }
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
  }
}
