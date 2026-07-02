'use server'

/**
 * CRM deal server actions — mutations for /admin/crm/deals/[id].
 *
 * Reads go through lib/data/crm/getCrmDeal (cached DAL).
 * All mutations use the service client + require CRM access.
 */

import { revalidatePath, revalidateTag } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { getCrmAccess, requirePersonInScope } from '@/app/actions/crm'
import { scopeBroker } from '@/lib/crm/scope'
import { dealInScope } from '@/lib/crm/deal-scope'
import { getDealScopeRow } from '@/lib/data/crm/getDealScopeRow'
import { getDealPipelines, pipelineHasStage } from '@/lib/data/crm/getDealPipelines'
import type { CrmBrokerSlug } from '@/lib/crm/constants'

export type DealActionResult = { ok: true } | { ok: false; error: string }

// ── helpers ──────────────────────────────────────────────────────────────────
// (Owner-only §9/§10 pipeline + stage management lives in
//  app/actions/crm-deal-pipelines.ts — split for the file-size budget.)

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

    // Reject a target that isn't a real stage of this deal's pipeline — checked
    // against the LIVE (DB-backed) config so owner-added stages are honored.
    const pipelines = await getDealPipelines()
    if (row.pipeline && !pipelineHasStage(pipelines, row.pipeline, target)) {
      return { ok: false, error: `"${target}" is not a stage of the ${row.pipeline} pipeline` }
    }

    if (row.stage === target) return { ok: true } // already there

    const sb = createServiceClient()
    const nowIso = new Date().toISOString()
    const patch: Record<string, unknown> = {
      stage: target,
      entered_stage_at: nowIso,
      updated_at: nowIso,
    }
    // §20.10: entering an is_closed_stage stage stamps the ACTUAL close date
    // (idempotent — never overwrites one already set; projected close untouched).
    const targetStage = pipelines
      .find((p) => p.name === row.pipeline)
      ?.stages.find((s) => s.name === target)
    if (targetStage?.isClosedStage && !row.actualCloseDate) {
      patch.actual_close_date = nowIso.slice(0, 10)
    }
    const { error: upErr } = await sb.from('crm_deals').update(patch).eq('id', dealId)
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
  input: {
    name: string
    pipeline?: string | null
    stage?: string | null
    /** §12 optional creation fields. */
    value?: number | null
    close_date?: string | null
    commission_dollars?: number | null
    person_id?: number | null
    assigned_broker?: string | null
  },
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  try {
    const access = await requireAccess()
    const name = (input.name ?? '').trim()
    if (!name) return { ok: false, error: 'Deal name is required' }

    // Optional pipeline/stage pre-scope (the per-column "+" on the Kanban board).
    // Validate the pair against the LIVE pipeline config so a deal can only be
    // seeded into a real column; an unknown pipeline/stage is dropped (deal
    // created bare).
    const pipeline = (input.pipeline ?? '').trim() || null
    const stage = (input.stage ?? '').trim() || null
    const pipelines = await getDealPipelines()
    const seedStage = pipeline && stage && pipelineHasStage(pipelines, pipeline, stage) ? stage : null
    const seedPipeline = seedStage ? pipeline : null

    const sb = createServiceClient()
    // Own the deal on create so it isn't an unscoped orphan (finding F6): the
    // creating broker becomes assigned_broker (a restricted broker can only
    // assign to themselves; an owner may pick any broker or leave their own).
    const assigned =
      access.role === 'superuser'
        ? ((input.assigned_broker ?? '').trim() || access.brokerSlug || null)
        : (access.brokerSlug ?? null)
    const insert: Record<string, unknown> = {
      name,
      status: 'active',
      assigned_broker: assigned,
      created_at: new Date().toISOString(),
    }
    if (seedPipeline) insert.pipeline = seedPipeline
    if (seedStage) {
      insert.stage = seedStage
      insert.entered_stage_at = new Date().toISOString()
    }
    if (input.value != null && Number.isFinite(input.value)) insert.value = input.value
    if (input.commission_dollars != null && Number.isFinite(input.commission_dollars)) {
      insert.commission_dollars = input.commission_dollars
    }
    if ((input.close_date ?? '').trim()) insert.close_date = input.close_date

    // Optional initial contact (§12 "Associated contacts") — scope-checked so a
    // restricted broker can only attach their own contact.
    let personId: number | null = null
    if (input.person_id != null && Number.isFinite(input.person_id)) {
      const inScope = await requirePersonInScope(Number(input.person_id), access)
      if (inScope.ok) {
        personId = Number(input.person_id)
        insert.person_id = personId
      }
    }

    const { data, error } = await sb
      .from('crm_deals')
      .insert(insert)
      .select('id')
      .single()
    if (error) return { ok: false, error: error.message }
    const id = data.id as number
    if (personId) {
      await sb
        .from('crm_deal_people')
        .upsert({ deal_id: id, person_id: personId }, { onConflict: 'deal_id,person_id' })
    }
    revalidatePath('/admin/crm/deals')
    return { ok: true, id }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

// ── people (crm_deal_people junction, §20.4 / AC-5 #22) ──────────────────────

export async function addDealPerson(dealId: number, personId: number): Promise<DealActionResult> {
  try {
    const access = await requireAccess()
    const scoped = await requireDealInScope(dealId, scopeBroker(access))
    if (!scoped.ok) return scoped
    const inScope = await requirePersonInScope(personId, access)
    if (!inScope.ok) return inScope
    const sb = createServiceClient()
    const { error } = await sb
      .from('crm_deal_people')
      .upsert({ deal_id: dealId, person_id: personId }, { onConflict: 'deal_id,person_id' })
    if (error) return { ok: false, error: error.message }
    // Keep the legacy primary-contact pointer coherent when it was empty.
    const row = await getDealScopeRow(dealId)
    if (row && row.personId == null) {
      await sb.from('crm_deals').update({ person_id: personId }).eq('id', dealId)
    }
    bust(dealId)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

export async function removeDealPerson(dealId: number, personId: number): Promise<DealActionResult> {
  try {
    const access = await requireAccess()
    const scoped = await requireDealInScope(dealId, scopeBroker(access))
    if (!scoped.ok) return scoped
    const sb = createServiceClient()
    const { error } = await sb
      .from('crm_deal_people')
      .delete()
      .eq('deal_id', dealId)
      .eq('person_id', personId)
    if (error) return { ok: false, error: error.message }
    // If the removed contact was the legacy primary pointer, repoint or clear it.
    const row = await getDealScopeRow(dealId)
    if (row && row.personId === personId) {
      const { data: remaining } = await sb
        .from('crm_deal_people')
        .select('person_id')
        .eq('deal_id', dealId)
        .order('created_at')
        .limit(1)
      await sb
        .from('crm_deals')
        .update({ person_id: remaining?.[0]?.person_id ?? null })
        .eq('id', dealId)
    }
    bust(dealId)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

// ── archive / restore (§13 — archiving, not deleting, marks lost deals) ──────

export async function setDealStatus(
  dealId: number,
  status: 'active' | 'archived',
): Promise<DealActionResult> {
  try {
    const access = await requireAccess()
    const scoped = await requireDealInScope(dealId, scopeBroker(access))
    if (!scoped.ok) return scoped
    const sb = createServiceClient()
    // Existing FUB-imported rows use 'Active' capitalization — write the same
    // family; all readers normalize case-insensitively.
    const { error } = await sb
      .from('crm_deals')
      .update({ status: status === 'archived' ? 'Archived' : 'Active', updated_at: new Date().toISOString() })
      .eq('id', dealId)
    if (error) return { ok: false, error: error.message }
    bust(dealId)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

