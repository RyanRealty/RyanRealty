'use server'

/**
 * Pipeline + stage management actions — §9 Manage Pipelines / §10 Add-Edit
 * Stage (spec docs/fub-crm-spec/10-deals-pipelines.md; AC-7 / AC-8).
 *
 * ACCOUNT-OWNER ONLY (§22): every action gates on role === 'superuser' — the
 * same rule the /admin/crm/deals/pipelines route enforces with its 403 page.
 * Split from app/actions/crm-deals.ts (deal-row mutations) to keep both under
 * the file-size budget; shares its DealActionResult shape.
 *
 * order_weight discipline (§10): weights renumber in 1000-unit gaps after any
 * insert/reorder/delete — never hardcoded by callers.
 *
 * crm_deals stores pipeline + stage BY NAME, so renames cascade to the deal
 * rows in the same action. Deletes are refused while deals still sit in the
 * pipeline/stage (move them first — no silent orphaning).
 */

import { revalidatePath, revalidateTag } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { getCrmAccess, type CrmAccess } from '@/app/actions/crm'
import { STAGE_COLOR_PALETTE } from '@/lib/crm/deal-pipelines'
import type { DealActionResult } from '@/app/actions/crm-deals'

async function requireAccess() {
  const access = await getCrmAccess()
  if (!access) throw new Error('Unauthorized')
  return access
}

function isOwner(access: CrmAccess): boolean {
  return access.role === 'superuser'
}

async function requireOwner(): Promise<
  { ok: true; access: CrmAccess } | { ok: false; error: string }
> {
  const access = await requireAccess()
  if (!isOwner(access)) return { ok: false, error: 'Only the account owner can manage pipelines' }
  return { ok: true, access }
}

function bustPipelines() {
  revalidateTag('crm-deal-pipelines', 'max')
  revalidatePath('/admin/crm/deals')
  revalidatePath('/admin/crm/deals/pipelines')
}


const STAGE_GAP = 1000

/** Renumber a pipeline's stages (or the pipelines themselves) in 1000-unit gaps. */
async function renumberStages(pipelineId: number): Promise<void> {
  const sb = createServiceClient()
  const { data } = await sb
    .from('crm_deal_stages')
    .select('id')
    .eq('pipeline_id', pipelineId)
    .order('order_weight')
    .order('id')
  let w = STAGE_GAP
  for (const s of data ?? []) {
    await sb.from('crm_deal_stages').update({ order_weight: w }).eq('id', s.id)
    w += STAGE_GAP
  }
}

export async function createDealStage(
  pipelineId: number,
  input: { name: string; color: string; isClosedStage: boolean },
): Promise<DealActionResult> {
  try {
    const owner = await requireOwner()
    if (!owner.ok) return owner
    const name = (input.name ?? '').trim()
    if (!name) return { ok: false, error: 'Stage name is required' }
    const sb = createServiceClient()
    const { data: last } = await sb
      .from('crm_deal_stages')
      .select('order_weight')
      .eq('pipeline_id', pipelineId)
      .order('order_weight', { ascending: false })
      .limit(1)
    const { error } = await sb.from('crm_deal_stages').insert({
      pipeline_id: pipelineId,
      name,
      // Default accent = the palette's periwinkle (no hex literal outside the
      // lint-ignored palette module).
      color: (input.color ?? '').trim() || STAGE_COLOR_PALETTE[2],
      is_closed_stage: !!input.isClosedStage,
      order_weight: (last?.[0]?.order_weight ?? 0) + STAGE_GAP,
    })
    if (error) return { ok: false, error: error.message }
    bustPipelines()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

export async function updateDealStage(
  stageId: number,
  patch: { name?: string; color?: string; isClosedStage?: boolean },
): Promise<DealActionResult> {
  try {
    const owner = await requireOwner()
    if (!owner.ok) return owner
    const sb = createServiceClient()
    const { data: stage } = await sb
      .from('crm_deal_stages')
      .select('id,name,pipeline_id,crm_pipelines(name)')
      .eq('id', stageId)
      .maybeSingle()
    if (!stage) return { ok: false, error: 'Stage not found' }
    const upd: Record<string, unknown> = { updated_at: new Date().toISOString() }
    const newName = (patch.name ?? '').trim()
    if (newName) upd.name = newName
    if ((patch.color ?? '').trim()) upd.color = patch.color!.trim()
    if (patch.isClosedStage != null) upd.is_closed_stage = !!patch.isClosedStage
    const { error } = await sb.from('crm_deal_stages').update(upd).eq('id', stageId)
    if (error) return { ok: false, error: error.message }
    // crm_deals stores stage BY NAME — a rename must cascade to the deal rows.
    const pipe = stage.crm_pipelines as unknown as { name: string } | { name: string }[] | null
    const pipeName = Array.isArray(pipe) ? pipe[0]?.name : pipe?.name
    if (newName && newName !== stage.name && pipeName) {
      await sb
        .from('crm_deals')
        .update({ stage: newName })
        .eq('pipeline', pipeName)
        .eq('stage', stage.name)
    }
    bustPipelines()
    revalidatePath('/admin/crm/deals')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

export async function deleteDealStage(stageId: number): Promise<DealActionResult> {
  try {
    const owner = await requireOwner()
    if (!owner.ok) return owner
    const sb = createServiceClient()
    const { data: stage } = await sb
      .from('crm_deal_stages')
      .select('id,name,pipeline_id,crm_pipelines(name)')
      .eq('id', stageId)
      .maybeSingle()
    if (!stage) return { ok: false, error: 'Stage not found' }
    const pipe = stage.crm_pipelines as unknown as { name: string } | { name: string }[] | null
    const pipeName = Array.isArray(pipe) ? pipe[0]?.name : pipe?.name
    if (pipeName) {
      const { count } = await sb
        .from('crm_deals')
        .select('id', { count: 'exact', head: true })
        .eq('pipeline', pipeName)
        .eq('stage', stage.name)
      if ((count ?? 0) > 0) {
        return { ok: false, error: `Move the ${count} deal(s) out of "${stage.name}" first` }
      }
    }
    const { error } = await sb.from('crm_deal_stages').delete().eq('id', stageId)
    if (error) return { ok: false, error: error.message }
    await renumberStages(Number(stage.pipeline_id))
    bustPipelines()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

/** Move a stage one position left (-1) or right (+1); weights renumber in 1000-gaps (AC-8 #36). */
export async function moveDealStage(stageId: number, dir: -1 | 1): Promise<DealActionResult> {
  try {
    const owner = await requireOwner()
    if (!owner.ok) return owner
    const sb = createServiceClient()
    const { data: stage } = await sb
      .from('crm_deal_stages')
      .select('id,pipeline_id')
      .eq('id', stageId)
      .maybeSingle()
    if (!stage) return { ok: false, error: 'Stage not found' }
    const { data: siblings } = await sb
      .from('crm_deal_stages')
      .select('id')
      .eq('pipeline_id', stage.pipeline_id)
      .order('order_weight')
      .order('id')
    const ids = (siblings ?? []).map((s) => Number(s.id))
    const i = ids.indexOf(stageId)
    const j = i + dir
    if (i < 0 || j < 0 || j >= ids.length) return { ok: true } // no-op at the edge
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    let w = STAGE_GAP
    for (const id of ids) {
      await sb.from('crm_deal_stages').update({ order_weight: w }).eq('id', id)
      w += STAGE_GAP
    }
    bustPipelines()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

export async function createDealPipeline(name: string): Promise<DealActionResult> {
  try {
    const owner = await requireOwner()
    if (!owner.ok) return owner
    const trimmed = (name ?? '').trim()
    if (!trimmed) return { ok: false, error: 'Pipeline name is required' }
    const sb = createServiceClient()
    const { data: last } = await sb
      .from('crm_pipelines')
      .select('order_weight')
      .order('order_weight', { ascending: false })
      .limit(1)
    const { error } = await sb.from('crm_pipelines').insert({
      name: trimmed,
      order_weight: (last?.[0]?.order_weight ?? 0) + STAGE_GAP,
    })
    if (error) return { ok: false, error: error.message }
    bustPipelines()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

export async function renameDealPipeline(id: number, name: string): Promise<DealActionResult> {
  try {
    const owner = await requireOwner()
    if (!owner.ok) return owner
    const trimmed = (name ?? '').trim()
    if (!trimmed) return { ok: false, error: 'Pipeline name is required' }
    const sb = createServiceClient()
    const { data: pipe } = await sb.from('crm_pipelines').select('id,name').eq('id', id).maybeSingle()
    if (!pipe) return { ok: false, error: 'Pipeline not found' }
    const { error } = await sb
      .from('crm_pipelines')
      .update({ name: trimmed, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return { ok: false, error: error.message }
    // crm_deals stores pipeline BY NAME — cascade the rename.
    if (trimmed !== pipe.name) {
      await sb.from('crm_deals').update({ pipeline: trimmed }).eq('pipeline', pipe.name)
    }
    bustPipelines()
    revalidatePath('/admin/crm/deals')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

export async function deleteDealPipeline(id: number): Promise<DealActionResult> {
  try {
    const owner = await requireOwner()
    if (!owner.ok) return owner
    const sb = createServiceClient()
    const { data: pipe } = await sb.from('crm_pipelines').select('id,name').eq('id', id).maybeSingle()
    if (!pipe) return { ok: false, error: 'Pipeline not found' }
    const { count } = await sb
      .from('crm_deals')
      .select('id', { count: 'exact', head: true })
      .eq('pipeline', pipe.name)
    if ((count ?? 0) > 0) {
      return { ok: false, error: `Move the ${count} deal(s) out of "${pipe.name}" first` }
    }
    const { error } = await sb.from('crm_pipelines').delete().eq('id', id)
    if (error) return { ok: false, error: error.message }
    bustPipelines()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

/** Reorder pipelines to the given id order (drag-to-reorder on Manage Pipelines, §9). */
export async function reorderDealPipelines(orderedIds: number[]): Promise<DealActionResult> {
  try {
    const owner = await requireOwner()
    if (!owner.ok) return owner
    const sb = createServiceClient()
    let w = STAGE_GAP
    for (const id of orderedIds) {
      await sb
        .from('crm_pipelines')
        .update({ order_weight: w, updated_at: new Date().toISOString() })
        .eq('id', id)
      w += STAGE_GAP
    }
    bustPipelines()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}
