'use server'

/**
 * CRM market-report-area CRUD — the server-action surface over the
 * crm_report_areas config table.
 *
 * Built on makeConfigTable (lib/crm/config-table.ts), the reusable CONFIG-TABLE
 * factory. These actions are the ONLY way the UI mutates report areas: every
 * method is access-guarded (getCrmAccess via the factory) and returns the
 * standard { ok } | { ok:false, error } result.
 *
 * Delete is special: an area slug can be referenced inside
 * crm_report_subscriptions.areas[] (a text[] column), so
 * deleteCrmReportAreaAction strips the deleted slug from every subscription's
 * areas array FIRST (the factory's reassign callback — here it scrubs rather than
 * moves, since areas is a set, not a single column). The protected area (Bend,
 * the report engine anchor) is refused. A failed scrub aborts the delete so no
 * subscription is left referencing a removed area.
 *
 * Reads come from the cached DAL (lib/data/crm/getCrmReportAreas); mutations
 * revalidate the admin surfaces so the cache + page refresh.
 */
import { revalidateTag } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { getCrmAccess } from '@/app/actions/crm'
import { makeConfigTable, type ConfigResult } from '@/lib/crm/config-table'

const AREAS = makeConfigTable({
  table: 'crm_report_areas',
  revalidatePaths: ['/admin/crm', '/admin/crm/settings'],
})

/** Drop the cached getCrmReportAreas result after any mutation. */
function bustAreaCache() {
  revalidateTag('crm-report-areas', 'max')
}

export async function createCrmReportAreaAction(formData: FormData): Promise<ConfigResult> {
  const label = String(formData.get('label') ?? '').trim()
  // The key is the geo slug a crm_report_subscriptions.areas[] entry matches.
  // Default it to the label (matches the seed convention) unless one is supplied.
  const key = String(formData.get('key') ?? label).trim()
  if (!label) return { ok: false, error: 'Label is required' }
  const res = await AREAS.create({ key, label })
  if (res.ok) bustAreaCache()
  return res
}

export async function renameCrmReportAreaAction(formData: FormData): Promise<ConfigResult> {
  const id = Number(formData.get('id'))
  const label = String(formData.get('label') ?? '').trim()
  if (!id || !label) return { ok: false, error: 'Area and label are required' }
  const res = await AREAS.rename(id, label)
  if (res.ok) bustAreaCache()
  return res
}

export async function reorderCrmReportAreasAction(orderedIds: number[]): Promise<ConfigResult> {
  if (!Array.isArray(orderedIds) || orderedIds.some((n) => !Number.isFinite(n))) {
    return { ok: false, error: 'Bad order' }
  }
  const res = await AREAS.reorder(orderedIds)
  if (res.ok) bustAreaCache()
  return res
}

export async function setCrmReportAreaActiveAction(formData: FormData): Promise<ConfigResult> {
  const id = Number(formData.get('id'))
  const isActive = String(formData.get('isActive') ?? '') === '1'
  if (!id) return { ok: false, error: 'Area required' }
  const res = await AREAS.setActive(id, isActive)
  if (res.ok) bustAreaCache()
  return res
}

/**
 * Delete an area, scrubbing the deleted slug from every crm_report_subscriptions
 * row that references it FIRST. Unlike a stage/segment (a single column), an area
 * lives inside the areas text[] set, so the reassign callback removes just that
 * element from each affected row's array (read-modify-write per affected row).
 *
 * The factory refuses a protected area (Bend). A failed scrub aborts the delete
 * so no subscription is left pointing at a removed area.
 */
export async function deleteCrmReportAreaAction(formData: FormData): Promise<ConfigResult> {
  const id = Number(formData.get('id'))
  if (!id) return { ok: false, error: 'Area required' }

  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }
  const sb = createServiceClient()

  const res = await AREAS.remove(id, async (deleted) => {
    // Find every subscription whose areas[] contains the deleted slug.
    const { data: affected, error: readErr } = await sb
      .from('crm_report_subscriptions')
      .select('id,areas')
      .contains('areas', [deleted.key])
    if (readErr) return { ok: false, error: `Could not scan subscriptions: ${readErr.message}` }

    for (const row of (affected ?? []) as Array<{ id: number; areas: string[] | null }>) {
      const nextAreas = (Array.isArray(row.areas) ? row.areas : []).filter((a) => a !== deleted.key)
      const { error: writeErr } = await sb
        .from('crm_report_subscriptions')
        .update({ areas: nextAreas, updated_at: new Date().toISOString() })
        .eq('id', row.id)
      if (writeErr) return { ok: false, error: `Could not update subscriptions: ${writeErr.message}` }
    }
    return { ok: true }
  })
  if (res.ok) bustAreaCache()
  return res
}

/** Read passthrough so a settings surface can list areas from one import. */
export async function listCrmReportAreasAction() {
  const access = await getCrmAccess()
  if (!access) return []
  return AREAS.list()
}
