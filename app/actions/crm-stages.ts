'use server'

/**
 * CRM stage CRUD — the server-action surface over the crm_stages config table.
 *
 * Built on makeConfigTable (lib/crm/config-table.ts), the reusable CONFIG-TABLE
 * factory. These actions are the ONLY way the UI mutates stages: every method is
 * access-guarded (getCrmAccess via the factory) and returns the standard
 * { ok } | { ok:false, error } result.
 *
 * Delete is special: a stage can hold crm_people, so deleteCrmStageAction moves
 * every affected person to a chosen fallback stage FIRST (the factory's reassign
 * callback). A protected stage (Trash, Archive) is refused. A failed reassign
 * aborts the delete so no person is ever orphaned on a removed stage.
 *
 * Reads come from the cached DAL (lib/data/crm/getCrmStages); mutations
 * revalidate /admin/crm so the cache + page refresh.
 */
import { revalidateTag } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { getCrmAccess } from '@/app/actions/crm'
import { makeConfigTable, type ConfigResult } from '@/lib/crm/config-table'

const STAGES = makeConfigTable({
  table: 'crm_stages',
  revalidatePaths: ['/admin/crm', '/admin/crm/settings'],
})

/**
 * Drop the cached getCrmStages result after any mutation. Next 16's
 * revalidateTag takes (tag, profile); 'max' invalidates the tagged entry on the
 * next request without pinning a custom cache lifetime.
 */
function bustStageCache() {
  revalidateTag('crm-stages', 'max')
}

export async function createCrmStageAction(formData: FormData): Promise<ConfigResult> {
  const label = String(formData.get('label') ?? '').trim()
  // The key is the stable identifier crm_people.stage matches. Default it to the
  // label (matches the seed convention) unless the caller supplies one.
  const key = String(formData.get('key') ?? label).trim()
  if (!label) return { ok: false, error: 'Label is required' }
  const res = await STAGES.create({ key, label })
  if (res.ok) bustStageCache()
  return res
}

export async function renameCrmStageAction(formData: FormData): Promise<ConfigResult> {
  const id = Number(formData.get('id'))
  const label = String(formData.get('label') ?? '').trim()
  if (!id || !label) return { ok: false, error: 'Stage and label are required' }
  const res = await STAGES.rename(id, label)
  if (res.ok) bustStageCache()
  return res
}

export async function reorderCrmStagesAction(orderedIds: number[]): Promise<ConfigResult> {
  if (!Array.isArray(orderedIds) || orderedIds.some((n) => !Number.isFinite(n))) {
    return { ok: false, error: 'Bad order' }
  }
  const res = await STAGES.reorder(orderedIds)
  if (res.ok) bustStageCache()
  return res
}

export async function setCrmStageActiveAction(formData: FormData): Promise<ConfigResult> {
  const id = Number(formData.get('id'))
  const isActive = String(formData.get('isActive') ?? '') === '1'
  if (!id) return { ok: false, error: 'Stage required' }
  const res = await STAGES.setActive(id, isActive)
  if (res.ok) bustStageCache()
  return res
}

/**
 * Delete a stage, moving every crm_people currently on it to `reassignToKey`
 * first. The reassign runs inside the factory's callback (before the row is
 * removed); if the people-move write fails, the delete is aborted.
 *
 * Refuses if the reassign target is missing or equals the stage being deleted.
 */
export async function deleteCrmStageAction(formData: FormData): Promise<ConfigResult> {
  const id = Number(formData.get('id'))
  const reassignToKey = String(formData.get('reassignToKey') ?? '').trim()
  if (!id) return { ok: false, error: 'Stage required' }
  if (!reassignToKey) return { ok: false, error: 'Pick a stage to move affected contacts to' }

  // The reassign target must exist and be a different, active-or-not stage.
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }
  const sb = createServiceClient()
  const { data: target } = await sb
    .from('crm_stages')
    .select('key')
    .eq('key', reassignToKey)
    .maybeSingle()
  if (!target) return { ok: false, error: 'Reassign target stage not found' }

  const res = await STAGES.remove(id, async (deleted) => {
    if (deleted.key === reassignToKey) {
      return { ok: false, error: 'Cannot reassign to the stage being deleted' }
    }
    const { error } = await sb
      .from('crm_people')
      .update({ stage: reassignToKey, updated_at: new Date().toISOString() })
      .eq('stage', deleted.key)
    if (error) return { ok: false, error: `Could not move contacts: ${error.message}` }
    return { ok: true }
  })
  if (res.ok) bustStageCache()
  return res
}

/** Read passthrough so the settings page can list stages from one import. */
export async function listCrmStagesAction() {
  const access = await getCrmAccess()
  if (!access) return []
  return STAGES.list()
}
