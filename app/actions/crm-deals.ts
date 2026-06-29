'use server'

/**
 * CRM deal server actions — mutations for /admin/crm/deals/[id].
 *
 * Reads go through lib/data/crm/getCrmDeal (cached DAL).
 * All mutations use the service client + require CRM access.
 */

import { revalidatePath, revalidateTag } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { getCrmAccess } from '@/app/actions/crm'
import { scopeBroker } from '@/lib/crm/scope'
import { dealInScope } from '@/lib/crm/deal-scope'
import { getDealScopeRow } from '@/lib/data/crm/getDealScopeRow'
import type { CrmBrokerSlug } from '@/lib/crm/constants'

export type DealActionResult = { ok: true } | { ok: false; error: string }

// ── helpers ──────────────────────────────────────────────────────────────────

async function requireAccess() {
  const access = await getCrmAccess()
  if (!access) throw new Error('Unauthorized')
  return access
}

/**
 * Broker-scope guard for deal mutations. An owner/superuser (scopeBroker → null)
 * may touch any deal. A restricted broker may only mutate a deal they can see in
 * their scoped pipeline — i.e. the deal's own assigned_broker OR its linked
 * person's assigned_broker matches their slug (mirrors listCrmDeals' GAP-7
 * person-scope). Deals matching neither are refused, so no broker can edit
 * another broker's financials. Returns ok:false with no DB write on failure.
 */
async function requireDealInScope(dealId: number, scoped: CrmBrokerSlug | null): Promise<DealActionResult> {
  if (scoped === null) return { ok: true }
  const row = await getDealScopeRow(dealId)
  if (!row) return { ok: false, error: 'Deal not found' }
  if (!dealInScope(scoped, row.assignedBroker, row.personBroker)) {
    return { ok: false, error: 'Not authorized for this deal' }
  }
  return { ok: true }
}

function bust(id: number) {
  revalidateTag('crm-deal-detail', 'max')
  revalidatePath(`/admin/crm/deals/${id}`)
  revalidatePath('/admin/crm/deals')
}

// ── updateCrmDeal ─────────────────────────────────────────────────────────────

export type DealPatch = {
  name?: string | null
  value?: number | null
  property_address?: string | null
  close_date?: string | null
  earnest_money_due?: string | null
  mutual_acceptance?: string | null
  due_diligence?: string | null
  final_walkthrough?: string | null
  possession?: string | null
  commission_dollars?: number | null
  commission_percent?: number | null
  description?: string | null
  assigned_broker?: string | null
  stage?: string | null
}

export async function updateCrmDeal(
  id: number,
  patch: DealPatch,
): Promise<DealActionResult> {
  try {
    const access = await requireAccess()
    const scoped = await requireDealInScope(id, scopeBroker(access))
    if (!scoped.ok) return scoped
    const sb = createServiceClient()
    const { error } = await sb
      .from('crm_deals')
      .update(patch)
      .eq('id', id)
    if (error) return { ok: false, error: error.message }
    bust(id)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

// ── splits ────────────────────────────────────────────────────────────────────

export async function addDealSplit(
  dealId: number,
  data: { broker_slug: string; split_pct: number; split_dollars?: number | null; notes?: string | null },
): Promise<DealActionResult> {
  try {
    const access = await requireAccess()
    const scoped = await requireDealInScope(dealId, scopeBroker(access))
    if (!scoped.ok) return scoped
    const sb = createServiceClient()
    const { error } = await sb.from('crm_deal_splits').insert({ deal_id: dealId, ...data })
    if (error) return { ok: false, error: error.message }
    bust(dealId)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

export async function removeDealSplit(
  dealId: number,
  splitId: number,
): Promise<DealActionResult> {
  try {
    const access = await requireAccess()
    const scoped = await requireDealInScope(dealId, scopeBroker(access))
    if (!scoped.ok) return scoped
    const sb = createServiceClient()
    const { error } = await sb
      .from('crm_deal_splits')
      .delete()
      .eq('id', splitId)
      .eq('deal_id', dealId)
    if (error) return { ok: false, error: error.message }
    bust(dealId)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

// ── files ─────────────────────────────────────────────────────────────────────

export async function addDealFile(
  dealId: number,
  data: { name: string; url?: string | null; storage_path?: string | null },
): Promise<DealActionResult> {
  try {
    const access = await requireAccess()
    const scoped = await requireDealInScope(dealId, scopeBroker(access))
    if (!scoped.ok) return scoped
    const sb = createServiceClient()
    const { error } = await sb.from('crm_deal_files').insert({
      deal_id: dealId,
      name: data.name,
      url: data.url ?? null,
      storage_path: data.storage_path ?? null,
      uploaded_by: access.email,
    })
    if (error) return { ok: false, error: error.message }
    bust(dealId)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

export async function removeDealFile(
  dealId: number,
  fileId: number,
): Promise<DealActionResult> {
  try {
    const access = await requireAccess()
    const scoped = await requireDealInScope(dealId, scopeBroker(access))
    if (!scoped.ok) return scoped
    const sb = createServiceClient()
    const { error } = await sb
      .from('crm_deal_files')
      .delete()
      .eq('id', fileId)
      .eq('deal_id', dealId)
    if (error) return { ok: false, error: error.message }
    bust(dealId)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

// ── createCrmDeal ─────────────────────────────────────────────────────────────

export async function createCrmDeal(
  input: { name: string },
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  try {
    const access = await requireAccess()
    const name = (input.name ?? '').trim()
    if (!name) return { ok: false, error: 'Deal name is required' }
    const sb = createServiceClient()
    // Own the deal on create so it isn't an unscoped orphan (finding F6): the
    // creating broker becomes assigned_broker. An owner/superuser with no broker
    // slug leaves it null (they see all deals regardless).
    const { data, error } = await sb
      .from('crm_deals')
      .insert({ name, status: 'active', assigned_broker: access.brokerSlug ?? null, created_at: new Date().toISOString() })
      .select('id')
      .single()
    if (error) return { ok: false, error: error.message }
    revalidatePath('/admin/crm/deals')
    return { ok: true, id: data.id as number }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}
