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
import { isKnownStage } from '@/lib/crm/deal-pipelines'
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

// ── restageCrmDeal ────────────────────────────────────────────────────────────

/**
 * Move a deal to a different stage (drag-to-restage on the Kanban board, spec §15).
 *
 * - Broker scope enforced via requireDealInScope — the SAME guard as updateCrmDeal:
 *   a restricted broker may only restage a deal they own; a superuser any deal.
 *   The board never shows a restricted broker another broker's deal, so this is
 *   defense-in-depth against a forged request.
 * - Validates the target is a real stage of THIS deal's pipeline (a drag can only
 *   land on a rendered column) — a bogus stage string is refused, no write.
 * - No-ops (ok:true, no write) when the deal is already in the target stage.
 * - Sets entered_stage_at = now — the stage-history timestamp that powers the
 *   "time in stage" metric and the FUB "Deal Stage Changed" trigger (spec §15).
 * - Appends a per-contact crm_timeline audit row (kind 'deal_stage_change')
 *   mirroring the set-stage bulk handler's pattern. Best-effort: a failed audit
 *   insert must not fail the restage the user just performed. Only logged when the
 *   deal is linked to a contact (crm_timeline.person_id is NOT NULL).
 */
export async function restageCrmDeal(
  dealId: number,
  toStage: string,
): Promise<DealActionResult> {
  try {
    const access = await requireAccess()

    const target = (toStage ?? '').trim()
    if (!target) return { ok: false, error: 'Target stage is required' }

    // ONE uncached DAL read serves the scope check, no-op detection, pipeline-stage
    // validation, and the audit from→to (no raw .from() in the action).
    const row = await getDealScopeRow(dealId)
    if (!row) return { ok: false, error: 'Deal not found' }

    // Same scope decision as requireDealInScope, inline so the single read is reused.
    const scoped = scopeBroker(access)
    if (!dealInScope(scoped, row.assignedBroker, row.personBroker)) {
      return { ok: false, error: 'Not authorized for this deal' }
    }

    // Reject a target that isn't a real stage of this deal's pipeline.
    if (row.pipeline && !isKnownStage(row.pipeline, target)) {
      return { ok: false, error: `"${target}" is not a stage of the ${row.pipeline} pipeline` }
    }

    if (row.stage === target) return { ok: true } // already there

    const sb = createServiceClient()
    const nowIso = new Date().toISOString()
    const { error: upErr } = await sb
      .from('crm_deals')
      .update({ stage: target, entered_stage_at: nowIso, updated_at: nowIso })
      .eq('id', dealId)
    if (upErr) return { ok: false, error: upErr.message }

    if (row.personId) {
      const dealName = row.name ?? `Deal #${dealId}`
      await sb.from('crm_timeline').insert({
        person_id: row.personId,
        kind: 'deal_stage_change',
        title: `Deal "${dealName}" moved: ${row.stage || '(none)'} → ${target}`,
        broker: access.brokerSlug ?? null,
        source: 'app',
        payload: { deal_id: dealId, from: row.stage, to: target },
      })
    }

    bust(dealId)
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
  input: { name: string; pipeline?: string | null; stage?: string | null },
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  try {
    const access = await requireAccess()
    const name = (input.name ?? '').trim()
    if (!name) return { ok: false, error: 'Deal name is required' }

    // Optional pipeline/stage pre-scope (the per-column "+" on the Kanban board).
    // Validate the pair against the pipeline config so a deal can only be seeded
    // into a real column; an unknown pipeline/stage is dropped (deal created bare).
    const pipeline = (input.pipeline ?? '').trim() || null
    const stage = (input.stage ?? '').trim() || null
    const seedStage = pipeline && stage && isKnownStage(pipeline, stage) ? stage : null
    const seedPipeline = seedStage ? pipeline : null

    const sb = createServiceClient()
    // Own the deal on create so it isn't an unscoped orphan (finding F6): the
    // creating broker becomes assigned_broker. An owner/superuser with no broker
    // slug leaves it null (they see all deals regardless).
    const insert: Record<string, unknown> = {
      name,
      status: 'active',
      assigned_broker: access.brokerSlug ?? null,
      created_at: new Date().toISOString(),
    }
    if (seedPipeline) insert.pipeline = seedPipeline
    if (seedStage) {
      insert.stage = seedStage
      insert.entered_stage_at = new Date().toISOString()
    }
    const { data, error } = await sb
      .from('crm_deals')
      .insert(insert)
      .select('id')
      .single()
    if (error) return { ok: false, error: error.message }
    revalidatePath('/admin/crm/deals')
    return { ok: true, id: data.id as number }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}
